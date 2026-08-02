import './init'
import { getMetric, getRecipe } from './core/defineMetric'
import { resolveParams, paramToLabel } from './core/params'
import {
  identityFor,
  isSummaryLeaf,
  leafOf,
  leafSummaryStatistic,
  projectionToLabel,
  type Projection,
  type ProjectionLabelPart,
} from './core/projection'
import { STARTING_METRICS } from './startingMetrics'
import { soundReductions, type GroupReduction } from './core/measurement'
import { effectiveReduction, reductionLabel } from './core/aggregation'

export type { Projection } from './core/projection'

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
 * through here — the metric-library handlers (via the `updateMetricInstances`
 * workspace command), starter seeding, and future
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

function buildStarterInstances(): MetricInstance[] {
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

/**
 * Load-time check for the workspace normalization: does this serialized
 * instance carry an `aggregate-aoi` extreme its metric no longer names
 * (`meta.aoiAggregate`)? Such an instance is rejected by every plot contract,
 * so left in the library it would strand invisibly — no card, no delete
 * button — while re-serializing into every export. Operates on raw untyped
 * JSON (Web-Worker-safe, no engine). Unknown recipes are never stranded:
 * this build's registry is not the arbiter of theirs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isStrandedAoiAggregate(inst: any): boolean {
  const proj = inst?.projection
  const leaf = proj?.kind === 'windowed' ? proj.inner : proj
  if (!leaf || leaf.kind !== 'aggregate-aoi') return false
  const recipe = getRecipe(inst?.baseId)
  if (!recipe) return false
  const extreme: unknown = leaf.reducer
  return !((extreme === 'max' || extreme === 'min') && !!recipe.aoiAggregate?.[extreme])
}

/**
 * Load-time normalization: carry a serialized `params.statistic` onto the
 * instance's SUMMARY leaf. The summary choice moved from a recipe param to the
 * projection, and a stale param would key the raw cache while `finalize` read
 * the projection, so it is always consumed, never left behind.
 *
 * Gated on `meta.sampleSummary` rather than a baseId list, so a future migrated
 * metric needs no edit here and an UNKNOWN recipe keeps its params verbatim
 * (this build's registry is not the arbiter of a workspace it cannot read).
 *
 * A non-mean setting on an IDENTITY leaf (an AOI Timeline instance) has
 * nowhere to go: a vector is the unmarked per-slot mean by construction. That
 * instance drops to mean, which is the accepted cost of the move. Operates on
 * raw untyped JSON (Web-Worker-safe, no engine); unknown recipes pass through.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function carrySummaryStatistic(inst: any): any {
  const statistic = inst?.params?.statistic
  if (typeof statistic !== 'string') return inst
  if (!getMetric(inst?.baseId)?.meta.sampleSummary) return inst

  const { statistic: _drop, ...params } = inst.params
  const proj = inst.projection
  const leaf = proj?.kind === 'windowed' ? proj.inner : proj
  // Already migrated (or hand-authored): never overwrite an explicit choice.
  if (!leaf || !isSummaryLeaf(leaf) || leaf.statistic !== undefined) {
    return { ...inst, params }
  }
  const next = { ...leaf, statistic }
  return {
    ...inst,
    params,
    projection: proj.kind === 'windowed' ? { ...proj, inner: next } : next,
  }
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

/** Human-readable readout of the projection. `part` selects the slice alone or
 *  the slice plus its window (see {@link ProjectionLabelPart}). An
 *  `aggregate-aoi` leaf prints the metric's own named meaning of the extreme
 *  ("most-dwelled AOI") — the same phrase that gated the projection. */
export function formatProjectionReadout(
  instance: MetricInstance,
  part: ProjectionLabelPart = 'full',
): string | null {
  const m = getMetric(instance.baseId)
  const unit = m?.meta.windowUnit ?? 'ms'
  const label = projectionToLabel(
    instance.projection,
    unit,
    { aoiAggregate: m?.meta.aoiAggregate },
    part,
  )
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
 * The within-participant SUMMARY statistic as a mid-dot readout qualifier — how
 * a metric collapses each slot's per-event sample into the per-participant
 * value. Read off the SUMMARY projection, the only place it can be declared.
 *
 * Deliberately disclosed here rather than inside the leaf label: a projection
 * readout is printed by only some plots (`includeProjection`), and the
 * summarization method must be visible on EVERY figure that shows one.
 *
 * `null` when nothing chose a statistic — an identity vector, whose collapse is
 * fixed at the per-slot mean and so is not a choice to disclose. UNLIKE
 * {@link reductionQualifier}, a statistic that WAS chosen discloses `mean` too:
 * that is the whole point of the chip.
 */
function summaryStatQualifier(
  instance: MetricInstance | null | undefined
): string | null {
  if (!instance) return null
  return leafSummaryStatistic(leafOf(instance.projection)) ?? null
}

/**
 * THE instance's full derived qualifier chips — params, the within-participant
 * summary statistic, and the cross-participant reduction. This is the SINGLE
 * readout the metric selector AND plot axes/legends compose from, so the panel
 * and the figure agree exactly and a static export is self-documenting.
 * `includeReduction: false` drops the reduction chip for distribution plots
 * (the bar plot, which discloses spread via its mean±CI / median-IQR overlay
 * rather than a point statistic).
 *
 * There is no matching opt-out for the summary chip: a distribution plot
 * consumes the raw VECTOR, and a vector never carries a chosen statistic, so
 * the chip cannot appear there in the first place.
 */
export function instanceReadout(
  instance: MetricInstance,
  opts: { includeReduction?: boolean } = {},
): string[] {
  const out = [...formatParamReadout(instance)]
  const stat = summaryStatQualifier(instance)
  if (stat) out.push(stat)
  if (opts.includeReduction !== false) {
    const red = reductionQualifier(instance)
    if (red) out.push(red)
  }
  return out
}

/**
 * The instance's one-line DETAIL text under its name — unit first, then the
 * {@link instanceReadout} chips, then the projection.
 *
 * The projection is suppressed when the user's own label already contains it:
 * renaming an instance to "Dwell · One AOI" must not print "One AOI" twice.
 * That echo rule is a cross-surface semantic (the pane's metric selector and
 * the library card have to agree, or the same instance reads differently in
 * two places), so it lives here with the readout rather than being retyped per
 * surface.
 *
 * Not every detail line composes this way — the export modal deliberately
 * orders and filters differently — so this is the SHARED composition, not the
 * only one.
 */
export function instanceDetailLine(instance: MetricInstance): string {
  const unit = getMetric(instance.baseId)?.meta.unit ?? ''
  const projection = formatProjectionReadout(instance)
  const shown = projection && !instance.label.includes(projection) ? projection : null
  return [unit, ...instanceReadout(instance), shown].filter(Boolean).join(' · ')
}

