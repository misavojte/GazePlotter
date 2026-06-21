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
 * this the coefficient is statistically uninformative (at very small n an
 * extreme r/ρ is near-certain by chance — e.g. Spearman at n=3 can only be
 * ±1 or ±0.5), so the cell renders as missing ("—") rather than painting noise
 * as signal. Per the project's statistical-rigor stance, an unsound low-n
 * coefficient is suppressed, not shown with a caveat.
 */
export const MIN_CORRELATION_SAMPLES = 10
