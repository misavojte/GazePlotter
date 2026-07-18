import type { MergeLogEntry, MergeMember } from '$lib/data/types'
import { cloneSegments, cloneSpatial, restoreOrderVector } from './shared'

/**
 * Pure, in-memory fold/unfold for a PARTICIPANT-axis merge (see PLANMERGE.md).
 *
 * A merge is a lossless, DISJOINT fold: for the merged group, no
 * (stimulus, participant) cell holds segments for more than one member, so the
 * representative simply absorbs each member's non-empty cells and the members
 * are TOMBSTONED (kept in `data`, dropped from `orderVector`, never reindexed —
 * ids stay stable, so nothing keyed by participant id needs remapping). Because
 * nothing is dropped or shifted, `unfold(fold(x)) === x` exactly, which is what
 * lets the pre-merge original always be reconstructed and exported.
 *
 * These functions operate on the legacy nested segment form
 * (`segments[stimulus][participant][segment][field]`, parallel `spatialData`)
 * that `binarySegmentsToJson*`/`jsonSegmentsToBinary` (data/binary/converters)
 * already round-trip — so the engine folds by: binary -> nested -> fold ->
 * binary, off the render loop. Stimulus-axis merge (M4) adds AOI/channel
 * reconciliation on top of the same cell-moving shape.
 */

/** The slice of a dataset the participant-axis fold reads and rewrites. */
export interface ParticipantFoldable {
  participants: { data: string[][]; orderVector: number[] }
  /** `[stimulus][participant][segment][field]` — `field = [start,end,cat,...aoi]`. */
  segments: number[][][][]
  /** Parallel to `segments`: `[stimulus][participant][segment] -> [x,y] | null`. */
  spatialData?: (number[] | null)[][][]
}

const displayedNameOf = (row: string[] | undefined): string =>
  row?.[1] ?? row?.[0] ?? ''

/**
 * Fold `memberIds` into `representativeId` along the participant axis.
 * Returns a NEW dataset (inputs are not mutated) plus the append-only log entry
 * that inverts it. Throws if the merge is not disjoint (a cell where both the
 * representative and a member — or two members — hold segments), because a
 * lossy overwrite would break reversibility; the caller's overlap gate should
 * prevent ever reaching that.
 */
export function foldParticipantMerge(
  ds: ParticipantFoldable,
  representativeId: number,
  memberIds: number[],
  at: number,
  /**
   * When `true`, the caller cedes ownership of `ds.segments` / `ds.spatialData`
   * and they are folded IN PLACE (no defensive clone). Used only by the
   * DataType-level folds, which pass freshly-converted, solely-owned buffers
   * (see `foldMerges`). Default `false` — external callers and tests keep the
   * no-mutation contract.
   */
  owned = false
): { dataset: ParticipantFoldable; entry: MergeLogEntry } {
  const segments = owned ? ds.segments : cloneSegments(ds.segments)
  const spatialData = ds.spatialData
    ? owned
      ? ds.spatialData
      : cloneSpatial(ds.spatialData)
    : undefined
  const stimuliCount = segments.length

  const members: MergeMember[] = memberIds.map(memberId => {
    const contributedCounterparts: number[] = []
    for (let s = 0; s < stimuliCount; s++) {
      const memberCell = segments[s]?.[memberId] ?? []
      if (memberCell.length === 0) continue
      const repCell = segments[s]?.[representativeId] ?? []
      if (repCell.length > 0) {
        throw new Error(
          `foldParticipantMerge: overlap on stimulus ${s} — participant ${representativeId} and ${memberId} both have segments; a merge must be disjoint`
        )
      }
      // Move the member's cell into the representative; empty the member's.
      segments[s][representativeId] = memberCell
      segments[s][memberId] = []
      if (spatialData) {
        spatialData[s][representativeId] = spatialData[s]?.[memberId] ?? []
        spatialData[s][memberId] = []
      }
      contributedCounterparts.push(s)
    }
    return {
      id: memberId,
      displayedName: displayedNameOf(ds.participants.data[memberId]),
      orderIndex: ds.participants.orderVector.indexOf(memberId),
      contributedCounterparts,
    }
  })

  // Tombstone: drop the members from the order vector (keep their `data` rows,
  // ids unchanged) so they vanish from every orderVector-driven surface.
  const memberSet = new Set(memberIds)
  const orderVector = ds.participants.orderVector.filter(
    id => !memberSet.has(id)
  )

  return {
    dataset: {
      participants: { data: ds.participants.data, orderVector },
      segments,
      ...(spatialData ? { spatialData } : {}),
    },
    entry: {
      op: 'merge',
      axis: 'participant',
      representativeId,
      members,
      at,
    },
  }
}

/**
 * Exact inverse of {@link foldParticipantMerge}: move each member's contributed
 * cells back out of the representative and re-insert the members into the order
 * vector at their recorded positions. Returns a NEW dataset.
 */
export function unfoldParticipantMerge(
  ds: ParticipantFoldable,
  entry: MergeLogEntry,
  /** See {@link foldParticipantMerge}'s `owned`. */
  owned = false
): ParticipantFoldable {
  if (entry.axis !== 'participant') {
    throw new Error(
      `unfoldParticipantMerge: expected a participant-axis entry, got "${entry.axis}"`
    )
  }
  const segments = owned ? ds.segments : cloneSegments(ds.segments)
  const spatialData = ds.spatialData
    ? owned
      ? ds.spatialData
      : cloneSpatial(ds.spatialData)
    : undefined
  const rep = entry.representativeId

  for (const member of entry.members) {
    for (const s of member.contributedCounterparts) {
      segments[s][member.id] = segments[s][rep]
      segments[s][rep] = []
      if (spatialData) {
        spatialData[s][member.id] = spatialData[s]?.[rep] ?? []
        spatialData[s][rep] = []
      }
    }
  }

  return {
    participants: {
      data: ds.participants.data,
      orderVector: restoreOrderVector(ds.participants.orderVector, entry.members),
    },
    segments,
    ...(spatialData ? { spatialData } : {}),
  }
}
