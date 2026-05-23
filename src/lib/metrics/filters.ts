/**
 * Single-source-of-truth filter between a plot's metric contract and the
 * library of MetricInstance objects. Plots declare `{outputShape, windowing}`
 * via `PlotMetricContract`; this module answers three questions against that
 * contract: does this instance match, could this recipe instantiate into it,
 * which instances from a library apply.
 */
import type { Metric, OutputShape } from './core/dsl'
import type { MetricInstance } from './instances'
import { getRecipe } from './core/defineMetric'
import {
  PROJECTION_LEAVES,
  type LeafKind,
} from './core/projection'
import { recipeSupports } from './core/validation'

export type PlotMetricContract = {
  outputShape: OutputShape | readonly OutputShape[]
  windowing: 'forbidden' | 'required' | 'allowed'
  multiSelect?: boolean
}

export function contractLeafKinds(c: PlotMetricContract): LeafKind[] {
  const shapes = Array.isArray(c.outputShape) ? c.outputShape : [c.outputShape as OutputShape]
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
