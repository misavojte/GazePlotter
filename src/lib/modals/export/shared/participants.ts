/**
 * Shared participant-selection logic for export modals: participants are an
 * EXPLICIT selection (a Set of participant-id strings), and participant groups
 * are one-click selection presets, never an export parameter.
 */
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { ParticipantsGroup } from '$lib/data/types'
import { getParticipants, getParticipantsGroups } from '$lib/data/engine'
import { listSummary } from './helpers'

/**
 * Group presets offered as selection chips. Excludes the stimulus-dependent
 * "Non-empty" pseudo-group (id -2): with several stimuli selected there is no
 * single truthful member set for it.
 */
export function participantGroupPresets(engine: DataEngine): ParticipantsGroup[] {
  return getParticipantsGroups(engine, true).filter(
    g => g.id !== -2 && g.participantsIds.length > 0
  )
}

/** Initial selection: a given group's members, else every participant. */
export function defaultParticipantSelection(
  engine: DataEngine,
  groupId?: number
): Set<string> {
  if (groupId != null) {
    const group = getParticipantsGroups(engine, true).find(g => g.id === groupId)
    if (group) return new Set(group.participantsIds.map(id => id.toString()))
  }
  return new Set(getParticipants(engine, -1).map(p => p.id.toString()))
}

export function isGroupSelected(
  memberIds: readonly number[],
  selected: ReadonlySet<string>
): boolean {
  return (
    memberIds.length > 0 && memberIds.every(id => selected.has(id.toString()))
  )
}

/** Chip click: add the whole group, or remove it when fully selected. */
export function toggleGroupSelection(
  memberIds: readonly number[],
  selected: ReadonlySet<string>
): Set<string> {
  const next = new Set(selected)
  if (isGroupSelected(memberIds, selected)) {
    for (const id of memberIds) next.delete(id.toString())
  } else {
    for (const id of memberIds) next.add(id.toString())
  }
  return next
}

/**
 * One-line step-header readout. A selection that exactly equals a group reads
 * as that group ("Group 1 (12)"); otherwise the standard {@link listSummary}.
 */
export function participantsSelectionSummary(
  engine: DataEngine,
  selected: ReadonlySet<string>
): string {
  const all = getParticipants(engine, -1)
  const count = selected.size
  if (count > 0) {
    const exact = participantGroupPresets(engine).find(
      g => g.participantsIds.length === count && isGroupSelected(g.participantsIds, selected)
    )
    if (exact) return `${exact.name} (${count})`
  }
  const single =
    count === 1
      ? all.find(p => selected.has(p.id.toString()))?.displayedName
      : undefined
  return listSummary(count, all.length, single)
}

/** Selected participant ids in engine order, so export rows are stable. */
export function orderedSelectedParticipantIds(
  engine: DataEngine,
  selected: ReadonlySet<string>
): number[] {
  return getParticipants(engine, -1)
    .map(p => p.id)
    .filter(id => selected.has(id.toString()))
}
