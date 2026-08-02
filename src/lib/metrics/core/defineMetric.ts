import type { ParamDef, ParamsOf } from './params'
import { reduceNumeric } from './numeric'
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
  const stored = withDerivedFinalize(recipe as MetricRecipe<any, any>)
  assertShapeLifecycleInvariant(stored)
  // Idempotent on the id: re-evaluating a definition file (HMR) overwrites the
  // stored recipe with the fresh closure but preserves registration order.
  if (!_recipes.has(recipe.id)) _order.push(recipe.id)
  _recipes.set(recipe.id, stored)
  return metricFor(stored)
}

/**
 * A `sampleSummary` recipe's `finalize` IS its sample collapsed per slot by
 * `ctx.summaryStatistic` — that is what the declaration MEANS, so the DSL
 * writes it rather than trusting each recipe to spell the same sentence. Every
 * consumer keeps calling `recipe.finalize`; only the authoring side shrinks, to
 * "scan into a sample, say where it lives". An explicit `finalize` still wins,
 * for a sample recipe whose vector genuinely isn't the plain collapse.
 */
function withDerivedFinalize(r: MetricRecipe<any, any>): MetricRecipe<any, any> {
  if (!r.sampleSummary || r.finalize || typeof r.individuals !== 'function') return r
  const { individuals, flush } = r
  return {
    ...r,
    finalize: (acc, slots, ctx) => {
      flush?.(acc, slots)
      return individuals(acc).map(sample => reduceNumeric(sample, ctx.summaryStatistic))
    },
  }
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
    if (r.accumulation) {
      throw new Error(
        `[metrics] recipe "${r.id}" computes via scanGroup and has no per-fixation accumulation; omit 'accumulation'`,
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
  if (!r.accumulation) {
    throw new Error(
      `[metrics] recipe "${r.id}" must declare its accumulation semantics ` +
        `('clippedDuration' | 'clippedDurationShare' | 'midpointCount' | 'stateful') — ` +
        `see MetricRecipe.accumulation`,
    )
  }
  // The eye-movement-type axis is a SHAPE, never a parameter: a recipe that
  // scans categories produces a value per type ('category-vector'), and one
  // type is extracted via the pick-category PROJECTION downstream. The two
  // declarations are inseparable, and the fused windowed driver's per-AOI-slot
  // assembly assumes fixation scans, so category recipes stay on the trio path.
  if (r.scanSource === 'categories' && r.rawShape !== 'category-vector') {
    throw new Error(
      `[metrics] recipe "${r.id}" scans categories and must declare rawShape: 'category-vector'`,
    )
  }
  if (r.rawShape === 'category-vector' && r.scanSource !== 'categories') {
    throw new Error(
      `[metrics] recipe "${r.id}" declares rawShape 'category-vector' and must scan with scanSource: 'categories'`,
    )
  }
  if (r.scanSource === 'categories' && r.accumulation !== 'stateful') {
    throw new Error(
      `[metrics] recipe "${r.id}" scans categories and must declare accumulation: 'stateful'`,
    )
  }
  // The summary statistic has exactly ONE declaration channel: the SUMMARY
  // projection (`sampleSummary` + `individuals`, the choice riding pick-aoi /
  // pick-any-fixation / pick-category). A recipe-level `statistic` param is the
  // retired second channel — rejected here so it cannot be reinvented, on any
  // recipe, whether or not that recipe declares a sample.
  if (r.params?.some(p => p.id === 'statistic')) {
    throw new Error(
      `[metrics] recipe "${r.id}" declares a 'statistic' param — the summary choice lives on the SUMMARY projection (declare sampleSummary + individuals), never on the recipe`,
    )
  }
  if (r.sampleSummary) {
    if (typeof r.individuals !== 'function') {
      throw new Error(
        `[metrics] recipe "${r.id}" declares sampleSummary but no individuals — a summarized sample must stay inspectable`,
      )
    }
  } else if (r.flush) {
    // `flush` exists to keep the derived readers agreeing about when the
    // sample is complete; without a sample it is just an unrun hook.
    throw new Error(
      `[metrics] recipe "${r.id}" defines flush without sampleSummary — fold it into finalize`,
    )
  }
}

export function getRecipe(id: string): MetricRecipe<any, any> | undefined {
  return _recipes.get(id)
}


export function getMetric(id: string): Metric | undefined {
  const r = _recipes.get(id)
  return r ? metricFor(r) : undefined
}

export function listMetrics(): Metric[] {
  return _order.map(id => metricFor(_recipes.get(id)!))
}

/**
 * The public `Metric` view of a recipe, built ONCE per recipe object.
 *
 * A recipe is immutable after registration, so its meta is too. Rebuilding it
 * per call allocated a fresh object (plus a `params` array) on every label,
 * filter and picker read — but the reason to memoize is IDENTITY, not
 * allocation: `getMetric(id) === getMetric(id)` now holds, so a `$derived` over
 * a metric no longer re-runs just because the wrapper was rebuilt.
 *
 * Keyed on the recipe OBJECT, so an HMR re-registration (which stores a fresh
 * closure under the same id) misses and rebuilds, exactly as it should. Frozen
 * because the value is now shared rather than per-caller.
 */
const _metricCache = new WeakMap<MetricRecipe<any, any>, Metric>()

function metricFor(r: MetricRecipe<any, any>): Metric {
  let m = _metricCache.get(r)
  if (!m) {
    m = Object.freeze({ meta: Object.freeze(toMeta(r)) })
    _metricCache.set(r, m)
  }
  return m
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
    measurementClass: r.measurementClass,
    defaultReduction: r.defaultReduction ?? 'mean',
    supportsWindowing: r.supportsWindowing ?? true,
    providesAnyFixation: r.providesAnyFixation ?? false,
    aoiAggregate: r.aoiAggregate,
    sampleSummary: r.sampleSummary ?? false,
  }
}
