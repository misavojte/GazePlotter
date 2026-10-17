import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import {
  getStimuliOptions,
  getParticipantsSelectionOptions,
  getParticipantOptions,
} from './selectOptionsGetters'

/** The label of the option whose value is `id`. */
export const optionLabel = (options: readonly { value: string; label: string }[], id: number) =>
  options.find(o => o.value === String(id))?.label

/** One part per fact that resolved to a non-empty label; undefined when none did. */
export function subtitleParts(...facts: [string, string | undefined][]): PlotSubtitleParts | undefined {
  const parts = facts.flatMap(([label, value]) => (value ? [{ label, value }] : []))
  return parts.length === 0 ? undefined : parts
}

/**
 * Shared grid-header subtitle builders — a plot's subtitle is its filter
 * facts, and the two variants cover the two units of analysis (group-scoped
 * and single-participant plots). Structurally typed so a definition can pass
 * them directly: `getSubtitle: stimulusGroupSubtitle`.
 */
export function stimulusGroupSubtitle(params: {
  item: { settings: { stimulusId: number; groupId: number } }
  engine: DataEngine
}): PlotSubtitleParts | undefined {
  const { settings } = params.item
  return subtitleParts(
    ['Stimulus', optionLabel(getStimuliOptions(params.engine), settings.stimulusId)],
    ['Participants', optionLabel(getParticipantsSelectionOptions(params.engine, true, settings.stimulusId), settings.groupId)]
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
