import { deriveMetricCorrelationView } from './core/view'
import { plotCursorScreen } from '$lib/plots/shared/plotCursor.svelte'
import { definePlot } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import {
  METRIC_CORRELATION_CONTRACT,
  METRIC_CORRELATION_METHODS,
  METRIC_CORRELATION_VIEWS,
} from './const'
import type { MetricCorrelationSettings } from './types'

export const metricCorrelationDefinition = definePlot<
  'metricCorrelation',
  MetricCorrelationSettings
>({
  type: 'metricCorrelation',
  name: 'Metric Correlation',
  group: 'per-participant',
  paneSections: [
    'stimulus',
    'group',
    // Entry-field override on the shared schema: this plot correlates 2+
    // metrics, so the section title is plural.
    { key: 'metric', props: { title: 'Metrics' } },
    {
      key: 'metricCorrelation:visualisation',
      title: 'Visualisation',
      fields: [
        {
          kind: 'enum',
          key: 'view',
          options: METRIC_CORRELATION_VIEWS,
          default: 'heatmap',
        },
      ],
      // Short names in the collapsed header (the option labels are long).
      summary: ctx => {
        const view = ctx.common(s => s.view)
        return view.mixed ? 'Mixed' : view.value === 'heatmap' ? 'Heatmap' : 'Splom'
      },
    },
    {
      key: 'metricCorrelation:correlationMethod',
      title: 'Correlation method',
      fields: [
        {
          kind: 'enum',
          key: 'correlationMethod',
          options: METRIC_CORRELATION_METHODS,
          default: 'spearman',
        },
      ],
    },
    'timelineRange',
    'aoi',
  ],
  view: { deriveView: deriveMetricCorrelationView },
  screen: plotCursorScreen(),
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
  requireCapabilities: ['segmented'],
  consumesMetrics: METRIC_CORRELATION_CONTRACT,
})
