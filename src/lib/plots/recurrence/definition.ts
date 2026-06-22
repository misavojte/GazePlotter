import RecurrencePlot from './components/RecurrencePlot.svelte'
import { deriveRecurrenceView } from './core/view'
import {
  StimulusSection,
  ParticipantSection,
  AoiSection,
  TimelineRangeSection,
} from '$lib/plots/shared/components/sections'
import RecurrenceMethodSection from './components/sections/RecurrenceMethodSection.svelte'
import RecurrenceVisualisationSection from './components/sections/RecurrenceVisualisationSection.svelte'
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
  group: 'gaze-behavior',
  component: RecurrencePlot,
  paneSections: [
    { key: 'stimulus', component: StimulusSection },
    { key: 'participant', component: ParticipantSection },
    { key: 'recurrencePlot:method', component: RecurrenceMethodSection },
    {
      key: 'recurrencePlot:visualisation',
      component: RecurrenceVisualisationSection,
    },
    { key: 'timelineRange', component: TimelineRangeSection },
    { key: 'aoi', component: AoiSection },
  ],
  export: { deriveView: deriveRecurrenceView },
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
