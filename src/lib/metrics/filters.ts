/**
 * Single-source-of-truth filter between a plot's metric contract and the
 * library of MetricInstance objects. Plots declare `{leaves, windowing}` via
 * `PlotMetricContract`; this module answers three questions against that
 * contract: does this instance match, could this recipe instantiate into it,
 * which instances from a library apply.
 */
import type { Metric } from './core/dsl'
import type { MetricInstance } from './instances'
import { getRecipe } from './core/defineMetric'
import {
  PROJECTION_LEAVES,
  type LeafKind,
} from './core/projection'
import { recipeSupports } from './core/validation'

export type PlotMetricContract = {
  leaves: readonly LeafKind[]
  windowing: 'forbidden' | 'required' | 'allowed'
  multiSelect?: boolean
}

export function instanceMatchesContract(
  inst: MetricInstance,
  c: PlotMetricContract,
): boolean {
  const p = inst.projection
  if (p.kind === 'windowed') {
    if (c.windowing === 'forbidden') return false
    if (!c.leaves.includes(p.inner.kind)) return false
  } else {
    if (c.windowing === 'required') return false
    if (!c.leaves.includes(p.kind)) return false
  }
  const recipe = getRecipe(inst.baseId)
  return !!recipe && recipeSupports(recipe, p) === true
}

export function metricIsCreatableInContract(
  m: Metric,
  c: PlotMetricContract,
): boolean {
  if (c.windowing === 'required' && m.meta.supportsWindowing === false) return false
  return c.leaves.some(leaf => PROJECTION_LEAVES[leaf].rawShapes.includes(m.meta.rawShape))
}

export function metricsForPlot(
  all: readonly MetricInstance[],
  c: PlotMetricContract,
): MetricInstance[] {
  return all.filter(i => instanceMatchesContract(i, c))
}
