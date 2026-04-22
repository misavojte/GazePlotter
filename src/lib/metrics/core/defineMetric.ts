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
  // Idempotent on the id: re-evaluating a definition file (HMR) overwrites the
  // stored recipe with the fresh closure but preserves registration order.
  if (!_recipes.has(recipe.id)) _order.push(recipe.id)
  _recipes.set(recipe.id, recipe as MetricRecipe<any, any>)
  return { meta: toMeta(recipe as MetricRecipe<any, any>) }
}

export function getRecipe(id: string): MetricRecipe<any, any> | undefined {
  return _recipes.get(id)
}

export function listRecipeIds(): readonly string[] {
  return _order
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
    supportsWindowing: r.supportsWindowing ?? true,
    additive: r.additive ?? false,
    providesAnyFixation: r.providesAnyFixation ?? false,
    defaultLabel: r.defaultLabel as ((p: Record<string, unknown>) => string) | undefined,
  }
}
