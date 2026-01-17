import type { EyeSettingsType } from '$lib/gaze-data/back-process/types/EyeSettingsType.js'
import { encodeString } from '$lib/gaze-data/back-process/utils/byteUtils'

const concatUint8 = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  if (a.length === 0) return b
  if (b.length === 0) return a
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

export class ByteSplitter {
  private readonly delimiterBytes: Uint8Array
  private readonly delimiterLength: number
  private readonly isSingleByteDelimiter: boolean
  private readonly delimiterByte: number
  private lastRow: Uint8Array = new Uint8Array(0)

  constructor(settings: EyeSettingsType) {
    this.delimiterBytes = encodeString(settings.rowDelimiter, settings.encoding)
    this.delimiterLength = this.delimiterBytes.length
    this.isSingleByteDelimiter = this.delimiterLength === 1
    this.delimiterByte = this.isSingleByteDelimiter ? this.delimiterBytes[0] : 0
  }

  splitChunk(chunk: Uint8Array): Uint8Array[] {
    if (chunk.length === 0) return []
    const buffer = this.lastRow.length
      ? concatUint8(this.lastRow, chunk)
      : chunk

    const rows: Uint8Array[] = []
    let start = 0
    let lastEnd = -1

    if (this.isSingleByteDelimiter) {
      const d = this.delimiterByte
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] !== d) continue
        rows.push(buffer.subarray(start, i))
        start = i + 1
        lastEnd = start
      }
    } else {
      const d = this.delimiterBytes
      const dLen = this.delimiterLength
      for (let i = 0; i <= buffer.length - dLen; i++) {
        let match = true
        for (let j = 0; j < dLen; j++) {
          if (buffer[i + j] !== d[j]) {
            match = false
            break
          }
        }
        if (!match) continue
        rows.push(buffer.subarray(start, i))
        i += dLen - 1
        start = i + 1
        lastEnd = start
      }
    }

    if (lastEnd === -1) {
      this.lastRow = buffer
      return []
    }

    this.lastRow =
      lastEnd < buffer.length ? buffer.subarray(lastEnd) : new Uint8Array(0)
    return rows
  }

  release(): Uint8Array[] {
    if (this.lastRow.length === 0) return []
    const final = this.lastRow
    this.lastRow = new Uint8Array(0)
    return [final]
  }
}
