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
  supportedLeaves,
  type LeafKind,
  type LeafProjection,
  type Projection,
} from './core/projection'
import { recipeSupports } from './core/validation'
import {
  soundReductions,
  distributionStatistics,
  supportedMatrixReducers,
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

function contractLeafKinds(c: PlotMetricContract): LeafKind[] {
  const shapes: readonly OutputShape[] = Array.isArray(c.outputShape) ? c.outputShape : [c.outputShape]
  return (Object.keys(PROJECTION_LEAVES) as LeafKind[]).filter(k =>
    shapes.includes(PROJECTION_LEAVES[k].outputShape)
  )
}

/**
 * A minimal VALID concrete leaf of `kind` for a metric — used only to ask
 * {@link recipeSupports} whether the kind is reachable. AOI names/slots are
 * irrelevant to validity (name-refs always pass), but reducer-bearing kinds must
 * carry a reducer the metric actually offers or the reducer gate spuriously fails.
 */
function representativeLeaf(meta: MetricMeta, kind: LeafKind): LeafProjection {
  switch (kind) {
    case 'pick-aoi':
    case 'matrix-row':
    case 'matrix-col':
      return { kind, aoiRef: { by: 'name', name: '' } }
    case 'matrix-cell':
      return { kind, fromAoi: { by: 'name', name: '' }, toAoi: { by: 'name', name: '' } }
    case 'aggregate-aoi':
      return { kind, reducer: meta.aoiAggregate?.max ? 'max' : 'min' }
    case 'matrix-aggregate':
      return { kind, reducer: supportedMatrixReducers(meta.measurementClass)[0] ?? 'mean' }
    default:
      return { kind } as LeafProjection
  }
}

/**
 * The projection leaf kinds a metric can actually produce under a plot's
 * contract: the metric's supported leaves ∩ the contract's allowed leaves,
 * validated through {@link recipeSupports} (windowing, reducer, and author
 * `rejects` gates). The "what could I build from this metric here?" answer —
 * read by the category/metric pickers to preview the options before Configure,
 * and by ConfigureMetric for its projection tabs.
 */
export function metricLeafKindsInContract(m: Metric, c: PlotMetricContract): LeafKind[] {
  const recipe = getRecipe(m.meta.id)
  if (!recipe) return []
  const allowed = new Set(contractLeafKinds(c))
  const windowed = c.windowing === 'required'
  return supportedLeaves(m).filter(kind => {
    if (!allowed.has(kind)) return false
    const leaf = representativeLeaf(m.meta, kind)
    const projection: Projection = windowed
      ? { kind: 'windowed', window: { windowSize: 500, stepSize: 500 }, inner: leaf }
      : leaf
    return recipeSupports(recipe, projection) === true
  })
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
