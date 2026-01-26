import {
  type BinarySegmentBuffers,
  SEGMENT_STRIDE,
  SegmentField,
} from './schema'

/**
 * Reader utility for zero-allocation queries on binary segment data.
 * Provides high-level methods to access segment information without
 * creating intermediate objects.
 */
export class BinaryBufferReader {
  private segmentBuffer: Float32Array
  private indexTable: Uint32Array
  private aoiPool: Uint16Array
  private maxParticipants: number
  private stimuliCount: number

  constructor(buffers: BinarySegmentBuffers) {
    this.segmentBuffer = buffers.segmentBuffer
    this.indexTable = buffers.indexTable
    this.aoiPool = buffers.aoiPool
    this.maxParticipants = buffers.maxParticipants
    this.stimuliCount = buffers.stimuliCount
  }

  /**
   * Get the segment range [startIndex, endIndex) for a stimulus and participant.
   */
  getSegmentRange(
    stimulusId: number,
    participantId: number
  ): { startIndex: number; endIndex: number } {
    const idx = (stimulusId * this.maxParticipants + participantId) * 2
    return {
      startIndex: this.indexTable[idx],
      endIndex: this.indexTable[idx + 1],
    }
  }

  /**
   * Get the number of segments for a stimulus and participant.
   */
  getSegmentCount(stimulusId: number, participantId: number): number {
    const range = this.getSegmentRange(stimulusId, participantId)
    return range.endIndex - range.startIndex
  }

  /**
   * Get the end time of the last segment for a participant on a stimulus.
   */
  getParticipantEndTime(stimulusId: number, participantId: number): number {
    const idx = (stimulusId * this.maxParticipants + participantId) * 2
    const startIndex = this.indexTable[idx]
    const endIndex = this.indexTable[idx + 1]

    if (startIndex === endIndex) return 0 // No segments

    const lastSegmentIndex = endIndex - 1
    return this.segmentBuffer[
      lastSegmentIndex * SEGMENT_STRIDE + SegmentField.END_TIME
    ]
  }

  getSegmentStart(segmentIndex: number): number {
    return this.segmentBuffer[
      segmentIndex * SEGMENT_STRIDE + SegmentField.START_TIME
    ]
  }

  getSegmentEnd(segmentIndex: number): number {
    return this.segmentBuffer[
      segmentIndex * SEGMENT_STRIDE + SegmentField.END_TIME
    ]
  }

  getSegmentCategory(segmentIndex: number): number {
    return (
      this.segmentBuffer[
        segmentIndex * SEGMENT_STRIDE + SegmentField.CATEGORY_ID
      ] | 0
    )
  }

  getSegmentId(segmentIndex: number): number {
    return (
      this.segmentBuffer[
        segmentIndex * SEGMENT_STRIDE + SegmentField.SEGMENT_ID
      ] | 0
    )
  }

  getSegmentAoiCount(segmentIndex: number): number {
    return (
      this.segmentBuffer[
        segmentIndex * SEGMENT_STRIDE + SegmentField.AOI_COUNT
      ] | 0
    )
  }

  /**
   * Returns a direct subarray view of the AOIs for a segment.
   * PERFORMANCE: Zero allocations. This is a pointer to existing memory.
   */
  getRawAois(segmentIndex: number): Uint16Array {
    const base = segmentIndex * SEGMENT_STRIDE
    const count = this.segmentBuffer[base + SegmentField.AOI_COUNT] | 0
    const ptr = this.segmentBuffer[base + SegmentField.AOI_POINTER] | 0

    return this.aoiPool.subarray(ptr, ptr + count)
  }

  /**
   * Retrieve the list of AOI IDs for a segment.
   */
  getSegmentAois(
    segmentIndex: number,
    stimulusId: number,
    useGrouping: boolean = true
  ): number[] {
    const base = segmentIndex * SEGMENT_STRIDE
    const count = this.segmentBuffer[base + SegmentField.AOI_COUNT] | 0
    const ptr = this.segmentBuffer[base + SegmentField.AOI_POINTER] | 0

    if (count === 0) {
      return []
    }

    const result: number[] = []

    if (!useGrouping) {
      for (let i = 0; i < count; i++) {
        result.push(this.aoiPool[ptr + i])
      }
    } else {
      const seen = new Set<number>()
      for (let i = 0; i < count; i++) {
        const rawId = this.aoiPool[ptr + i]
        if (!seen.has(rawId)) {
          seen.add(rawId)
          result.push(rawId)
        }
      }
    }

    return result
  }

  /**
   * Iterate over all segments for a stimulus and participant.
   */
  forEachSegment(
    stimulusId: number,
    participantId: number,
    callback: (segmentIndex: number) => boolean | void
  ): boolean {
    const range = this.getSegmentRange(stimulusId, participantId)
    for (let i = range.startIndex; i < range.endIndex; i++) {
      if (callback(i) === false) {
        return false
      }
    }
    return true
  }

  /**
   * Get access to the underlying buffers (read-only operations only).
   */
  getBuffers(): Readonly<BinarySegmentBuffers> {
    return {
      segmentBuffer: this.segmentBuffer,
      indexTable: this.indexTable,
      aoiPool: this.aoiPool,
      maxParticipants: this.maxParticipants,
      stimuliCount: this.stimuliCount,
    }
  }
}
