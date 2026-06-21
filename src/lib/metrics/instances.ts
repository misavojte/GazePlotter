import './init'
import { getMetric, getRecipe } from './core/defineMetric'
import { resolveParams, paramToLabel } from './core/params'
import {
  identityFor,
  projectionToLabel,
  type Projection,
  type LeafProjection,
} from './core/projection'
import { STARTING_METRICS } from './startingMetrics'
import type { GroupAggregation } from './core/dsl'

export type { Projection, LeafProjection, AoiRef, AoiReducer, MatrixReducer, WindowSpec } from './core/projection'

export interface MetricInstance {
  /**
   * Starters use human-readable slugs from {@link STARTING_METRICS}; user-created
   * instances use `crypto.randomUUID()`. Both live in the same string namespace
   * without colliding — slugs are hand-authored, UUIDs are generated.
   */
  id: string
  baseId: string
  params: Record<string, unknown>
  label: string
  projection: Projection
  /**
   * Per-instance override of the cross-participant reduction used by
   * {@link queryGroup} (mean / median / sum). Absent ⇒ the recipe's declared
   * `groupAggregation` applies. This lets two instances of the SAME recipe carry
   * different group statistics — e.g. a windowed "Time on AOI" summed for an AOI
   * Timeline (a cohort total that tapers as participants drop out of late
   * windows) vs. the recipe's default mean for a per-AOI bar comparison. The
   * override is validated against the recipe's `groupAggregationGuard`; a stale
   * or incoherent value falls back to mean at query time.
   */
  groupAggregation?: GroupAggregation
}

// ─── Instance construction ──────────────────────────────────────────────────

/**
 * Single constructor for a `MetricInstance`. All instance-creation paths route
 * through here — `DataEngine.addMetricInstance`, starter seeding, and future
 * agent-callable compute APIs — so a metric instance always carries fully
 * resolved params, a valid projection, and a non-empty label regardless of
 * where it came from.
 *
 *   - `id`         defaults to `crypto.randomUUID()`. Starters pass their slug.
 *   - `params`     are run through `resolveParams` so any missing keys are
 *                  filled with the recipe's declared defaults (and primitive
 *                  values get coerced to the declared type).
 *   - `projection` defaults to the recipe's identity leaf (`identityFor`).
 *   - `label`      defaults to `defaultInstanceLabel(baseId)` (the bare quantity name).
 *
 * Returns `null` when `baseId` does not name a registered recipe — callers
 * (UI, starter loader, agent) handle the miss in their own way.
 */
export function createMetricInstance(opts: {
  baseId: string
  params?: Record<string, unknown>
  projection?: Projection
  label?: string
  id?: string
  groupAggregation?: GroupAggregation
}): MetricInstance | null {
  const recipe = getRecipe(opts.baseId)
  if (!recipe) return null
  const projection = opts.projection ?? identityFor(recipe.rawShape)
  const params = resolveParams(recipe.params, opts.params) as Record<string, unknown>
  const label = opts.label?.trim() || defaultInstanceLabel(opts.baseId)
  return {
    id: opts.id ?? crypto.randomUUID(),
    baseId: opts.baseId,
    params,
    projection,
    label,
    // Only carry the field when explicitly set, so instances that ride the
    // recipe default stay free of a redundant override (keeps the exported
    // workspace and the label provenance clean).
    ...(opts.groupAggregation ? { groupAggregation: opts.groupAggregation } : {}),
  }
}

// ─── Starter instances (from the shared settings file) ──────────────────────

export function buildStarterInstances(): MetricInstance[] {
  return STARTING_METRICS.map(spec => {
    const inst = createMetricInstance({
      id: spec.id,
      baseId: spec.baseId,
      params: spec.params,
      projection: spec.projection,
      label: spec.label,
      groupAggregation: spec.groupAggregation,
    })
    if (!inst) throw new Error(`Starter "${spec.id}" references unknown recipe: ${spec.baseId}`)
    return inst
  })
}

export function createDefaultMetricInstances(): MetricInstance[] {
  return buildStarterInstances()
}

export function resolveInstance(
  instances: readonly MetricInstance[],
  id: string | null,
): MetricInstance | undefined {
  if (id == null) return undefined
  return instances.find(i => i.id === id)
}

// ─── Label / readout helpers ─────────────────────────────────────────────────

/**
 * Default display NAME for a metric instance: the recipe's bare quantity name
 * (`meta.label`), e.g. `"Transition probability"`, `"Scanpath similarity"`.
 *
 * Parameters, projection and unit are deliberately NOT baked into the name —
 * they are derived separately ({@link formatParamReadout},
 * {@link formatProjectionReadout}, `meta.unit`) and shown as chips in the metric
 * selector / as mid-dot qualifiers on a plot axis. A user rename overrides only
 * this name, so it can never destroy the derived metadata (the unit and the
 * operational params always remain visible and correct).
 */
export function defaultInstanceLabel(baseId: string): string {
  return getMetric(baseId)?.meta.label ?? baseId
}

/** Human-readable readout of the projection (including window suffix). */
export function formatProjectionReadout(instance: MetricInstance): string | null {
  const m = getMetric(instance.baseId)
  const unit = m?.meta.windowUnit ?? 'ms'
  const label = projectionToLabel(instance.projection, unit)
  return label.length > 0 ? label : null
}

/**
 * Cross-participant statistic as a readout qualifier, but ONLY when the instance
 * pins an explicit `groupAggregation` override. An instance riding the recipe
 * default emits nothing (the conventional statistic needs no disclosure); a
 * pinned non-default one is surfaced so a summed AOI Timeline reads
 * `… · summed` rather than silently differing from a mean. `proportion` (an
 * intrinsic [0,1] rate, never user-selectable) is not a shaping choice and is
 * omitted. Lives here, beside {@link formatParamReadout}, so the SINGLE readout
 * the selector and the figure both consume carries it identically.
 */
const AGGREGATION_QUALIFIER: Record<GroupAggregation, string | null> = {
  mean: 'mean',
  median: 'median',
  sum: 'summed',
  proportion: null,
}
export function aggregationQualifier(
  instance: MetricInstance | null | undefined
): string | null {
  const method = instance?.groupAggregation
  return method ? AGGREGATION_QUALIFIER[method] : null
}

/**
 * The instance's settable qualifiers — every param with its current value via
 * the single {@link paramToLabel} rule, plus an explicit group-aggregation
 * override ({@link aggregationQualifier}). This is the SAME readout used by the
 * metric selector AND by plot axes/legends, so the panel and the figure agree
 * exactly and a static export is self-documenting. Always derived from the
 * instance, so a renamed display name never drops these.
 */
export function formatParamReadout(instance: MetricInstance): string[] {
  const m = getMetric(instance.baseId)
  if (!m) return []
  const out =
    m.meta.params.length === 0
      ? []
      : m.meta.params
          .map(p => paramToLabel(p, instance.params[p.id] ?? p.default))
          .filter((s): s is string => !!s)
  const agg = aggregationQualifier(instance)
  if (agg) out.push(agg)
  return out
}

