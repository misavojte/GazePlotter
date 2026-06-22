import type { ParseSettings } from '../../../types'
import { encodeString } from '$lib/data/ingest/utils/byteUtils'

const concatUint8 = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  if (a.length === 0) return b
  if (b.length === 0) return a
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

export class RowSplitter {
  private readonly delimiterBytes: Uint8Array
  private readonly delimiterLength: number
  private readonly isSingleByteDelimiter: boolean
  private readonly delimiterByte: number
  private readonly isCRLFDelimiter: boolean
  private lastRow: Uint8Array = new Uint8Array(0)

  constructor(settings: ParseSettings) {
    this.delimiterBytes = encodeString(settings.rowDelimiter, settings.encoding)
    this.delimiterLength = this.delimiterBytes.length
    this.isSingleByteDelimiter = this.delimiterLength === 1
    this.delimiterByte = this.isSingleByteDelimiter ? this.delimiterBytes[0] : 0
    this.isCRLFDelimiter =
      this.delimiterLength === 2 &&
      this.delimiterBytes[0] === 13 &&
      this.delimiterBytes[1] === 10
  }

  splitChunk(chunk: Uint8Array): Uint8Array[] {
    if (chunk.length === 0) return []
    if (this.isSingleByteDelimiter) {
      return this.splitSingleByte(chunk)
    }
    if (this.isCRLFDelimiter) {
      return this.splitCRLF(chunk)
    }
    return this.splitMultiByte(chunk)
  }

  processChunk(chunk: Uint8Array, onRow: (row: Uint8Array) => void): void {
    if (chunk.length === 0) return
    if (this.isSingleByteDelimiter) {
      this.processSingleByte(chunk, onRow)
      return
    }
    if (this.isCRLFDelimiter) {
      this.processCRLF(chunk, onRow)
      return
    }
    this.processMultiByte(chunk, onRow)
  }

  private splitSingleByte(chunk: Uint8Array): Uint8Array[] {
    const rows: Uint8Array[] = []
    const d = this.delimiterByte
    let start = 0

    if (this.lastRow.length > 0) {
      const firstDelim = chunk.indexOf(d, 0)
      if (firstDelim === -1) {
        this.lastRow = concatUint8(this.lastRow, chunk)
        return rows
      }

      rows.push(concatUint8(this.lastRow, chunk.subarray(0, firstDelim)))
      this.lastRow = new Uint8Array(0)
      start = firstDelim + 1
    }

    let idx = chunk.indexOf(d, start)
    while (idx !== -1) {
      rows.push(chunk.subarray(start, idx))
      start = idx + 1
      idx = chunk.indexOf(d, start)
    }

    this.lastRow =
      start < chunk.length ? chunk.subarray(start) : new Uint8Array(0)
    return rows
  }

  private processSingleByte(
    chunk: Uint8Array,
    onRow: (row: Uint8Array) => void
  ): void {
    const d = this.delimiterByte
    let start = 0

    if (this.lastRow.length > 0) {
      const firstDelim = chunk.indexOf(d, 0)
      if (firstDelim === -1) {
        this.lastRow = concatUint8(this.lastRow, chunk)
        return
      }

      onRow(concatUint8(this.lastRow, chunk.subarray(0, firstDelim)))
      this.lastRow = new Uint8Array(0)
      start = firstDelim + 1
    }

    let idx = chunk.indexOf(d, start)
    while (idx !== -1) {
      onRow(chunk.subarray(start, idx))
      start = idx + 1
      idx = chunk.indexOf(d, start)
    }

    this.lastRow =
      start < chunk.length ? chunk.subarray(start) : new Uint8Array(0)
  }

  private splitCRLF(chunk: Uint8Array): Uint8Array[] {
    const rows: Uint8Array[] = []
    let start = 0

    if (this.lastRow.length > 0) {
      if (
        this.lastRow[this.lastRow.length - 1] === 13 &&
        chunk.length > 0 &&
        chunk[0] === 10
      ) {
        rows.push(this.lastRow.subarray(0, this.lastRow.length - 1))
        this.lastRow = new Uint8Array(0)
        start = 1
      } else {
        const firstDelim = this.findNextCRLF(chunk, start)
        if (firstDelim === -1) {
          this.lastRow = concatUint8(this.lastRow, chunk)
          return rows
        }
        rows.push(concatUint8(this.lastRow, chunk.subarray(0, firstDelim - 1)))
        this.lastRow = new Uint8Array(0)
        start = firstDelim + 1
      }
    }

    let idx = this.findNextCRLF(chunk, start)
    while (idx !== -1) {
      rows.push(chunk.subarray(start, idx - 1))
      start = idx + 1
      idx = this.findNextCRLF(chunk, start)
    }

    this.lastRow =
      start < chunk.length ? chunk.subarray(start) : new Uint8Array(0)
    return rows
  }

  private processCRLF(
    chunk: Uint8Array,
    onRow: (row: Uint8Array) => void
  ): void {
    let start = 0

    if (this.lastRow.length > 0) {
      if (
        this.lastRow[this.lastRow.length - 1] === 13 &&
        chunk.length > 0 &&
        chunk[0] === 10
      ) {
        onRow(this.lastRow.subarray(0, this.lastRow.length - 1))
        this.lastRow = new Uint8Array(0)
        start = 1
      } else {
        const firstDelim = this.findNextCRLF(chunk, start)
        if (firstDelim === -1) {
          this.lastRow = concatUint8(this.lastRow, chunk)
          return
        }
        onRow(concatUint8(this.lastRow, chunk.subarray(0, firstDelim - 1)))
        this.lastRow = new Uint8Array(0)
        start = firstDelim + 1
      }
    }

    let idx = this.findNextCRLF(chunk, start)
    while (idx !== -1) {
      onRow(chunk.subarray(start, idx - 1))
      start = idx + 1
      idx = this.findNextCRLF(chunk, start)
    }

    this.lastRow =
      start < chunk.length ? chunk.subarray(start) : new Uint8Array(0)
  }

  private splitMultiByte(chunk: Uint8Array): Uint8Array[] {
    const buffer = this.lastRow.length
      ? concatUint8(this.lastRow, chunk)
      : chunk

    const rows: Uint8Array[] = []
    const d = this.delimiterBytes
    const dLen = this.delimiterLength
    const first = d[0]
    let start = 0

    let idx = buffer.indexOf(first, 0)
    while (idx !== -1 && idx <= buffer.length - dLen) {
      let match = true
      for (let j = 1; j < dLen; j++) {
        if (buffer[idx + j] !== d[j]) {
          match = false
          break
        }
      }
      if (match) {
        rows.push(buffer.subarray(start, idx))
        start = idx + dLen
        idx = buffer.indexOf(first, start)
        continue
      }
      idx = buffer.indexOf(first, idx + 1)
    }

    if (rows.length === 0 && start === 0) {
      this.lastRow = buffer
      return rows
    }

    this.lastRow =
      start < buffer.length ? buffer.subarray(start) : new Uint8Array(0)
    return rows
  }

  private processMultiByte(
    chunk: Uint8Array,
    onRow: (row: Uint8Array) => void
  ): void {
    const buffer = this.lastRow.length
      ? concatUint8(this.lastRow, chunk)
      : chunk

    const d = this.delimiterBytes
    const dLen = this.delimiterLength
    const first = d[0]
    let start = 0

    let idx = buffer.indexOf(first, 0)
    while (idx !== -1 && idx <= buffer.length - dLen) {
      let match = true
      for (let j = 1; j < dLen; j++) {
        if (buffer[idx + j] !== d[j]) {
          match = false
          break
        }
      }
      if (match) {
        onRow(buffer.subarray(start, idx))
        start = idx + dLen
        idx = buffer.indexOf(first, start)
        continue
      }
      idx = buffer.indexOf(first, idx + 1)
    }

    if (start === 0) {
      this.lastRow = buffer
      return
    }

    this.lastRow =
      start < buffer.length ? buffer.subarray(start) : new Uint8Array(0)
  }

  private findNextCRLF(buffer: Uint8Array, from: number): number {
    let idx = buffer.indexOf(10, from)
    while (idx !== -1) {
      if (idx > 0 && buffer[idx - 1] === 13) return idx
      idx = buffer.indexOf(10, idx + 1)
    }
    return -1
  }

  release(): Uint8Array[] {
    if (this.lastRow.length === 0) return []
    const final = this.lastRow
    this.lastRow = new Uint8Array(0)
    return [final]
  }

  releaseTo(onRow: (row: Uint8Array) => void): void {
    if (this.lastRow.length === 0) return
    const final = this.lastRow
    this.lastRow = new Uint8Array(0)
    onRow(final)
  }
}
