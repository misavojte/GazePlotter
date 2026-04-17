import { BAR_PLOT_AGGREGATION_METHODS } from '$lib/plots/bar/const'
import type {
  CorrelationMethod,
  MetricCorrelationView,
} from './types'

export { BAR_PLOT_AGGREGATION_METHODS }

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

export const MIN_CORRELATION_SAMPLES = 3

export const WHOLE_STIMULUS_AOI_LABEL = 'Whole stimulus (any fixation)'
