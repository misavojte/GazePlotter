import type { TextEncoding } from '$lib/data/ingest/utils/byteUtils'
import type { RowEnd } from '$lib/data/ingest/formats/lib/rows/rowScan'

/** A cell or row as byte offsets [start, end) into the scanned bytes. */
export interface ByteRange {
  start: number
  end: number
}

export interface ReferenceRow extends ByteRange {
  cells: ByteRange[]
}

/**
 * Deliberately naive definition of the row spine, the oracle for rowScan.ts:
 * decode to code units, cut rows at the row end, cut cells at the delimiter.
 *  - 'lf': every LF ends a row; 'cr': every CR ends a row.
 *  - 'crlf': a LF preceded by CR (inside the row) ends it; the CR is not
 *    part of the row; any other LF is content.
 *  - Text after the last row end is a final row; an empty input has none.
 *  - UTF-16 is read in whole code units; an odd trailing byte is ignored.
 */
export function referenceRowScan(
  bytes: Uint8Array,
  encoding: TextEncoding,
  rowEnd: RowEnd,
  delimiter: string
): ReferenceRow[] {
  const unit = encoding === 'utf-8' ? 1 : 2
  const n = Math.floor(bytes.length / unit)
  const code = (i: number) =>
    unit === 1
      ? bytes[i]
      : encoding === 'utf-16le'
        ? bytes[2 * i] | (bytes[2 * i + 1] << 8)
        : (bytes[2 * i] << 8) | bytes[2 * i + 1]
  const D = delimiter.charCodeAt(0)

  const rows: ReferenceRow[] = []
  const pushRow = (start: number, end: number) => {
    const cells: ByteRange[] = []
    let cellStart = start
    for (let i = start; i < end; i++) {
      if (code(i) === D) {
        cells.push({ start: cellStart * unit, end: i * unit })
        cellStart = i + 1
      }
    }
    cells.push({ start: cellStart * unit, end: end * unit })
    rows.push({ start: start * unit, end: end * unit, cells })
  }

  let rowStart = 0
  for (let i = 0; i < n; i++) {
    const c = code(i)
    if (rowEnd === 'lf' && c === 10) {
      pushRow(rowStart, i)
      rowStart = i + 1
    } else if (rowEnd === 'cr' && c === 13) {
      pushRow(rowStart, i)
      rowStart = i + 1
    } else if (rowEnd === 'crlf' && c === 10 && i > rowStart && code(i - 1) === 13) {
      pushRow(rowStart, i - 1)
      rowStart = i + 1
    }
  }
  if (rowStart < n) pushRow(rowStart, n)
  return rows
}
