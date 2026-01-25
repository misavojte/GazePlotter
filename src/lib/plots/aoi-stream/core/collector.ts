/**
 * Optimized single-pass collector for AOI stream data.
 * Extracted from data.ts to separate collection from transformation/view logic.
 */
import { getData, engine } from '$lib/gaze-data/front-process'
import {
  BinaryBufferReader,
  SEGMENT_STRIDE,
  SegmentField,
  type ExtendedInterpretedDataType,
} from '$lib/gaze-data/shared/types'
import { END_BIN_EPSILON, FIXATION_CATEGORY_ID } from '../const'

export interface AoiStreamMetricSeries {
  id: number
  values: Float32Array
}

export interface AoiStreamMetrics {
  series: AoiStreamMetricSeries[]
  maxTotal: number
}

export function collectAoiStreamMetrics(
  stimulusId: number,
  participantIds: number[],
  orderedAois: ExtendedInterpretedDataType[],
  hiddenAoisSet: Set<number> | null,
  binCount: number,
  timelineMin: number,
  timelineMax: number,
  safeMaxTime: number
): AoiStreamMetrics {
  const data = getData()
  const reader = new BinaryBufferReader(data.segments)
  const buffers = reader.getBuffers()
  const segmentBuffer = buffers.segmentBuffer
  const aoiPool = buffers.aoiPool

  // Only mapped AOIs + NoAOI
  const aoiCount = orderedAois.length
  // Map AOI ID -> Series Index
  const aoiIndexById = new Map<number, number>()
  for (let i = 0; i < aoiCount; i++) {
    aoiIndexById.set(orderedAois[i].id, i)
  }

  // Last index is No-AOI
  const noAoiIndex = aoiCount
  const totalSeriesCount = aoiCount + 1

  const invBinSize = binCount / safeMaxTime
  const binSize = safeMaxTime / binCount

  // Initialize accumulators
  const diffs = new Array<Float32Array>(totalSeriesCount)
  const partials = new Array<Float32Array>(totalSeriesCount)
  for (let i = 0; i < totalSeriesCount; i++) {
    diffs[i] = new Float32Array(binCount + 1)
    partials[i] = new Float32Array(binCount)
  }

  const seenStamp = new Int32Array(totalSeriesCount)
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

      const aoiCountInSeg = segmentBuffer[base + SegmentField.AOI_COUNT] | 0
      const ptr = segmentBuffer[base + SegmentField.AOI_POINTER] | 0

      stamp++
      if (stamp === 0x7fffffff) {
        seenStamp.fill(0)
        stamp = 1
      }

      let hasAnyAoi = false

      if (aoiCountInSeg > 0) {
        for (let i = 0; i < aoiCountInSeg; i++) {
          const rawId = aoiPool[ptr + i]
          if (hiddenAoisSet && hiddenAoisSet.has(rawId)) continue

          const groupId = engine.getAoiMapping(stimulusId, rawId)
          const seriesIndex = aoiIndexById.get(groupId)

          if (seriesIndex == null) continue
          if (seenStamp[seriesIndex] === stamp) continue

          seenStamp[seriesIndex] = stamp
          hasAnyAoi = true

          addSegmentToAccumulators(
            partials[seriesIndex],
            diffs[seriesIndex],
            start,
            end,
            timelineMin,
            safeMaxTime,
            invBinSize,
            binSize,
            binCount
          )
        }
      }

      if (!hasAnyAoi) {
        // Add to No-AOI series
        addSegmentToAccumulators(
          partials[noAoiIndex],
          diffs[noAoiIndex],
          start,
          end,
          timelineMin,
          safeMaxTime,
          invBinSize,
          binSize,
          binCount
        )
      }
    }
  }

  // Integrate results into series
  const series: AoiStreamMetricSeries[] = new Array(totalSeriesCount)
  let maxTotal = 0

  for (let s = 0; s < totalSeriesCount; s++) {
    const diff = diffs[s]
    const partial = partials[s]
    const values = new Float32Array(binCount)

    let acc = 0
    for (let i = 0; i < binCount; i++) {
      acc += diff[i]
      values[i] = acc + partial[i]
    }

    // ID is not fully populated here, just values. Transformer will attach metadata.
    // However, we return objects to keep it structured.
    series[s] = {
      id: s === noAoiIndex ? -1 : orderedAois[s].id,
      values,
    }
  }

  if (totalSeriesCount > 0) {
    for (let i = 0; i < binCount; i++) {
      let total = 0
      for (let s = 0; s < totalSeriesCount; s++) {
        total += series[s].values[i]
      }
      if (total > maxTotal) maxTotal = total
    }
  }

  return { series, maxTotal }
}

function addSegmentToAccumulators(
  partial: Float32Array,
  diff: Float32Array,
  start: number,
  end: number,
  timelineMin: number,
  safeMaxTime: number,
  invBinSize: number,
  binSize: number,
  binCount: number
) {
  const adjustedStart = Math.max(0, start - timelineMin)
  const adjustedEnd = Math.min(safeMaxTime, Math.max(0, end - timelineMin))
  if (adjustedEnd <= adjustedStart) return

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
      partial[startBin] += overlap * invBinSize
    }
  } else {
    const startBinStart = startBin * binSize
    const endBinStart = endBin * binSize
    const startOverlap = startBinStart + binSize - adjustedStart
    const endOverlap = adjustedEnd - endBinStart

    if (startOverlap > 0) {
      partial[startBin] += startOverlap * invBinSize
    }
    if (endOverlap > 0) {
      partial[endBin] += endOverlap * invBinSize
    }

    const fullStart = startBin + 1
    const fullEnd = endBin - 1
    if (fullStart <= fullEnd) {
      diff[fullStart] += 1
      diff[fullEnd + 1] -= 1
    }
  }
}
