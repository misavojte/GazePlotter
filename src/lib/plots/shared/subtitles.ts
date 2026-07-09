import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import {
  getStimuliOptions,
  getParticipantsGroupOptions,
  getParticipantOptions,
} from './selectOptionsGetters'

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
  const { item, engine } = params
  const parts: PlotSubtitleParts = []
  const stim = getStimuliOptions(engine).find(
    o => o.value === String(item.settings.stimulusId)
  )
  if (stim?.label) parts.push({ label: 'Stimulus', value: stim.label })
  const group = getParticipantsGroupOptions(
    engine,
    true,
    item.settings.stimulusId
  ).find(o => o.value === String(item.settings.groupId))
  if (group?.label) parts.push({ label: 'Group', value: group.label })
  return parts.length === 0 ? undefined : parts
}

export function stimulusParticipantSubtitle(params: {
  item: { settings: { stimulusId: number; participantId: number } }
  engine: DataEngine
}): PlotSubtitleParts | undefined {
  const { item, engine } = params
  const parts: PlotSubtitleParts = []
  const stim = getStimuliOptions(engine).find(
    o => o.value === String(item.settings.stimulusId)
  )
  if (stim?.label) parts.push({ label: 'Stimulus', value: stim.label })
  const participant = getParticipantOptions(engine).find(
    o => o.value === String(item.settings.participantId)
  )
  if (participant?.label)
    parts.push({ label: 'Participant', value: participant.label })
  return parts.length === 0 ? undefined : parts
}
