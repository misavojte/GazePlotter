import MetricCorrelationPlot from './components/MetricCorrelationPlot.svelte'
import { deriveMetricCorrelationView } from './core/view'
import {
  StimulusSection,
  GroupSection,
  AoiSection,
  TimelineRangeSection,
} from '$lib/plots/shared/components/sections'
import MetricCorrelationMetricSection from './components/sections/MetricCorrelationMetricSection.svelte'
import MetricCorrelationVisualisationSection from './components/sections/MetricCorrelationVisualisationSection.svelte'
import MetricCorrelationMethodSection from './components/sections/MetricCorrelationMethodSection.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import {
  getStimuliOptions,
  getParticipantsGroupOptions,
} from '$lib/plots/shared'
import type { MetricCorrelationSettings } from './types'

export const metricCorrelationDefinition = definePlot<
  'metricCorrelation',
  MetricCorrelationSettings
>({
  type: 'metricCorrelation',
  name: 'Metric Correlation',
  group: 'per-participant',
  component: MetricCorrelationPlot,
  paneSections: [
    { key: 'stimulus', component: StimulusSection },
    { key: 'group', component: GroupSection },
    { key: 'metric', component: MetricCorrelationMetricSection },
    {
      key: 'metricCorrelation:visualisation',
      component: MetricCorrelationVisualisationSection,
    },
    {
      key: 'metricCorrelation:correlationMethod',
      component: MetricCorrelationMethodSection,
    },
    { key: 'timelineRange', component: TimelineRangeSection },
    { key: 'aoi', component: AoiSection },
  ],
  export: { deriveView: deriveMetricCorrelationView },
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
    view: 'heatmap',
    correlationMethod: 'spearman',
    metricInstanceIds: [
      'absoluteTime-any',
      'visitCount-any',
      'visitDuration-any',
      'fixationCount-any',
      'fixationDuration-any',
      'timeToFirstFixation-any',
      'firstFixationDuration-any',
      'rqaRec',
      'rqaDet',
      'rqaLam',
    ],
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
  requireCapabilities: ['segmented'],
  consumesMetrics: {
    outputShape: 'scalar',
    windowing: 'forbidden',
    crossParticipant: 'samples',
    multiSelect: true,
  },
})
