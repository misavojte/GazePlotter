import {
  getAois,
  getData,
  getParticipantsIds,
  getParticipantEndTime,
  getHiddenAois,
} from '$lib/gaze-data/front-process/stores/dataStore'
import {
  BinaryBufferReader,
  SEGMENT_STRIDE,
  SegmentField,
  MAX_AOI_PER_STIMULUS,
} from '$lib/gaze-data/shared/types'
import { AdaptiveTimeline } from '$lib/plots/shared/class/AdaptiveTimeline'
import type { AoiStreamPlotResult, AoiStreamPlotSeries } from '../types'
import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'

const DEFAULT_BIN_COUNT = 200
const END_BIN_EPSILON = 1e-6

export function getAoiStreamPlotData(
  settings: Pick<AoiStreamPlotGridType, 'stimulusId' | 'groupId' | 'binCount'>
): AoiStreamPlotResult {
  const data = getData()
  const stimulusId = settings.stimulusId
  const groupId = settings.groupId

  const aois = getAois(stimulusId)
  const participantIds = getParticipantsIds(groupId, stimulusId)

  const maxParticipants = participantIds.length
  const maxTime = participantIds.reduce(
    (max, participantId) =>
      Math.max(max, getParticipantEndTime(stimulusId, participantId)),
    0
  )

  const safeMaxTime = maxTime > 0 ? maxTime : 1
  const binCount = Math.max(1, settings.binCount ?? DEFAULT_BIN_COUNT)
  const binSize = safeMaxTime / binCount

  const noAoiTreatment = data.noAoiTreatment

  const seriesMeta: Array<Omit<AoiStreamPlotSeries, 'values'>> = [
    ...aois.map(aoi => ({
      id: aoi.id,
      label: aoi.displayedName || aoi.originalName,
      color: aoi.color,
    })),
    {
      id: -1,
      label: noAoiTreatment.displayedName,
      color: noAoiTreatment.color,
    },
  ]

  const seriesCount = seriesMeta.length
  const diffs = new Array<Float32Array>(seriesCount)
  const partials = new Array<Float32Array>(seriesCount)
  for (let i = 0; i < seriesCount; i++) {
    diffs[i] = new Float32Array(binCount + 1)
    partials[i] = new Float32Array(binCount)
  }

  const aoiIndexById = new Map<number, number>()
  for (let i = 0; i < aois.length; i++) {
    aoiIndexById.set(aois[i].id, i)
  }
  const noAoiIndex = seriesCount - 1

  const reader = new BinaryBufferReader(data.segments)
  const buffers = reader.getBuffers()
  const segmentBuffer = buffers.segmentBuffer
  const aoiPool = buffers.aoiPool
  const groupMap = buffers.groupMap

  const hidden = getHiddenAois(stimulusId)
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null

  const seenStamp = new Int32Array(seriesCount)
  let stamp = 1

  const addContribution = (seriesIndex: number, start: number, end: number) => {
    if (end <= start) return

    const startBin = Math.max(
      0,
      Math.min(binCount - 1, Math.floor(start / binSize))
    )
    let endBin = Math.min(
      binCount - 1,
      Math.floor((end - END_BIN_EPSILON) / binSize)
    )
    if (endBin < startBin) endBin = startBin

    if (startBin === endBin) {
      const overlap = end - start
      if (overlap > 0) {
        partials[seriesIndex][startBin] += overlap / binSize
      }
      return
    }

    const startBinStart = startBin * binSize
    const endBinStart = endBin * binSize
    const startOverlap = Math.max(0, startBinStart + binSize - start)
    const endOverlap = Math.max(0, end - endBinStart)

    if (startOverlap > 0) {
      partials[seriesIndex][startBin] += startOverlap / binSize
    }
    if (endOverlap > 0) {
      partials[seriesIndex][endBin] += endOverlap / binSize
    }

    const fullStart = startBin + 1
    const fullEnd = endBin - 1
    if (fullStart <= fullEnd) {
      diffs[seriesIndex][fullStart] += 1
      diffs[seriesIndex][fullEnd + 1] -= 1
    }
  }

  for (let p = 0; p < participantIds.length; p++) {
    const participantId = participantIds[p]
    const range = reader.getSegmentRange(stimulusId, participantId)

    for (
      let segmentIndex = range.startIndex;
      segmentIndex < range.endIndex;
      segmentIndex++
    ) {
      const base = segmentIndex * SEGMENT_STRIDE
      const start = segmentBuffer[base + SegmentField.START_TIME]
      const end = segmentBuffer[base + SegmentField.END_TIME]

      if (end <= start) continue

      const aoiCount = segmentBuffer[base + SegmentField.AOI_COUNT] | 0
      const ptr = segmentBuffer[base + SegmentField.AOI_POINTER] | 0

      stamp++
      if (stamp === 0x7fffffff) {
        seenStamp.fill(0)
        stamp = 1
      }

      let hasAnyAoi = false

      if (aoiCount > 0) {
        const mapOffset = stimulusId * MAX_AOI_PER_STIMULUS
        for (let i = 0; i < aoiCount; i++) {
          const rawId = aoiPool[ptr + i]
          if (hiddenSet && hiddenSet.has(rawId)) continue

          const mapped = groupMap[mapOffset + rawId]
          const groupId = mapped === 0xffff ? rawId : mapped
          const seriesIndex = aoiIndexById.get(groupId)

          if (seriesIndex == null) continue
          if (seenStamp[seriesIndex] === stamp) continue

          seenStamp[seriesIndex] = stamp
          hasAnyAoi = true

          addContribution(seriesIndex, start, end)
        }
      }

      if (!hasAnyAoi) {
        addContribution(noAoiIndex, start, end)
      }
    }
  }

  const series: AoiStreamPlotSeries[] = new Array(seriesCount)
  for (let s = 0; s < seriesCount; s++) {
    const diff = diffs[s]
    const partial = partials[s]
    const values = new Float32Array(binCount)
    let acc = 0
    for (let i = 0; i < binCount; i++) {
      acc += diff[i]
      values[i] = acc + partial[i]
    }

    series[s] = {
      ...seriesMeta[s],
      values,
    }
  }

  let maxTotal = 0
  if (seriesCount > 0) {
    for (let i = 0; i < binCount; i++) {
      let total = 0
      for (let s = 0; s < seriesCount; s++) {
        total += series[s].values[i]
      }
      if (total > maxTotal) maxTotal = total
    }
  }

  return {
    series,
    timeline: new AdaptiveTimeline(0, safeMaxTime, 6),
    binCount,
    binSize,
    maxTime: safeMaxTime,
    maxParticipants,
    maxTotal,
  }
}
