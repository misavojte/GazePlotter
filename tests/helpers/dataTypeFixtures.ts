/**
 * Shared full-DataType fixture for the merge test suite. ONE place owns the
 * DataType literal SHAPE (same rationale as testEngine.ts), so a schema change
 * is an edit here instead of in six hand-rolled per-file fixtures. Defaults
 * are derived from the `segments` dimensions (stimuli S0..Sn−1, participants
 * P0..Pn−1, one AOI 'A' per stimulus, empty events); a test overrides only
 * what its pin is about.
 */
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import {
  jsonSegmentsToBinary,
  binarySegmentsToJsonWithSpatial,
} from '$lib/data/binary'
import { createDefaultMetricInstances } from '$lib/metrics/instances'
import type { DataType } from '$lib/data/types'

/**
 * Build a DataType over nested `segments[stimulus][participant][segment]`
 * rows of `[start, end, categoryId, ...rawAoiIds]`.
 */
export function makeDataType(
  segments: number[][][][],
  over: Partial<DataType> = {}
): DataType {
  const stimulusCount = segments.length
  const participantCount = Math.max(0, ...segments.map(s => s.length))
  return {
    isOrdinalOnly: false,
    capabilities: { segmented: true, spatial: false, event: false },
    stimuli: {
      data: Array.from({ length: stimulusCount }, (_, i) => [`S${i}`, `S${i}`]),
      orderVector: Array.from({ length: stimulusCount }, (_, i) => i),
    },
    participants: {
      data: Array.from({ length: participantCount }, (_, i) => [
        `P${i}`,
        `P${i}`,
      ]),
      orderVector: Array.from({ length: participantCount }, (_, i) => i),
    },
    participantsSelections: [],
    metricInstances: createDefaultMetricInstances(),
    categories: {
      data: [['Fixation', 'Fixation', '#000000']],
      orderVector: [0],
    },
    noAoiTreatment: { displayedName: 'No AOI', color: '#cbd5e1' },
    aois: {
      data: Array.from({ length: stimulusCount }, () => [['A', 'A', '#ff0000']]),
      orderVector: Array.from({ length: stimulusCount }, () => [0]),
    },
    segments: jsonSegmentsToBinary(segments),
    eventData: {
      data: Array.from({ length: stimulusCount }, () => []),
      orderVector: Array.from({ length: stimulusCount }, () => []),
      events: Array.from({ length: stimulusCount }, () => []),
    },
    ...over,
  }
}

/** Nested segment form of a DataType's binary buffers (for structural pins). */
export const nestedSegments = (d: DataType): number[][][][] =>
  binarySegmentsToJsonWithSpatial(d.segments).segments

/**
 * Compare DataTypes by their nested segment form (binary buffers are otherwise
 * opaque typed arrays); everything else compares structurally.
 */
export const normalizeSegments = (d: DataType) => ({
  ...d,
  segments: binarySegmentsToJsonWithSpatial(d.segments),
})

/** Nested segment form of an engine's current dataset. */
export const engineNestedSegments = (engine: DataEngine): number[][][][] =>
  nestedSegments(engine.toDataType()!)
