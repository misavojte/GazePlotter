import type { DeserializerOutputType } from '$lib/gaze-data/back-process/types/DeserializerOutputType.js'

type PackedTarget = { raw: number; packed: number }

/**
 * Single-character delimiter only.
 * Fast, single-pass scan of the row string.
 *
 * Notes:
 * - No split().
 * - No indexOf() in the hot path.
 * - Only slices for columns you actually keep.
 * - Early-exits after maxNeededCol is closed.
 * - Zero-fills missing AOI tail to prevent carry-over.
 */
export abstract class AbstractEyeDeserializer {
  protected readonly delim: string
  protected readonly delimLen: number
  private readonly delimCh: number

  // String Double Buffer: Main metadata columns (packed)
  protected curr: string[] = []
  protected prev: string[] = []
  private temp: string[] = []

  // Row stamp for efficient clearing
  private currStamp: Uint32Array = new Uint32Array(0)
  private rowId = 0

  // Binary Double Buffer: AOI data (0 or 1)
  protected currAoi: Uint8Array = new Uint8Array(0)
  protected prevAoi: Uint8Array = new Uint8Array(0)
  private tempAoi: Uint8Array = new Uint8Array(0)

  // Mappings
  protected columnMap: number[] = []
  protected aoiStart = 0
  protected aoiCount = 0

  // Precomputed packed targets (rigid lookup tables)
  // For each raw column, packedHead[raw] points to the first node index in
  // packedIndex/packedNext, or -1 if no packed field maps to that raw column.
  private packedHead: Int32Array = new Int32Array(0)
  private packedIndex: Int32Array = new Int32Array(0)
  private packedNext: Int32Array = new Int32Array(0)

  private minNeededCol = 0
  private maxNeededCol = -1

  constructor(columnDelimiter: string = ',') {
    if (columnDelimiter.length !== 1) {
      throw new Error(
        `AbstractEyeDeserializer expects a single-character delimiter, got "${columnDelimiter}".`
      )
    }
    this.delim = columnDelimiter
    this.delimLen = 1
    this.delimCh = columnDelimiter.charCodeAt(0)
  }

  abstract deserialize(rawRowRef: string): DeserializerOutputType
  abstract finalize(): DeserializerOutputType

  protected getCurr(index: number): string {
    return this.currStamp[index] === this.rowId ? this.curr[index] : ''
  }

  protected setupColumns(indices: number[]): void {
    const count = indices.length
    this.columnMap = indices
    this.curr = new Array(count).fill('')
    this.prev = new Array(count).fill('')
    this.temp = new Array(count)
    this.currStamp = new Uint32Array(count)
    this.rebuildTargets()
  }

  protected setupAoiColumns(startIndex: number, count: number): void {
    this.aoiStart = startIndex
    this.aoiCount = count
    this.currAoi = new Uint8Array(count)
    this.prevAoi = new Uint8Array(count)
    this.tempAoi = new Uint8Array(count)
    this.rebuildTargets()
  }

  private rebuildTargets(): void {
    const targetsStr: PackedTarget[] = []
    for (let packed = 0; packed < this.columnMap.length; packed++) {
      const raw = this.columnMap[packed]
      if (raw >= 0) targetsStr.push({ raw, packed })
    }
    targetsStr.sort((a, b) => a.raw - b.raw)

    let min = Number.POSITIVE_INFINITY
    let max = -1

    if (targetsStr.length) {
      min = Math.min(min, targetsStr[0].raw)
      max = Math.max(max, targetsStr[targetsStr.length - 1].raw)
    }

    if (this.aoiCount > 0) {
      min = Math.min(min, this.aoiStart)
      max = Math.max(max, this.aoiStart + this.aoiCount - 1)
    }

    if (min === Number.POSITIVE_INFINITY) {
      min = 0
      max = -1
    }

    this.minNeededCol = min
    this.maxNeededCol = max

    // Build fast lookup tables for packed string columns.
    // Note: allocate head up to maxNeededCol so we can index directly by raw col.
    const len = targetsStr.length
    this.packedIndex = new Int32Array(len)
    this.packedNext = new Int32Array(len)
    this.packedNext.fill(-1)

    if (this.maxNeededCol >= 0) {
      this.packedHead = new Int32Array(this.maxNeededCol + 1)
      this.packedHead.fill(-1)
    } else {
      this.packedHead = new Int32Array(0)
    }

    // targetsStr is sorted by raw; link nodes per raw column.
    for (let i = len - 1; i >= 0; i--) {
      const raw = targetsStr[i].raw
      this.packedIndex[i] = targetsStr[i].packed
      this.packedNext[i] = this.packedHead[raw]
      this.packedHead[raw] = i
    }
  }

  processRow(rawRow: string): DeserializerOutputType {
    // Buffer swap (strings)
    {
      const prevTemp = this.prev
      this.prev = this.curr
      this.curr = this.temp
      this.temp = prevTemp
    }

    // Buffer swap (AOI)
    {
      const prevAoiTemp = this.prevAoi
      this.prevAoi = this.currAoi
      this.currAoi = this.tempAoi
      this.tempAoi = prevAoiTemp
    }

    // Increment row ID for stamping
    this.rowId++

    if (this.maxNeededCol < this.minNeededCol) return this.deserialize(rawRow)

    const s = rawRow
    const n = s.length
    const delimCh = this.delimCh

    const packedHead = this.packedHead
    const packedIndex = this.packedIndex
    const packedNext = this.packedNext
    const hasPacked = packedIndex.length !== 0

    const aoiStart = this.aoiStart
    const aoiEnd = aoiStart + this.aoiCount

    let col = 0
    let start = 0

    // Process delimited fields (scan only for delimiters)
    for (let i = 0; i < n; i++) {
      if (s.charCodeAt(i) !== delimCh) continue

      const end = i

      if (col >= this.minNeededCol && col <= this.maxNeededCol) {
        // Packed string targets for this col
        if (hasPacked) {
          let node = packedHead[col]
          if (node !== -1) {
            const value = start < end ? s.slice(start, end) : ''
            do {
              this.curr[packedIndex[node]] = value
              this.currStamp[packedIndex[node]] = this.rowId
              node = packedNext[node]
            } while (node !== -1)
          }
        }

        // AOI parsing for this col
        if (col >= aoiStart && col < aoiEnd) {
          const idx = col - aoiStart
          this.currAoi[idx] =
            end === start + 1 && s.charCodeAt(start) === 49 ? 1 : 0
        }
      }

      // Early exit after we closed the last needed col
      if (col >= this.maxNeededCol) {
        // Zero-fill missing AOIs after the last seen AOI column
        if (this.aoiCount > 0) {
          const lastSeenAoi = col >= aoiStart ? col - aoiStart : -1
          const firstMissing = Math.max(0, lastSeenAoi + 1)
          if (firstMissing < this.aoiCount) this.currAoi.fill(0, firstMissing)
        }

        return this.deserialize(rawRow)
      }

      start = i + 1
      col++
    }

    // Handle final field (from start to end-of-line)
    const end = n
    if (col >= this.minNeededCol && col <= this.maxNeededCol) {
      // Packed string targets for this col
      if (hasPacked) {
        let node = packedHead[col]
        if (node !== -1) {
          const value = start < end ? s.slice(start, end) : ''
          do {
            this.curr[packedIndex[node]] = value
            this.currStamp[packedIndex[node]] = this.rowId
            node = packedNext[node]
          } while (node !== -1)
        }
      }

      // AOI parsing for this col
      if (col >= aoiStart && col < aoiEnd) {
        const idx = col - aoiStart
        this.currAoi[idx] =
          end === start + 1 && s.charCodeAt(start) === 49 ? 1 : 0
      }
    }

    // Zero-fill missing AOIs (row truncated or final field)
    if (this.aoiCount > 0) {
      const lastSeenAoi = col >= aoiStart ? col - aoiStart : -1
      const firstMissing = Math.max(0, lastSeenAoi + 1)
      if (firstMissing < this.aoiCount) this.currAoi.fill(0, firstMissing)
    }

    return this.deserialize(rawRow)
  }

  getIndex(header: string[], name: string): number {
    const index = header.indexOf(name)
    if (index === -1) {
      throw new Error(
        `Invalid data file for ${this.constructor.name} deserializer. Column ${name} not found in header`
      )
    }
    return index
  }
}
