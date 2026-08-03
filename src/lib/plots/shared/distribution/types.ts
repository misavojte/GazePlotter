import type { Scope } from '$lib/metrics'
import type { AdaptiveTimeline } from '$lib/plots/shared/timelineUtils'

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

// --- What a plot contributes: its category axis ---

/** One category slot: where to read it from the metric, and how to draw it. */
export interface DistributionSlot {
  /** Index into the metric's vector — the slot its result is indexed by. */
  slot: number
  label: string
  color: string
}

/**
 * The ONLY per-plot input to a distribution: the category axis in drawn order
 * (already narrowed by the plot's SELECTION) and the participant scopes to
 * query (already carrying the stimulus, the sub-stimulus time range and any AOI
 * SELECTION). A slot is an AOI on the AOI Comparison and an eye-movement type
 * on the Eye-movement Comparison; everything downstream — metric resolution,
 * pooling, statistics, ordering, scale — is `collectDistribution`'s job and is
 * identical for both.
 */
export interface DistributionAxis {
  slots: readonly DistributionSlot[]
  scopes: readonly Scope[]
  /** Display names, parallel to `scopes` — the dot-hover attribution. */
  participantNames: readonly string[]
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

/**
 * The screen-coordination surface every distribution view carries on
 * `PlotView.meta`. Read by `distributionValueAxisScreen`, so a plot opts into
 * cross-plot value-axis sync with one line in its definition and nothing in its
 * derivation; plots without the recipe simply carry it unread.
 */
export interface DistributionViewMeta {
  /** Metric instance id used as the sync key, or null when nothing is picked. */
  syncKey: string | null
  /** Unsynced data maximum — what a sibling plot's axis is compared against. */
  dataMax: number
}
