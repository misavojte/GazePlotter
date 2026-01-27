import type { BinaryBufferReader } from './reader.segment'

/**
 * High-level reader that provides an "interpreted" view of AOIs.
 * Handles mapping of raw AOI IDs to grouped/displayed IDs and deduplication.
 * Uses a pointer-based system to support dynamic number of AOIs per stimulus.
 */
export class AoiGroupReader {
  private indexTable = new Uint32Array(0) // [pointer, length] per stimulus
  private groupPool = new Uint16Array(0) // Flat pool of mapped IDs

  constructor(private segmentReader: BinaryBufferReader) {}

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
        if (!row || hiddenSet?.has(id)) continue
        const name = (row[1] ?? row[0]).trim()
        if (name !== '' && !nameToId.has(name)) nameToId.set(name, id)
      }

      for (let id = 0; id < aois.length; id++) {
        const row = aois[id]
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
  getSegmentAois(segmentIndex: number, stimulusId: number): number[] {
    const rawAois = this.segmentReader.getRawAois(segmentIndex)
    const rawLen = rawAois.length
    if (rawLen === 0) return []

    const ptr = this.indexTable[stimulusId * 2]
    const mapLen = this.indexTable[stimulusId * 2 + 1]

    // Fast Path: Single AOI (common case)
    if (rawLen === 1) {
      const id = rawAois[0]
      return [id < mapLen ? this.groupPool[ptr + id] : id]
    }

    // Deduplication Path (Linear dedupe is faster than Set for typical small AOI counts)
    const result: number[] = []
    for (let i = 0; i < rawLen; i++) {
      const rawId = rawAois[i]
      const finalId = rawId < mapLen ? this.groupPool[ptr + rawId] : rawId

      let seen = false
      for (let j = 0; j < result.length; j++) {
        if (result[j] === finalId) {
          seen = true
          break
        }
      }
      if (!seen) result.push(finalId)
    }

    return result
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
