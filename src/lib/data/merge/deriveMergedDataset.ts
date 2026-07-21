import type {
  DataType,
  MergeLogEntry,
  ParticipantsSelection,
} from '$lib/data/types'
import { foldParticipantMerge, unfoldParticipantMerge } from './mergeFold'
import {
  cloneEvents,
  dropMergeEntry,
  toNested,
  fromNested,
  type NestedDataset,
} from './shared'

/**
 * DataType-level participant merge / un-merge (see PLANMERGE.md M3).
 *
 * Bridges the binary segment store to the pure nested-form fold in mergeFold:
 * binary -> nested (binarySegmentsToJsonWithSpatial) -> fold -> binary
 * (jsonSegmentsToBinary), the same battle-tested round-trip the workspace
 * save/load uses. Off the render loop. Also handles the two participant-id-keyed
 * structures the segment fold does not: the `participants` metadata (via the
 * fold's order-vector tombstone) and `participantsSelections` (member ids
 * substituted by the representative, snapshotted for exact reversal). The merge
 * log grows append-only; un-merge is the exact inverse (`unmerge(merge(x)) === x`).
 */

const selectionTouchesMembers = (
  selection: ParticipantsSelection,
  memberSet: ReadonlySet<number>
): boolean => selection.participantsIds.some(id => memberSet.has(id))

type EventContribution = { stimulus: number; channel: number; boundary: number }

/**
 * Fold each member participant's event-occurrence buffers into the
 * representative (`events[stimulus][channel][participant]`). Mirrors the
 * segment fold on the participant index: the representative absorbs the
 * member's flat occurrence buffer per `(stimulus, channel)` cell, recording a
 * `boundary` (the representative's prior length, 0 in the clean disjoint case)
 * so un-merge splits it back exactly. Returns new events + per-member
 * contributions to attach to the log.
 */
function foldParticipantEvents(
  events: number[][][][],
  representativeId: number,
  memberIds: number[],
  /** When true, fold `events` in place (caller owns it). See `foldMerges`. */
  owned = false
): { events: number[][][][]; byMember: Map<number, EventContribution[]> } {
  const out = owned ? events : cloneEvents(events)
  const byMember = new Map<number, EventContribution[]>(
    memberIds.map(id => [id, []])
  )

  for (let s = 0; s < out.length; s++) {
    const stimulus = out[s] ?? []
    for (let c = 0; c < stimulus.length; c++) {
      const channel = stimulus[c] ?? []
      for (const memberId of memberIds) {
        const memberCell = channel[memberId]
        if (!memberCell || memberCell.length === 0) continue
        const repCell = channel[representativeId] ?? []
        const boundary = repCell.length
        while (channel.length <= representativeId) channel.push([])
        channel[representativeId] = repCell.concat(memberCell)
        channel[memberId] = []
        byMember.get(memberId)!.push({ stimulus: s, channel: c, boundary })
      }
    }
  }

  return { events: out, byMember }
}

/** Exact inverse of {@link foldParticipantEvents}. */
function unfoldParticipantEvents(
  events: number[][][][],
  entry: MergeLogEntry,
  /** When true, unfold `events` in place (caller owns it). */
  owned = false
): number[][][][] {
  const out = owned ? events : cloneEvents(events)
  const rep = entry.representativeId
  // foldParticipantEvents stacks members' buffers onto the rep cell
  // cumulatively, so unwind LIFO — forward order would hand the first member
  // the whole cell (same rule as mergeStimuli.unfoldStimulusMergeDataset).
  for (const member of [...entry.members].reverse()) {
    for (const { stimulus, channel, boundary } of member.eventContributions ??
      []) {
      const chan = out[stimulus]?.[channel]
      if (!chan) continue
      const repCell = chan[rep] ?? []
      while (chan.length <= member.id) chan.push([])
      chan[member.id] = repCell.slice(boundary)
      chan[rep] = repCell.slice(0, boundary)
    }
  }
  return out
}

/**
 * Substitute merged member ids with the representative id in every named
 * selection (dedup, first-occurrence order preserved), returning the new
 * selections and a pre-fold snapshot of only those that changed (for exact
 * un-merge).
 */
function foldParticipantSelections(
  selections: ParticipantsSelection[],
  representativeId: number,
  memberIds: number[]
): {
  selections: ParticipantsSelection[]
  before: { id: number; participantsIds: number[] }[]
} {
  const memberSet = new Set(memberIds)
  const before: { id: number; participantsIds: number[] }[] = []

  const next = selections.map(selection => {
    if (!selectionTouchesMembers(selection, memberSet)) return selection
    before.push({
      id: selection.id,
      participantsIds: selection.participantsIds.slice(),
    })

    const seen = new Set<number>()
    const participantsIds: number[] = []
    for (const id of selection.participantsIds) {
      const mapped = memberSet.has(id) ? representativeId : id
      if (!seen.has(mapped)) {
        seen.add(mapped)
        participantsIds.push(mapped)
      }
    }
    return { ...selection, participantsIds }
  })

  return { selections: next, before }
}

/**
 * Merge `memberIds` into `representativeId` on the participant axis, operating
 * on the nested working form: folded segments, tombstoned members, remapped
 * selections, and an appended merge-log entry. Throws if not disjoint. The
 * binary boundary lives in the {@link mergeParticipants} wrapper / `foldMerges`,
 * so a whole log replays without re-serializing segments per entry.
 *
 * TAKES OWNERSHIP of `data` and its segment / spatial / event buffers, folding
 * them IN PLACE. Every caller passes a freshly-converted, solely-owned
 * {@link NestedDataset} (`toNested(...)`), so the defensive per-entry clones are
 * pure waste and skipped.
 */
export function foldParticipantMergeDataset(
  data: NestedDataset,
  representativeId: number,
  memberIds: number[],
  at: number
): NestedDataset {
  const { dataset, entry } = foldParticipantMerge(
    { participants: data.participants, segments: data.segments, spatialData: data.spatialData },
    representativeId,
    memberIds,
    at,
    true
  )

  const { selections, before } = foldParticipantSelections(
    data.participantsSelections,
    representativeId,
    memberIds
  )

  const { events, byMember } = foldParticipantEvents(
    data.eventData.events ?? [],
    representativeId,
    memberIds,
    true
  )

  // Attach each member's event contributions to its log record.
  const membersWithEvents = entry.members.map(m => {
    const contributions = byMember.get(m.id) ?? []
    return contributions.length ? { ...m, eventContributions: contributions } : m
  })

  const fullEntry: MergeLogEntry = {
    ...entry,
    members: membersWithEvents,
    ...(before.length ? { participantsSelectionsBefore: before } : {}),
  }

  return {
    ...data,
    participants: dataset.participants,
    participantsSelections: selections,
    segments: dataset.segments,
    spatialData: dataset.spatialData,
    eventData: { ...data.eventData, events },
    merges: [...(data.merges ?? []), fullEntry],
  }
}

/**
 * Exact inverse of {@link foldParticipantMergeDataset} (nested working form).
 * TAKES OWNERSHIP of `data` and its buffers (unfolds them in place).
 */
export function unfoldParticipantMergeDataset(
  data: NestedDataset,
  entry: MergeLogEntry
): NestedDataset {
  const restored = unfoldParticipantMerge(
    { participants: data.participants, segments: data.segments, spatialData: data.spatialData },
    entry,
    true
  )

  let participantsSelections = data.participantsSelections
  if (entry.participantsSelectionsBefore) {
    const beforeById = new Map(
      entry.participantsSelectionsBefore.map(b => [b.id, b.participantsIds])
    )
    participantsSelections = data.participantsSelections.map(sel =>
      beforeById.has(sel.id)
        ? { ...sel, participantsIds: beforeById.get(sel.id)!.slice() }
        : sel
    )
  }

  const events = unfoldParticipantEvents(data.eventData.events ?? [], entry, true)

  return {
    ...data,
    participants: restored.participants,
    participantsSelections,
    segments: restored.segments,
    spatialData: restored.spatialData,
    eventData: { ...data.eventData, events },
    merges: dropMergeEntry(data.merges, entry),
  }
}

/**
 * DataType-level participant merge (binary boundary): the pristine
 * {@link foldParticipantMergeDataset} wrapped in a single binary→nested→binary
 * conversion, preserving the `DataType → DataType` contract every caller and
 * test relies on. Returns a NEW DataType; `unmerge(merge(x)) === x`.
 */
export const mergeParticipants = (
  data: DataType,
  representativeId: number,
  memberIds: number[],
  at: number
): DataType =>
  fromNested(
    foldParticipantMergeDataset(toNested(data), representativeId, memberIds, at)
  )

/** Exact inverse of {@link mergeParticipants} (binary boundary). */
export const unmergeParticipants = (data: DataType, entry: MergeLogEntry): DataType =>
  fromNested(unfoldParticipantMergeDataset(toNested(data), entry))
