import type { EventContribution } from '../../../kernel/sink'
import type { DatasetExclusionIssue } from '$lib/data/types'
import { FIXATION_SEED_NAME } from '$lib/data/binary'
import type { TextEncoding } from '$lib/data/ingest/utils/byteUtils'
import { RowScanFeed, rowEndOf, type RowEnd, type RowScanLayout } from './rowScan'

/**
 * Base of every row format's parser. Subclasses declare the columns they read
 * (setupColumns / setupAoiColumns) and interpret one row at a time in
 * deserializeFromBytes, reading cells with getBytes / getNumber / cellEquals.
 * Rows and cells come from the one-pass scanner in ./rowScan.ts.
 */
export abstract class RowParser {
  /**
   * Segment emission callback. Spatial coordinate is optional and set only when available.
   * Different parsers contribute spatial data based on their source format.
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

  /**
   * Intern an eye-movement-category NAME (decoded string) to a stable id
   * (Fixation reserved at 0). Wired to the dataset sink in production so ids are
   * consistent across files of any encoding; null when a parser runs standalone
   * (see `resolveCategoryId`).
   */
  internCategory: ((name: string) => number) | null = null

  /** Event-channel emission callback (cold path — event rows are sparse). */
  onEvent: ((event: EventContribution) => void) | null = null

  /** Non-fatal issue reporting (surfaced as a toast after the upload). */
  onWarning: ((message: string) => void) | null = null

  /**
   * Open a (stimulus, participant) group as provisional and get a stable handle.
   * Segments written under these byte keys are held back until the group is
   * committed; an uncommitted group is dropped. A gating parser (Tobii interval
   * mode) opens every interval group it emits, then commits only the validated
   * ones — so invalid data is never released to the writer. The keys must match
   * those passed to `onSegment`.
   */
  onBeginProvisionalGroup:
    | ((stimulus: Uint8Array, participant: Uint8Array) => number)
    | null = null
  /** Confirm a provisional group valid (by the handle `onBeginProvisionalGroup` returned). */
  onCommitProvisionalGroup: ((handle: number) => void) | null = null
  /** Reject a provisional group: its segments are discarded. */
  onDropProvisionalGroup: ((handle: number) => void) | null = null
  /**
   * Record a persisted exclusion notice (decoded names + the pairing `issues`),
   * surfaced to the user after import. Independent of dropping.
   */
  onRecordExclusion:
    | ((
        stimulus: string,
        participant: string,
        issues: DatasetExclusionIssue[]
      ) => void)
    | null = null
  protected readonly delim: string
  protected readonly encoding: TextEncoding

  private currRowBytes: Uint8Array = new Uint8Array(0)
  // Cell p of the current row is currRowBytes[ranges[o], ranges[o + 1]) with
  // o = rangeBase + rangeOffset[p]: `ranges` is the row-scan feed's record
  // buffer, so scanned rows are read in place; an absent cell is (0, 0).
  private ranges: Int32Array = new Int32Array(0)
  private rangeOffset: Int32Array = new Int32Array(0)
  private rangeBase = 0

  // AOI-block column indices (0-based within the block) whose cell is "1"
  // on the current row: aoiHits[aoiHitStart, aoiHitStart + aoiHitLen).
  protected aoiHits: Int32Array = new Int32Array(0)
  protected aoiHitStart = 0
  protected aoiHitLen = 0

  // Mappings
  protected columnMap: number[] = []
  protected aoiStart = 0
  protected aoiCount = 0

  /** Single-row feed behind processRowBytes; rebuilt when columns change. */
  private rowFeed: RowScanFeed | null = null

  constructor(columnDelimiter: string = ',', encoding: TextEncoding = 'utf-8') {
    if (columnDelimiter.length !== 1 || '\n\r1'.includes(columnDelimiter)) {
      throw new Error(
        `RowParser expects a single-character delimiter other than a row end or "1", got "${columnDelimiter}".`
      )
    }
    this.delim = columnDelimiter
    this.encoding = encoding
  }

  abstract finalize(): void

  /** Shared empty result — getBytes is on the per-row path; no allocation. */
  protected static readonly EMPTY_BYTES = new Uint8Array(0)

  protected getBytes(index: number): Uint8Array {
    const o = this.rangeBase + this.rangeOffset[index]
    const start = this.ranges[o]
    const end = this.ranges[o + 1]
    if (end <= start) return RowParser.EMPTY_BYTES
    return this.currRowBytes.subarray(start, end)
  }

  /** Byte length of a cell (0 when absent); no allocation. */
  protected cellLength(index: number): number {
    const o = this.rangeBase + this.rangeOffset[index]
    const len = this.ranges[o + 1] - this.ranges[o]
    return len > 0 ? len : 0
  }

  /** bytesEqual(getBytes(index), bytes) without slicing (null = empty). */
  protected cellEquals(index: number, bytes: Uint8Array | null): boolean {
    const o = this.rangeBase + this.rangeOffset[index]
    const start = this.ranges[o]
    const len = Math.max(0, this.ranges[o + 1] - start)
    if (bytes === null) return len === 0
    if (len !== bytes.length) return false
    const row = this.currRowBytes
    for (let i = 0; i < len; i++) if (row[start + i] !== bytes[i]) return false
    return true
  }

  protected getNumber(index: number): number {
    const o = this.rangeBase + this.rangeOffset[index]
    const start = this.ranges[o]
    const end = this.ranges[o + 1]
    if (end <= start) return Number.NaN
    return this.parseNumberFromBytes(this.currRowBytes, start, end)
  }

  /**
   * Resolve an eye-movement-category to a category id from the source's raw type
   * bytes (or canonical name bytes a parser substitutes). The bytes are decoded
   * to a string and interned by name, so identity is encoding-independent and a
   * type from a differently-encoded file in the same upload coalesces correctly.
   * Uses the sink's interner when wired; otherwise interns locally with the same
   * Fixation-reserved-at-0 rule so standalone parsers (unit tests) behave
   * identically. Pass the canonical "Fixation" bytes for fixations so they map
   * to id 0.
   */
  protected resolveCategoryId(nameBytes: Uint8Array): number {
    if (!this.categoryDecoder) {
      this.categoryDecoder = new TextDecoder(this.encoding)
    }
    const name = this.categoryDecoder.decode(nameBytes)
    if (this.internCategory) return this.internCategory(name)
    if (!this.localCategoryIds) this.localCategoryIds = new Map([[FIXATION_SEED_NAME, 0]])
    let id = this.localCategoryIds.get(name)
    if (id === undefined) {
      id = this.localCategoryIds.size
      this.localCategoryIds.set(name, id)
    }
    return id
  }

  /** Decoder + local interner used only when no sink is wired (see above). */
  private categoryDecoder: TextDecoder | null = null
  private localCategoryIds: Map<string, number> | null = null

  protected setupColumns(indices: number[]): void {
    this.columnMap = indices
    this.rowFeed = null
  }

  protected setupAoiColumns(startIndex: number, count: number): void {
    this.aoiStart = startIndex
    this.aoiCount = count
    this.rowFeed = null
  }

  /** Parses one row given without its row delimiter (tests, single rows). */
  processRowBytes(rawRow: Uint8Array): void {
    this.rowFeed ??= this.openFeed('none')
    this.rowFeed.scanRow(rawRow)
  }

  /** The feed for a file's data rows (rows + columns in one pass). */
  openRowScanFeed(rowDelimiter: string): RowScanFeed {
    return this.openFeed(rowEndOf(rowDelimiter))
  }

  /** A feed over this parser's columns; points getBytes at its record slots. */
  private openFeed(rowEnd: RowEnd): RowScanFeed {
    // Needed columns get a slot each, absent ones an always-zero slot, the
    // rest the scanner's scratch slot. Column 0 is scanned even if unread.
    let max = 0
    for (const raw of this.columnMap) if (raw > max) max = raw
    if (this.aoiCount > 0) max = Math.max(max, this.aoiStart + this.aoiCount - 1)
    const colSlot = new Int32Array(max + 1).fill(-1)
    let slotCount = 0
    for (const raw of this.columnMap) {
      if (raw >= 0 && colSlot[raw] === -1) colSlot[raw] = slotCount++
    }
    this.rangeOffset = Int32Array.from(this.columnMap, raw => 4 + 2 * (raw >= 0 ? colSlot[raw] : slotCount))
    for (let c = 0; c <= max; c++) if (colSlot[c] === -1) colSlot[c] = slotCount + 1
    const layout: RowScanLayout = {
      delimiter: this.delim,
      encoding: this.encoding,
      rowEnd,
      aoiStart: this.aoiStart,
      aoiEnd: this.aoiStart + this.aoiCount,
      maxNeededCol: max,
      colSlot,
      slotCount: slotCount + 1,
    }
    const feed: RowScanFeed = new RowScanFeed(layout, (input, count) => this.processScannedRows(input, count, feed))
    return feed
  }

  /** Scanned batch: point the range reads at each row record in turn. */
  private processScannedRows(
    input: Uint8Array,
    count: number,
    feed: RowScanFeed
  ): void {
    const rec = feed.rec
    const stride = feed.stride
    this.currRowBytes = input
    this.ranges = rec
    this.aoiHits = feed.hits
    for (let r = 0, base = 0; r < count; r++, base += stride) {
      this.rangeBase = base
      this.aoiHitStart = rec[base + 2]
      this.aoiHitLen = rec[base + 3]
      this.deserializeFromBytes()
    }
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

  protected findOptionalColumn(header: string[], target: string): number {
    for (let i = 0; i < header.length; i++) {
      if (header[i].trim().toLowerCase() === target) return i
    }
    return -1
  }

  protected deserializeFromBytes(): void {
    throw new Error(
      `Binary deserialization not implemented for ${this.constructor.name}.`
    )
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

  /**
   * Read the optional spatial coordinate from the packed x/y columns.
   * `undefined` = no spatial columns configured (either raw index is -1);
   * `null` = columns exist but this row's values are not finite numbers.
   */
  protected getSpatial(
    cX: number,
    cY: number,
    pX: number,
    pY: number
  ): { x: number; y: number } | null | undefined {
    if (cX === -1 || cY === -1) return undefined
    const x = this.getNumber(pX)
    const y = this.getNumber(pY)
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  }
}

