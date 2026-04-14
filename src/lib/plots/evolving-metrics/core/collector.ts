/**
 * Single-pass binned fixation collector for evolving metrics.
 * Walks segments once per participant, attributing fixation count and duration
 * to every time bin the fixation overlaps — with its full (uncropped) duration.
 */
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { SEGMENT_STRIDE, SegmentField } from '$lib/data/types'
import { FIXATION_CATEGORY_ID } from '../const'

export interface ParticipantBinnedFixations {
  /** Sum of fixation durations per bin [binCount] */
  fixationDurationSum: Float32Array
  /** Number of fixations per bin [binCount] */
  fixationCount: Float32Array
}

/**
 * Collects binned fixation metrics for a single participant on a stimulus.
 * A fixation is included in every bin it overlaps — with its full (uncropped)
 * duration. E.g. a 300 ms fixation spanning 3 bins appears in all 3.
 */
export function collectParticipantBinnedFixations(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  binCount: number,
  stepSize: number,
  timelineMin: number
): ParticipantBinnedFixations {
  const reader = engine.getReader()
  if (!reader) {
    return {
      fixationDurationSum: new Float32Array(binCount),
      fixationCount: new Float32Array(binCount),
    }
  }

  const buffers = reader.getBuffers()
  const { segmentBuffer } = buffers

  const fixationDurationSum = new Float32Array(binCount)
  const fixationCount = new Float32Array(binCount)

  const { startIndex, endIndex } = reader.getSegmentRange(
    stimulusId,
    participantId
  )

  const invStepSize = 1 / stepSize

  for (let segIdx = startIndex; segIdx < endIndex; segIdx++) {
    const base = segIdx * SEGMENT_STRIDE

    // Only fixations
    if (
      (segmentBuffer[base + SegmentField.CATEGORY_ID] | 0) !==
      FIXATION_CATEGORY_ID
    )
      continue

    const start = segmentBuffer[base + SegmentField.START_TIME]
    const end = segmentBuffer[base + SegmentField.END_TIME]
    if (end <= start) continue

    const duration = end - start
    const adjustedStart = start - timelineMin
    const adjustedEnd = end - timelineMin

    // Every bin the fixation overlaps gets the full duration
    const firstBin = Math.max(0, (adjustedStart * invStepSize) | 0)
    const lastBin = Math.min(
      binCount - 1,
      ((adjustedEnd * invStepSize - 1e-6) | 0)
    )

    for (let bin = firstBin; bin <= lastBin; bin++) {
      fixationDurationSum[bin] += duration
      fixationCount[bin] += 1
    }
  }

  return { fixationDurationSum, fixationCount }
}
