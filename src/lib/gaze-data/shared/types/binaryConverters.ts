/**
 * Bidirectional converters between legacy JSON segment format and binary buffers.
 *
 * These utilities ensure perfect roundtrip compatibility:
 * JSON → binary → JSON must produce identical results.
 */

import {
  BinaryBufferReader,
  type BinarySegmentBuffers,
  MAX_AOI_PER_STIMULUS,
  SEGMENT_STRIDE,
  SegmentField,
} from './binaryDataTypes'

/**
 * Convert legacy JSON segments (number[][][][]) to binary buffers.
 *
 * @param segments - Nested array format: [stimulus][participant][segmentIndex] = [start, end, category, ...aoiIds]
 * @param groupMap - Optional grouping map (if not provided, identity mapping is used)
 * @returns Binary segment buffers ready for use
 */
export function jsonSegmentsToBinary(
  segments: number[][][][],
  groupMap?: Uint16Array
): BinarySegmentBuffers {
  const stimuliCount = segments.length
  if (stimuliCount === 0) {
    // Empty dataset
    return {
      segmentBuffer: new Float32Array(0),
      indexTable: new Uint32Array(0),
      aoiPool: new Uint16Array(0),
      groupMap: groupMap ?? new Uint16Array(0),
      maxParticipants: 0,
      stimuliCount: 0,
    }
  }

  // Determine max participants across all stimuli
  let maxParticipants = 0
  for (let s = 0; s < stimuliCount; s++) {
    maxParticipants = Math.max(maxParticipants, segments[s]?.length ?? 0)
  }

  // First pass: count total segments and AOIs
  let totalSegments = 0
  let totalAois = 0

  for (let s = 0; s < stimuliCount; s++) {
    const stimulus = segments[s] ?? []
    for (let p = 0; p < stimulus.length; p++) {
      const participantSegments = stimulus[p] ?? []
      totalSegments += participantSegments.length

      for (const segment of participantSegments) {
        // AOI IDs are everything after the first 3 elements [start, end, category]
        const aoiCount = Math.max(0, segment.length - 3)
        totalAois += aoiCount
      }
    }
  }

  // Allocate buffers
  const segmentBuffer = new Float32Array(totalSegments * SEGMENT_STRIDE)
  const indexTable = new Uint32Array(stimuliCount * maxParticipants * 2)
  const aoiPool = new Uint16Array(totalAois)

  // Initialize groupMap if not provided (identity mapping)
  const finalGroupMap =
    groupMap ??
    new Uint16Array(stimuliCount * MAX_AOI_PER_STIMULUS).fill(0xffff)

  // Second pass: populate buffers
  let segmentIndex = 0
  let aoiPoolIndex = 0

  for (let s = 0; s < stimuliCount; s++) {
    const stimulus = segments[s] ?? []

    for (let p = 0; p < maxParticipants; p++) {
      const indexTableIdx = (s * maxParticipants + p) * 2
      const startSegmentIndex = segmentIndex

      const participantSegments = stimulus[p] ?? []

      for (let i = 0; i < participantSegments.length; i++) {
        const segment = participantSegments[i]
        const base = segmentIndex * SEGMENT_STRIDE

        // Write segment fields
        segmentBuffer[base + SegmentField.START_TIME] = segment[0]
        segmentBuffer[base + SegmentField.END_TIME] = segment[1]
        segmentBuffer[base + SegmentField.CATEGORY_ID] = segment[2]

        // AOIs start at index 3
        const aoiCount = Math.max(0, segment.length - 3)
        segmentBuffer[base + SegmentField.AOI_COUNT] = aoiCount
        segmentBuffer[base + SegmentField.AOI_POINTER] = aoiPoolIndex
        segmentBuffer[base + SegmentField.SEGMENT_ID] = i // Segment order within participant

        // Copy AOI IDs to overflow pool
        for (let j = 0; j < aoiCount; j++) {
          aoiPool[aoiPoolIndex++] = segment[3 + j]
        }

        segmentIndex++
      }

      // Update index table
      indexTable[indexTableIdx] = startSegmentIndex
      indexTable[indexTableIdx + 1] = segmentIndex
    }
  }

  return {
    segmentBuffer,
    indexTable,
    aoiPool,
    groupMap: finalGroupMap,
    maxParticipants,
    stimuliCount,
  }
}

/**
 * Convert binary buffers back to legacy JSON segments format.
 *
 * This must produce identical output to the original JSON for perfect roundtrip.
 *
 * @param buffers - Binary segment buffers
 * @returns Nested array format: [stimulus][participant][segmentIndex] = [start, end, category, ...aoiIds]
 */
export function binarySegmentsToJson(
  buffers: BinarySegmentBuffers
): number[][][][] {
  const { stimuliCount, maxParticipants, segmentBuffer, indexTable, aoiPool } =
    buffers

  // Initialize nested array structure
  const segments: number[][][][] = []

  for (let s = 0; s < stimuliCount; s++) {
    const stimulus: number[][][] = []

    // Create participant arrays for all participants up to maxParticipants
    // This ensures empty participant arrays are preserved in the roundtrip
    for (let p = 0; p < maxParticipants; p++) {
      const indexTableIdx = (s * maxParticipants + p) * 2
      const startIndex = indexTable[indexTableIdx]
      const endIndex = indexTable[indexTableIdx + 1]

      const participantSegments: number[][] = []

      for (let i = startIndex; i < endIndex; i++) {
        const base = i * SEGMENT_STRIDE

        const startTime = segmentBuffer[base + SegmentField.START_TIME]
        const endTime = segmentBuffer[base + SegmentField.END_TIME]
        const categoryId = segmentBuffer[base + SegmentField.CATEGORY_ID]
        const aoiCount = segmentBuffer[base + SegmentField.AOI_COUNT] | 0
        const aoiPointer = segmentBuffer[base + SegmentField.AOI_POINTER] | 0

        // Build segment array: [start, end, category, ...aoiIds]
        const segment: number[] = [startTime, endTime, categoryId]

        // Append AOI IDs
        for (let j = 0; j < aoiCount; j++) {
          segment.push(aoiPool[aoiPointer + j])
        }

        participantSegments.push(segment)
      }

      stimulus.push(participantSegments)
    }

    segments.push(stimulus)
  }

  return segments
}

/**
 * Create a BinaryBufferReader from legacy JSON segments.
 * Convenience method that combines conversion and reader creation.
 */
export function createReaderFromJson(
  segments: number[][][][],
  groupMap?: Uint16Array
): BinaryBufferReader {
  const buffers = jsonSegmentsToBinary(segments, groupMap)
  return new BinaryBufferReader(buffers)
}

/**
 * Validate roundtrip conversion: JSON → binary → JSON should be identical.
 * Used for testing and validation.
 *
 * @param original - Original JSON segments
 * @returns true if roundtrip is perfect, false otherwise
 */
export function validateRoundtrip(original: number[][][][]): boolean {
  const buffers = jsonSegmentsToBinary(original)
  const converted = binarySegmentsToJson(buffers)

  // Deep equality check
  if (original.length !== converted.length) return false

  for (let s = 0; s < original.length; s++) {
    const origStimulus = original[s] ?? []
    const convStimulus = converted[s] ?? []

    if (origStimulus.length !== convStimulus.length) return false

    for (let p = 0; p < origStimulus.length; p++) {
      const origParticipant = origStimulus[p] ?? []
      const convParticipant = convStimulus[p] ?? []

      if (origParticipant.length !== convParticipant.length) return false

      for (let i = 0; i < origParticipant.length; i++) {
        const origSegment = origParticipant[i]
        const convSegment = convParticipant[i]

        if (origSegment.length !== convSegment.length) return false

        for (let j = 0; j < origSegment.length; j++) {
          // Use approximate equality for floats
          if (Math.abs(origSegment[j] - convSegment[j]) > 1e-10) {
            return false
          }
        }
      }
    }
  }

  return true
}
