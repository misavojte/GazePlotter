import {
  type BinarySegmentBuffers,
  SEGMENT_STRIDE,
  SegmentField,
} from './schema'
import { BinaryBufferReader } from './reader.segment'

type SpatialDataJson = (number[] | null)[][][]

type SegmentsWithSpatialJson = {
  segments: number[][][][]
  spatialData?: SpatialDataJson
}

/**
 * Convert legacy JSON segments (number[][][][]) to binary buffers.
 */
export function jsonSegmentsToBinary(
  segments: number[][][][],
  spatialData?: SpatialDataJson
): BinarySegmentBuffers {
  const stimuliCount = segments.length
  if (stimuliCount === 0) {
    return {
      segmentBuffer: new Float32Array(0),
      indexTable: new Uint32Array(0),
      fixationIndex: new Uint32Array(0),
      fixationIndexTable: new Uint32Array(0),
      aoiPool: new Uint16Array(0),
      hasSpatialData: false,
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
  let totalFixations = 0

  for (let s = 0; s < stimuliCount; s++) {
    const stimulus = segments[s] ?? []
    for (let p = 0; p < stimulus.length; p++) {
      const participantSegments = stimulus[p] ?? []
      totalSegments += participantSegments.length

      for (const segment of participantSegments) {
        const aoiCount = Math.max(0, segment.length - 3)
        totalAois += aoiCount
        if ((segment[2] | 0) === 0) totalFixations++
      }
    }
  }

  const segmentBuffer = new Float32Array(totalSegments * SEGMENT_STRIDE)
  const indexTable = new Uint32Array(stimuliCount * maxParticipants * 2)
  const fixationIndex = new Uint32Array(totalFixations)
  const fixationIndexTable = new Uint32Array(stimuliCount * maxParticipants * 2)
  const aoiPool = new Uint16Array(totalAois)
  const hasSpatialData = spatialData !== undefined
  const spatialBuffer = hasSpatialData
    ? new Float32Array(totalSegments * 2).fill(Number.NaN)
    : undefined

  let segmentIndex = 0
  let aoiPoolIndex = 0
  let fixationCursor = 0

  for (let s = 0; s < stimuliCount; s++) {
    const stimulus = segments[s] ?? []
    const spatialStimulus = spatialData?.[s] ?? []

    for (let p = 0; p < maxParticipants; p++) {
      const indexTableIdx = (s * maxParticipants + p) * 2
      const startSegmentIndex = segmentIndex
      const startFixationCursor = fixationCursor

      const participantSegments = stimulus[p] ?? []
      const participantSpatial = spatialStimulus[p] ?? []

      for (let i = 0; i < participantSegments.length; i++) {
        const segment = participantSegments[i]
        const base = segmentIndex * SEGMENT_STRIDE
        const categoryId = segment[2]

        segmentBuffer[base + SegmentField.START_TIME] = segment[0]
        segmentBuffer[base + SegmentField.END_TIME] = segment[1]
        segmentBuffer[base + SegmentField.CATEGORY_ID] = categoryId

        const aoiCount = Math.max(0, segment.length - 3)
        segmentBuffer[base + SegmentField.AOI_COUNT] = aoiCount
        segmentBuffer[base + SegmentField.AOI_POINTER] = aoiPoolIndex
        segmentBuffer[base + SegmentField.SEGMENT_ID] = i

        for (let j = 0; j < aoiCount; j++) {
          aoiPool[aoiPoolIndex++] = segment[3 + j]
        }

        if (hasSpatialData && spatialBuffer) {
          const coords = participantSpatial[i]
          if (coords && coords.length >= 2) {
            spatialBuffer[segmentIndex * 2] = coords[0]
            spatialBuffer[segmentIndex * 2 + 1] = coords[1]
          }
        }

        if ((categoryId | 0) === 0) {
          fixationIndex[fixationCursor++] = segmentIndex
        }

        segmentIndex++
      }

      indexTable[indexTableIdx] = startSegmentIndex
      indexTable[indexTableIdx + 1] = segmentIndex
      fixationIndexTable[indexTableIdx] = startFixationCursor
      fixationIndexTable[indexTableIdx + 1] = fixationCursor
    }
  }

  return {
    segmentBuffer,
    indexTable,
    fixationIndex,
    fixationIndexTable,
    aoiPool,
    hasSpatialData,
    spatialBuffer,
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
  return binarySegmentsToJsonWithSpatial(buffers).segments
}

/**
 * Convert binary buffers back to legacy JSON segments format with optional spatial data.
 */
export function binarySegmentsToJsonWithSpatial(
  buffers: BinarySegmentBuffers
): SegmentsWithSpatialJson {
  const { stimuliCount, maxParticipants, segmentBuffer, indexTable, aoiPool } =
    buffers
  const hasSpatialData = buffers.hasSpatialData ?? false
  const spatialBuffer = buffers.spatialBuffer

  const segments: number[][][][] = []
  const spatialData: SpatialDataJson = []

  for (let s = 0; s < stimuliCount; s++) {
    const stimulus: number[][][] = []
    const spatialStimulus: (number[] | null)[][] = []

    for (let p = 0; p < maxParticipants; p++) {
      const indexTableIdx = (s * maxParticipants + p) * 2
      const startIndex = indexTable[indexTableIdx]
      const endIndex = indexTable[indexTableIdx + 1]

      const participantSegments: number[][] = []
      const participantSpatial: (number[] | null)[] = []

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

        if (hasSpatialData && spatialBuffer) {
          const spatialBase = i * 2
          const x = spatialBuffer[spatialBase]
          if (Number.isNaN(x)) {
            participantSpatial.push(null)
          } else {
            participantSpatial.push([x, spatialBuffer[spatialBase + 1]])
          }
        }
      }

      stimulus.push(participantSegments)
      if (hasSpatialData) spatialStimulus.push(participantSpatial)
    }

    segments.push(stimulus)
    if (hasSpatialData) spatialData.push(spatialStimulus)
  }

  return {
    segments,
    spatialData: hasSpatialData ? spatialData : undefined,
  }
}

/**
 * Create a BinaryBufferReader from legacy JSON segments.
 */
export function createReaderFromJson(
  segments: number[][][][],
  spatialData?: SpatialDataJson
): BinaryBufferReader {
  const buffers = jsonSegmentsToBinary(segments, spatialData)
  return new BinaryBufferReader(buffers)
}

/**
 * Validate roundtrip conversion: JSON → binary → JSON should be identical.
 */
export function validateRoundtrip(
  original: number[][][][],
  spatialData?: SpatialDataJson
): boolean {
  const buffers = jsonSegmentsToBinary(original, spatialData)
  const converted = binarySegmentsToJson(buffers)
  const convertedWithSpatial = binarySegmentsToJsonWithSpatial(buffers)

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

  if (spatialData === undefined) {
    return convertedWithSpatial.spatialData === undefined
  }

  const convertedSpatial = convertedWithSpatial.spatialData
  if (!convertedSpatial || convertedSpatial.length !== spatialData.length)
    return false

  for (let s = 0; s < spatialData.length; s++) {
    const origStimulus = spatialData[s] ?? []
    const convStimulus = convertedSpatial[s] ?? []
    if (origStimulus.length !== convStimulus.length) return false

    for (let p = 0; p < origStimulus.length; p++) {
      const origParticipant = origStimulus[p] ?? []
      const convParticipant = convStimulus[p] ?? []
      if (origParticipant.length !== convParticipant.length) return false

      for (let i = 0; i < origParticipant.length; i++) {
        const origCoords = origParticipant[i]
        const convCoords = convParticipant[i]

        if (origCoords === null || convCoords === null) {
          if (origCoords !== convCoords) return false
          continue
        }

        if (
          !origCoords ||
          !convCoords ||
          origCoords.length < 2 ||
          convCoords.length < 2
        ) {
          return false
        }

        if (Math.abs(origCoords[0] - convCoords[0]) > 1e-5) return false
        if (Math.abs(origCoords[1] - convCoords[1]) > 1e-5) return false
      }
    }
  }

  return true
}
