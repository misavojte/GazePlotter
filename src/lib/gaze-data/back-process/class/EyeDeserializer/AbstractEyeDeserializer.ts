import type { DeserializerOutputType } from '$lib/gaze-data/back-process/types/DeserializerOutputType.js'

type PackedTarget = { raw: number; packed: number }
type TextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be'

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
  onSegment:
    | ((
        start: number,
        end: number,
        categoryId: number,
        stimulus: Uint8Array,
        participant: Uint8Array,
        aoi: Uint8Array[] | null
      ) => void)
    | null = null
  protected readonly delim: string
  protected readonly delimLen: number
  private readonly delimCh: number
  protected readonly encoding: TextEncoding
  private readonly encodingKind: 0 | 1 | 2
  private readonly delimBytes: Uint8Array
  private readonly delimBytesLen: number

  protected useBinary = false
  private currRowBytes: Uint8Array = new Uint8Array(0)
  private currRangeStart: Uint32Array = new Uint32Array(0)
  private currRangeEnd: Uint32Array = new Uint32Array(0)
  private currRangeStamp: Uint32Array = new Uint32Array(0)

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

  constructor(columnDelimiter: string = ',', encoding: TextEncoding = 'utf-8') {
    if (columnDelimiter.length !== 1) {
      throw new Error(
        `AbstractEyeDeserializer expects a single-character delimiter, got "${columnDelimiter}".`
      )
    }
    this.delim = columnDelimiter
    this.delimLen = 1
    this.delimCh = columnDelimiter.charCodeAt(0)
    this.encoding = encoding
    this.encodingKind =
      encoding === 'utf-16le' ? 1 : encoding === 'utf-16be' ? 2 : 0
    this.delimBytes = this.encodeDelimiter(columnDelimiter, encoding)
    this.delimBytesLen = this.delimBytes.length
  }

  abstract deserialize(rawRowRef: string): void
  abstract finalize(): void

  protected getCurr(index: number): string {
    return this.currStamp[index] === this.rowId ? this.curr[index] : ''
  }

  protected getBytes(index: number): Uint8Array {
    if (this.currRangeStamp[index] !== this.rowId) return new Uint8Array(0)
    const start = this.currRangeStart[index]
    const end = this.currRangeEnd[index]
    if (end <= start) return new Uint8Array(0)
    return this.currRowBytes.subarray(start, end)
  }

  protected getNumber(index: number): number {
    if (this.currRangeStamp[index] !== this.rowId) return Number.NaN
    const start = this.currRangeStart[index]
    const end = this.currRangeEnd[index]
    if (end <= start) return Number.NaN
    return this.parseNumberFromBytes(this.currRowBytes, start, end)
  }

  protected emitSegment(
    start: number,
    end: number,
    categoryId: number,
    stimulus: Uint8Array,
    participant: Uint8Array,
    aoi: Uint8Array[] | null
  ): void {
    if (!this.onSegment) return
    this.onSegment(start, end, categoryId, stimulus, participant, aoi)
  }

  protected setupColumns(indices: number[]): void {
    const count = indices.length
    this.columnMap = indices
    this.curr = new Array(count).fill('')
    this.prev = new Array(count).fill('')
    this.temp = new Array(count)
    this.currStamp = new Uint32Array(count)
    this.currRangeStart = new Uint32Array(count)
    this.currRangeEnd = new Uint32Array(count)
    this.currRangeStamp = new Uint32Array(count)
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

  processRow(rawRow: string): void {
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

    if (this.maxNeededCol < this.minNeededCol) {
      this.deserialize(rawRow)
      return
    }

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

        this.deserialize(rawRow)
        return
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

    this.deserialize(rawRow)
  }

  processRowBytes(rawRow: Uint8Array, decoder: TextDecoder): void {
    if (!this.useBinary) {
      const rowText = decoder.decode(rawRow)
      this.processRow(rowText)
      return
    }
    this.processRowBinary(rawRow)
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

  protected deserializeFromBytes(_rawRowRef: Uint8Array): void {
    throw new Error(
      `Binary deserialization not implemented for ${this.constructor.name}.`
    )
  }

  private processRowBinary(rawRow: Uint8Array): void {
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
    this.currRowBytes = rawRow

    if (this.maxNeededCol < this.minNeededCol) {
      this.deserializeFromBytes(rawRow)
      return
    }

    const bytes = rawRow
    const n = bytes.length
    const delimBytes = this.delimBytes
    const delimBytesLen = this.delimBytesLen
    const isSingleByteDelim = delimBytesLen === 1
    const delimByte = isSingleByteDelim ? delimBytes[0] : 0
    const encodingKind = this.encodingKind

    const packedHead = this.packedHead
    const packedIndex = this.packedIndex
    const packedNext = this.packedNext
    const hasPacked = packedIndex.length !== 0

    const aoiStart = this.aoiStart
    const aoiEnd = aoiStart + this.aoiCount

    let col = 0
    let start = 0

    if (isSingleByteDelim) {
      for (let i = 0; i < n; i++) {
        if (bytes[i] !== delimByte) continue

        const end = i

        if (col >= this.minNeededCol && col <= this.maxNeededCol) {
          if (hasPacked) {
            let node = packedHead[col]
            if (node !== -1) {
              do {
                const packed = packedIndex[node]
                this.currRangeStart[packed] = start
                this.currRangeEnd[packed] = end
                this.currRangeStamp[packed] = this.rowId
                node = packedNext[node]
              } while (node !== -1)
            }
          }

          if (col >= aoiStart && col < aoiEnd) {
            const idx = col - aoiStart
            if (encodingKind === 1) {
              this.currAoi[idx] =
                end === start + 2 &&
                bytes[start] === 49 &&
                bytes[start + 1] === 0
                  ? 1
                  : 0
            } else if (encodingKind === 2) {
              this.currAoi[idx] =
                end === start + 2 &&
                bytes[start] === 0 &&
                bytes[start + 1] === 49
                  ? 1
                  : 0
            } else {
              this.currAoi[idx] =
                end === start + 1 && bytes[start] === 49 ? 1 : 0
            }
          }
        }

        if (col >= this.maxNeededCol) {
          if (this.aoiCount > 0) {
            const lastSeenAoi = col >= aoiStart ? col - aoiStart : -1
            const firstMissing = Math.max(0, lastSeenAoi + 1)
            if (firstMissing < this.aoiCount) this.currAoi.fill(0, firstMissing)
          }
          this.deserializeFromBytes(rawRow)
          return
        }

        start = i + 1
        col++
      }
    } else {
      for (let i = 0; i <= n - delimBytesLen; i++) {
        let match = true
        for (let j = 0; j < delimBytesLen; j++) {
          if (bytes[i + j] !== delimBytes[j]) {
            match = false
            break
          }
        }
        if (!match) continue

        const end = i

        if (col >= this.minNeededCol && col <= this.maxNeededCol) {
          if (hasPacked) {
            let node = packedHead[col]
            if (node !== -1) {
              do {
                const packed = packedIndex[node]
                this.currRangeStart[packed] = start
                this.currRangeEnd[packed] = end
                this.currRangeStamp[packed] = this.rowId
                node = packedNext[node]
              } while (node !== -1)
            }
          }

          if (col >= aoiStart && col < aoiEnd) {
            const idx = col - aoiStart
            if (encodingKind === 1) {
              this.currAoi[idx] =
                end === start + 2 &&
                bytes[start] === 49 &&
                bytes[start + 1] === 0
                  ? 1
                  : 0
            } else if (encodingKind === 2) {
              this.currAoi[idx] =
                end === start + 2 &&
                bytes[start] === 0 &&
                bytes[start + 1] === 49
                  ? 1
                  : 0
            } else {
              this.currAoi[idx] =
                end === start + 1 && bytes[start] === 49 ? 1 : 0
            }
          }
        }

        if (col >= this.maxNeededCol) {
          if (this.aoiCount > 0) {
            const lastSeenAoi = col >= aoiStart ? col - aoiStart : -1
            const firstMissing = Math.max(0, lastSeenAoi + 1)
            if (firstMissing < this.aoiCount) this.currAoi.fill(0, firstMissing)
          }
          this.deserializeFromBytes(rawRow)
          return
        }

        i += delimBytesLen - 1
        start = i + 1
        col++
      }
    }

    const end = n
    if (col >= this.minNeededCol && col <= this.maxNeededCol) {
      if (hasPacked) {
        let node = packedHead[col]
        if (node !== -1) {
          do {
            const packed = packedIndex[node]
            this.currRangeStart[packed] = start
            this.currRangeEnd[packed] = end
            this.currRangeStamp[packed] = this.rowId
            node = packedNext[node]
          } while (node !== -1)
        }
      }

      if (col >= aoiStart && col < aoiEnd) {
        const idx = col - aoiStart
        if (encodingKind === 1) {
          this.currAoi[idx] =
            end === start + 2 && bytes[start] === 49 && bytes[start + 1] === 0
              ? 1
              : 0
        } else if (encodingKind === 2) {
          this.currAoi[idx] =
            end === start + 2 && bytes[start] === 0 && bytes[start + 1] === 49
              ? 1
              : 0
        } else {
          this.currAoi[idx] = end === start + 1 && bytes[start] === 49 ? 1 : 0
        }
      }
    }

    if (this.aoiCount > 0) {
      const lastSeenAoi = col >= aoiStart ? col - aoiStart : -1
      const firstMissing = Math.max(0, lastSeenAoi + 1)
      if (firstMissing < this.aoiCount) this.currAoi.fill(0, firstMissing)
    }

    this.deserializeFromBytes(rawRow)
  }

  private encodeDelimiter(
    delimiter: string,
    encoding: TextEncoding
  ): Uint8Array {
    if (encoding === 'utf-16le' || encoding === 'utf-16be') {
      const out = new Uint8Array(delimiter.length * 2)
      for (let i = 0; i < delimiter.length; i++) {
        const code = delimiter.charCodeAt(i)
        if (encoding === 'utf-16le') {
          out[i * 2] = code & 0xff
          out[i * 2 + 1] = (code >> 8) & 0xff
        } else {
          out[i * 2] = (code >> 8) & 0xff
          out[i * 2 + 1] = code & 0xff
        }
      }
      return out
    }

    const out = new Uint8Array(delimiter.length)
    for (let i = 0; i < delimiter.length; i++) {
      out[i] = delimiter.charCodeAt(i) & 0xff
    }
    return out
  }

  private isAsciiOne(bytes: Uint8Array, start: number, end: number): boolean {
    if (this.encodingKind === 1) {
      return end === start + 2 && bytes[start] === 49 && bytes[start + 1] === 0
    }
    if (this.encodingKind === 2) {
      return end === start + 2 && bytes[start] === 0 && bytes[start + 1] === 49
    }
    return end === start + 1 && bytes[start] === 49
  }

  private parseNumberFromBytes(
    bytes: Uint8Array,
    start: number,
    end: number
  ): number {
    if (this.encoding === 'utf-16le' || this.encoding === 'utf-16be') {
      return this.parseNumberFromUtf16(bytes, start, end)
    }
    return this.parseNumberFromUtf8(bytes, start, end)
  }

  private parseNumberFromUtf8(
    bytes: Uint8Array,
    start: number,
    end: number
  ): number {
    let i = start
    let sign = 1
    let value = 0
    let fraction = 0
    let fractionScale = 1
    let exponent = 0
    let exponentSign = 1
    let sawDigit = false
    let inFraction = false
    let inExponent = false

    for (; i < end; i++) {
      const code = bytes[i]
      if (code === 32 || code === 9) continue
      if (code === 45) {
        if (inExponent) exponentSign = -1
        else sign = -1
        continue
      }
      if (code === 43) continue
      if (code === 46) {
        inFraction = true
        continue
      }
      if (code === 69 || code === 101) {
        inExponent = true
        continue
      }
      if (code < 48 || code > 57) break

      const digit = code - 48
      sawDigit = true
      if (inExponent) {
        exponent = exponent * 10 + digit
      } else if (inFraction) {
        fraction = fraction * 10 + digit
        fractionScale *= 10
      } else {
        value = value * 10 + digit
      }
    }

    if (!sawDigit) return Number.NaN
    let result = sign * (value + fraction / fractionScale)
    if (inExponent && exponent !== 0) {
      result *= Math.pow(10, exponentSign * exponent)
    }
    return result
  }

  private parseNumberFromUtf16(
    bytes: Uint8Array,
    start: number,
    end: number
  ): number {
    let i = start
    let sign = 1
    let value = 0
    let fraction = 0
    let fractionScale = 1
    let exponent = 0
    let exponentSign = 1
    let sawDigit = false
    let inFraction = false
    let inExponent = false

    const isLE = this.encoding === 'utf-16le'

    for (; i + 1 < end; i += 2) {
      const code = isLE
        ? bytes[i] | (bytes[i + 1] << 8)
        : (bytes[i] << 8) | bytes[i + 1]
      if (code === 32 || code === 9) continue
      if (code === 45) {
        if (inExponent) exponentSign = -1
        else sign = -1
        continue
      }
      if (code === 43) continue
      if (code === 46) {
        inFraction = true
        continue
      }
      if (code === 69 || code === 101) {
        inExponent = true
        continue
      }
      if (code < 48 || code > 57) break

      const digit = code - 48
      sawDigit = true
      if (inExponent) {
        exponent = exponent * 10 + digit
      } else if (inFraction) {
        fraction = fraction * 10 + digit
        fractionScale *= 10
      } else {
        value = value * 10 + digit
      }
    }

    if (!sawDigit) return Number.NaN
    let result = sign * (value + fraction / fractionScale)
    if (inExponent && exponent !== 0) {
      result *= Math.pow(10, exponentSign * exponent)
    }
    return result
  }
}
