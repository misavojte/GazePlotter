import type { Metric, OutputShape } from './core/dsl'
import type { MetricInstance } from './instances'
import { getMetric } from './registry'
import { getRecipe } from './core/defineMetric'
import { computeEffectiveShape, targetsFor } from './core/projection'
import { validateCombination } from './core/validation'

/**
 * Descriptor of what metric instances a UI surface (plot pane, library
 * modal) accepts. One descriptor drives both the dropdown filter and the
 * "Create new" list — eliminates the need for each pane to reimplement
 * the same shape/windowing predicate.
 */
export type MetricContext = {
  /** Output shapes this consumer accepts. */
  shapes: readonly OutputShape[]
  /** 'never' = only non-windowed instances; 'only' = only windowed. */
  windowing: 'never' | 'only'
  /** Dropdown UX: multi-select (checkboxes) vs single-select (radios). */
  multiSelect?: boolean
}

/** Does an existing instance belong in this context? Uses effective
 *  (post-projection) shape, then runs the central validator so invalid
 *  combinations (e.g., a saved `transitionProbability · matrix-aggregate`
 *  from an older build) silently disappear from dropdowns. */
export function instanceMatchesContext(
  instance: MetricInstance,
  ctx: MetricContext,
): boolean {
  const rawShape = getMetric(instance.baseId)?.meta.outputShape
  if (!rawShape) return false
  const effective = computeEffectiveShape(rawShape, instance.projection)
  if (!ctx.shapes.includes(effective)) return false
  const hasWindowing = !!instance.windowing
  if ((ctx.windowing === 'only') !== hasWindowing) return false
  // Validator runs only when projection is set; bare recipes (no projection)
  // are always structurally valid against their raw shape.
  if (instance.projection) {
    const recipe = getRecipe(instance.baseId)
    if (!recipe) return false
    if (!validateCombination({ recipe, projection: instance.projection, windowing: instance.windowing }).ok) {
      return false
    }
  }
  return true
}

/**
 * Can a metric definition be instantiated via this context's "Create" UI?
 * A metric is creatable if SOME target shape of its projection space matches
 * the context's accepted shapes — purely projection-target-based, regardless
 * of the recipe's raw output shape.
 */
export function metricIsCreatableInContext(
  metric: Metric,
  ctx: MetricContext,
): boolean {
  const raw = metric.meta.outputShape
  const anyTargetFits = targetsFor(raw).some(t => ctx.shapes.includes(t))
  if (!anyTargetFits) return false
  if (ctx.windowing === 'only') {
    return metric.meta.computationModes.some(m => m !== 'global')
  }
  return true
}

/** Canonical contexts used by the built-in plots. */
export const METRIC_CONTEXTS = {
  /** Single aoi-vector metric (bar plot). */
  aoiVector: {
    shapes: ['aoi-vector'],
    windowing: 'never',
    multiSelect: false,
  },
  /** Single aoi-pair-matrix metric (transition matrix). */
  aoiPair: {
    shapes: ['aoi-pair-matrix'],
    windowing: 'never',
    multiSelect: false,
  },
  /** Multiple scalar metrics (metric correlation). AOI binding lives inside
   *  the projection of each selected instance — the plot has no plot-level
   *  AOI scope picker. */
  globalMulti: {
    shapes: ['scalar'],
    windowing: 'never',
    multiSelect: true,
  },
  /** Single windowed scalar metric (evolving metrics). AOI binding lives in
   *  the projection of the instance — no plot-level AOI scope picker. */
  windowed: {
    shapes: ['scalar'],
    windowing: 'only',
    multiSelect: false,
  },
} as const satisfies Record<string, MetricContext>
