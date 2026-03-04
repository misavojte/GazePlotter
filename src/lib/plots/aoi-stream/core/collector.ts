/**
 * Optimized single-pass collector for AOI stream data.
 * Adheres to senior FP principles: Buffer recycling, zero per-frame allocations, and flat control flow.
 */
import { engine, getAllAois } from '$lib/data/engine'
import {
  SEGMENT_STRIDE,
  SegmentField,
  type ExtendedInterpretedDataType,
} from '$lib/data/types'
import { END_BIN_EPSILON, FIXATION_CATEGORY_ID } from '../const'

export interface AoiStreamMetricSeries {
  id: number
  values: Float32Array
}

export interface AoiStreamMetrics {
  series: AoiStreamMetricSeries[]
  maxTotal: number
}

/**
 * Workspace to persist allocations across calls.
 */
export interface CollectorWorkspace {
  binCount: number
  seriesCount: number
  // Flat buffers for diffs and partials (seriesCount * (binCount + 1))
  diffBuffer: Float32Array
  partialBuffer: Float32Array
  // Output values (seriesCount * binCount)
  valueBuffer: Float32Array
  // Lookup: rawAoiId -> groupIndex (for stimulusId context)
  aoiLookup: Int32Array
  // Stamp buffer for de-duplication
  seenStamp: Int32Array
  currentStamp: number
  // Stored for validation/reuse
  stimulusId: number
}

function ensureWorkspace(
  workspace: CollectorWorkspace | null,
  binCount: number,
  seriesCount: number,
  stimulusId: number,
  aoiMaxId: number
): CollectorWorkspace {
  const needsRealloc =
    !workspace ||
    workspace.binCount !== binCount ||
    workspace.seriesCount !== seriesCount ||
    workspace.aoiLookup.length <= aoiMaxId

  if (needsRealloc) {
    return {
      binCount,
      seriesCount,
      diffBuffer: new Float32Array(seriesCount * (binCount + 1)),
      partialBuffer: new Float32Array(seriesCount * binCount),
      valueBuffer: new Float32Array(seriesCount * binCount),
      aoiLookup: new Int32Array(aoiMaxId + 1).fill(-1),
      seenStamp: new Int32Array(seriesCount),
      currentStamp: 1,
      stimulusId,
    }
  }

  // Clear transient buffers for fresh pass
  workspace.diffBuffer.fill(0)
  workspace.partialBuffer.fill(0)
  workspace.seenStamp.fill(0)
  workspace.currentStamp = 1
  workspace.stimulusId = stimulusId

  return workspace
}

export function collectAoiStreamMetrics(
  stimulusId: number,
  participantIds: number[],
  orderedAois: ExtendedInterpretedDataType[],
  hiddenAoisSet: Set<number> | null,
  binCount: number,
  timelineMin: number,
  safeMaxTime: number,
  existingWorkspace: CollectorWorkspace | null
): { metrics: AoiStreamMetrics; workspace: CollectorWorkspace } {
  const reader = engine.getReader()
  if (!reader) {
    const emptyMetrics = { series: [], maxTotal: 0 }
    // We still return a workspace if possible, or null.
    // For simplicity here, if no reader, we just return empty.
    throw new Error('Data reader not available')
  }

  const buffers = reader.getBuffers()
  const { segmentBuffer, aoiPool } = buffers
  const aoiCount = orderedAois.length
  const noAoiIndex = aoiCount
  const totalSeriesCount = aoiCount + 1

  // Find max AOI ID to size the lookup table
  const aoiIdsInStimulus = getAllAois(stimulusId)
  let aoiMaxId = 0
  for (let i = 0; i < aoiIdsInStimulus.length; i++) {
    if (aoiIdsInStimulus[i].id > aoiMaxId) aoiMaxId = aoiIdsInStimulus[i].id
  }
  for (let i = 0; i < aoiCount; i++) {
    if (orderedAois[i].id > aoiMaxId) aoiMaxId = orderedAois[i].id
  }

  const workspace = ensureWorkspace(
    existingWorkspace,
    binCount,
    totalSeriesCount,
    stimulusId,
    aoiMaxId
  )

  const {
    aoiLookup,
    diffBuffer,
    partialBuffer,
    seenStamp,
    binCount: wsBinCount,
  } = workspace
  let { currentStamp } = workspace

  // Hot path optimization: Use flat array for AOI mapping instead of Map
  aoiLookup.fill(-1)
  for (let i = 0; i < aoiIdsInStimulus.length; i++) {
    const rawId = aoiIdsInStimulus[i].id
    if (hiddenAoisSet && hiddenAoisSet.has(rawId)) continue
    const groupId = engine.getAoiMapping(stimulusId, rawId)

    // Find if this groupId is in our ordered selection
    for (let j = 0; j < aoiCount; j++) {
      if (orderedAois[j].id === groupId) {
        if (rawId < aoiLookup.length) aoiLookup[rawId] = j
        break
      }
    }
  }

  const invBinSize = binCount / safeMaxTime
  const binSize = safeMaxTime / binCount

  for (let p = 0; p < participantIds.length; p++) {
    const participantId = participantIds[p]
    const { startIndex, endIndex } = reader.getSegmentRange(
      stimulusId,
      participantId
    )

    for (let segIdx = startIndex; segIdx < endIndex; segIdx++) {
      const base = segIdx * SEGMENT_STRIDE
      if (
        (segmentBuffer[base + SegmentField.CATEGORY_ID] | 0) !==
        FIXATION_CATEGORY_ID
      )
        continue

      const start = segmentBuffer[base + SegmentField.START_TIME]
      const end = segmentBuffer[base + SegmentField.END_TIME]
      if (end <= start) continue

      const aoiCountInSeg = segmentBuffer[base + SegmentField.AOI_COUNT] | 0
      const ptr = segmentBuffer[base + SegmentField.AOI_POINTER] | 0

      currentStamp++
      if (currentStamp === 0x7fffffff) {
        seenStamp.fill(0)
        currentStamp = 1
      }

      let hasAnyAoi = false
      if (aoiCountInSeg > 0) {
        for (let i = 0; i < aoiCountInSeg; i++) {
          const rawId = aoiPool[ptr + i]
          const seriesIndex = aoiLookup[rawId]
          if (seriesIndex === -1 || seenStamp[seriesIndex] === currentStamp)
            continue

          seenStamp[seriesIndex] = currentStamp
          hasAnyAoi = true

          addSegmentToAccumulators(
            partialBuffer,
            diffBuffer,
            seriesIndex,
            binCount,
            start,
            end,
            timelineMin,
            safeMaxTime,
            invBinSize,
            binSize
          )
        }
      }

      if (!hasAnyAoi) {
        addSegmentToAccumulators(
          partialBuffer,
          diffBuffer,
          noAoiIndex,
          binCount,
          start,
          end,
          timelineMin,
          safeMaxTime,
          invBinSize,
          binSize
        )
      }
    }
  }

  // Update workspace stamp
  workspace.currentStamp = currentStamp

  // Integration pass: seriesCount * binCount
  const { valueBuffer } = workspace
  const series: AoiStreamMetricSeries[] = new Array(totalSeriesCount)
  let maxTotal = 0

  for (let s = 0; s < totalSeriesCount; s++) {
    const diffOffset = s * (binCount + 1)
    const partOffset = s * binCount
    const valOffset = s * binCount

    let acc = 0
    for (let i = 0; i < binCount; i++) {
      acc += diffBuffer[diffOffset + i]
      valueBuffer[valOffset + i] = acc + partialBuffer[partOffset + i]
    }

    series[s] = {
      id: s === noAoiIndex ? -1 : orderedAois[s].id,
      values: valueBuffer.subarray(valOffset, valOffset + binCount),
    }
  }

  // Global max pass (could be merged with integration if needed)
  for (let i = 0; i < binCount; i++) {
    let total = 0
    for (let s = 0; s < totalSeriesCount; s++) {
      total += valueBuffer[s * binCount + i]
    }
    if (total > maxTotal) maxTotal = total
  }

  return { metrics: { series, maxTotal }, workspace }
}

function addSegmentToAccumulators(
  partialBuf: Float32Array,
  diffBuf: Float32Array,
  seriesIndex: number,
  binCount: number,
  start: number,
  end: number,
  timelineMin: number,
  safeMaxTime: number,
  invBinSize: number,
  binSize: number
) {
  const adjustedStart = Math.max(0, start - timelineMin)
  const adjustedEnd = Math.min(safeMaxTime, Math.max(0, end - timelineMin))
  if (adjustedEnd <= adjustedStart) return

  const startBin = Math.floor(adjustedStart * invBinSize)
  const endBin = Math.floor((adjustedEnd - END_BIN_EPSILON) * invBinSize)

  const partOffset = seriesIndex * binCount
  const diffOffset = seriesIndex * (binCount + 1)

  if (startBin === endBin) {
    if (startBin >= 0 && startBin < binCount) {
      partialBuf[partOffset + startBin] +=
        (adjustedEnd - adjustedStart) * invBinSize
    }
  } else {
    // Clamp bins
    const sBin = Math.max(0, startBin)
    const eBin = Math.min(binCount - 1, endBin)

    if (sBin === startBin) {
      const startOverlap = (startBin + 1) * binSize - adjustedStart
      partialBuf[partOffset + sBin] += startOverlap * invBinSize
    }
    if (eBin === endBin) {
      const endOverlap = adjustedEnd - endBin * binSize
      partialBuf[partOffset + eBin] += endOverlap * invBinSize
    }

    const fullStart = sBin + (sBin === startBin ? 1 : 0)
    const fullEnd = eBin - (eBin === endBin ? 1 : 0)
    if (fullStart <= fullEnd) {
      diffBuf[diffOffset + fullStart] += 1
      diffBuf[diffOffset + fullEnd + 1] -= 1
    }
  }
}
