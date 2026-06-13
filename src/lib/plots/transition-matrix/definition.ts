import TransitionMatrixPlot from './components/TransitionMatrixPlot.svelte'
import { deriveTransitionMatrixView } from './core/view'
import {
  StimulusSection,
  GroupSection,
  MetricSection,
  TimelineRangeSection,
  AoiSection,
} from '$lib/plots/shared/components/sections'
import TransitionMatrixVisualisationSection from './components/sections/TransitionMatrixVisualisationSection.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import { INACTIVE_COLOR, PRESET_PALETTES } from '$lib/color/palettes'
import {
  getStimuliOptions,
  getParticipantsGroupOptions,
} from '$lib/plots/shared'
import type { TransitionMatrixPlotSettings } from './types'

export const transitionMatrixDefinition = definePlot<
  'transitionMatrix',
  TransitionMatrixPlotSettings
>({
  type: 'transitionMatrix',
  name: 'Transition Matrix',
  component: TransitionMatrixPlot,
  paneSections: [
    { key: 'stimulus', component: StimulusSection },
    { key: 'group', component: GroupSection },
    { key: 'metric', component: MetricSection },
    {
      key: 'transitionMatrix:visualisation',
      component: TransitionMatrixVisualisationSection,
    },
    { key: 'timelineRange', component: TimelineRangeSection },
    { key: 'aoi', component: AoiSection },
  ],
  export: { deriveView: deriveTransitionMatrixView },
  getSubtitle: ({ item, engine }) => {
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
  },
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    stimuliColorValueRanges: [],
    metricInstanceIds: ['transitionCount-fix'],
    belowMinColor: INACTIVE_COLOR,
    aboveMaxColor: INACTIVE_COLOR,
    showBelowMinLabels: false,
    showAboveMaxLabels: false,
    colorScale: [...PRESET_PALETTES.BLUE.colors],
    hideNoAoi: false,
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
  requireCapabilities: ['segmented'],
  consumesMetrics: {
    outputShape: 'aoi-pair-matrix',
    windowing: 'forbidden',
  },
})
