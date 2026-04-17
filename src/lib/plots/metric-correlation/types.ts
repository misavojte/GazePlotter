import type { PlotItemContract } from '$lib/plots/definePlot'

export type MetricCorrelationView = 'heatmap' | 'splom'

export type CorrelationMethod = 'pearson' | 'spearman'

export type MetricCorrelationSettings = {
  stimulusId: number
  groupId: number
  view: MetricCorrelationView
  /**
   * AOI id the participant-level correlation is computed over. `null` means
   * the whole stimulus (AnyFixation slot) — one point per participant based
   * on their stimulus-wide gaze behavior. A stale id from a previous stimulus
   * falls back to null at render time.
   *
   * Only participant-level correlation is supported on purpose: across-AOI
   * and participant×AOI modes are statistically unsound (ecological fallacy,
   * pseudo-replication) and are deliberately not shipped.
   */
  selectedAoiId: number | null
  correlationMethod: CorrelationMethod
  /** List of BAR_PLOT_AGGREGATION_METHODS ids. Empty means all defaults. */
  enabledMetrics: string[]
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
  /** Scope the correlation is taken over. */
  scope: {
    kind: 'aoi' | 'wholeStimulus'
    /** AOI displayed name (or 'Whole stimulus'). */
    label: string
    /** Canonical AOI id for reference; undefined for wholeStimulus. */
    aoiId?: number
  }
  /** Participant labels parallel to vectors' rows (for SPLOM tooltips). */
  participantLabels?: string[]
}
