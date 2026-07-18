import type { DataType, MergeLogEntry, MergeMember } from '$lib/data/types'
import {
  binarySegmentsToJsonWithSpatial,
  jsonSegmentsToBinary,
} from '$lib/data/binary'

/**
 * Internal helpers shared by the participant-axis (mergeFold,
 * deriveMergedDataset) and stimulus-axis (mergeStimuli) merge implementations.
 */

/**
 * A working dataset with segments in NESTED (JSON) form — the shape every merge
 * fold operates on. The binary segment store is deserialized ONCE at the
 * boundary (`toNested`) and re-serialized ONCE (`fromNested`); the pure folds
 * loop over this form, so replaying a whole merge log no longer round-trips
 * binary ↔ JSON per entry (see `foldMerges`).
 */
export type NestedDataset = Omit<DataType, 'segments'> & {
  segments: number[][][][]
  spatialData?: (number[] | null)[][][]
}

/**
 * Binary `DataType` → nested working form. Produces a FULLY-OWNED working set:
 * `segments` / `spatialData` are freshly deserialized, and the event-occurrence
 * buffers are cloned ONCE here (they are otherwise shared by reference with the
 * input). That lets every fold mutate these buffers in place (see the
 * takes-ownership cores) without a defensive per-entry clone. The small
 * per-stimulus dictionaries are copied inside the folds, so they need no clone.
 */
export const toNested = (data: DataType): NestedDataset => {
  const { segments, spatialData } = binarySegmentsToJsonWithSpatial(data.segments)
  return {
    ...data,
    segments,
    spatialData,
    eventData: {
      ...data.eventData,
      events: cloneEvents(data.eventData.events ?? []),
    },
  }
}

/** Nested working form → binary `DataType` (segments serialized once). */
export const fromNested = (nested: NestedDataset): DataType => {
  const { segments, spatialData, ...rest } = nested
  return { ...rest, segments: jsonSegmentsToBinary(segments, spatialData) }
}

/** Deep clone of `segments[stimulus][participant][segment][field]`. */
export const cloneSegments = (g: number[][][][]): number[][][][] =>
  g.map(stim => stim.map(cell => cell.map(seg => seg.slice())))

/** Deep clone of the parallel `spatialData[stimulus][participant][segment] -> [x,y] | null`. */
export const cloneSpatial = (
  g: (number[] | null)[][][]
): (number[] | null)[][][] =>
  g.map(stim => stim.map(cell => cell.map(pt => (pt ? pt.slice() : null))))

/** Deep clone of `events[stimulus][channel][participant]` flat occurrence buffers. */
export const cloneEvents = (e: number[][][][]): number[][][][] =>
  e.map(stim => stim.map(ch => ch.map(p => p.slice())))

/**
 * Drop the merge entry being inverted by its natural key, not reference
 * identity — the command bus precomputes an equal-but-distinct entry object
 * before execute, so `!==` would fail to match the one the forward appended.
 * Collapses an emptied log to `undefined` so the field leaves the dataset.
 */
export function dropMergeEntry(
  merges: MergeLogEntry[] | undefined,
  entry: MergeLogEntry
): MergeLogEntry[] | undefined {
  const kept = (merges ?? []).filter(
    e =>
      !(
        e.op === entry.op &&
        e.axis === entry.axis &&
        e.representativeId === entry.representativeId &&
        e.at === entry.at
      )
  )
  return kept.length ? kept : undefined
}

/**
 * Re-insert tombstoned members at their recorded order-vector positions.
 * Ascending by orderIndex so each splice lands at the correct absolute slot
 * (earlier members are restored before later ones depend on them).
 */
export function restoreOrderVector(
  orderVector: readonly number[],
  members: readonly MergeMember[]
): number[] {
  const out = orderVector.slice()
  for (const { id, orderIndex } of [...members].sort(
    (a, b) => a.orderIndex - b.orderIndex
  )) {
    out.splice(orderIndex, 0, id)
  }
  return out
}
