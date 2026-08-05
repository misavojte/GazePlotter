import type { ParamDef, ParamsOf } from './params'
import { reduceNumeric } from './numeric'
import type { Metric, MetricMeta, MetricRecipe } from './dsl'

// On globalThis so it survives the module-graph re-evaluations Vite dev mode
// performs across SSR / client / HMR passes — otherwise a definition file runs
// twice and throws on duplicate registration.
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
  // Idempotent on the id: an HMR re-evaluation swaps in the fresh closure but
  // keeps registration order.
  if (!_recipes.has(recipe.id)) _order.push(recipe.id)
  _recipes.set(recipe.id, stored)
  return metricFor(stored)
}

/**
 * A `sampleSummary` recipe's `finalize` IS its sample collapsed per slot by
 * `ctx.summaryStatistic` — what the declaration MEANS — so the DSL writes it
 * rather than trusting each recipe to spell the same sentence. An explicit
 * `finalize` still wins, for a sample whose vector isn't the plain collapse.
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
 * and must NOT define the scan trio; every other shape is the reverse. Codified
 * here so no recipe slides into a hybrid mode where the runtime would have to
 * pick between two APIs.
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
  // The eye-movement-type axis is a SHAPE, never a parameter, so scanning
  // categories and declaring 'category-vector' are inseparable. And the fused
  // driver's per-AOI-slot assembly assumes fixation scans, so these stay
  // 'stateful' — on the trio path.
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
  // MEMBERSHIP. Additivity is the only thing that depends on this rule, so the
  // `extensive` class must say it out loud rather than inherit a default — a count
  // that silently takes 'all' stops summing to the unwindowed total, and a mean
  // that silently takes 'own' reports NaN for a window a fixation plainly covers.
  if (r.windowUnit === 'ms' && r.measurementClass === 'extensive' && !r.windowMembership) {
    throw new Error(
      `[metrics] recipe "${r.id}" is extensive and windowed in ms, so it must declare ` +
        `windowMembership: 'own' (indivisible events, keeps per-window values summing to ` +
        `the total) or 'all' (divisible contribution, e.g. clipped dwell)`,
    )
  }
  // The fused driver's `midpointCount` kernel IS the 'own' rule; a clipped kernel
  // IS the 'all' rule. Declaring the opposite is the contradiction `fixated` shipped
  // with (clipped dwell, midpoint gate), so make it unrepresentable.
  if (r.accumulation === 'midpointCount' && r.windowMembership !== 'own') {
    throw new Error(
      `[metrics] recipe "${r.id}" accumulates 'midpointCount' but declares ` +
        `windowMembership '${r.windowMembership}'; counting an indivisible event requires 'own'`,
    )
  }
  if (
    (r.accumulation === 'clippedDuration' || r.accumulation === 'clippedDurationShare') &&
    r.windowMembership === 'own'
  ) {
    throw new Error(
      `[metrics] recipe "${r.id}" clips its contribution to the window, which already ` +
        `partitions divisible time; windowMembership 'own' would also drop the clipped ` +
        `remainder of every boundary-crossing fixation`,
    )
  }
  // ONE declaration channel for the summary statistic: the SUMMARY projection.
  // A recipe-level `statistic` param is the retired second channel, rejected
  // here so it cannot be reinvented on any recipe.
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
    // Without a sample, `flush` is an unrun hook.
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
 * The public `Metric` view, built ONCE per recipe object (a recipe is
 * immutable after registration, so its meta is too). Memoized for IDENTITY
 * rather than allocation: `getMetric(id) === getMetric(id)` holds, so a
 * `$derived` over a metric no longer re-runs on a rebuilt wrapper.
 *
 * Keyed on the recipe OBJECT, so an HMR re-registration misses and rebuilds.
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
