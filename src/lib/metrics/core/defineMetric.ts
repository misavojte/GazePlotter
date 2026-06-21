import type { ParamDef, ParamsOf } from './params'
import type { Metric, MetricMeta, MetricRecipe } from './dsl'

// Registry state lives on globalThis so it survives the module-graph re-evaluations
// that Vite dev mode performs across SSR / client / HMR passes. Without this, the
// same definition file runs twice and throws on duplicate registration.
interface RegistryState {
  recipes: Map<string, MetricRecipe<any, any>>
  order: string[]
}
const REGISTRY_KEY = Symbol.for('gazeplotter.metrics.registry')
const _state: RegistryState =
  (globalThis as Record<symbol, unknown>)[REGISTRY_KEY] as RegistryState ??
  ((globalThis as Record<symbol, unknown>)[REGISTRY_KEY] = {
    recipes: new Map<string, MetricRecipe<any, any>>(),
    order: [],
  })
const _recipes = _state.recipes
const _order = _state.order

export function defineMetric<
  const Params extends readonly ParamDef<any>[],
  Acc,
>(recipe: MetricRecipe<ParamsOf<Params>, Acc> & { params?: Params }): Metric {
  assertShapeLifecycleInvariant(recipe as MetricRecipe<any, any>)
  // Idempotent on the id: re-evaluating a definition file (HMR) overwrites the
  // stored recipe with the fresh closure but preserves registration order.
  if (!_recipes.has(recipe.id)) _order.push(recipe.id)
  _recipes.set(recipe.id, recipe as MetricRecipe<any, any>)
  return { meta: toMeta(recipe as MetricRecipe<any, any>) }
}

/**
 * `participant-pair-matrix` recipes compute via {@link MetricRecipe.scanGroup}
 * and must NOT define the per-participant scan trio. All other shapes use the
 * trio and must NOT define `scanGroup`. The pairing is an architectural
 * invariant — keeping it codified here prevents future recipes from sliding
 * into a hybrid mode where the runtime has to pick between two APIs.
 */
function assertShapeLifecycleInvariant(r: MetricRecipe<any, any>): void {
  const isGroupShape = r.rawShape === 'participant-pair-matrix'
  const hasGroup = typeof r.scanGroup === 'function'
  const hasPerParticipant =
    typeof r.init === 'function' &&
    typeof r.onFixation === 'function' &&
    typeof r.finalize === 'function'

  if (isGroupShape) {
    if (!hasGroup) {
      throw new Error(
        `[metrics] recipe "${r.id}" has rawShape 'participant-pair-matrix' but defines no scanGroup`,
      )
    }
    if (r.init || r.onFixation || r.finalize) {
      throw new Error(
        `[metrics] recipe "${r.id}" has rawShape 'participant-pair-matrix'; init/onFixation/finalize must be omitted`,
      )
    }
    return
  }

  if (hasGroup) {
    throw new Error(
      `[metrics] recipe "${r.id}" defines scanGroup but rawShape is "${r.rawShape}"; scanGroup is reserved for participant-pair-matrix`,
    )
  }
  if (!hasPerParticipant) {
    throw new Error(
      `[metrics] recipe "${r.id}" must define init, onFixation, and finalize`,
    )
  }
}

export function getRecipe(id: string): MetricRecipe<any, any> | undefined {
  return _recipes.get(id)
}


export function getMetric(id: string): Metric | undefined {
  const r = _recipes.get(id)
  return r ? { meta: toMeta(r) } : undefined
}

export function listMetrics(): Metric[] {
  return _order.map(id => ({ meta: toMeta(_recipes.get(id)!) }))
}

function toMeta(r: MetricRecipe<any, any>): MetricMeta {
  return {
    id: r.id,
    label: r.label,
    unit: r.unit,
    description: r.description,
    category: r.category,
    rawShape: r.rawShape,
    windowUnit: r.windowUnit,
    params: r.params ?? [],
    searchTags: r.searchTags ?? [],
    groupAggregation: r.groupAggregation ?? 'mean',
    supportsGroupAggregation: r.supportsGroupAggregation ?? r.rawShape !== 'participant-pair-matrix',
    supportsWindowing: r.supportsWindowing ?? true,
    additive: r.additive ?? false,
    providesAnyFixation: r.providesAnyFixation ?? false,
  }
}
