import type { BinarySegmentBuffers } from './schema'
import type { ZipWriteEntry } from '$lib/data/zip/blobZip'

/**
 * In a `.gazeplotter` file the segment buffers are zip entries of their own
 * (raw little-endian typed arrays); `workspace.json` keeps this marker in
 * place of the nested arrays, so a large dataset never becomes one string.
 */
export type StoredSegments = {
  stored: 'entries'
  maxParticipants: number
  stimuliCount: number
  hasSpatialData: boolean
}

const SEGMENT_ARRAYS = [
  'segmentBuffer',
  'indexTable',
  'aoiPool',
  'spatialBuffer',
  'fixationIndex',
  'fixationIndexTable',
] as const satisfies readonly (keyof BinarySegmentBuffers)[]

export function isStoredSegments(value: unknown): value is StoredSegments {
  return (value as StoredSegments | undefined)?.stored === 'entries'
}

const segmentEntryName = (key: (typeof SEGMENT_ARRAYS)[number]) => `segments/${key}`

function assertLittleEndian(): void {
  if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) {
    throw new Error('Workspace files need a little-endian platform.')
  }
}

// One set of entries per buffer set: saves of an unchanged dataset reuse them.
const entryCache = new WeakMap<BinarySegmentBuffers, ZipWriteEntry[]>()

export function segmentEntries(segments: BinarySegmentBuffers): ZipWriteEntry[] {
  assertLittleEndian()
  let entries = entryCache.get(segments)
  if (!entries) {
    entries = []
    for (const key of SEGMENT_ARRAYS) {
      const array = segments[key]
      if (!array) continue
      const content = new Blob([array as ArrayBufferView<ArrayBuffer>])
      entries.push({ name: segmentEntryName(key), content })
    }
    entryCache.set(segments, entries)
  }
  return entries
}

/** Rebuilds the buffers from a file's entries (`read` returns an entry's bytes). */
export async function readSegmentEntries(
  marker: StoredSegments,
  read: (name: string) => Promise<ArrayBuffer | null>
): Promise<BinarySegmentBuffers> {
  assertLittleEndian()
  const view = async <T>(key: (typeof SEGMENT_ARRAYS)[number], make: (b: ArrayBuffer) => T) => {
    const bytes = await read(segmentEntryName(key))
    return bytes ? make(bytes) : undefined
  }
  const segmentBuffer = await view('segmentBuffer', b => new Float32Array(b))
  const indexTable = await view('indexTable', b => new Uint32Array(b))
  const aoiPool = await view('aoiPool', b => new Uint16Array(b))
  if (!segmentBuffer || !indexTable || !aoiPool) {
    throw new Error('Invalid workspace file: segment entries are missing')
  }
  return {
    segmentBuffer,
    indexTable,
    aoiPool,
    spatialBuffer: await view('spatialBuffer', b => new Float32Array(b)),
    fixationIndex: await view('fixationIndex', b => new Uint32Array(b)),
    fixationIndexTable: await view('fixationIndexTable', b => new Uint32Array(b)),
    hasSpatialData: marker.hasSpatialData,
    maxParticipants: marker.maxParticipants,
    stimuliCount: marker.stimuliCount,
  }
}
