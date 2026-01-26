import {
  type BinarySegmentBuffers,
  SEGMENT_STRIDE,
  SegmentField,
} from './schema'
import { BinaryBufferReader } from './reader'

/**
 * Convert legacy JSON segments (number[][][][]) to binary buffers.
 */
export function jsonSegmentsToBinary(
  segments: number[][][][],
  groupMap?: Uint16Array
): BinarySegmentBuffers {
  const stimuliCount = segments.length
  if (stimuliCount === 0) {
    return {
      segmentBuffer: new Float32Array(0),
      indexTable: new Uint32Array(0),
      aoiPool: new Uint16Array(0),
      maxParticipants: 0,
      stimuliCount: 0,
    }
  }

  let maxParticipants = 0
  for (let s = 0; s < stimuliCount; s++) {
    maxParticipants = Math.max(maxParticipants, segments[s]?.length ?? 0)
  }

  let totalSegments = 0
  let totalAois = 0

  for (let s = 0; s < stimuliCount; s++) {
    const stimulus = segments[s] ?? []
    for (let p = 0; p < stimulus.length; p++) {
      const participantSegments = stimulus[p] ?? []
      totalSegments += participantSegments.length

      for (const segment of participantSegments) {
        const aoiCount = Math.max(0, segment.length - 3)
        totalAois += aoiCount
      }
    }
  }

  const segmentBuffer = new Float32Array(totalSegments * SEGMENT_STRIDE)
  const indexTable = new Uint32Array(stimuliCount * maxParticipants * 2)
  const aoiPool = new Uint16Array(totalAois)

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

        segmentBuffer[base + SegmentField.START_TIME] = segment[0]
        segmentBuffer[base + SegmentField.END_TIME] = segment[1]
        segmentBuffer[base + SegmentField.CATEGORY_ID] = segment[2]

        const aoiCount = Math.max(0, segment.length - 3)
        segmentBuffer[base + SegmentField.AOI_COUNT] = aoiCount
        segmentBuffer[base + SegmentField.AOI_POINTER] = aoiPoolIndex
        segmentBuffer[base + SegmentField.SEGMENT_ID] = i

        for (let j = 0; j < aoiCount; j++) {
          aoiPool[aoiPoolIndex++] = segment[3 + j]
        }

        segmentIndex++
      }

      indexTable[indexTableIdx] = startSegmentIndex
      indexTable[indexTableIdx + 1] = segmentIndex
    }
  }

  return {
    segmentBuffer,
    indexTable,
    aoiPool,
    maxParticipants,
    stimuliCount,
  }
}

/**
 * Convert binary buffers back to legacy JSON segments format.
 */
export function binarySegmentsToJson(
  buffers: BinarySegmentBuffers
): number[][][][] {
  const { stimuliCount, maxParticipants, segmentBuffer, indexTable, aoiPool } =
    buffers

  const segments: number[][][][] = []

  for (let s = 0; s < stimuliCount; s++) {
    const stimulus: number[][][] = []

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

        const segment: number[] = [startTime, endTime, categoryId]

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
 */
export function createReaderFromJson(
  segments: number[][][][]
): BinaryBufferReader {
  const buffers = jsonSegmentsToBinary(segments)
  return new BinaryBufferReader(buffers)
}

/**
 * Validate roundtrip conversion: JSON → binary → JSON should be identical.
 */
export function validateRoundtrip(original: number[][][][]): boolean {
  const buffers = jsonSegmentsToBinary(original)
  const converted = binarySegmentsToJson(buffers)

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
          if (Math.abs(origSegment[j] - convSegment[j]) > 1e-10) {
            return false
          }
        }
      }
    }
  }

  return true
}
