import type { PlotMetricContract } from '$lib/metrics'
import type {
  CorrelationMethod,
  MetricCorrelationView,
} from './types'

/**
 * The metric contract — ONE const, referenced by both the transformer
 * (`resolveMetrics`) and `definition.consumesMetrics`, so the pane picker
 * filter and the value resolution can never disagree: an instance invalidated
 * after save (e.g. an `aggregate-aoi` extreme its metric no longer names)
 * must drop from the computation exactly as it drops from the picker.
 */
export const METRIC_CORRELATION_CONTRACT = {
  outputShape: 'scalar',
  windowing: 'forbidden',
  crossParticipant: 'samples',
  multiSelect: true,
} as const satisfies PlotMetricContract

export const METRIC_CORRELATION_METHODS: {
  value: CorrelationMethod
  label: string
}[] = [
  { value: 'spearman', label: 'Spearman' },
  { value: 'pearson', label: 'Pearson' },
]

export const METRIC_CORRELATION_VIEWS: {
  value: MetricCorrelationView
  label: string
}[] = [
  { value: 'heatmap', label: 'Heatmap matrix' },
  { value: 'splom', label: 'Scatterplot matrix (SPLOM)' },
]

/**
 * Minimum complete-pair sample size for a correlation cell to be shown. Below
 * this (n < 3) the coefficient is mathematically degenerate or undefined,
 * so the cell renders as missing ("—").
 */
export const MIN_CORRELATION_SAMPLES = 3
