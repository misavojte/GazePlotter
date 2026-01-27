/**
 * Binary relational memory model for high-performance segment storage.
 *
 * This module defines the binary buffer-based data structures that replace
 * the nested number[][][][] segment arrays with contiguous typed arrays.
 */

/**
 * Constants for binary buffer layout
 */
export const SEGMENT_STRIDE = 6 as const // Fields per segment in master buffer

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
 */
export interface BinarySegmentBuffers {
  /**
   * Master segment storage: Float32Array with SEGMENT_STRIDE fields per segment.
   */
  segmentBuffer: Float32Array

  /**
   * Index table for O(1) access to participant segment ranges.
   * Layout: [startIdx0, endIdx0, startIdx1, endIdx1, ...]
   */
  indexTable: Uint32Array

  /**
   * AOI overflow pool: flat array of AOI IDs for all segments.
   */
  aoiPool: Uint16Array

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
 */
export interface BinarySegmentBuilder {
  addSegment(
    stimulusId: number,
    participantId: number,
    startTime: number,
    endTime: number,
    categoryId: number,
    aoiIds: number[],
    segmentId: number
  ): void

  build(): BinarySegmentBuffers
}
