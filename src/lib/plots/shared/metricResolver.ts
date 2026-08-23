import {
  getMetric,
  instanceMatchesContract,
  resolveInstance,
  type MetricInstance,
  type PlotMetricContract,
  type WindowSpec,
} from '$lib/metrics'
import type { DataCapabilities } from '$lib/data/types'
import type { SectionFieldCtx } from '$lib/plots/definePlot'

/**
 * Whether the plot's picked metric instance is `proportion`-class — the ONE
 * derivation behind "proportion metrics take no statistical overlay" for
 * every plot rendering through `BeeswarmFigure` (the figure draws plain
 * proportional bars and ignores the overlay). Both the AOI Comparison and
 * the Eye-movement Comparison gate their overlay field and pane summary on
 * this, so the rule cannot drift between them.
 */
export function pickedInstanceIsProportion(ctx: SectionFieldCtx): boolean {
  const metricId = ctx.common(s => (s as { metricInstanceIds?: string[] }).metricInstanceIds?.[0] ?? null)
  if (metricId.mixed || !metricId.value) return false
  const inst = resolveInstance(
    ctx.engine.metadata?.metricInstances ?? [],
    metricId.value as string
  )
  return inst
    ? getMetric(inst.baseId)?.meta.measurementClass === 'proportion'
    : false
}

/**
 * The slice of the engine metric resolution reads — structural, so callers
 * pass the real DataEngine while tests pass a plain literal.
 */
export interface MetricResolutionEngine {
  metadata?: { metricInstances?: readonly MetricInstance[] } | null
  capabilities: DataCapabilities
}

/**
 * The plot's PICKED metric instance, resolved WITHOUT contract validation —
 * deliberately distinct from {@link resolveMetric}. A view needs the instance
 * to name its axis/legend even when the instance fails the contract, so the
 * figure shows "Absolute dwell time / ms" beside the noMetric placeholder
 * rather than an anonymous empty frame. Do not "fix" this into the contract
 * path; the transformer already gates the DATA on the contract.
 */
export function resolvePickedInstance(
  engine: MetricResolutionEngine,
  ids: readonly string[] | undefined
): MetricInstance | undefined {
  return resolveInstance(engine.metadata?.metricInstances ?? [], ids?.[0] ?? null)
}

/**
 * Single-call resolution + contract validation for a plot's metric instance.
 * Collapses the per-plot `resolveInstance(...) → contract check → projection-
 * kind re-check` triplet into one branch. For windowing-required contracts the
 * `window` field is materialised directly — plots never read
 * `instance.projection.window` and never re-check `projection.kind === 'windowed'`.
 *
 * Returns `{ ok: false }` when the id is null/unknown OR when the resolved
 * instance doesn't satisfy the contract. Both failure modes funnel the plot
 * into the same `noMetric` placeholder path.
 */
export type ResolvedMetric<C extends PlotMetricContract> = {
  ok: true
  instance: MetricInstance
  /**
   * Present (and required) when `contract.windowing === 'required'` — contract
   * validation guarantees the projection is windowed, so this is just a typed
   * accessor for `instance.projection.window`. For other contracts the field
   * is typed as possibly-undefined and plots should ignore it.
   */
  window: C['windowing'] extends 'required' ? WindowSpec : WindowSpec | undefined
} | { ok: false }

export function resolveMetric<C extends PlotMetricContract>(args: {
  engine: MetricResolutionEngine
  id: string | null
  contract: C
}): ResolvedMetric<C> {
  const instance = resolveInstance(
    args.engine.metadata?.metricInstances ?? [],
    args.id
  )
  if (!instance) return { ok: false }
  if (!instanceMatchesContract(instance, args.contract, args.engine.capabilities))
    return { ok: false }
  const window =
    instance.projection.kind === 'windowed' ? instance.projection.window : undefined
  return { ok: true, instance, window } as ResolvedMetric<C>
}
