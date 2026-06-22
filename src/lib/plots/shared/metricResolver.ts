import {
  instanceMatchesContract,
  resolveInstance,
  type MetricInstance,
  type PlotMetricContract,
  type WindowSpec,
} from '$lib/metrics'

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
  instances: readonly MetricInstance[] | undefined
  id: string | null
  contract: C
}): ResolvedMetric<C> {
  const instance = resolveInstance(args.instances ?? [], args.id)
  if (!instance) return { ok: false }
  if (!instanceMatchesContract(instance, args.contract)) return { ok: false }
  const window =
    instance.projection.kind === 'windowed' ? instance.projection.window : undefined
  return { ok: true, instance, window } as ResolvedMetric<C>
}
