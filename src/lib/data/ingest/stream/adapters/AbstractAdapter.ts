type TextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be'

/**
 * Single-character delimiter only.
 * Fast, single-pass scan of row bytes.
 *
 * Notes:
 * - No split().
 * - No indexOf() in the hot path.
 * - Only slices for columns you actually keep.
 * - Early-exits after maxNeededCol is closed.
 * - Zero-fills missing AOI tail to prevent carry-over.
 */
export abstract class AbstractAdapter {
  /**
   * Segment emission callback. Spatial coordinate is optional and set only when available.
   * Different adapters contribute spatial data based on their source format.
   */
  onSegment:
    | ((
        start: number,
        end: number,
        categoryId: number,
        stimulus: Uint8Array,
        participant: Uint8Array,
        aoi: Uint8Array[] | null,
        spatial?: { x: number; y: number } | null
      ) => void)
    | null = null
  protected readonly delim: string
  protected readonly encoding: TextEncoding
  private readonly encodingKind: 0 | 1 | 2
  private readonly delimBytes: Uint8Array
  private readonly delimBytesLen: number

  private currRowBytes: Uint8Array = new Uint8Array(0)
  private currRangeStart: Uint32Array = new Uint32Array(0)
  private currRangeEnd: Uint32Array = new Uint32Array(0)
  private currRangeStamp: Uint32Array = new Uint32Array(0)
  private rowId = 0

  // Binary Double Buffer: AOI data (0 or 1)
  protected currAoi: Uint8Array = new Uint8Array(0)
  protected prevAoi: Uint8Array = new Uint8Array(0)
  private tempAoi: Uint8Array = new Uint8Array(0)

  // Mappings
  protected columnMap: number[] = []
  protected aoiStart = 0
  protected aoiCount = 0

  private binaryRowParser: ((rawRow: Uint8Array) => void) | null = null

  private minNeededCol = 0
  private maxNeededCol = -1

  constructor(columnDelimiter: string = ',', encoding: TextEncoding = 'utf-8') {
    if (columnDelimiter.length !== 1) {
      throw new Error(
        `AbstractAdapter expects a single-character delimiter, got "${columnDelimiter}".`
      )
    }
    this.delim = columnDelimiter
    this.encoding = encoding
    this.encodingKind =
      encoding === 'utf-16le' ? 1 : encoding === 'utf-16be' ? 2 : 0
    this.delimBytes = this.encodeDelimiter(columnDelimiter, encoding)
    this.delimBytesLen = this.delimBytes.length
  }

  abstract finalize(): void

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

  /**
   * Emit a segment to the consumer. Optionally includes spatial coordinates.
   */
  protected emitSegment(
    start: number,
    end: number,
    categoryId: number,
    stimulus: Uint8Array,
    participant: Uint8Array,
    aoi: Uint8Array[] | null,
    spatial?: { x: number; y: number } | null
  ): void {
    if (!this.onSegment) return
    this.onSegment(start, end, categoryId, stimulus, participant, aoi, spatial)
  }

  protected setupColumns(indices: number[]): void {
    const count = indices.length
    this.columnMap = indices
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
    let min = Number.POSITIVE_INFINITY
    let max = -1

    for (let i = 0; i < this.columnMap.length; i++) {
      const raw = this.columnMap[i]
      if (raw < 0) continue
      if (raw < min) min = raw
      if (raw > max) max = raw
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

    this.compileBinaryRowParser()
  }

  processRowBytes(rawRow: Uint8Array, decoder: TextDecoder): void {
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
    if (this.binaryRowParser) {
      this.binaryRowParser(rawRow)
      return
    }
    // Buffer swap (AOI)
    {
      const prevAoiTemp = this.prevAoi
      this.prevAoi = this.currAoi
      this.currAoi = this.tempAoi
      this.tempAoi = prevAoiTemp
    }

    this.rowId++
    this.currRowBytes = rawRow
    this.deserializeFromBytes(rawRow)
  }

  private compileBinaryRowParser(): void {
    if (this.maxNeededCol < this.minNeededCol) {
      const parserSource = `
        return function(rawRow) {
          { const prevAoiTemp = this.prevAoi; this.prevAoi = this.currAoi; this.currAoi = this.tempAoi; this.tempAoi = prevAoiTemp; }
          this.rowId++;
          this.currRowBytes = rawRow;
          this.deserializeFromBytes(rawRow);
        };
      `
      // eslint-disable-next-line no-new-func
      this.binaryRowParser = new Function(parserSource)().bind(this)
      return
    }

    const mapping = new Map<number, { packed: number[] }>()
    for (let packed = 0; packed < this.columnMap.length; packed++) {
      const raw = this.columnMap[packed]
      if (raw < 0) continue
      let entry = mapping.get(raw)
      if (!entry) {
        entry = { packed: [] }
        mapping.set(raw, entry)
      }
      entry.packed.push(packed)
    }

    const cases: string[] = []
    const encodingKind = this.encodingKind
    const entries = Array.from(mapping.entries()).sort((a, b) => a[0] - b[0])
    for (const [raw, entry] of entries) {
      const body: string[] = []
      for (let i = 0; i < entry.packed.length; i++) {
        const packed = entry.packed[i]
        body.push(
          `currRangeStart[${packed}] = start; currRangeEnd[${packed}] = end; currRangeStamp[${packed}] = rowId;`
        )
      }
      cases.push(`case ${raw}: { ${body.join(' ')} break; }`)
    }

    const switchBlock = cases.length
      ? `switch (col) { ${cases.join(' ')} }`
      : ''

    const delimBytes = Array.from(this.delimBytes)
    const delimLen = this.delimBytesLen
    const delimByte = delimLen === 1 ? delimBytes[0] : 0

    const aoiSetter =
      this.aoiCount > 0
        ? encodingKind === 1
          ? `if (col >= aoiStart && col < aoiStart + aoiCount) { const idx = col - aoiStart; currAoi[idx] = end === start + 2 && bytes[start] === 49 && bytes[start + 1] === 0 ? 1 : 0; }`
          : encodingKind === 2
            ? `if (col >= aoiStart && col < aoiStart + aoiCount) { const idx = col - aoiStart; currAoi[idx] = end === start + 2 && bytes[start] === 0 && bytes[start + 1] === 49 ? 1 : 0; }`
            : `if (col >= aoiStart && col < aoiStart + aoiCount) { const idx = col - aoiStart; currAoi[idx] = end === start + 1 && bytes[start] === 49 ? 1 : 0; }`
        : ''

    const parserSource = `
      return function(rawRow) {
        { const prevAoiTemp = this.prevAoi; this.prevAoi = this.currAoi; this.currAoi = this.tempAoi; this.tempAoi = prevAoiTemp; }
        this.rowId++;
        const rowId = this.rowId;
        this.currRowBytes = rawRow;

        const bytes = rawRow;
        const n = bytes.length;
        const currRangeStart = this.currRangeStart;
        const currRangeEnd = this.currRangeEnd;
        const currRangeStamp = this.currRangeStamp;
        const currAoi = this.currAoi;
        const aoiStart = ${this.aoiStart};
        const aoiCount = ${this.aoiCount};
        const maxNeededCol = ${this.maxNeededCol};

        let col = 0;
        let start = 0;

        if (${delimLen} === 1) {
          const d = ${delimByte};
          for (let i = 0; i < n; i++) {
            if (bytes[i] !== d) continue;
            const end = i;
            ${aoiSetter}
            ${switchBlock}
            if (col >= maxNeededCol) {
              if (aoiCount > 0) {
                const lastSeenAoi = col >= aoiStart ? col - aoiStart : -1;
                const firstMissing = Math.max(0, lastSeenAoi + 1);
                if (firstMissing < aoiCount) currAoi.fill(0, firstMissing);
              }
              this.deserializeFromBytes(rawRow);
              return;
            }
            start = i + 1;
            col++;
          }
        } else {
          const d0 = ${delimBytes[0] ?? 0};
          const d1 = ${delimBytes[1] ?? 0};
          const d2 = ${delimBytes[2] ?? 0};
          const d3 = ${delimBytes[3] ?? 0};
          for (let i = 0; i <= n - ${delimLen}; i++) {
            let match = true;
            if (${delimLen} > 0 && bytes[i] !== d0) match = false;
            if (match && ${delimLen} > 1 && bytes[i + 1] !== d1) match = false;
            if (match && ${delimLen} > 2 && bytes[i + 2] !== d2) match = false;
            if (match && ${delimLen} > 3 && bytes[i + 3] !== d3) match = false;
            if (!match) continue;
            const end = i;
            ${aoiSetter}
            ${switchBlock}
            if (col >= maxNeededCol) {
              if (aoiCount > 0) {
                const lastSeenAoi = col >= aoiStart ? col - aoiStart : -1;
                const firstMissing = Math.max(0, lastSeenAoi + 1);
                if (firstMissing < aoiCount) currAoi.fill(0, firstMissing);
              }
              this.deserializeFromBytes(rawRow);
              return;
            }
            i += ${delimLen} - 1;
            start = i + 1;
            col++;
          }
        }

        const end = n;
        ${aoiSetter}
        ${switchBlock}
        if (aoiCount > 0) {
          const lastSeenAoi = col >= aoiStart ? col - aoiStart : -1;
          const firstMissing = Math.max(0, lastSeenAoi + 1);
          if (firstMissing < aoiCount) currAoi.fill(0, firstMissing);
        }
        this.deserializeFromBytes(rawRow);
      };
    `

    // eslint-disable-next-line no-new-func
    this.binaryRowParser = new Function(parserSource)().bind(this)
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
