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
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import type { MetricCorrelationSettings } from './types'

export const metricCorrelationDefinition = definePlot<
  'metricCorrelation',
  MetricCorrelationSettings
>({
  type: 'metricCorrelation',
  name: 'Metric Correlation',
  group: 'per-participant',
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
  view: { deriveView: deriveMetricCorrelationView },
  getSubtitle: stimulusGroupSubtitle,
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
