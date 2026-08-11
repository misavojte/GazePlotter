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
  /** A hand-authored slug from {@link STARTING_METRICS}, or a
   *  `crypto.randomUUID()` for user-created instances. */
  id: string
  baseId: string
  params: Record<string, unknown>
  label: string
  projection: Projection
  /**
   * Per-instance override for reduce-mode plots, letting two instances of the
   * SAME recipe differ — a windowed "Time on AOI" summed for an AOI Timeline
   * (a cohort total that tapers as participants drop out of late windows) vs.
   * the per-participant mean elsewhere. Absent ⇒ the metric's
   * `defaultReduction`; a stale or unsound value falls back at query time.
   */
  reduction?: GroupReduction
}

// ─── Instance construction ──────────────────────────────────────────────────

/**
 * The single constructor — every creation path routes through here, so an
 * instance always carries resolved params, a valid projection, and a non-empty
 * label. Defaults: a UUID `id` (starters pass their slug), `resolveParams`
 * over `params`, the recipe's identity leaf, `defaultInstanceLabel`.
 *
 * `null` when `baseId` names no registered recipe; callers handle the miss.
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
    // Only when explicitly set, so instances riding the metric's default stay
    // free of a redundant override in the exported workspace.
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
 * Does this serialized instance carry an `aggregate-aoi` extreme its metric no
 * longer names? Every plot contract rejects such an instance, so left in the
 * library it strands invisibly — no card, no delete button — while
 * re-serializing into every export. Raw untyped JSON (Web-Worker-safe, no
 * engine); unknown recipes never strand, this build's registry not being the
 * arbiter of theirs.
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
 * instance's SUMMARY leaf. The choice moved from a recipe param to the
 * projection, and a stale param would key the raw cache while `finalize` read
 * the projection — so it is always consumed, never left behind.
 *
 * Gated on `meta.sampleSummary`, not a baseId list, so a future migrated
 * metric needs no edit here. A non-mean setting on an IDENTITY leaf has
 * nowhere to go (a vector is the per-slot mean by construction) and drops to
 * mean — the accepted cost of the move. Raw untyped JSON; unknown recipes pass
 * through with their params verbatim.
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
 * The recipe's bare quantity name. Params, projection and unit stay OUT of it
 * — they are derived separately and shown as chips, so a user rename can never
 * destroy them.
 */
export function defaultInstanceLabel(baseId: string): string {
  return getMetric(baseId)?.meta.label ?? baseId
}

/** An `aggregate-aoi` leaf prints the metric's own named meaning of the
 *  extreme — the same phrase that gated the projection. */
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
 * Every settable param with its current value, via the one
 * {@link paramToLabel} rule. Purely the recipe's params, so it composes with
 * {@link reductionQualifier} rather than absorbing it.
 */
export function formatParamReadout(instance: MetricInstance): string[] {
  const m = getMetric(instance.baseId)
  if (!m || m.meta.params.length === 0) return []
  return m.meta.params
    .map(p => paramToLabel(p, instance.params[p.id] ?? p.default))
    .filter((s): s is string => !!s)
}


/**
 * Shared by BOTH the label ({@link reductionQualifier}) and the runtime
 * ({@link queryGroup}), so what is disclosed always equals what is computed.
 */
export function resolveReduction(instance: MetricInstance): GroupReduction {
  const m = getMetric(instance.baseId)
  if (!m) return 'mean'
  return effectiveReduction(m.meta, instance.reduction)
}

/** `· summed` for a cohort sum; `null` for `mean` (the conventional default
 *  needs no disclosure) and for `relational` metrics. */
export function reductionQualifier(
  instance: MetricInstance | null | undefined
): string | null {
  if (!instance) return null
  const m = getMetric(instance.baseId)
  if (!m || soundReductions(m.meta.measurementClass).length === 0) return null
  return reductionLabel(resolveReduction(instance))
}

/**
 * How a metric collapses each slot's per-event sample, read off the SUMMARY
 * projection. Disclosed here rather than inside the leaf label because only
 * some plots print a projection readout, and the summarization must show on
 * every figure.
 *
 * `null` when nothing chose one — an identity vector's collapse is fixed at
 * the per-slot mean, so it is not a choice. But unlike
 * {@link reductionQualifier}, a chosen `mean` IS disclosed: that is the point.
 */
function summaryStatQualifier(
  instance: MetricInstance | null | undefined
): string | null {
  if (!instance) return null
  return leafSummaryStatistic(leafOf(instance.projection)) ?? null
}

/**
 * The instance's derived qualifier chips — params, summary statistic,
 * cross-participant reduction. The SINGLE readout the metric selector and plot
 * axes both compose from, so panel and figure agree exactly.
 *
 * `includeReduction: false` drops the reduction chip for distribution plots,
 * which disclose spread via their overlay instead. No matching opt-out exists
 * for the summary chip: a distribution plot consumes the raw VECTOR, which
 * never carries a chosen statistic.
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
 * The one-line DETAIL text under an instance's name: unit, chips, projection.
 * The projection is suppressed when the user's own label already contains it —
 * renaming to "Dwell · One AOI" must not print "One AOI" twice. That echo rule
 * lives here so the pane selector and the library card cannot disagree.
 *
 * The SHARED composition, not the only one — the export modal orders and
 * filters differently on purpose.
 */
export function instanceDetailLine(instance: MetricInstance): string {
  const unit = getMetric(instance.baseId)?.meta.unit ?? ''
  const projection = formatProjectionReadout(instance)
  const shown = projection && !instance.label.includes(projection) ? projection : null
  return [unit, ...instanceReadout(instance), shown].filter(Boolean).join(' · ')
}

