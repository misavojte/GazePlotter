import MetricCorrelationPlot from './components/MetricCorrelationPlot.svelte'
import MetricCorrelationExportFigure from './components/MetricCorrelationExportFigure.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { MetricCorrelationSettings } from './types'

export const metricCorrelationDefinition = definePlot<
  'metricCorrelation',
  MetricCorrelationSettings
>({
  type: 'metricCorrelation',
  name: 'Metric Correlation',
  component: MetricCorrelationPlot,
  export: { figure: MetricCorrelationExportFigure },
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    view: 'heatmap',
    selectedAoiId: null,
    correlationMethod: 'spearman',
    enabledMetrics: [],
  }),
  getMinSize: () => ({ w: 11, h: 11 }),
  getDefaultHeight: () => 13,
  getDefaultWidth: () => 13,
  requireCapabilities: ['segmented'],
})
