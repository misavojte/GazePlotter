import RecurrencePlot from './components/RecurrencePlot.svelte'
import RecurrenceExportFigure from './components/RecurrenceExportFigure.svelte'
import RecurrencePlotPaneSettings from './components/RecurrencePlotPaneSettings.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import {
  getStimuliOptions,
  getParticipantOptions,
} from '$lib/plots/shared'
import type { RecurrencePlotSettings } from './types'

export const recurrencePlotDefinition = definePlot<
  'recurrencePlot',
  RecurrencePlotSettings
>({
  type: 'recurrencePlot',
  name: 'Recurrence Plot',
  component: RecurrencePlot,
  paneSettings: RecurrencePlotPaneSettings,
  export: { figure: RecurrenceExportFigure },
  getSubtitle: ({ item, engine }) => {
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
  },
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    participantId: 0,
    recurrenceMethod: 'fixedDistance',
    radius: 50,
    gridSize: 10,
    showDuration: false,
    minLineLength: 2,
    highlight: 'none',
    masking: 'diagonal',
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
  requireCapabilities: ['segmented'],
})
