/**
 * Binary relational memory model for high-performance segment storage.
 *
 * This module defines the binary buffer-based data structures that replace
 * the nested number[][][][] segment arrays with contiguous typed arrays,
 * enabling zero-allocation queries and dramatically improved iteration speed
 * for large datasets (50k+ segments).
 */

/**
 * Constants for binary buffer layout
 */
export const SEGMENT_STRIDE = 6 as const // Fields per segment in master buffer
export const MAX_AOI_PER_STIMULUS = 256 as const // Maximum AOI IDs per stimulus

/**
 * Indices for segment fields in the master buffer (stride = 6)
 */
export const enum SegmentField {
  START_TIME = 0,
  END_TIME = 1,
  CATEGORY_ID = 2,
  AOI_COUNT = 3,
  AOI_POINTER = 4,
  SEGMENT_ID = 5,
}

/**
 * Binary buffers for relational segment storage.
 *
 * Structure:
 * - Master Segment Buffer: Flat Float32Array with fixed stride (6 fields per segment)
 *   [startTime, endTime, categoryId, aoiCount, aoiPointer, segmentId, ...]
 *
 * - Index Table: Uint32Array mapping (stimulus, participant) → segment range
 *   Each entry pair [startIndex, endIndex) points to a contiguous range in master buffer
 *
 * - AOI Overflow Pool: Uint16Array storing all AOI IDs for all segments
 *   Segments reference their AOIs via pointer + count into this pool
 *
 * - Grouping Map: Uint16Array mapping raw AOI IDs to representative group IDs
 *   Enables O(1) resolution of AOI name-based grouping
 */
export interface BinarySegmentBuffers {
  /**
   * Master segment storage: Float32Array with SEGMENT_STRIDE fields per segment.
   * All segments stored sequentially, grouped by stimulus/participant.
   */
  segmentBuffer: Float32Array

  /**
   * Index table for O(1) access to participant segment ranges.
   * Layout: [startIdx0, endIdx0, startIdx1, endIdx1, ...]
   * For stimulus s, participant p: index = (s * maxParticipants + p) * 2
   */
  indexTable: Uint32Array

  /**
   * AOI overflow pool: flat array of AOI IDs for all segments.
   * Each segment's AOIs occupy a contiguous slice referenced by aoiPointer.
   */
  aoiPool: Uint16Array

  /**
   * Grouping map: translates raw AOI IDs to group representative IDs.
   * For stimulus s, rawAoiId: groupMap[s * MAX_AOI_PER_STIMULUS + rawAoiId] = repId
   * Value 0xFFFF indicates identity mapping (no grouping).
   */
  groupMap: Uint16Array

  /**
   * Maximum participants per stimulus (for index table calculations)
   */
  maxParticipants: number

  /**
   * Total number of stimuli
   */
  stimuliCount: number
}

/**
 * Builder for constructing binary segment buffers incrementally.
 * Used during data import/processing to build the binary structures.
 */
export interface BinarySegmentBuilder {
  /**
   * Add a segment for a specific stimulus and participant.
   * AOI pool grows dynamically as needed (starting size 1, grow by 1).
   */
  addSegment(
    stimulusId: number,
    participantId: number,
    startTime: number,
    endTime: number,
    categoryId: number,
    aoiIds: number[],
    segmentId: number
  ): void

  /**
   * Finalize construction and return immutable binary buffers.
   * Called after all segments have been added.
   */
  build(): BinarySegmentBuffers
}

/**
 * Reader utility for zero-allocation queries on binary segment data.
 * Provides high-level methods to access segment information without
 * creating intermediate objects.
 */
export class BinaryBufferReader {
  private segmentBuffer: Float32Array
  private indexTable: Uint32Array
  private aoiPool: Uint16Array
  private groupMap: Uint16Array
  private maxParticipants: number
  private stimuliCount: number

  constructor(buffers: BinarySegmentBuffers) {
    this.segmentBuffer = buffers.segmentBuffer
    this.indexTable = buffers.indexTable
    this.aoiPool = buffers.aoiPool
    this.groupMap = buffers.groupMap
    this.maxParticipants = buffers.maxParticipants
    this.stimuliCount = buffers.stimuliCount
  }

  /**
   * Get the segment range [startIndex, endIndex) for a stimulus and participant.
   * Returns indices into the master segment buffer (not byte offsets).
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
   * Read a segment's start time by its global index in the master buffer.
   */
  getSegmentStart(segmentIndex: number): number {
    return this.segmentBuffer[
      segmentIndex * SEGMENT_STRIDE + SegmentField.START_TIME
    ]
  }

  /**
   * Read a segment's end time by its global index in the master buffer.
   */
  getSegmentEnd(segmentIndex: number): number {
    return this.segmentBuffer[
      segmentIndex * SEGMENT_STRIDE + SegmentField.END_TIME
    ]
  }

  /**
   * Read a segment's category ID by its global index in the master buffer.
   */
  getSegmentCategory(segmentIndex: number): number {
    return (
      this.segmentBuffer[
        segmentIndex * SEGMENT_STRIDE + SegmentField.CATEGORY_ID
      ] | 0
    )
  }

  /**
   * Read a segment's ID (order within participant) by its global index.
   */
  getSegmentId(segmentIndex: number): number {
    return (
      this.segmentBuffer[
        segmentIndex * SEGMENT_STRIDE + SegmentField.SEGMENT_ID
      ] | 0
    )
  }

  /**
   * Get the number of AOIs for a segment.
   */
  getSegmentAoiCount(segmentIndex: number): number {
    return (
      this.segmentBuffer[
        segmentIndex * SEGMENT_STRIDE + SegmentField.AOI_COUNT
      ] | 0
    )
  }

  /**
   * Retrieve the list of AOI IDs for a segment.
   *
   * @param segmentIndex - Global index in master buffer
   * @param stimulusId - Stimulus ID (required for grouping map offset)
   * @param useGrouping - If true, map raw AOI IDs to group representative IDs
   * @returns Array of AOI IDs (grouped or raw)
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
    const groupMapOffset = stimulusId * MAX_AOI_PER_STIMULUS

    if (!useGrouping) {
      // Return raw AOI IDs without grouping
      for (let i = 0; i < count; i++) {
        result.push(this.aoiPool[ptr + i])
      }
    } else {
      // Apply grouping and deduplicate
      const seen = new Set<number>()
      for (let i = 0; i < count; i++) {
        const rawId = this.aoiPool[ptr + i]
        const mapped = this.groupMap[groupMapOffset + rawId]
        const groupId = mapped === 0xffff ? rawId : mapped
        if (!seen.has(groupId)) {
          seen.add(groupId)
          result.push(groupId)
        }
      }
    }

    return result
  }

  /**
   * Iterate over all segments for a stimulus and participant.
   * Calls the callback with the global segment index for each segment.
   *
   * @returns true if iteration completed, false if callback returned false
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
      groupMap: this.groupMap,
      maxParticipants: this.maxParticipants,
      stimuliCount: this.stimuliCount,
    }
  }
}
