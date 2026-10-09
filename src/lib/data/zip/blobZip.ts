/**
 * A ZIP reader and writer over Blobs, for workspace archives carrying
 * reference media (recordings can be GBs). Neither side copies an entry into
 * memory: the writer assembles the archive as Blob parts that reference the
 * source files, the reader hands out stored entries as slices of the archive.
 * Media is stored (no compression); text entries are deflated. ZIP64 covers
 * entries and archives past 4 GB.
 */

const LOCAL_SIG = 0x04034b50
const CENTRAL_SIG = 0x02014b50
const END_SIG = 0x06054b50
const ZIP64_END_SIG = 0x06064b50
const ZIP64_LOCATOR_SIG = 0x07064b50
const ZIP64_EXTRA_ID = 0x0001
const MAX32 = 0xffffffff
const MAX16 = 0xffff
const UTF8_FLAG = 0x0800
const STORE = 0
const DEFLATE = 8

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** CRC-32 of a Blob, read chunk by chunk (never whole into memory). */
async function crc32(blob: Blob): Promise<number> {
  let crc = 0xffffffff
  const reader = blob.stream().getReader()
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    for (let i = 0; i < value.length; i++) {
      crc = CRC_TABLE[(crc ^ value[i]) & 0xff] ^ (crc >>> 8)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function deflate(blob: Blob): Promise<Blob> {
  return new Response(
    blob.stream().pipeThrough(new CompressionStream('deflate-raw'))
  ).blob()
}

function inflate(blob: Blob, type: string): Promise<Blob> {
  return new Response(
    blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))
  )
    .blob()
    .then(b => (type ? new Blob([b], { type }) : b))
}

function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((Math.max(1980, date.getFullYear()) - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  }
}

export interface ZipWriteEntry {
  name: string
  content: Blob | string
  /** Deflate the entry; leave off for already-compressed media. */
  compress?: boolean
}

/**
 * Build the archive. An entry whose bytes can't be read (e.g. its source file
 * was moved or is an online-only placeholder) is left out and reported, so
 * one bad medium never fails the whole archive.
 */
export async function writeBlobZip(
  entries: ZipWriteEntry[]
): Promise<{ blob: Blob; skipped: string[] }> {
  const encoder = new TextEncoder()
  const stamp = dosDateTime(new Date())
  const parts: BlobPart[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  const skipped: string[] = []
  let offset = 0

  for (const entry of entries) {
    const source =
      typeof entry.content === 'string'
        ? new Blob([entry.content])
        : entry.content
    let crc: number
    let data: Blob
    try {
      crc = await crc32(source)
      data = entry.compress ? await deflate(source) : source
    } catch {
      skipped.push(entry.name)
      continue
    }
    const name = encoder.encode(entry.name)
    const method = entry.compress ? DEFLATE : STORE
    const size = source.size
    const compSize = data.size
    const zip64 = size >= MAX32 || compSize >= MAX32 || offset >= MAX32

    const localExtra = zip64 ? 20 : 0
    const local = new DataView(new ArrayBuffer(30 + name.length + localExtra))
    local.setUint32(0, LOCAL_SIG, true)
    local.setUint16(4, zip64 ? 45 : 20, true)
    local.setUint16(6, UTF8_FLAG, true)
    local.setUint16(8, method, true)
    local.setUint16(10, stamp.time, true)
    local.setUint16(12, stamp.date, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, zip64 ? MAX32 : compSize, true)
    local.setUint32(22, zip64 ? MAX32 : size, true)
    local.setUint16(26, name.length, true)
    local.setUint16(28, localExtra, true)
    new Uint8Array(local.buffer).set(name, 30)
    if (zip64) {
      const at = 30 + name.length
      local.setUint16(at, ZIP64_EXTRA_ID, true)
      local.setUint16(at + 2, 16, true)
      local.setBigUint64(at + 4, BigInt(size), true)
      local.setBigUint64(at + 12, BigInt(compSize), true)
    }

    const centralExtra = zip64 ? 28 : 0
    const header = new DataView(new ArrayBuffer(46 + name.length + centralExtra))
    header.setUint32(0, CENTRAL_SIG, true)
    header.setUint16(4, 45, true)
    header.setUint16(6, zip64 ? 45 : 20, true)
    header.setUint16(8, UTF8_FLAG, true)
    header.setUint16(10, method, true)
    header.setUint16(12, stamp.time, true)
    header.setUint16(14, stamp.date, true)
    header.setUint32(16, crc, true)
    header.setUint32(20, zip64 ? MAX32 : compSize, true)
    header.setUint32(24, zip64 ? MAX32 : size, true)
    header.setUint16(28, name.length, true)
    header.setUint16(30, centralExtra, true)
    header.setUint32(42, zip64 ? MAX32 : offset, true)
    new Uint8Array(header.buffer).set(name, 46)
    if (zip64) {
      const at = 46 + name.length
      header.setUint16(at, ZIP64_EXTRA_ID, true)
      header.setUint16(at + 2, 24, true)
      header.setBigUint64(at + 4, BigInt(size), true)
      header.setBigUint64(at + 12, BigInt(compSize), true)
      header.setBigUint64(at + 20, BigInt(offset), true)
    }

    parts.push(local.buffer, data)
    central.push(new Uint8Array(header.buffer))
    offset += local.byteLength + compSize
  }

  const centralOffset = offset
  const centralSize = central.reduce((sum, c) => sum + c.length, 0)
  parts.push(...central)

  const count = central.length
  const zip64End = centralOffset >= MAX32 || centralSize >= MAX32 || count >= MAX16
  if (zip64End) {
    const end64 = new DataView(new ArrayBuffer(56 + 20))
    end64.setUint32(0, ZIP64_END_SIG, true)
    end64.setBigUint64(4, 44n, true)
    end64.setUint16(12, 45, true)
    end64.setUint16(14, 45, true)
    end64.setBigUint64(24, BigInt(count), true)
    end64.setBigUint64(32, BigInt(count), true)
    end64.setBigUint64(40, BigInt(centralSize), true)
    end64.setBigUint64(48, BigInt(centralOffset), true)
    end64.setUint32(56, ZIP64_LOCATOR_SIG, true)
    end64.setBigUint64(64, BigInt(centralOffset + centralSize), true)
    end64.setUint32(72, 1, true)
    parts.push(end64.buffer)
  }

  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, END_SIG, true)
  // With a ZIP64 end record, every field here defers to it.
  end.setUint16(8, zip64End ? MAX16 : count, true)
  end.setUint16(10, zip64End ? MAX16 : count, true)
  end.setUint32(12, zip64End ? MAX32 : centralSize, true)
  end.setUint32(16, zip64End ? MAX32 : centralOffset, true)
  parts.push(end.buffer)

  return { blob: new Blob(parts, { type: 'application/zip' }), skipped }
}

export interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  size: number
  localOffset: number
}

const u64 = (view: DataView, at: number) => Number(view.getBigUint64(at, true))

async function readView(blob: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await blob.slice(start, end).arrayBuffer())
}

/** The archive's entries by name, read from its central directory only. */
export async function readBlobZip(blob: Blob): Promise<Map<string, ZipEntry>> {
  // The end record sits in the last 22 bytes plus an optional comment.
  const tailStart = Math.max(0, blob.size - (22 + MAX16))
  const tail = await readView(blob, tailStart, blob.size)
  let endAt = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === END_SIG) {
      endAt = i
      break
    }
  }
  if (endAt < 0) throw new Error('Not a ZIP archive')

  let count = tail.getUint16(endAt + 10, true)
  let centralSize = tail.getUint32(endAt + 12, true)
  let centralOffset = tail.getUint32(endAt + 16, true)
  const locatorAt = endAt - 20
  if (locatorAt >= 0 && tail.getUint32(locatorAt, true) === ZIP64_LOCATOR_SIG) {
    const end64At = u64(tail, locatorAt + 8)
    const end64 = await readView(blob, end64At, end64At + 56)
    if (end64.getUint32(0, true) !== ZIP64_END_SIG) {
      throw new Error('Corrupt ZIP64 end record')
    }
    count = u64(end64, 32)
    centralSize = u64(end64, 40)
    centralOffset = u64(end64, 48)
  }

  const dir = await readView(blob, centralOffset, centralOffset + centralSize)
  const decoder = new TextDecoder()
  const entries = new Map<string, ZipEntry>()
  let at = 0
  for (let n = 0; n < count; n++) {
    if (dir.getUint32(at, true) !== CENTRAL_SIG) {
      throw new Error('Corrupt ZIP central directory')
    }
    const nameLength = dir.getUint16(at + 28, true)
    const extraLength = dir.getUint16(at + 30, true)
    const commentLength = dir.getUint16(at + 32, true)
    let compressedSize = dir.getUint32(at + 20, true)
    let size = dir.getUint32(at + 24, true)
    let localOffset = dir.getUint32(at + 42, true)
    // ZIP64 extra: 64-bit values, in this order, for each field set to MAX32.
    for (let e = at + 46 + nameLength; e < at + 46 + nameLength + extraLength; ) {
      const id = dir.getUint16(e, true)
      const length = dir.getUint16(e + 2, true)
      if (id === ZIP64_EXTRA_ID) {
        let v = e + 4
        if (size === MAX32) {
          size = u64(dir, v)
          v += 8
        }
        if (compressedSize === MAX32) {
          compressedSize = u64(dir, v)
          v += 8
        }
        if (localOffset === MAX32) localOffset = u64(dir, v)
      }
      e += 4 + length
    }
    const name = decoder.decode(
      new Uint8Array(dir.buffer, dir.byteOffset + at + 46, nameLength)
    )
    entries.set(name, {
      name,
      method: dir.getUint16(at + 10, true),
      compressedSize,
      size,
      localOffset,
    })
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/** One entry's content: a slice of the archive when stored, inflated otherwise. */
export async function readZipEntry(
  blob: Blob,
  entry: ZipEntry,
  type = ''
): Promise<Blob> {
  const local = await readView(blob, entry.localOffset, entry.localOffset + 30)
  if (local.getUint32(0, true) !== LOCAL_SIG) {
    throw new Error(`Corrupt ZIP entry: ${entry.name}`)
  }
  const start =
    entry.localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true)
  const data = blob.slice(start, start + entry.compressedSize, type)
  if (entry.method === STORE) return data
  if (entry.method === DEFLATE) return inflate(data, type)
  throw new Error(`Unsupported ZIP compression in ${entry.name}`)
}
