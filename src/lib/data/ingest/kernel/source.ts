/**
 * Sources — bytes in. See `src/lib/data/ingest/README.md` for the model.
 *
 * An `IngestSource` is a named, one-shot byte stream. The job reads its
 * first chunk to build a `SourceProbe` (the only thing format detection is
 * allowed to see), then hands the already-started stream to the matched
 * format, which owns the rest of the read.
 *
 * CHARACTERIZED CONSTRAINT (pinned in tests): detection sees only the first
 * chunk, so a file's header row must fit inside it. Real `File` streams
 * deliver ≥64 KB chunks; the buffer path chunks at 1 MB.
 */

const MAX_HEADER_BYTES = 256 * 1024
const BUFFER_CHUNK_BYTES = 1024 * 1024

export type TextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be'

export interface IngestSource {
  readonly name: string
  /** One-shot sequential byte stream. May be consumed exactly once. */
  readonly stream: ReadableStream<Uint8Array>
}

export function streamSource(
  name: string,
  stream: ReadableStream<Uint8Array>
): IngestSource {
  return { name, stream }
}

/** Wraps a fully-materialized buffer as a chunked stream source. */
export function bufferSource(name: string, bytes: Uint8Array): IngestSource {
  return {
    name,
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += BUFFER_CHUNK_BYTES) {
          controller.enqueue(
            bytes.subarray(i, Math.min(i + BUFFER_CHUNK_BYTES, bytes.length))
          )
        }
        controller.close()
      },
    }),
  }
}

/**
 * A source whose first chunk has been read (for probing). The format reader
 * must process `firstChunk` first, then continue draining `reader`.
 */
export interface OpenedSource {
  readonly name: string
  readonly firstChunk: Uint8Array
  readonly firstDone: boolean
  readonly reader: ReadableStreamDefaultReader<Uint8Array>
}

export async function openSource(source: IngestSource): Promise<OpenedSource> {
  const reader = source.stream.getReader()
  const first = await reader.read()
  return {
    name: source.name,
    firstChunk: first.value ?? new Uint8Array(),
    firstDone: first.done,
    reader,
  }
}

/** Drains an entire source into one contiguous buffer (archive/workspace formats). */
export async function drainSource(source: IngestSource): Promise<Uint8Array> {
  const reader = source.stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (value) {
      chunks.push(value)
      total += value.byteLength
    }
    if (done) break
  }
  if (chunks.length === 1) return chunks[0]
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/**
 * Everything format detection is allowed to see. Built once per source from
 * the file name and the first chunk; all fields are derived eagerly so
 * `detect()` implementations stay synchronous and allocation-free.
 */
export interface SourceProbe {
  readonly fileName: string
  /** Decoded text of the first chunk (≤256 KB, BOM stripped). */
  readonly slice: string
  /** First row of `slice` (split by the detected row delimiter). */
  readonly headerRow: string
  /** Detected row delimiter: '\r\n', '\n', or '\r'. */
  readonly rowDelimiter: string
  readonly encoding: TextEncoding
}

function detectEncoding(bytes: Uint8Array): {
  encoding: TextEncoding
  bomLength: number
} {
  if (bytes.length >= 3) {
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return { encoding: 'utf-8', bomLength: 3 }
    }
  }
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return { encoding: 'utf-16le', bomLength: 2 }
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return { encoding: 'utf-16be', bomLength: 2 }
    }
  }

  // Heuristic: detect UTF-16 by null bytes at even/odd positions
  const sampleLen = Math.min(bytes.length, 512)
  let zeroEven = 0
  let zeroOdd = 0
  for (let i = 0; i < sampleLen; i++) {
    if (bytes[i] !== 0) continue
    if (i % 2 === 0) zeroEven++
    else zeroOdd++
  }

  if (zeroOdd > zeroEven * 2) return { encoding: 'utf-16le', bomLength: 0 }
  if (zeroEven > zeroOdd * 2) return { encoding: 'utf-16be', bomLength: 0 }

  return { encoding: 'utf-8', bomLength: 0 }
}

/**
 * Detects the row delimiter used in the file content.
 * Windows line endings are checked first (most common), then Unix, then
 * old-Mac; Unix is the fallback.
 */
function detectRowDelimiter(slice: string): string {
  if (slice.includes('\r\n')) return '\r\n'
  if (slice.includes('\n')) return '\n'
  if (slice.includes('\r')) return '\r'
  return '\n'
}

/** Builds a probe from already-decoded text (tests, in-process callers). */
export function probeFromText(
  slice: string,
  options: { fileName?: string; encoding?: TextEncoding } = {}
): SourceProbe {
  const rowDelimiter = detectRowDelimiter(slice)
  return {
    fileName: options.fileName ?? '',
    slice,
    headerRow: slice.split(rowDelimiter)[0] ?? '',
    rowDelimiter,
    encoding: options.encoding ?? 'utf-8',
  }
}

/** Builds a probe from the raw first chunk of a source. */
export function probeFromBytes(
  fileName: string,
  firstChunk: Uint8Array
): SourceProbe {
  const limited = firstChunk.subarray(0, MAX_HEADER_BYTES)
  const { encoding, bomLength } = detectEncoding(limited)
  const decoder = new TextDecoder(encoding)
  const slice = decoder.decode(limited.subarray(bomLength))
  return probeFromText(slice, { fileName, encoding })
}
