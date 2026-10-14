import { encodeString, type TextEncoding } from '$lib/data/ingest/utils/byteUtils'

/**
 * THE row spine: splits rows and scans columns in one pass, for every
 * encoding (UTF-8; UTF-16LE/BE in code units) and row end (LF, CRLF, CR).
 * Pinned against a naive reference in tests/rowScan.test.ts.
 *
 * Row record (Int32, stride 4 + 2(slotCount + 1)), byte offsets into the
 * input handed to `onRows`:
 *   [rowStart, rowEnd, hitStart, hitCount, s0, e0, .., s(K-1), e(K-1), scratch]
 * Slots start each row as (0, 0) (absent); the scratch pair takes columns
 * nobody reads. Hits are AOI-block columns whose cell is exactly "1".
 */

/** How rows end. 'none': the whole input is one row (single-row scans). */
export type RowEnd = 'lf' | 'crlf' | 'cr' | 'none'

/** What the scanner extracts from each row; built by RowParser. */
export interface RowScanLayout {
  delimiter: string
  encoding: TextEncoding
  rowEnd: RowEnd
  aoiStart: number
  /** Exclusive; equal to aoiStart when there is no AOI block. */
  aoiEnd: number
  maxNeededCol: number
  /** Column -> slot; >= slotCount means scratch. Length maxNeededCol + 1. */
  colSlot: Int32Array
  slotCount: number
}

export function rowEndOf(rowDelimiter: string): RowEnd {
  if (rowDelimiter === '\n') return 'lf'
  if (rowDelimiter === '\r\n') return 'crlf'
  if (rowDelimiter === '\r') return 'cr'
  throw new Error(`Unsupported row delimiter ${JSON.stringify(rowDelimiter)}`)
}

const MAX_ROWS = 4096
const HIT_SLACK = 65536

/** Scans rows from unit `start`; returns rows written, out[0] = consumed unit. */
type ChunkScanner = (
  inp: Uint8Array | Uint16Array,
  words: Float64Array,
  wordShift: number,
  start: number,
  fin: boolean,
  rec: Int32Array,
  hits: Int32Array,
  out: Int32Array
) => number

/** A compiled scanner and its record buffers. */
class Scanner {
  readonly stride: number
  readonly rec: Int32Array
  readonly hits: Int32Array
  readonly unit: 1 | 2
  /** Byte offset where the last scan stopped. */
  consumed = 0
  private readonly scanChunk: ChunkScanner
  private readonly out = new Int32Array(1)

  constructor(layout: RowScanLayout, maxRows: number) {
    this.unit = layout.encoding === 'utf-8' ? 1 : 2
    this.stride = 4 + 2 * (layout.slotCount + 1)
    const aoiCount = layout.aoiEnd - layout.aoiStart
    const hitCap = aoiCount > 0 ? aoiCount + HIT_SLACK : 1
    this.rec = new Int32Array(maxRows * this.stride)
    this.hits = new Int32Array(hitCap)
    this.scanChunk = compileChunkScanner(layout, this.stride, maxRows, hitCap)
  }

  /** Scans `input` from byte `start`; UTF-16 input must be 2-aligned and even. */
  scan(input: Uint8Array, start: number, fin: boolean): number {
    const unit = this.unit
    const units = unit === 1 ? input : new Uint16Array(input.buffer, input.byteOffset, input.length >> 1)
    // 8-byte-aligned float64 view for the AOI tab skip.
    const at = (input.byteOffset + 7) & ~7
    const end = input.byteOffset + input.length
    const words = end > at ? new Float64Array(input.buffer, at, (end - at) >> 3) : new Float64Array(0)
    const rows = this.scanChunk(units, words, (input.byteOffset - at) / unit, start / unit, fin, this.rec, this.hits, this.out)
    this.consumed = this.out[0] * unit
    return rows
  }
}

/** UTF-16 needs whole code units at an even address. */
function aligned(bytes: Uint8Array, unit: 1 | 2): Uint8Array {
  if (unit === 1) return bytes
  const even = bytes.length & ~1
  return bytes.byteOffset & 1 ? bytes.slice(0, even) : bytes.subarray(0, even)
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

/** Chunks in, row batches out: `onRows` reads `rec` / `hits` before the next batch. */
export class RowScanFeed extends Scanner {
  private readonly rowEnd: RowEnd
  private carry: Uint8Array = new Uint8Array(0)

  constructor(
    layout: RowScanLayout,
    private readonly onRows: (input: Uint8Array, count: number) => void
  ) {
    super(layout, MAX_ROWS)
    this.rowEnd = layout.rowEnd
  }

  push(chunk: Uint8Array): void {
    if (chunk.length === 0) return
    if (this.unit === 2) {
      // Carry and chunk in one even-addressed buffer; a split code unit's
      // first byte stays in the carry.
      let buffer = concat(this.carry, chunk)
      if (buffer.byteOffset & 1) buffer = buffer.slice()
      this.carry = buffer.subarray(this.run(buffer.subarray(0, buffer.length & ~1), false))
      return
    }
    if (this.carry.length > 0) {
      // Only the row straddling the boundary is copied, never the chunk.
      const end = this.firstRowEnd(chunk)
      if (end === -1) {
        this.carry = concat(this.carry, chunk)
        return
      }
      this.run(concat(this.carry, chunk.subarray(0, end + 1)), false)
      chunk = chunk.subarray(end + 1)
    }
    this.carry = chunk.subarray(this.run(chunk, false))
  }

  /** The rest is the last row; an odd UTF-16 byte is dropped. */
  finish(): void {
    if (this.carry.length > 0) this.run(aligned(this.carry, this.unit), true)
    this.carry = new Uint8Array(0)
  }

  /** Scans exactly one row (a 'none' layout); an empty row is a row too. */
  scanRow(row: Uint8Array): void {
    const input = aligned(row, this.unit)
    if (input.length > 0) {
      this.run(input, true)
      return
    }
    this.rec.fill(0, 0, this.stride)
    this.onRows(input, 1)
  }

  /** UTF-8: the byte index ending the carried row in `chunk`, or -1. */
  private firstRowEnd(chunk: Uint8Array): number {
    const rt = this.rowEnd === 'cr' ? 13 : 10
    let idx = chunk.indexOf(rt)
    if (this.rowEnd !== 'crlf') return idx
    while (idx !== -1 && (idx > 0 ? chunk[idx - 1] : this.carry[this.carry.length - 1]) !== 13) {
      idx = chunk.indexOf(rt, idx + 1)
    }
    return idx
  }

  /** Scans `input` in batches; returns the byte offset of its unfinished tail. */
  private run(input: Uint8Array, fin: boolean): number {
    let pos = 0
    let rows: number
    while ((rows = this.scan(input, pos, fin)) > 0) {
      this.onRows(input, rows)
      pos = this.consumed
    }
    return pos
  }
}

/** Splits the leading rows (skipped rows, header) one at a time, before a parser exists. */
export class LeadingRows {
  private readonly scanner: Scanner
  private pending: Uint8Array = new Uint8Array(0)

  constructor(encoding: TextEncoding, rowDelimiter: string) {
    const rowsOnly = { aoiStart: 0, aoiEnd: 0, maxNeededCol: 0, colSlot: new Int32Array([1]), slotCount: 1 }
    this.scanner = new Scanner({ ...rowsOnly, delimiter: '\t', encoding, rowEnd: rowEndOf(rowDelimiter) }, 1)
  }

  push(chunk: Uint8Array): void {
    this.pending = concat(this.pending, chunk)
  }

  /** The next complete row (with `fin`, also a trailing one), or null. */
  next(fin: boolean): Uint8Array | null {
    const input = aligned(this.pending, this.scanner.unit)
    if (input.length === 0 || this.scanner.scan(input, 0, fin) === 0) return null
    const row = input.subarray(this.scanner.rec[0], this.scanner.rec[1])
    this.pending = this.pending.subarray(this.scanner.consumed)
    return row
  }

  /** Everything not yet returned as a row. */
  rest(): Uint8Array {
    const rest = this.pending
    this.pending = new Uint8Array(0)
    return rest
  }
}

/** Code unit of `char` in `encoding`, as the scanner's view reads it. */
function unitOf(char: string, encoding: TextEncoding): number {
  const bytes = encodeString(char, encoding)
  if (encoding !== 'utf-8') return new Uint16Array(bytes.slice(0, 2).buffer)[0]
  if (bytes.length !== 1) throw new Error(`Delimiter ${JSON.stringify(char)} must be one byte in UTF-8`)
  return bytes[0]
}

/** Eight bytes of encoded tabs as one float64 (=== is exact unless NaN or 0). */
function tabWord(encoding: TextEncoding, unit: 1 | 2): number | null {
  const value = new Float64Array(encodeString('\t'.repeat(8 / unit), encoding).slice(0, 8).buffer)[0]
  return Number.isNaN(value) || value === 0 ? null : value
}

/**
 * One scanner per layout, constants inlined, over code units. Tab files:
 * one `> 13` test clears a content unit; AOI tab runs skip 8/16 bytes per
 * word compare; past the last needed column, indexOf jumps to the row end.
 */
function compileChunkScanner(layout: RowScanLayout, stride: number, maxRows: number, hitCap: number): ChunkScanner {
  const enc = layout.encoding
  const unit: 1 | 2 = enc === 'utf-8' ? 1 : 2
  const D = unitOf(layout.delimiter, enc)
  const LF = unitOf('\n', enc)
  const CR = unitOf('\r', enc)
  const ONE = unitOf('1', enc)
  const mode = layout.rowEnd
  const RT = mode === 'cr' ? CR : LF // the unit that ends a row
  const max = layout.maxNeededCol
  const { aoiStart, aoiEnd } = layout
  const aoiCount = aoiEnd - aoiStart
  // No needed column inside the AOI block: its cells only yield hits.
  let aoiFast = aoiCount > 0
  for (let c = aoiStart; c < aoiEnd && c <= max; c++) if (layout.colSlot[c] < layout.slotCount) aoiFast = false
  const TAB_WORD = aoiFast && layout.delimiter === '\t' ? tabWord(enc, unit) : null
  const perWord = 8 / unit
  const B = (x: string) => (unit === 1 ? x : `(${x}) << 1`) // units -> bytes

  // Record offset of each column's pair (scratch for unread columns: no branch).
  const OFF = new Int32Array(max + 1)
  for (let c = 0; c <= max; c++) OFF[c] = 4 + 2 * Math.min(layout.colSlot[c], layout.slotCount)
  const store = (colExpr: string, e: string) =>
    `{ const o = r + OFF[${colExpr}]; rec[o] = ${B('s')}; rec[o + 1] = ${B(e)}; }`
  // Does the RT unit at i end the row?
  const isRowEnd = mode === 'none' ? 'false' : mode === 'crlf' ? `(i !== pos && inp[i - 1] === ${CR})` : 'true'
  const endAt = mode === 'crlf' ? 'i - 1' : 'i'
  // Row not finished in this input: drop its hits, resume here next call.
  const incomplete = 'if (!fin) { hitN = rowHit; break rows; }'
  const skipToRowEnd =
    mode === 'none'
      ? `{ rowEnd = len; next = len; break row; }`
      : `{
    let lf = inp.indexOf(${RT}, i);
    ${mode === 'crlf' ? `while (lf !== -1 && inp[lf - 1] !== ${CR}) lf = inp.indexOf(${RT}, lf + 1);` : ''}
    if (lf === -1) { ${incomplete} rowEnd = len; next = len; }
    else { rowEnd = ${mode === 'crlf' ? 'lf - 1' : 'lf'}; next = lf + 1; }
    break row;
  }`

  // Columns [lo, hi) outside the AOI block.
  const plain = (lo: number, hi: number) => {
    if (lo > max) return skipToRowEnd
    const bounded = Number.isFinite(hi)
    return `
      for (; i < len; i++) {
        const c = inp[i];
        ${Math.max(D, LF, CR) < 14 ? 'if (c > 13) continue;' : ''}
        if (c === ${D}) {
          ${store('col', 'i')}
          ${bounded ? '' : `if (col >= ${max}) { i++; ${skipToRowEnd} }`}
          s = i + 1;
          col++;
          ${bounded ? `if (col === ${hi}) { i++; break; }` : ''}
          continue;
        }
        if (c !== ${RT} || !${isRowEnd}) continue;
        rowEnd = ${endAt}; next = i + 1;
        ${store('col', 'rowEnd')}
        break row;
      }
      if (${bounded ? `col < ${hi}` : 'true'}) {
        ${incomplete}
        rowEnd = len; next = len;
        ${store('col', 'len')}
        break row;
      }`
  }

  const aoi = () => {
    const hit = (e: string) => `if (${e} === s + 1 && inp[s] === ${ONE}) hits[hitN++] = idx;`
    const cell = (e: string) => (aoiFast ? '' : store(`idx + ${aoiStart}`, e))
    // After a tab the open cell is empty, so following tabs end only empty
    // cells: take them singly until 8-byte aligned, then by word.
    const wordSkip =
      TAB_WORD === null
        ? ''
        : `for (;;) {
           if (((i + wordShift) & ${perWord - 1}) === 0) {
             const w = (i + wordShift) >> ${unit === 1 ? 3 : 2};
             if (i + ${2 * perWord} <= len && idx + ${2 * perWord} < ${aoiCount} && words[w] === TAB_WORD && words[w + 1] === TAB_WORD) { idx += ${2 * perWord}; i += ${2 * perWord}; continue; }
             if (i + ${perWord} <= len && idx + ${perWord} < ${aoiCount} && words[w] === TAB_WORD) { idx += ${perWord}; i += ${perWord}; continue; }
             break;
           }
           if (i < len && inp[i] === ${D} && idx + 1 < ${aoiCount}) { idx++; i++; continue; }
           break;
         }
         s = i;`
    return `
      {
        let idx = 0;
        while (i < len) {
          const c = inp[i];
          if (c === ${D}) {
            ${hit('i')}
            ${cell('i')}
            i++;
            s = i;
            if (++idx === ${aoiCount}) break;
            ${wordSkip}
            continue;
          }
          if (c === ${RT} && ${isRowEnd}) {
            rowEnd = ${endAt}; next = i + 1;
            ${hit('rowEnd')}
            ${cell('rowEnd')}
            break row;
          }
          i++;
        }
        if (idx < ${aoiCount}) {
          ${incomplete}
          rowEnd = len; next = len;
          ${hit('len')}
          ${cell('len')}
          break row;
        }
        col = ${aoiEnd};
      }`
  }

  const body =
    aoiCount === 0
      ? plain(0, Number.POSITIVE_INFINITY)
      : (aoiStart > 0 ? plain(0, aoiStart) : '') + aoi() + plain(aoiEnd, Number.POSITIVE_INFINITY)

  const source = `
    const TAB_WORD = ${TAB_WORD ?? 0};
    return function scanChunk(inp, words, wordShift, start, fin, rec, hits, out) {
      const len = inp.length;
      let rowCount = 0;
      let hitN = 0;
      let r = 0;
      let pos = start;
      rows: while (pos < len && rowCount < ${maxRows} && ${hitCap} - hitN >= ${aoiCount}) {
        const rowHit = hitN;
        rec[r] = ${B('pos')};
        rec[r + 2] = hitN;
        for (let z = r + 4; z < r + ${4 + 2 * layout.slotCount}; z++) rec[z] = 0;
        let i = pos;
        let s = pos;
        let col = 0;
        let rowEnd = -1;
        let next = -1;
        row: {
          ${body}
        }
        rec[r + 1] = ${B('rowEnd')};
        rec[r + 3] = hitN - rowHit;
        rowCount++;
        r += ${stride};
        pos = next;
      }
      out[0] = pos;
      return rowCount;
    };`
  return new Function('OFF', source)(OFF) as ChunkScanner
}
