import type { AdaptiveTimeline } from '$lib/plots/shared'

/**
 * The figure's data contract: ONE DISTRIBUTION PER CATEGORY SLOT, drawn as a
 * beeswarm plus an overlay statistic, degenerating to a single proportional bar
 * when the metric is a rate with no distribution to swarm.
 *
 * Deliberately category-agnostic — a slot is an AOI on the AOI Comparison and
 * an eye-movement type on the Eye-movement Comparison. Nothing here names
 * either entity, and nothing names the mark: the marks are the renderers'
 * concern (`drawBeeswarmPoints`, `drawBoxplotOverlay`, `drawProportionalBars`).
 */

// --- Which statistic the overlay draws on top of the swarm ---

export type StatisticalOverlayType =
  | 'none'
  | 'meanCi95'
  | 'meanSd'
  | 'boxplot'

// --- Per-slot statistics bundle ---

export interface SummaryStatistics {
  mean: number
  median: number
  q1: number
  q3: number
  min: number
  max: number
  sd: number
  sem: number
  whiskerLow: number // max(min, Q1 - 1.5*IQR)
  whiskerHigh: number // min(max, Q3 + 1.5*IQR)
  count: number
  outliers: number[] // values beyond whiskers
}

/** One category slot: its distribution, its summary, and its chrome. */
export interface CategoryDistribution {
  value: number
  label: string
  color: string
  stats: SummaryStatistics | null
  individualValues: number[] | null
  individualParticipantNames: string[] | null
}

export interface DistributionResult {
  data: CategoryDistribution[]
  timeline: AdaptiveTimeline
  /**
   * Raw maximum across individual values (and whiskers for the boxplot
   * overlay), before nice-rounding is applied to the timeline. Exposed so
   * cross-plot sync can compare apples to apples between plots.
   */
  dataMax: number
  /** True when the plot's `metricInstanceIds[0]` points to a missing instance. */
  noMetric?: boolean
  /**
   * True when the metric aggregates as a `proportion` (e.g. `fixated`): the
   * figure renders a plain proportional bar, not a beeswarm. The value is
   * already scaled to percent.
   */
  proportion?: boolean
}
