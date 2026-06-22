import type {
  CorrelationMethod,
  MetricCorrelationView,
} from './types'

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
