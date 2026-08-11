import type { AdaptiveTimeline } from '$lib/plots/shared/timelineUtils'

export type EvolvingMetricsSettings = {
  stimulusId: number
  groupId: number
  /** Per-plot AOI SELECTION id; unset/0 = all AOIs. */
  aoiSelectionId?: number
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

/**
 * A single windowed measurement. `centerMs` is where the value is
 * scientifically anchored — the temporal midpoint of the window (midpoint of
 * the middle fixation for fixation-windowed metrics).
 *
 * `startMs`/`endMs` are the PAINT span, and the rules differ per branch — see
 * `core/windowSpans.ts`, the single source of truth. Coverage is NOT gap-free:
 * where a window was dropped its span stays unpainted rather than being
 * inherited by a neighbour.
 */
export interface EvolvingMetricsWindow {
  startMs: number
  endMs: number
  centerMs: number
  value: number
  /**
   * The WINDOW this value summarises — `windowSize` wide and so identical for
   * every window of a time-windowed metric, first fixation's onset to last
   * fixation's end for a fixation-windowed one. Bounds `startMs`/`endMs`, and is
   * what the hover band shows. Required: both construction sites set it, and a
   * fallback here would have to invent a duration.
   */
  windowStartMs: number
  windowEndMs: number
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
