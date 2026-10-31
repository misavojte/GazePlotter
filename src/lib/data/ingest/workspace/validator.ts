import type { DataCapabilities, DataType, RawIngestPayload, BinarySegmentBuffers } from '$lib/data/types'
import {
  jsonSegmentsToBinary,
  reservedFixationName,
  DEFAULT_NO_AOI_TREATMENT,
} from '$lib/data/types'
import { SEGMENT_STRIDE } from '$lib/data/binary/schema'

function refuse(what: string): never {
  throw new Error(`Invalid workspace file: ${what}`)
}

const isRow = (row: unknown): boolean =>
  Array.isArray(row) && row.length > 0 && row.every(cell => typeof cell === 'string')
const isList = (value: unknown): value is unknown[] | null | undefined =>
  value == null || Array.isArray(value)
const listOf =
  (item: (value: unknown) => boolean) =>
  (list: unknown): boolean =>
    Array.isArray(list) && list.every(item)

/** Container, field, the field's expected shape, and that shape in words. */
const SHAPES: [string, string, (value: unknown) => boolean, string][] = [
  ['stimuli', 'data', listOf(isRow), 'a list of name rows'],
  ['participants', 'data', listOf(isRow), 'a list of name rows'],
  ['categories', 'data', listOf(isRow), 'a list of name rows'],
  ['aois', 'data', listOf(listOf(isRow)), 'a list of name rows per stimulus'],
  [
    'eventData',
    'data',
    v => v == null || listOf(listOf(isRow))(v),
    'a list of channel rows per stimulus',
  ],
  [
    'eventData',
    'events',
    v => v == null || listOf(listOf(listOf(isList)))(v),
    'a list of event buffers per stimulus, channel and participant',
  ],
]

/**
 * Refuses a file whose containers, rows or name cells have the wrong type
 * before anything reads them: a damaged file would otherwise surface as the
 * engine's TypeError instead of saying what is wrong.
 * @throws Error if the data structure is invalid
 */
function validateBasicStructure(data: RawIngestPayload): void {
  const raw = data as unknown as Record<string, Record<string, unknown> | null | undefined>
  for (const [key, field, shape, words] of SHAPES) {
    const container = raw[key]
    if (container == null && key === 'eventData') continue
    if (typeof container !== 'object' || container === null) refuse(`${key} is not an object`)
    if (!shape(container[field])) refuse(`${key}.${field} is not ${words}`)
  }
  const segmentLists = listOf(s => isList(s) && (s ?? []).every(isList))
  if (Array.isArray(data.segments) && !segmentLists(data.segments)) {
    refuse('segments is not a list of segment lists per stimulus and participant')
  }
}

/**
 * The stored counts size every loop over the tables, so a `.gazeplotter`
 * file whose `stimuliCount` or index ranges were damaged would otherwise
 * hang the reader (billions of iterations) instead of being refused.
 * @throws Error when the counts and tables disagree
 */
function assertSegmentTablesAgree(bins: BinarySegmentBuffers): void {
  const { stimuliCount, maxParticipants, segmentBuffer, indexTable } = bins
  const tableLength = stimuliCount * maxParticipants * 2
  const segmentCount = segmentBuffer.length / SEGMENT_STRIDE
  let consistent =
    Number.isInteger(stimuliCount) &&
    stimuliCount >= 0 &&
    Number.isInteger(maxParticipants) &&
    maxParticipants >= 0 &&
    Number.isInteger(segmentCount) &&
    indexTable.length === tableLength &&
    (bins.fixationIndexTable?.length ?? tableLength) === tableLength
  for (let i = 0; consistent && i < indexTable.length; i += 2) {
    consistent =
      indexTable[i] <= indexTable[i + 1] && indexTable[i + 1] <= segmentCount
  }
  if (!consistent) {
    throw new Error(
      'Invalid workspace file: the segment tables do not match the stored stimulus and participant counts'
    )
  }
}

/**
 * Normalizes and validates the data structure.
 * Ensures required fields exist and segments are properly formatted and sorted.
 */
export function processAndValidateData(
  data: RawIngestPayload
): DataType {
  validateBasicStructure(data)
  const stimuliCount = data.stimuli.data.length

  // 1. Normalize basic metadata
  data.noAoiTreatment ??= { ...DEFAULT_NO_AOI_TREATMENT }
  // AOI visibility is retired — drop the legacy hidden set old workspace
  // files carry so it doesn't ride back out through export.
  delete (data.aois as { hiddenAois?: unknown }).hiddenAois

  // Normalize eventData
  const ed = (data.eventData ??= {
    data: [],
    orderVector: [],
    events: [],
  })
  ed.data ??= []
  ed.orderVector ??= []
  ed.events ??= []
  for (let s = ed.data.length; s < stimuliCount; s++) ed.data.push([])
  for (let s = ed.events.length; s < stimuliCount; s++) ed.events.push([])
  // Channel/category visibility is retired — drop the legacy hidden sets old
  // workspace files carry so they don't ride back out through export.
  delete (ed as { hiddenChannels?: unknown }).hiddenChannels
  if (data.categories) {
    delete (data.categories as { hiddenCategories?: unknown }).hiddenCategories
    // The fixation row's displayed name is reserved (id 0 is the substrate
    // every AOI metric scans). Heal files — hand-edited or saved before the
    // guard existed — where another row took it, or the display fold would
    // silently claim that type is the fixation baseline. An EMPTY reserved
    // name heals nothing: the fold keeps empty names standalone, so there is
    // no collision to prevent.
    const rows = (data.categories as { data?: (string[] | null)[] }).data
    if (Array.isArray(rows) && rows.length > 0) {
      const reserved = reservedFixationName(rows)
      const taken = new Set(
        rows.map(r => (((r?.[1] ?? r?.[0]) ?? '') as string).trim())
      )
      for (let i = 1; reserved !== '' && i < rows.length; i++) {
        const row = rows[i]
        if (!row) continue
        if (((row[1] ?? row[0]) ?? '').trim() === reserved) {
          // Unique suffix: landing on another row's name would silently MERGE
          // two distinct types via the displayed-name fold.
          let n = i + 1
          while (taken.has(`${reserved} (${n})`)) n++
          row[1] = `${reserved} (${n})`
          taken.add(row[1])
        }
      }
    }
    // Pre-1.9.3 category-modal Applies persisted categories.orderVector
    // WITHOUT id 0 (the old modal excluded the fixation row). The undo
    // inverse snapshots through that vector, so heal it or undoing a
    // fixation recolor cannot restore row 0.
    const orderVector = (data.categories as { orderVector?: number[] }).orderVector
    if (
      Array.isArray(orderVector) &&
      orderVector.length > 0 &&
      !orderVector.includes(0)
    ) {
      orderVector.unshift(0)
    }
  }

  const events = ed.events ?? []
  const hasEventData = events.some((channels: number[][][]) =>
    channels.some((participants: number[][]) =>
      participants.some((buffer: number[]) => (buffer?.length ?? 0) > 0)
    )
  )

  // 2. Validate and sort segments
  if (!data.segments) {
    refuse('segments are missing')
  }

  if (Array.isArray(data.segments)) {
    const rawSegments = data.segments as number[][][][]

    for (let s = 0; s < rawSegments.length; s++) {
      const stimSegments = rawSegments[s] || []
      rawSegments[s] = stimSegments

      for (let p = 0; p < stimSegments.length; p++) {
        const pSegments = stimSegments[p]
        if (!pSegments) {
          stimSegments[p] = []
          continue
        }

        // Inline validation and filtering to avoid extra passes
        const valid = []
        for (let i = 0; i < pSegments.length; i++) {
          const seg = pSegments[i]
          if (
            Array.isArray(seg) &&
            seg.length >= 3 &&
            typeof seg[0] === 'number' &&
            typeof seg[1] === 'number' &&
            typeof seg[2] === 'number'
          ) {
            valid.push(seg)
          }
        }

        // Sort in-place by start time
        valid.sort((a, b) => a[0] - b[0])
        stimSegments[p] = valid
      }
    }

    const rawSpatialData = data.spatialData as (number[] | null)[][][] | undefined
    delete data.spatialData
    data.segments = jsonSegmentsToBinary(rawSegments, rawSpatialData)
  } else {
    // Basic structural validation for binary segments to ensure they aren't plain objects
    const bins = data.segments as Partial<BinarySegmentBuffers> & Record<string, unknown>
    if (
      !bins ||
      !(bins.segmentBuffer instanceof Float32Array) ||
      !(bins.indexTable instanceof Uint32Array) ||
      !(bins.aoiPool instanceof Uint16Array) ||
      typeof bins.maxParticipants !== 'number' ||
      typeof bins.stimuliCount !== 'number'
    ) {
      refuse('segments are not a list or a binary table')
    }

    if (typeof bins.hasSpatialData !== 'boolean') {
      bins.hasSpatialData = false
    }
    assertSegmentTablesAgree(bins as BinarySegmentBuffers)
  }

  const bins = data.segments as DataType['segments']
  const segmentCount = (bins.segmentBuffer?.length ?? 0) / SEGMENT_STRIDE
  const normalizedCapabilities: DataCapabilities = {
    segmented: segmentCount > 0,
    spatial: bins.hasSpatialData ?? false,
    event: hasEventData,
  }

  data.capabilities = {
    ...normalizedCapabilities,
    ...(data.capabilities ?? {}),
    segmented: normalizedCapabilities.segmented,
    spatial: normalizedCapabilities.spatial,
    event: normalizedCapabilities.event,
  }

  return data as DataType
}
