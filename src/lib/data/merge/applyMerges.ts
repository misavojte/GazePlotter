import type { DataType, MergeLogEntry } from '$lib/data/types'
import {
  foldParticipantMergeDataset,
  unfoldParticipantMergeDataset,
} from './mergeParticipants'
import {
  foldStimulusMergeDataset,
  unfoldStimulusMergeDataset,
} from './mergeStimuli'
import { toNested, fromNested, type NestedDataset } from './shared'

/**
 * Apply / reverse the whole active merge log (see PLANMERGE.md M5 persistence).
 *
 * The chosen persistence is ORIGINAL-ON-DISK: the workspace JSON stores the
 * pristine original segments + the merge log, and the merged working view is
 * DERIVED. `unfoldMerges` runs on save/export (merged -> original + log);
 * `foldMerges` runs on load (original + log -> merged). Both are pure and are
 * exact inverses, so the pre-merge original is always literally in the file and
 * always reconstructable.
 *
 * Both convert the binary segment store to nested form ONCE and back ONCE,
 * replaying every log entry on the shared nested working set (`NestedDataset`)
 * rather than round-tripping binary ↔ JSON per entry.
 */

const foldEntry = (d: NestedDataset, e: MergeLogEntry): NestedDataset =>
  e.axis === 'participant'
    ? foldParticipantMergeDataset(d, e.representativeId, e.members.map(m => m.id), e.at)
    : foldStimulusMergeDataset(d, e.representativeId, e.members.map(m => m.id), e.at)

const unfoldEntry = (d: NestedDataset, e: MergeLogEntry): NestedDataset =>
  e.axis === 'participant'
    ? unfoldParticipantMergeDataset(d, e)
    : unfoldStimulusMergeDataset(d, e)

/**
 * Original (+ its merge log) -> merged working view. Re-derives the merged
 * buffers by replaying each active merge in log order. No-op when the log is
 * empty (the overwhelmingly common case — zero cost on ordinary datasets).
 */
export function foldMerges(original: DataType): DataType {
  const log = original.merges ?? []
  if (log.length === 0) return original
  let d = toNested({ ...original, merges: [] })
  for (const entry of log) {
    if (entry.op !== 'merge') continue
    d = foldEntry(d, entry)
  }
  return fromNested(d)
}

/**
 * Merged working view -> original (+ the log re-attached) for original-on-disk
 * persistence. Replays each active merge's inverse in reverse order, then keeps
 * the log so a re-load can re-fold. No-op when the log is empty.
 */
export function unfoldMerges(merged: DataType): DataType {
  const log = merged.merges ?? []
  if (log.length === 0) return merged
  let d = toNested(merged)
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i]
    if (entry.op !== 'merge') continue
    d = unfoldEntry(d, entry)
  }
  return { ...fromNested(d), merges: log }
}
