import type { PlotItemContract } from '$lib/plots/definePlot'

export type MetricCorrelationView = 'heatmap' | 'splom'

export type CorrelationMethod = 'pearson' | 'spearman'

export type MetricCorrelationSettings = {
  stimulusId: number
  groupId: number
  view: MetricCorrelationView
  correlationMethod: CorrelationMethod
  /**
   * List of MetricInstance ids (workspace-level library references). Each
   * selected metric must project to a scalar — AOI binding lives inside the
   * projection of the instance, not on the plot.
   *
   * Only participant-level correlation is supported on purpose: across-AOI
   * and participant×AOI modes are statistically unsound (ecological fallacy,
   * pseudo-replication) and are deliberately not shipped.
   */
  metricInstanceIds: string[]
  timelineStart?: number
  timelineEnd?: number
}

export type MetricCorrelationItem = PlotItemContract<
  'metricCorrelation',
  MetricCorrelationSettings
>

export interface MetricDescriptor {
  id: string
  label: string
  unit: string
}

export interface MetricVector {
  metricId: string
  values: number[]
}

export interface CorrelationPoint {
  /** Raw (x, y) pair for SPLOM scatter cells. */
  x: number
  y: number
  /** Participant label for hover tooltip. */
  participantLabel?: string
}

export interface CorrelationCell {
  rowMetricId: string
  colMetricId: string
  r: number | null
  n: number
  /** Paired samples for SPLOM rendering. Only populated when needed. */
  points?: CorrelationPoint[]
}

export interface MetricCorrelationResult {
  metrics: MetricDescriptor[]
  /** Parallel to metrics[]; all vectors are aligned on the participant axis. */
  vectors: MetricVector[]
  /** Row-major N×N cells (N = metrics.length). */
  cells: CorrelationCell[]
  correlationMethod: CorrelationMethod
  /** Number of participants in the group (base N before NaN filtering). */
  sampleSize: number
  /** Participant labels parallel to vectors' rows (for SPLOM tooltips). */
  participantLabels?: string[]
  /** True when fewer than 2 enabled metric instances exist / resolve. */
  noMetric?: boolean
}
