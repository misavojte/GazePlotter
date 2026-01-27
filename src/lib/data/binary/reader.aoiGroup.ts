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
    // Default to identity mapping (0xffff)
    this.groupPool.fill(0xffff)

    // Step 2: Populate mapping logic
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
        this.groupPool[ptr + id] = mapped !== undefined ? mapped : id
      }
    }
  }

  /**
   * Retrieve the list of logical (mapped) AOI IDs for a segment.
   * PERFORMANCE: Minimizes allocations by using a Set for deduplication if needed.
   */
  getSegmentAois(
    segmentIndex: number,
    stimulusId: number,
    useGrouping: boolean = true
  ): number[] {
    const rawAois = this.segmentReader.getRawAois(segmentIndex)
    if (rawAois.length === 0) return []

    const ptr = this.indexTable[stimulusId * 2]
    const len = this.indexTable[stimulusId * 2 + 1]
    const result: number[] = []

    if (!useGrouping) {
      for (let i = 0; i < rawAois.length; i++) {
        result.push(rawAois[i])
      }
    } else {
      const seen = new Set<number>()
      for (let i = 0; i < rawAois.length; i++) {
        const rawId = rawAois[i]

        // Safety check for rawId within bounds of this stimulus mapping
        if (rawId >= len) {
          if (!seen.has(rawId)) {
            seen.add(rawId)
            result.push(rawId)
          }
          continue
        }

        const mappedId = this.groupPool[ptr + rawId]

        // 0xffff is the default value for "unmapped" or "identity"
        const finalId =
          mappedId === 0xffff || mappedId === undefined ? rawId : mappedId

        if (!seen.has(finalId)) {
          seen.add(finalId)
          result.push(finalId)
        }
      }
    }

    return result
  }

  /**
   * Map a single raw AOI ID to its logical ID for a stimulus.
   */
  getAoiMapping(stimulusId: number, rawId: number): number {
    const ptr = this.indexTable[stimulusId * 2]
    const len = this.indexTable[stimulusId * 2 + 1]

    if (rawId >= len) return rawId

    const mapped = this.groupPool[ptr + rawId]
    return mapped === undefined || mapped === 0xffff ? rawId : mapped
  }
}
