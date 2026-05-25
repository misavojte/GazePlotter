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
  private fixationIndex: Uint32Array
  private fixationIndexTable: Uint32Array
  public readonly hasSpatialData: boolean
  private spatialBuffer?: Float32Array
  private maxParticipants: number
  private stimuliCount: number

  constructor(buffers: BinarySegmentBuffers) {
    this.segmentBuffer = buffers.segmentBuffer
    this.indexTable = buffers.indexTable
    this.aoiPool = buffers.aoiPool
    this.hasSpatialData = buffers.hasSpatialData ?? false
    this.spatialBuffer = buffers.spatialBuffer
    this.maxParticipants = buffers.maxParticipants
    this.stimuliCount = buffers.stimuliCount

    // Back-fill fixation-only index for legacy buffers (e.g. workspaces saved
    // before this field existed). Newly-built buffers always carry it.
    if (buffers.fixationIndex && buffers.fixationIndexTable) {
      this.fixationIndex = buffers.fixationIndex
      this.fixationIndexTable = buffers.fixationIndexTable
    } else {
      const built = buildFixationIndex(
        this.segmentBuffer,
        this.indexTable,
        this.stimuliCount,
        this.maxParticipants,
      )
      this.fixationIndex = built.fixationIndex
      this.fixationIndexTable = built.fixationIndexTable
    }
  }

  /**
   * Get the [startIndex, endIndex) range into `fixationIndex` for a stimulus
   * and participant. Hot loops (scanAccumulator, scanBatch) iterate this
   * range and dereference `fixationIndex[k]` to get the actual segment index,
   * skipping the per-segment category filter entirely.
   */
  getFixationRange(
    stimulusId: number,
    participantId: number,
  ): { startIndex: number; endIndex: number } {
    const idx = (stimulusId * this.maxParticipants + participantId) * 2
    return {
      startIndex: this.fixationIndexTable[idx],
      endIndex: this.fixationIndexTable[idx + 1],
    }
  }

  /** Resolve a position in `fixationIndex` to the actual segment index. */
  getFixationSegmentIndex(k: number): number {
    return this.fixationIndex[k]
  }

  /** Raw segment buffer, exposed for hot-loop direct indexing. */
  get segmentBufferRaw(): Float32Array {
    return this.segmentBuffer
  }

  /** Raw AOI pool, exposed for hot-loop direct indexing. */
  get aoiPoolRaw(): Uint16Array {
    return this.aoiPool
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
   * Get spatial coordinates for a segment.
   * Returns null if the workspace has no spatial data or this segment has missing coordinates.
   */
  getSegmentSpatial(segmentIndex: number): { x: number; y: number } | null {
    if (!this.hasSpatialData || !this.spatialBuffer) return null

    const base = segmentIndex * 2
    const x = this.spatialBuffer[base]

    if (Number.isNaN(x)) return null

    return {
      x,
      y: this.spatialBuffer[base + 1],
    }
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
      fixationIndex: this.fixationIndex,
      fixationIndexTable: this.fixationIndexTable,
      aoiPool: this.aoiPool,
      hasSpatialData: this.hasSpatialData,
      spatialBuffer: this.spatialBuffer,
      maxParticipants: this.maxParticipants,
      stimuliCount: this.stimuliCount,
    }
  }
}

/**
 * Build `fixationIndex` + `fixationIndexTable` from an existing segment buffer
 * by scanning each (stimulus, participant) range for category-0 segments.
 * Used as a fallback when constructing a reader from a legacy
 * BinarySegmentBuffers that lacks the precomputed fixation index.
 */
function buildFixationIndex(
  segmentBuffer: Float32Array,
  indexTable: Uint32Array,
  stimuliCount: number,
  maxParticipants: number,
): { fixationIndex: Uint32Array; fixationIndexTable: Uint32Array } {
  // Pass 1: count fixations to size the output exactly.
  let total = 0
  for (let s = 0; s < stimuliCount; s++) {
    for (let p = 0; p < maxParticipants; p++) {
      const idx = (s * maxParticipants + p) * 2
      const startIndex = indexTable[idx]
      const endIndex = indexTable[idx + 1]
      for (let i = startIndex; i < endIndex; i++) {
        if ((segmentBuffer[i * SEGMENT_STRIDE + SegmentField.CATEGORY_ID] | 0) === 0) {
          total++
        }
      }
    }
  }

  const fixationIndex = new Uint32Array(total)
  const fixationIndexTable = new Uint32Array(stimuliCount * maxParticipants * 2)
  let cursor = 0

  for (let s = 0; s < stimuliCount; s++) {
    for (let p = 0; p < maxParticipants; p++) {
      const idx = (s * maxParticipants + p) * 2
      const startIndex = indexTable[idx]
      const endIndex = indexTable[idx + 1]
      const fixStart = cursor
      for (let i = startIndex; i < endIndex; i++) {
        if ((segmentBuffer[i * SEGMENT_STRIDE + SegmentField.CATEGORY_ID] | 0) === 0) {
          fixationIndex[cursor++] = i
        }
      }
      fixationIndexTable[idx] = fixStart
      fixationIndexTable[idx + 1] = cursor
    }
  }

  return { fixationIndex, fixationIndexTable }
}
