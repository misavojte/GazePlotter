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

export const FIXATION_CATEGORY_ID = 0 as const // Category ID reserved for fixations

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
   * Flat list of segment indices where CATEGORY_ID === 0 (fixations only).
   * Lets hot loops iterate fixations directly without paying a per-segment
   * category-check on saccades/blinks. Built by `jsonSegmentsToBinary`;
   * back-filled by the reader if absent (legacy workspaces).
   */
  fixationIndex?: Uint32Array

  /**
   * [start, end) pointers into `fixationIndex`, per (stimulus, participant) —
   * same stride layout as `indexTable`. Always pairs with `fixationIndex`.
   */
  fixationIndexTable?: Uint32Array

  /**
   * AOI overflow pool: flat array of AOI IDs for all segments.
   */
  aoiPool: Uint16Array

  /**
   * True when spatial segment coordinates are available.
   */
  hasSpatialData: boolean

  /**
   * Optional parallel spatial storage with stride 2.
   * Layout: [x0, y0, x1, y1, ...]. Missing coordinates are represented as NaN.
   */
  spatialBuffer?: Float32Array

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
 * Stride of the flat event occurrence buffer: [start, duration, ...].
 * Mirrors the stride-2 layout the legacy `number[][][][]` events used.
 */
export const EVENT_STRIDE = 2 as const

/**
 * Field offsets within one stride-2 event occurrence.
 */
export const enum EventField {
  START_TIME = 0,
  DURATION = 1,
}

/**
 * Binary buffers for event-occurrence storage — the event analogue of
 * {@link BinarySegmentBuffers}. The hot scarf overlay loop iterates these
 * directly instead of paying a Svelte `$state` proxy `get` per element,
 * which is what the previous `number[][][][]` (held inside reactive
 * `metadata`) cost. Channel definitions, ordering and hidden state stay in
 * reactive metadata (small, UI-edited); only the heavy occurrence numbers
 * live here, outside the proxy.
 */
export interface BinaryEventBuffers {
  /**
   * Flat occurrence storage: Float32Array, EVENT_STRIDE fields per
   * occurrence, all (stimulus, channel, participant) buffers concatenated.
   * Layout per occurrence: [startMs, durationMs]; duration 0 = instant.
   */
  occurrenceBuffer: Float32Array

  /**
   * Cumulative channel counts, length `stimuliCount + 1`.
   * `channelOffsets[s]` is the first global channel index for stimulus `s`;
   * `channelOffsets[stimuliCount]` is the total channel count. A stimulus's
   * channel count is `channelOffsets[s + 1] - channelOffsets[s]`.
   */
  channelOffsets: Uint32Array

  /**
   * [start, end) element ranges into `occurrenceBuffer`, per
   * (globalChannel, participant). Entry index =
   * `(globalChannel * maxParticipants + participantId) * 2`, where
   * `globalChannel = channelOffsets[stimulusId] + localChannelId`.
   * Occurrence count for a cell is `(end - start) / EVENT_STRIDE`.
   */
  indexTable: Uint32Array

  /** Maximum participants across all channels (index-table stride). */
  maxParticipants: number

  /** Total number of stimuli. */
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
    segmentId: number,
    spatial?: { x: number; y: number } | null
  ): void

  build(): BinarySegmentBuffers
}
