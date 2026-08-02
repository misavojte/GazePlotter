/**
 * The filter between a plot's `PlotMetricContract` and the metric library:
 * does this instance match, could this recipe instantiate into it, which
 * instances apply.
 */
import type { Metric, MetricMeta, OutputShape } from './core/dsl'
import type { MetricInstance } from './instances'
import { getRecipe } from './core/defineMetric'
import {
  PROJECTION_LEAVES,
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
 * How a plot treats the cross-participant dimension. With a metric's
 * `measurementClass`, this decides which controls the library offers.
 *
 *   - `reduce`          one value per cell → a {@link GroupReduction}
 *     (AOI Timeline, Transition matrix).
 *   - `distribution`    the per-participant distribution → a
 *     {@link DistributionStat} overlay (AOI Comparison / bar).
 *   - `per-participant` one series each, no reduction (Metric Timeline).
 *   - `samples`         participants are the N of a statistic (Correlation).
 *   - `group-axis`      participants are the matrix axes (Scanpath comparison).
 */
type CrossParticipantMode =
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

/** The intersection of plot capability and metric nature: the metric's sound
 *  set when the plot reduces to one value per cell, else `[]`. */
export function contractReductions(c: PlotMetricContract, meta: MetricMeta): GroupReduction[] {
  return c.crossParticipant === 'reduce' ? soundReductions(meta.measurementClass) : []
}

/** Likewise, the metric's set when the plot draws a distribution, else `[]`. */
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
 * A minimal valid leaf of `kind`, only ever passed to {@link recipeSupports}
 * to ask whether the kind is reachable. AOI names are irrelevant to validity
 * (name-refs always pass), but a reducer-bearing kind must carry a reducer the
 * metric actually offers or its gate fails spuriously.
 */
function representativeLeaf(meta: MetricMeta, kind: LeafKind): LeafProjection {
  switch (kind) {
    case 'pick-aoi':
    case 'matrix-row':
    case 'matrix-col':
      return { kind, aoiRef: { by: 'name', name: '' } }
    case 'pick-category':
      return { kind, categoryName: '' }
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
 * "What could I build from this metric here?" — the contract's allowed leaves,
 * each validated through {@link recipeSupports}, which is the ONE authority on
 * availability (raw shape, `providesAnyFixation`, `aoiAggregate`,
 * `sampleSummary`, windowing, author `rejects`). Never pre-filter through a
 * second enumerator; the one that existed re-encoded three of those gates and
 * drifted.
 */
export function metricLeafKindsInContract(m: Metric, c: PlotMetricContract): LeafKind[] {
  const recipe = getRecipe(m.meta.id)
  if (!recipe) return []
  const windowed = c.windowing === 'required'
  return contractLeafKinds(c).filter(kind => {
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
