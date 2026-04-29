import {
  instanceMatchesContract,
  resolveInstance,
  type MetricInstance,
  type PlotMetricContract,
} from '$lib/metrics'

export type ContractResolution =
  | { ok: true; instance: MetricInstance }
  | { ok: false; reason: 'missing' | 'shape-mismatch' }

/**
 * Single resolution + contract validation site. Plots pass the engine's
 * metric-instance list, the settings ID, and their contract; receive either
 * a typed instance or a discriminated rejection. Replaces the per-plot
 * `resolveInstance(...) → if (!instance) return ...` boilerplate so missing
 * vs shape-mismatch failures are distinguishable in one place.
 */
export function resolveContractedInstance(
  instances: readonly MetricInstance[] | undefined,
  id: string | null,
  contract: PlotMetricContract,
): ContractResolution {
  const instance = resolveInstance(instances ?? [], id)
  if (!instance) return { ok: false, reason: 'missing' }
  if (!instanceMatchesContract(instance, contract)) return { ok: false, reason: 'shape-mismatch' }
  return { ok: true, instance }
}
