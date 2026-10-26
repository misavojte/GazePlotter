/**
 * Shared participant-selection logic for export modals: participants are an
 * EXPLICIT selection (a Set of participant-id strings), and participant groups
 * are one-click selection presets, never an export parameter.
 */
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { ParticipantsSelection } from '$lib/data/types'
import { getParticipants, getParticipantsSelections } from '$lib/data/engine'

/**
 * Group presets offered as selection chips. Excludes the stimulus-dependent
 * "Non-empty" pseudo-group (id -2): with several stimuli selected there is no
 * single truthful member set for it.
 */
export function participantGroupPresets(engine: DataEngine): ParticipantsSelection[] {
  return getParticipantsSelections(engine, true).filter(
    g => g.id !== -2 && g.participantsIds.length > 0
  )
}

/** Initial selection: a given group's members, else every participant. */
export function defaultParticipantSelection(
  engine: DataEngine,
  groupId?: number
): Set<string> {
  if (groupId != null) {
    const group = getParticipantsSelections(engine, true).find(g => g.id === groupId)
    if (group) return new Set(group.participantsIds.map(id => id.toString()))
  }
  return new Set(getParticipants(engine, -1).map(p => p.id.toString()))
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
