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
import { metricShape, soundReductions, type GroupReduction, type MetricShape } from './core/measurement'
import { effectiveReduction, reductionLabel } from './core/aggregation'

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
   * Per-instance override of the cross-participant reduction used by reduce-mode
   * plots via {@link queryGroup} (`mean` / `sum`). Absent ⇒ the metric's
   * `defaultReduction`. This lets two instances of the SAME recipe carry
   * different reductions — e.g. a windowed "Time on AOI" summed for an AOI
   * Timeline (a cohort total that tapers as participants drop out of late
   * windows) vs. the per-participant mean elsewhere. Validity is a pure function
   * of the metric's `measurementClass` ({@link soundReductions}); a stale or
   * unsound value falls back to the default at query time (request === result
   * for any sound value, never a silent downgrade between sound values).
   */
  reduction?: GroupReduction
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
  reduction?: GroupReduction
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
    // metric's default reduction stay free of a redundant override (keeps the
    // exported workspace and the label provenance clean).
    ...(opts.reduction ? { reduction: opts.reduction } : {}),
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
      reduction: spec.reduction,
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
 * The instance's parameter qualifiers — every settable param with its current
 * value, via the single {@link paramToLabel} rule. The reduction statistic is
 * NOT here (see {@link reductionQualifier} / {@link instanceReadout}); this stays
 * purely the recipe's params so it composes cleanly. Always derived from the
 * instance, so a renamed display name never drops these.
 */
export function formatParamReadout(instance: MetricInstance): string[] {
  const m = getMetric(instance.baseId)
  if (!m || m.meta.params.length === 0) return []
  return m.meta.params
    .map(p => paramToLabel(p, instance.params[p.id] ?? p.default))
    .filter((s): s is string => !!s)
}

/** The abstract {@link MetricShape} of an instance, or `null` if its recipe is
 *  unknown. The single value the capability algebra (and future MCP/stats
 *  callers) reason over. */
export function metricShapeOf(instance: MetricInstance): MetricShape | null {
  const m = getMetric(instance.baseId)
  return m ? metricShape(m.meta, instance.projection) : null
}

/**
 * The cross-participant reductions a metric genuinely offers — the sound set,
 * a PURE function of its `measurementClass` ({@link soundReductions}). This is
 * what the ConfigureMetric reduction control lists once intersected with the
 * plot's contract. `[]` for `relational` (group-level) and a single-element set
 * for `intensive` / `proportion` (no choice to surface).
 */
export function availableReductions(baseId: string): GroupReduction[] {
  const m = getMetric(baseId)
  return m ? soundReductions(m.meta.measurementClass) : []
}

/**
 * The EFFECTIVE cross-participant reduction for an instance — the single source
 * of truth shared by BOTH the label ({@link reductionQualifier}) and the runtime
 * ({@link queryGroup}), so what is disclosed always equals what is computed.
 * Trivial and shape-independent: a sound requested value wins verbatim, else the
 * metric's `defaultReduction` (see {@link effectiveReduction}). No silent
 * between-sound downgrade — request === result.
 */
export function resolveReduction(instance: MetricInstance): GroupReduction {
  const m = getMetric(instance.baseId)
  if (!m) return 'mean'
  return effectiveReduction(m.meta, instance.reduction)
}

/**
 * The cross-participant reduction as a readout qualifier — `· summed` for a
 * cohort sum, `null` for `mean` (the conventional default needs no disclosure)
 * and for metrics not reduced across participants (`relational`). Shown
 * identically in the selector and on the figure.
 */
export function reductionQualifier(
  instance: MetricInstance | null | undefined
): string | null {
  if (!instance) return null
  const m = getMetric(instance.baseId)
  if (!m || soundReductions(m.meta.measurementClass).length === 0) return null
  return reductionLabel(resolveReduction(instance))
}

/**
 * THE instance's full derived qualifier chips — params plus the cross-participant
 * reduction. This is the SINGLE readout the metric selector AND plot axes/legends
 * compose from, so the panel and the figure agree exactly and a static export is
 * self-documenting. `includeReduction: false` drops the chip for distribution
 * plots (the bar plot, which discloses its statistic via its mean±CI / median-IQR
 * overlay rather than the generic chip).
 */
export function instanceReadout(
  instance: MetricInstance,
  opts: { includeReduction?: boolean } = {},
): string[] {
  const out = [...formatParamReadout(instance)]
  if (opts.includeReduction !== false) {
    const red = reductionQualifier(instance)
    if (red) out.push(red)
  }
  return out
}

