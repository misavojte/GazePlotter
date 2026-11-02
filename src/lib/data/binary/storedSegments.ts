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

/** Every typed array in the schema, with the view it comes back as. The type
 *  is what keeps the two ends together: a buffer added to the schema fails to
 *  compile until it is listed here, and it is then written and read alike. */
type SegmentArrays = {
  [
    K in keyof BinarySegmentBuffers as BinarySegmentBuffers[K] extends
      ArrayBufferView | undefined
      ? K
      : never
  ]-?: {
    new (buffer: ArrayBuffer): NonNullable<BinarySegmentBuffers[K]>
    BYTES_PER_ELEMENT: number
  }
}

const SEGMENT_ARRAYS: SegmentArrays = {
  segmentBuffer: Float32Array,
  indexTable: Uint32Array,
  aoiPool: Uint16Array,
  spatialBuffer: Float32Array,
  fixationIndex: Uint32Array,
  fixationIndexTable: Uint32Array,
}

// The table is the key list for both ends.
type SegmentArrayKey = keyof typeof SEGMENT_ARRAYS

const segmentArrayKeys = Object.keys(SEGMENT_ARRAYS) as SegmentArrayKey[]

export function isStoredSegments(value: unknown): value is StoredSegments {
  return (value as StoredSegments | undefined)?.stored === 'entries'
}

const segmentEntryName = (key: SegmentArrayKey) => `segments/${key}`

function assertLittleEndian(): void {
  if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) {
    throw new Error('Workspace files need a little-endian platform.')
  }
}

// One set of entries per buffer set: saves of an unchanged dataset reuse them.
const entryCache = new WeakMap<BinarySegmentBuffers, ZipWriteEntry[]>()

export function segmentEntries(
  segments: BinarySegmentBuffers
): ZipWriteEntry[] {
  assertLittleEndian()
  let entries = entryCache.get(segments)
  if (!entries) {
    entries = []
    for (const key of segmentArrayKeys) {
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
  const views: Partial<BinarySegmentBuffers> = {}
  for (const key of segmentArrayKeys) {
    const bytes = await read(segmentEntryName(key))
    if (!bytes) continue
    const View = SEGMENT_ARRAYS[key]
    if (bytes.byteLength % View.BYTES_PER_ELEMENT !== 0) {
      throw new Error(`Invalid workspace file: the ${segmentEntryName(key)} entry is truncated`)
    }
    // Computed key: the table types the view, the loop only carries it.
    Object.assign(views, { [key]: new View(bytes) })
  }
  const { segmentBuffer, indexTable, aoiPool } = views
  if (!segmentBuffer || !indexTable || !aoiPool) {
    throw new Error('Invalid workspace file: segment entries are missing')
  }
  return {
    ...views,
    segmentBuffer,
    indexTable,
    aoiPool,
    hasSpatialData: marker.hasSpatialData,
    maxParticipants: marker.maxParticipants,
    stimuliCount: marker.stimuliCount,
  }
}
