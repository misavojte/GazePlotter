import {
  getAois,
  getData,
  getParticipantsIds,
  getParticipantEndTime,
  getHiddenAois,
  getAoiOrderVector,
} from '$lib/gaze-data/front-process/stores/dataStore'
import {
  BinaryBufferReader,
  SEGMENT_STRIDE,
  SegmentField,
} from '$lib/gaze-data/shared/types'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import type { AoiStreamPlotResult, AoiStreamPlotSeries } from '../types'
import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'
import { engine } from '$lib/gaze-data/front-process/stores/dataStore.svelte'

import {
  DEFAULT_BIN_COUNT,
  END_BIN_EPSILON,
  FIXATION_CATEGORY_ID,
} from '../const'

export function getAoiStreamPlotData(
  settings: Pick<
    AoiStreamPlotGridType,
    'stimulusId' | 'groupId' | 'binCount'
  > & {
    timelineMin?: number
    timelineMax?: number
  }
): AoiStreamPlotResult {
  const data = getData()
  const stimulusId = settings.stimulusId
  const groupId = settings.groupId

  const aois = getAois(stimulusId)
  const orderVector = getAoiOrderVector(stimulusId)
  const aoiById = new Map(aois.map(aoi => [aoi.id, aoi]))
  const orderedAois = orderVector
    .map(id => aoiById.get(id))
    .filter((aoi): aoi is (typeof aois)[number] => Boolean(aoi))

  const participantIds = getParticipantsIds(groupId, stimulusId)

  const maxTime = participantIds.reduce(
    (max, participantId) =>
      Math.max(max, getParticipantEndTime(stimulusId, participantId)),
    0
  )

  const timelineMin = settings.timelineMin ?? 0
  const timelineMax = settings.timelineMax ?? maxTime
  const safeMaxTime = Math.max(1, timelineMax - timelineMin)
  const binCount = Math.max(1, settings.binCount ?? DEFAULT_BIN_COUNT)
  const binSize = safeMaxTime / binCount

  const noAoiTreatment = data.noAoiTreatment

  const seriesMeta: Array<Omit<AoiStreamPlotSeries, 'values'>> = [
    ...orderedAois.map(aoi => ({
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

  const reader = new BinaryBufferReader(data.segments)
  const buffers = reader.getBuffers()
  const segmentBuffer = buffers.segmentBuffer
  const aoiPool = buffers.aoiPool

  const hidden = getHiddenAois(stimulusId)
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null

  const aoiIndexById = new Map<number, number>()
  for (let i = 0; i < orderedAois.length; i++) {
    aoiIndexById.set(orderedAois[i].id, i)
  }
  const seriesCount = seriesMeta.length
  const noAoiIndex = seriesCount - 1

  const invBinSize = 1 / binSize

  const computeSeriesForParticipants = (participantIds: number[]) => {
    const diffs = new Array<Float32Array>(seriesCount)
    const partials = new Array<Float32Array>(seriesCount)
    for (let i = 0; i < seriesCount; i++) {
      diffs[i] = new Float32Array(binCount + 1)
      partials[i] = new Float32Array(binCount)
    }

    const seenStamp = new Int32Array(seriesCount)
    let stamp = 1

    for (let p = 0; p < participantIds.length; p++) {
      const participantId = participantIds[p]
      const range = reader.getSegmentRange(stimulusId, participantId)

      for (
        let segmentIndex = range.startIndex;
        segmentIndex < range.endIndex;
        segmentIndex++
      ) {
        const base = segmentIndex * SEGMENT_STRIDE
        const categoryId = segmentBuffer[base + SegmentField.CATEGORY_ID] | 0
        if (categoryId !== FIXATION_CATEGORY_ID) continue

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
          for (let i = 0; i < aoiCount; i++) {
            const rawId = aoiPool[ptr + i]
            if (hiddenSet && hiddenSet.has(rawId)) continue

            const groupId = engine.getAoiMapping(stimulusId, rawId)
            const seriesIndex = aoiIndexById.get(groupId)
            if (seriesIndex == null) continue
            if (seenStamp[seriesIndex] === stamp) continue
            seenStamp[seriesIndex] = stamp
            hasAnyAoi = true

            const adjustedStart = Math.max(0, start - timelineMin)
            const adjustedEnd = Math.min(
              safeMaxTime,
              Math.max(0, end - timelineMin)
            )
            if (adjustedEnd <= adjustedStart) continue

            const startBin = Math.max(
              0,
              Math.min(binCount - 1, Math.floor(adjustedStart * invBinSize))
            )
            let endBin = Math.min(
              binCount - 1,
              Math.floor((adjustedEnd - END_BIN_EPSILON) * invBinSize)
            )
            if (endBin < startBin) endBin = startBin

            if (startBin === endBin) {
              const overlap = adjustedEnd - adjustedStart
              if (overlap > 0) {
                partials[seriesIndex][startBin] += overlap * invBinSize
              }
            } else {
              const startBinStart = startBin * binSize
              const endBinStart = endBin * binSize
              const startOverlap = startBinStart + binSize - adjustedStart
              const endOverlap = adjustedEnd - endBinStart

              if (startOverlap > 0) {
                partials[seriesIndex][startBin] += startOverlap * invBinSize
              }
              if (endOverlap > 0) {
                partials[seriesIndex][endBin] += endOverlap * invBinSize
              }

              const fullStart = startBin + 1
              const fullEnd = endBin - 1
              if (fullStart <= fullEnd) {
                diffs[seriesIndex][fullStart] += 1
                diffs[seriesIndex][fullEnd + 1] -= 1
              }
            }
          }
        }

        if (!hasAnyAoi) {
          const adjustedStart = Math.max(0, start - timelineMin)
          const adjustedEnd = Math.min(
            safeMaxTime,
            Math.max(0, end - timelineMin)
          )
          if (adjustedEnd <= adjustedStart) continue

          const startBin = Math.max(
            0,
            Math.min(binCount - 1, Math.floor(adjustedStart * invBinSize))
          )
          let endBin = Math.min(
            binCount - 1,
            Math.floor((adjustedEnd - END_BIN_EPSILON) * invBinSize)
          )
          if (endBin < startBin) endBin = startBin

          if (startBin === endBin) {
            const overlap = adjustedEnd - adjustedStart
            if (overlap > 0) {
              partials[noAoiIndex][startBin] += overlap * invBinSize
            }
          } else {
            const startBinStart = startBin * binSize
            const endBinStart = endBin * binSize
            const startOverlap = startBinStart + binSize - adjustedStart
            const endOverlap = adjustedEnd - endBinStart

            if (startOverlap > 0) {
              partials[noAoiIndex][startBin] += startOverlap * invBinSize
            }
            if (endOverlap > 0) {
              partials[noAoiIndex][endBin] += endOverlap * invBinSize
            }

            const fullStart = startBin + 1
            const fullEnd = endBin - 1
            if (fullStart <= fullEnd) {
              diffs[noAoiIndex][fullStart] += 1
              diffs[noAoiIndex][fullEnd + 1] -= 1
            }
          }
        }
      }
    }

    const series: AoiStreamPlotSeries[] = new Array(seriesCount)
    let maxTotal = 0

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

    if (seriesCount > 0) {
      for (let i = 0; i < binCount; i++) {
        let total = 0
        for (let s = 0; s < seriesCount; s++) {
          total += series[s].values[i]
        }
        if (total > maxTotal) maxTotal = total
      }
    }

    return { series, maxTotal }
  }

  const result = computeSeriesForParticipants(participantIds)

  return {
    series: result.series,
    timeline: createAdaptiveTimeline(timelineMin, timelineMin + safeMaxTime, 6),
    binCount,
    binSize,
    maxTime: timelineMin + safeMaxTime,
    participants: participantIds.length,
    maxTotal: result.maxTotal,
  }
}
