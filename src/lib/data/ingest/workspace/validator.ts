import type { DataCapabilities, DataType, RawIngestPayload, BinarySegmentBuffers } from '$lib/data/types'
import {
  jsonSegmentsToBinary,
  reservedFixationName,
  DEFAULT_NO_AOI_TREATMENT,
} from '$lib/data/types'

/**
 * Validates the basic structure of the data
 * @throws Error if the data structure is invalid
 */
export function validateBasicStructure(data: RawIngestPayload): void {
  if (!data.stimuli?.data || !Array.isArray(data.stimuli.data)) {
    throw new Error('Invalid data structure: missing or invalid stimuli data')
  }
  if (!data.participants?.data || !Array.isArray(data.participants.data)) {
    throw new Error(
      'Invalid data structure: missing or invalid participants data'
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
    // silently claim that type is the fixation baseline.
    const rows = (data.categories as { data?: (string[] | null)[] }).data
    if (Array.isArray(rows) && rows.length > 0) {
      const reserved = reservedFixationName(rows)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row) continue
        if (((row[1] ?? row[0]) ?? '').trim() === reserved) {
          row[1] = `${reserved} (${i + 1})`
        }
      }
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
    throw new Error('Invalid data structure: missing segments data')
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
      throw new Error(
        'Invalid data structure: segments are not in valid array or binary buffer format'
      )
    }

    if (typeof bins.hasSpatialData !== 'boolean') {
      bins.hasSpatialData = false
    }
  }

  const bins = data.segments as DataType['segments']
  const segmentCount = (bins.segmentBuffer?.length ?? 0) / 6
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
