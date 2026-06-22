import { SegmentField, SEGMENT_STRIDE } from './schema'
import type { BinaryBufferReader } from './reader.segment'

/**
 * High-level reader that provides an "interpreted" view of AOIs.
 * Handles mapping of raw AOI IDs to grouped/displayed IDs and deduplication.
 * Uses a pointer-based system to support dynamic number of AOIs per stimulus.
 */
export interface AoiMetrics {
  order: number
  count: number
}

export class AoiGroupReader {
  public static readonly HIDDEN_ID = 0xffff

  private indexTable = new Uint32Array(0) // [pointer, length] per stimulus
  private groupPool = new Uint16Array(0) // Flat pool of mapped IDs

  /**
   * Structural version. Bumps inside `updateMap()` only when the rebuilt
   * `groupPool` actually differs byte-for-byte from the previous one — i.e.
   * grouping, visibility, or order *materially* changed. The metric cache
   * (`runtime.ts`) keys off this; cosmetic edits (color, no-op hidden saves)
   * leave it untouched without any per-mutator detection.
   */
  private _version = 0
  get version(): number {
    return this._version
  }

  /**
   * Appearance version. Bumps every time `updateMap()` is called, regardless
   * of whether `groupPool` changed. Display-side caches (memoized `getAois`)
   * key off this — they must refresh on any potential metadata mutation
   * (color, displayedName) since the diff only inspects `groupPool`.
   */
  private _appearanceVersion = 0
  get appearanceVersion(): number {
    return this._appearanceVersion
  }

  // Direct buffer access optimization
  private segmentBuffer: Float32Array
  private aoiPool: Uint16Array

  // Deduplication state for retrieval
  private seenStamp = new Uint32Array(0)
  private stamp = 1

  // Reusable structures for updateMap to avoid per-stimulus allocations
  private sharedMap = new Map<string, number>()
  private sharedSet = new Set<number>()

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

    const { aois: aoisMeta } = meta
    let totalCap = 0
    for (let sId = 0; sId < sCount; sId++) {
      const len = aoisMeta.data[sId]?.length ?? 0
      this.indexTable[sId * 2] = totalCap
      this.indexTable[sId * 2 + 1] = len
      totalCap += len
    }

    // Build into a fresh buffer so we can diff against the previous one and
    // decide whether the structural version needs to bump. The allocation
    // (~2 bytes per AOI per stimulus) is negligible compared to keeping the
    // "did anything actually change?" decision out of every caller.
    const prevPool = this.groupPool
    const nextPool = new Uint16Array(totalCap)

    const { sharedMap, sharedSet } = this
    for (let sId = 0; sId < sCount; sId++) {
      const aois = aoisMeta.data[sId]
      if (!aois) continue

      const ptr = this.indexTable[sId * 2]
      const len = aois.length
      const hidden = aoisMeta.hiddenAois?.[sId]
      const order = aoisMeta.orderVector?.[sId]

      sharedMap.clear()
      sharedSet.clear()

      if (hidden) {
        for (let i = 0; i < hidden.length; i++) sharedSet.add(hidden[i])
      }

      // Pass over AOIs (via order vector if provided) to establish group representatives
      const iterate = (id: number) => {
        const row = aois[id]
        if (!row || sharedSet.has(id)) return
        const name = (row[1] ?? row[0]).trim()
        if (name !== '' && !sharedMap.has(name)) sharedMap.set(name, id)
      }

      if (order) {
        for (let i = 0; i < order.length; i++) iterate(order[i])
      } else {
        for (let id = 0; id < len; id++) iterate(id)
      }

      // Populate groupPool with mapped IDs or HIDDEN_ID sentinel
      for (let id = 0; id < len; id++) {
        if (sharedSet.has(id)) {
          nextPool[ptr + id] = AoiGroupReader.HIDDEN_ID
        } else {
          const row = aois[id]
          const name = row ? (row[1] ?? row[0]).trim() : ''
          nextPool[ptr + id] = sharedMap.get(name) ?? id
        }
      }
    }

    // Single decision point: structural version bumps iff groupPool actually
    // changed. Appearance always bumps because metadata fields not encoded in
    // groupPool (color, displayedName-when-name-unchanged) may have moved.
    let structurallyChanged = prevPool.length !== nextPool.length
    if (!structurallyChanged) {
      for (let i = 0; i < nextPool.length; i++) {
        if (prevPool[i] !== nextPool[i]) {
          structurallyChanged = true
          break
        }
      }
    }

    this.groupPool = nextPool
    if (structurallyChanged) this._version++
    this._appearanceVersion++
  }

  /**
   * Internal zero-allocation utility for iterating unique mapped AOIs in a segment.
   * Consolidates deduplication logic (bitmask for small sets, stamp-table for large).
   * @returns The number of unique mapped AOIs (without hidden AOIs).
   */
  private _forEachUniqueMappedAoi(
    segmentIndex: number,
    stimulusId: number,
    callback: (mappedId: number, order: number) => void
  ): number {
    const base = segmentIndex * SEGMENT_STRIDE
    const count = this.segmentBuffer[base + SegmentField.AOI_COUNT] | 0
    if (count === 0) return 0

    const ptr = this.indexTable[stimulusId * 2]
    const mapLen = this.indexTable[stimulusId * 2 + 1]
    const aoiPtr = this.segmentBuffer[base + SegmentField.AOI_POINTER] | 0

    if (count === 1) {
      const finalId = this.groupPool[ptr + this.aoiPool[aoiPtr]]
      if (finalId !== AoiGroupReader.HIDDEN_ID) {
        callback(finalId, 0)
        return 1
      }
      return 0
    }

    let outLen = 0
    if (mapLen <= 31) {
      let mask = 0
      for (let i = 0; i < count; i++) {
        const finalId = this.groupPool[ptr + this.aoiPool[aoiPtr + i]]
        if (finalId === AoiGroupReader.HIDDEN_ID) continue
        const bit = 1 << finalId
        if ((mask & bit) !== 0) continue
        mask |= bit
        callback(finalId, outLen++)
      }
    } else {
      this.ensureSeenCapacity(mapLen)
      this.stamp = (this.stamp + 1) >>> 0 || 1
      const stamp = this.stamp
      for (let i = 0; i < count; i++) {
        const finalId = this.groupPool[ptr + this.aoiPool[aoiPtr + i]]
        if (
          finalId === AoiGroupReader.HIDDEN_ID ||
          this.seenStamp[finalId] === stamp
        )
          continue
        this.seenStamp[finalId] = stamp
        callback(finalId, outLen++)
      }
    }
    return outLen
  }

  /**
   * Retrieve unique logical AOI IDs into a supplied buffer.
   * Zero-allocation API.
   */
  getSegmentAoisIntoUniqueTyped(
    segmentIndex: number,
    stimulusId: number,
    out: Uint16Array | Uint32Array
  ): number {
    return this._forEachUniqueMappedAoi(
      segmentIndex,
      stimulusId,
      (id, order) => {
        out[order] = id
      }
    )
  }

  /**
   * Returns both the order of a specific AOI and the total unique count in a segment.
   * Zero-allocation API. Writes results into supplied 'out' object.
   */
  getAoiMetricsInSegmentInto(
    segmentIndex: number,
    stimulusId: number,
    logicalAoiId: number,
    out: AoiMetrics
  ): void {
    out.order = -1
    out.count = this._forEachUniqueMappedAoi(
      segmentIndex,
      stimulusId,
      (id, order) => {
        if (id === logicalAoiId) out.order = order
      }
    )
  }

  /**
   * Map a single raw AOI ID to its logical ID for a stimulus.
   */
  getAoiMapping(stimulusId: number, rawId: number): number {
    const idx = stimulusId * 2
    if (idx + 1 >= this.indexTable.length) {
      throw new Error(`getAoiMapping: stimulusId ${stimulusId} out of range`)
    }
    const ptr = this.indexTable[idx]
    const len = this.indexTable[idx + 1]
    if (rawId < 0 || rawId >= len) {
      throw new Error(
        `getAoiMapping: rawId ${rawId} out of range for stimulus ${stimulusId} (len=${len})`
      )
    }
    return this.groupPool[ptr + rawId]
  }
}
