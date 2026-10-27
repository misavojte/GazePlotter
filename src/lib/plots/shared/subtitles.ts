import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getParticipantsSelections } from '$lib/data/engine'
import { ALL_SELECTION_LABEL, type ParticipantScope } from '$lib/data/types'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import { getStimuliOptions, getParticipantOptions } from './selectOptionsGetters'

/** The label of the option whose value is `id`. */
export const optionLabel = (options: readonly { value: string; label: string }[], id: number) =>
  options.find(o => o.value === String(id))?.label

/** One part per fact that resolved to a non-empty label; undefined when none did. */
export function subtitleParts(...facts: [string, string | undefined][]): PlotSubtitleParts | undefined {
  const parts = facts.flatMap(([label, value]) => (value ? [{ label, value }] : []))
  return parts.length === 0 ? undefined : parts
}

/** The participants a plot ranges over: its selection's name (unknown = All), plus the empty-participant filter. */
export function participantScopeLabel(engine: DataEngine, scope: ParticipantScope): string {
  const id = scope.participantSelectionId
  const name = (id && getParticipantsSelections(engine).find(s => s.id === id)?.name) || ALL_SELECTION_LABEL
  return scope.hideEmptyParticipants ? `${name}, non-empty` : name
}

/**
 * Shared grid-header subtitle builders — a plot's subtitle is its filter
 * facts, and the two variants mirror the 'participants' and 'participant' pane
 * sections (a participant selection, or one participant). Structurally typed so a definition can pass
 * them directly: `getSubtitle: stimulusParticipantsSubtitle`.
 */
export function stimulusParticipantsSubtitle(params: {
  item: { settings: ParticipantScope & { stimulusId: number } }
  engine: DataEngine
}): PlotSubtitleParts | undefined {
  const { settings } = params.item
  return subtitleParts(
    ['Stimulus', optionLabel(getStimuliOptions(params.engine), settings.stimulusId)],
    ['Participants', participantScopeLabel(params.engine, settings)]
  )
}

export function stimulusParticipantSubtitle(params: {
  item: { settings: { stimulusId: number; participantId: number } }
  engine: DataEngine
}): PlotSubtitleParts | undefined {
  const { settings } = params.item
  return subtitleParts(
    ['Stimulus', optionLabel(getStimuliOptions(params.engine), settings.stimulusId)],
    ['Participant', optionLabel(getParticipantOptions(params.engine), settings.participantId)]
  )
}
