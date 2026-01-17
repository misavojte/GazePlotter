export type TextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be'

export const encodeString = (
  value: string,
  encoding: TextEncoding
): Uint8Array => {
  if (encoding === 'utf-16le' || encoding === 'utf-16be') {
    const out = new Uint8Array(value.length * 2)
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i)
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
  const out = new Uint8Array(value.length)
  for (let i = 0; i < value.length; i++) out[i] = value.charCodeAt(i) & 0xff
  return out
}

export const decodeBytes = (
  bytes: Uint8Array,
  decoder: TextDecoder,
  emptyValue = ''
): string => {
  if (!bytes.length) return emptyValue
  return decoder.decode(bytes)
}

export const bytesEqual = (a: Uint8Array, b: Uint8Array | null): boolean => {
  if (b === null) return a.length === 0
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export const startsWithBytes = (
  value: Uint8Array,
  prefix: Uint8Array
): boolean => {
  if (prefix.length === 0 || value.length < prefix.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (value[i] !== prefix[i]) return false
  }
  return true
}

export const endsWithBytes = (
  value: Uint8Array,
  suffix: Uint8Array
): boolean => {
  if (suffix.length === 0 || value.length < suffix.length) return false
  const offset = value.length - suffix.length
  for (let i = 0; i < suffix.length; i++) {
    if (value[offset + i] !== suffix[i]) return false
  }
  return true
}

export const trimEndSpaces = (
  bytes: Uint8Array,
  encoding: TextEncoding
): Uint8Array => {
  if (!bytes.length) return bytes
  let end = bytes.length
  if (encoding === 'utf-16le') {
    while (end >= 2 && bytes[end - 2] === 32 && bytes[end - 1] === 0) end -= 2
    return bytes.subarray(0, end)
  }
  if (encoding === 'utf-16be') {
    while (end >= 2 && bytes[end - 2] === 0 && bytes[end - 1] === 32) end -= 2
    return bytes.subarray(0, end)
  }
  while (end > 0 && bytes[end - 1] === 32) end--
  return bytes.subarray(0, end)
}

export const lastIndexOfSubarray = (
  value: Uint8Array,
  search: Uint8Array
): number => {
  if (search.length === 0 || value.length < search.length) return -1
  for (let i = value.length - search.length; i >= 0; i--) {
    let match = true
    for (let j = 0; j < search.length; j++) {
      if (value[i + j] !== search[j]) {
        match = false
        break
      }
    }
    if (match) return i
  }
  return -1
}

export const splitByDelimiterBytes = (
  value: Uint8Array,
  delimiter: Uint8Array
): Uint8Array[] => {
  const rows: Uint8Array[] = []
  const dLen = delimiter.length
  if (dLen === 0) return rows
  let start = 0
  for (let i = 0; i <= value.length - dLen; i++) {
    let match = true
    for (let j = 0; j < dLen; j++) {
      if (value[i + j] !== delimiter[j]) {
        match = false
        break
      }
    }
    if (!match) continue
    rows.push(value.subarray(start, i))
    i += dLen - 1
    start = i + 1
  }
  if (start <= value.length) rows.push(value.subarray(start))
  return rows
}

export const stripBom = (
  bytes: Uint8Array,
  encoding: TextEncoding
): Uint8Array => {
  if (!bytes.length) return bytes
  if (encoding === 'utf-8') {
    if (
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
    ) {
      return bytes.subarray(3)
    }
  } else if (encoding === 'utf-16le') {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return bytes.subarray(2)
    }
  } else if (encoding === 'utf-16be') {
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return bytes.subarray(2)
    }
  }
  return bytes
}
