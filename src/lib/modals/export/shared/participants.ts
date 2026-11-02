/**
 * Shared participant-selection logic for export modals: participants are an
 * EXPLICIT selection (a Set of participant-id strings), and saved participant
 * selections are one-click presets, never an export parameter.
 */
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { ALL_SELECTION_LABEL, type ParticipantsSelection } from '$lib/data/types'
import {
  getParticipantOrderVector,
  getParticipantsIds,
  getParticipantsSelections,
} from '$lib/data/engine'

/** Selection presets offered as chips: "All", then every non-empty saved selection. */
export function participantSelectionPresets(engine: DataEngine): ParticipantsSelection[] {
  return [
    { id: 0, name: ALL_SELECTION_LABEL, participantsIds: getParticipantOrderVector(engine) },
    ...getParticipantsSelections(engine),
  ].filter(g => g.participantsIds.length > 0)
}

/** Initial selection: a given selection's members, else every participant. */
export function defaultParticipantSelection(
  engine: DataEngine,
  participantSelectionId?: number
): Set<string> {
  return new Set(
    getParticipantsIds(engine, { participantSelectionId }).map(id => id.toString())
  )
}

/** Selected participant ids in engine order, so export rows are stable. */
export function orderedSelectedParticipantIds(
  engine: DataEngine,
  selected: ReadonlySet<string>
): number[] {
  return getParticipantOrderVector(engine).filter(id => selected.has(id.toString()))
}
