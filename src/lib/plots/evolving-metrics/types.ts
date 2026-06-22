import type { AdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import type { PlotItemContract } from '$lib/plots/definePlot'

export type EvolvingMetricsSettings = {
  stimulusId: number
  groupId: number
  /**
   * Slug(s) of the windowed × scalar MetricInstance this plot renders.
   * Stored as an array for uniformity with multi-select plots; the contract
   * is single-select so length is 0 (none) or 1 (selected).
   */
  metricInstanceIds: string[]
  presentation?: 'heatmap' | 'overlay'
  colorScale?: string[]
  timelineStart?: number
  timelineEnd?: number
}

export type EvolvingMetricsItem = PlotItemContract<
  'evolvingMetrics',
  EvolvingMetricsSettings
>

/**
 * A single windowed measurement. `centerMs` is where the value is
 * scientifically anchored — the temporal midpoint of the window (midpoint of
 * the middle fixation for fixation-windowed metrics). `startMs` and `endMs`
 * are Voronoi-style paint boundaries: each window "owns" the span from
 * halfway back to the previous window's center to halfway forward to the
 * next's, so colored regions butt together without gaps while each value is
 * still visually centered on its true anchor.
 *
 * The first and last windows use symmetric half-gap extrapolation (the gap
 * to their single neighbour mirrored on the opposite side) so edge windows
 * are the same width as their interior neighbours rather than stretching to
 * the trial bounds.
 */
export interface EvolvingMetricsWindow {
  startMs: number
  endMs: number
  centerMs: number
  value: number
  dataStartMs?: number
  dataEndMs?: number
}

export interface EvolvingMetricsParticipant {
  id: number
  label: string
  windows: EvolvingMetricsWindow[]
}

export interface EvolvingMetricsResult {
  participants: EvolvingMetricsParticipant[]
  timeline: AdaptiveTimeline
  xAxisLabel: string
  yAxisLabel: string
  maxTime: number
  valueMin: number
  valueMax: number
  /** True when the plot's `metricInstanceIds[0]` points to a missing instance. */
  noMetric?: boolean
}
