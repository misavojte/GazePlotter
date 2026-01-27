import { SegmentField, SEGMENT_STRIDE } from './schema'
import type { BinaryBufferReader } from './reader.segment'

/**
 * High-level reader that provides an "interpreted" view of AOIs.
 * Handles mapping of raw AOI IDs to grouped/displayed IDs and deduplication.
 * Uses a pointer-based system to support dynamic number of AOIs per stimulus.
 */
export class AoiGroupReader {
  public static readonly HIDDEN_ID = 0xffff

  private indexTable = new Uint32Array(0) // [pointer, length] per stimulus
  private groupPool = new Uint16Array(0) // Flat pool of mapped IDs

  // Direct buffer access optimization
  private segmentBuffer: Float32Array
  private aoiPool: Uint16Array

  // Deduplication state
  private seenStamp = new Uint32Array(0)
  private stamp = 1

  constructor(segmentReader: BinaryBufferReader) {
    const buffers = segmentReader.getBuffers()
    this.segmentBuffer = buffers.segmentBuffer
    this.aoiPool = buffers.aoiPool
  }

  private ensureSeenCapacity(mapLen: number) {
    if (this.seenStamp.length < mapLen) {
      this.seenStamp = new Uint32Array(
        Math.max(mapLen, this.seenStamp.length * 2, 1024)
      )
      this.stamp = 1
    }
  }

  /**
   * Refreshes the internal interpretation map based on the provided metadata.
   * This logic handles AOI grouping, ordering, and hidden AOIs.
   */
  updateMap(meta: {
    aois: {
      data: string[][][]
      orderVector?: number[][]
      hiddenAois?: number[][]
    }
    stimuli: { data: string[][] }
  }) {
    const sCount = meta.stimuli.data.length
    if (this.indexTable.length !== sCount * 2) {
      this.indexTable = new Uint32Array(sCount * 2)
    }

    // Step 1: Calculate total capacity needed and pointers
    let totalCap = 0
    for (let sId = 0; sId < sCount; sId++) {
      const aois = meta.aois.data[sId] || []
      const len = aois.length
      this.indexTable[sId * 2] = totalCap
      this.indexTable[sId * 2 + 1] = len
      totalCap += len
    }

    if (this.groupPool.length !== totalCap) {
      this.groupPool = new Uint16Array(totalCap)
    }

    // Step 2: Identity pre-filling (removes 0xffff / undefined checks in hot loop)
    for (let sId = 0; sId < sCount; sId++) {
      const ptr = this.indexTable[sId * 2]
      const len = this.indexTable[sId * 2 + 1]
      for (let i = 0; i < len; i++) {
        this.groupPool[ptr + i] = i
      }
    }

    // Step 3: Populate group/displayed ID mapping
    for (let sId = 0; sId < sCount; sId++) {
      const aois = meta.aois.data[sId] || []
      const hidden = meta.aois.hiddenAois?.[sId]
      const hiddenSet = hidden && hidden.length ? new Set(hidden) : null
      const nameToId = new Map<string, number>()
      const ptr = this.indexTable[sId * 2]

      const order =
        meta.aois.orderVector?.[sId] ||
        Array.from({ length: aois.length }, (_, i) => i)

      for (let i = 0; i < order.length; i++) {
        const id = order[i]
        const row = aois[id]
        if (!row) continue // Skip non-existent
        if (hiddenSet?.has(id)) {
          // Explicitly mark hidden in the pool (overwriting identity)
          this.groupPool[ptr + id] = AoiGroupReader.HIDDEN_ID
          continue
        }

        const name = (row[1] ?? row[0]).trim()
        if (name !== '' && !nameToId.has(name)) {
          nameToId.set(name, id)
        }
      }

      for (let id = 0; id < aois.length; id++) {
        const row = aois[id]
        // If already marked hidden, skip mapping logic but ensure it stays hidden
        if (hiddenSet?.has(id)) {
          this.groupPool[ptr + id] = AoiGroupReader.HIDDEN_ID
          continue
        }

        if (!row) continue
        const name = (row[1] ?? row[0]).trim()
        const mapped = nameToId.get(name)
        if (mapped !== undefined) {
          this.groupPool[ptr + id] = mapped
        }
      }
    }
  }

  /**
   * Retrieve the list of logical (mapped) AOI IDs for a segment.
   * NOTE: This high-level reader always performs interpretation/grouping.
   * PERFORMANCE:
   * - Fast path for N=1 (no-allocation, no-dedupe).
   * - Linear deduplication for N > 1 (avoids Set allocation overhead).
   * - Identity pre-filling in updateMap avoids branching here.
   */
  /**
   * Retrieve unique logical AOI IDs into a supplied buffer.
   * Zero-allocation API.
   * @returns number of AOIs written
   */
  getSegmentAoisIntoUnique(
    segmentIndex: number,
    stimulusId: number,
    out: Uint16Array | Uint32Array | number[]
  ): number {
    const base = segmentIndex * SEGMENT_STRIDE
    const count = this.segmentBuffer[base + SegmentField.AOI_COUNT] | 0
    if (count === 0) return 0

    const ptr = this.indexTable[stimulusId * 2]
    const mapLen = this.indexTable[stimulusId * 2 + 1]
    const aoiPtr = this.segmentBuffer[base + SegmentField.AOI_POINTER] | 0

    if (count === 1) {
      const rawId = this.aoiPool[aoiPtr]
      const finalId = rawId < mapLen ? this.groupPool[ptr + rawId] : rawId
      if (finalId !== AoiGroupReader.HIDDEN_ID) {
        out[0] = finalId
        return 1
      }
      return 0
    }

    // Super tiny universe: 32-bit mask
    if (mapLen <= 31) {
      let mask = 0
      let outLen = 0
      for (let i = 0; i < count; i++) {
        const rawId = this.aoiPool[aoiPtr + i]
        const finalId = rawId < mapLen ? this.groupPool[ptr + rawId] : rawId
        // if rawId >= mapLen happens, bail out to fallback (rare)
        if (finalId >= 31) continue
        // Note: HIDDEN_ID (0xFFFF) >= 31 check handles visibility naturally here!
        // 0xFFFF is 65535, so it is caught by 'finalId >= 31' and skipped.
        // Wait, 'finalId >= 31' handles it?
        // If HIDDEN_ID is 0xFFFF, then 0xFFFF >= 31 is true. So it `continue`s.
        // So strict visibility logic is IMPLICITLY handled by the range check in Bitmask path.
        // We should verify this assumption explicitly or add explicit check for clarity?
        // Explicit check is safer if mapLen > 31 logic changes.
        // But for now, let's leave implicit or minimal change.
        // Actually, if mapLen is huge but only small IDs used...
        // No, mapLen includes HIDDEN_ID? No, mapLen is total raw count.
        // HIDDEN_ID is a value *in* the pool.

        // Let's add explicit check for correctness/clarity.
        if (finalId === AoiGroupReader.HIDDEN_ID) continue

        if (finalId >= 31) continue
        const bit = 1 << finalId
        if ((mask & bit) !== 0) continue
        mask |= bit
        out[outLen++] = finalId
      }
      return outLen
    }

    // General case: stamp-table dedupe (small memory, fast)
    this.ensureSeenCapacity(mapLen)
    let stamp = (this.stamp + 1) | 0
    if (stamp === 0x7fffffff) stamp = 1
    this.stamp = stamp

    let outLen = 0
    for (let i = 0; i < count; i++) {
      const rawId = this.aoiPool[aoiPtr + i]
      const finalId = rawId < mapLen ? this.groupPool[ptr + rawId] : rawId

      if (finalId < mapLen) {
        if (finalId === AoiGroupReader.HIDDEN_ID) continue

        if (this.seenStamp[finalId] === stamp) continue
        this.seenStamp[finalId] = stamp
        out[outLen++] = finalId
      } else {
        // Fallback for out-of-bounds IDs (rare)
        let seen = false
        // Linear scan over widely available small 'out' buffer is fast
        for (let j = 0; j < outLen; j++) {
          if (out[j] === finalId) {
            seen = true
            break
          }
        }
        // Also skip if it happens to be HIDDEN_ID (though unlikely if mapLen covers it)
        if (!seen && finalId !== AoiGroupReader.HIDDEN_ID)
          out[outLen++] = finalId
      }
    }
    return outLen
  }

  /**
   * Legacy compatibility wrapper.
   * Allocates a new array. Use getSegmentAoisIntoUnique for critical paths.
   */
  getSegmentAois(segmentIndex: number, stimulusId: number): number[] {
    const base = segmentIndex * SEGMENT_STRIDE
    const count = this.segmentBuffer[base + SegmentField.AOI_COUNT] | 0
    if (count === 0) return []

    // Allocate buffer for worst case
    const buffer = new Array(count)
    const len = this.getSegmentAoisIntoUnique(segmentIndex, stimulusId, buffer)

    // Slice to actual size
    return buffer.slice(0, len)
  }

  /**
   * Map a single raw AOI ID to its logical ID for a stimulus.
   */
  getAoiMapping(stimulusId: number, rawId: number): number {
    const len = this.indexTable[stimulusId * 2 + 1]
    if (rawId >= len) return rawId

    const ptr = this.indexTable[stimulusId * 2]
    return this.groupPool[ptr + rawId]
  }
}
