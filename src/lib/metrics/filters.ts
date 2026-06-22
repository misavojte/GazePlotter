/**
 * Single-source-of-truth filter between a plot's metric contract and the
 * library of MetricInstance objects. Plots declare `{outputShape, windowing}`
 * via `PlotMetricContract`; this module answers three questions against that
 * contract: does this instance match, could this recipe instantiate into it,
 * which instances from a library apply.
 */
import type { Metric, MetricMeta, OutputShape } from './core/dsl'
import type { MetricInstance } from './instances'
import { getRecipe } from './core/defineMetric'
import {
  PROJECTION_LEAVES,
  type LeafKind,
} from './core/projection'
import { recipeSupports } from './core/validation'
import {
  soundReductions,
  distributionStatistics,
  type GroupReduction,
  type DistributionStat,
} from './core/measurement'

/**
 * How a plot treats the cross-participant dimension — the capability that, with
 * a metric's `measurementClass`, determines which reduction / statistic controls
 * the metric library offers when opened from that plot.
 *
 *   - `reduce`          collapse to one value per cell → a {@link GroupReduction}
 *     (AOI Timeline, Transition matrix).
 *   - `distribution`    draw the per-participant distribution → a
 *     {@link DistributionStat} overlay (AOI Comparison / bar).
 *   - `per-participant` one series per participant, no reduction (Metric Timeline).
 *   - `samples`         participants are the N of a statistic (Metric Correlation).
 *   - `group-axis`      participants are the matrix axes (Scanpath comparison).
 */
export type CrossParticipantMode =
  | 'reduce'
  | 'distribution'
  | 'per-participant'
  | 'samples'
  | 'group-axis'

export type PlotMetricContract = {
  outputShape: OutputShape | readonly OutputShape[]
  windowing: 'forbidden' | 'required' | 'allowed'
  crossParticipant: CrossParticipantMode
  multiSelect?: boolean
}

/**
 * The cross-participant reduction options the metric library should offer for a
 * metric under this plot's contract — the metric's sound set ({@link
 * soundReductions}) when the plot reduces to one value per cell, else `[]`. Pure
 * intersection of plot capability and metric nature; an MCP caller reads the
 * same function to know what it may set.
 */
export function contractReductions(c: PlotMetricContract, meta: MetricMeta): GroupReduction[] {
  return c.crossParticipant === 'reduce' ? soundReductions(meta.measurementClass) : []
}

/**
 * The distribution statistics the metric library should offer for a metric under
 * this plot's contract — the metric's set ({@link distributionStatistics}) when
 * the plot draws a distribution, else `[]`.
 */
export function contractDistributionStats(c: PlotMetricContract, meta: MetricMeta): DistributionStat[] {
  return c.crossParticipant === 'distribution' ? distributionStatistics(meta.measurementClass) : []
}

export function contractLeafKinds(c: PlotMetricContract): LeafKind[] {
  const shapes: readonly OutputShape[] = Array.isArray(c.outputShape) ? c.outputShape : [c.outputShape]
  return (Object.keys(PROJECTION_LEAVES) as LeafKind[]).filter(k =>
    shapes.includes(PROJECTION_LEAVES[k].outputShape)
  )
}

export function instanceMatchesContract(
  inst: MetricInstance,
  c: PlotMetricContract,
): boolean {
  const p = inst.projection
  const allowed = contractLeafKinds(c)
  if (p.kind === 'windowed') {
    if (c.windowing === 'forbidden') return false
    if (!allowed.includes(p.inner.kind)) return false
  } else {
    if (c.windowing === 'required') return false
    if (!allowed.includes(p.kind)) return false
  }
  const recipe = getRecipe(inst.baseId)
  return !!recipe && recipeSupports(recipe, p) === true
}

export function metricIsCreatableInContract(
  m: Metric,
  c: PlotMetricContract,
): boolean {
  if (c.windowing === 'required' && m.meta.supportsWindowing === false) return false
  return contractLeafKinds(c).some(leaf =>
    PROJECTION_LEAVES[leaf].rawShapes.includes(m.meta.rawShape),
  )
}
