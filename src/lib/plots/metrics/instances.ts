import { METRIC_DEFS, getMetricDef } from './registry'
import type { MetricInstance, MetricParamDef } from './types'

/**
 * System instance ids are stable and reserved. They are assigned in registry
 * order starting at 1. User-created instances take ids >= SYSTEM_ID_OFFSET.
 */
const SYSTEM_ID_OFFSET = 1000

/**
 * Pre-seeded instances for the 8 built-in metrics. Shipped on every workspace
 * so plots can reference metrics by id identically to how they will reference
 * user-created parametric instances in the future.
 *
 * Ids are a simple 1..N mapping in registry order; relied on by the V5→V6
 * migration and by `findSystemInstanceByBaseId`.
 */
export function createSystemMetricInstances(): MetricInstance[] {
  return METRIC_DEFS.map((def, idx) => ({
    id: idx + 1,
    baseId: def.id,
    params: {},
    label: def.label,
    system: true,
  }))
}

export function findSystemInstanceIdByBaseId(baseId: string): number | null {
  const idx = METRIC_DEFS.findIndex(d => d.id === baseId)
  return idx < 0 ? null : idx + 1
}

/**
 * Ensures `metricInstances` contains all current system entries (idempotent).
 * Run-on read so seeded files and migrated files converge to the same state
 * even if the registry grows.
 */
export function reconcileSystemInstances(
  existing: MetricInstance[]
): MetricInstance[] {
  const system = createSystemMetricInstances()
  const existingIds = new Set(existing.map(i => i.id))
  const result = [...existing]
  for (const s of system) {
    if (!existingIds.has(s.id)) result.push(s)
  }
  return result
}

export function nextInstanceId(existing: MetricInstance[]): number {
  let max = SYSTEM_ID_OFFSET - 1
  for (const inst of existing) {
    if (inst.id > max) max = inst.id
  }
  return Math.max(max + 1, SYSTEM_ID_OFFSET)
}

export function resolveInstance(
  instances: readonly MetricInstance[],
  id: number
): MetricInstance | undefined {
  return instances.find(i => i.id === id)
}

/**
 * Builds the default auto-generated label for an instance ("DET (L_min=2)").
 * User-set labels always take precedence — this is only used when creating a
 * new instance or when the user hasn't overridden the label yet.
 */
export function defaultInstanceLabel(
  baseId: string,
  params: Record<string, unknown>
): string {
  const def = getMetricDef(baseId)
  if (!def) return baseId
  if (def.defaultLabel) return def.defaultLabel(params)
  if (!def.params || def.params.length === 0) return def.label

  const paramStrs = def.params
    .map(p => formatParamShort(p, params[p.id] ?? p.default))
    .filter(Boolean)

  return paramStrs.length > 0
    ? `${def.label} (${paramStrs.join(', ')})`
    : def.label
}

/**
 * Returns every non-default param as a "k=v" string, in registry order.
 * Used as the secondary line in the active-metrics list.
 */
export function formatParamReadout(instance: MetricInstance): string[] {
  const def = getMetricDef(instance.baseId)
  if (!def || !def.params || def.params.length === 0) return []
  return def.params
    .map(p => formatParamShort(p, instance.params[p.id] ?? p.default))
    .filter((s): s is string => s.length > 0)
}

export function formatWindowingReadout(instance: MetricInstance): string | null {
  const w = instance.windowing
  if (!w) return null
  const unit = ['rqaRec', 'rqaDet', 'rqaLam'].includes(instance.baseId) ? 'fix' : 'ms'
  const modeLabel = w.mode === 'epoch' ? 'Epoch' : 'Sliding'
  return `${modeLabel} ${w.windowSize}${unit} · ${w.reduction}`
}

function formatParamShort(
  def: MetricParamDef,
  value: unknown
): string {
  if (value === undefined || value === null) return ''
  if (def.type === 'enum') {
    const opt = def.options?.find(o => o.value === value)
    return `${def.id}=${opt?.label ?? String(value)}`
  }
  if (def.type === 'boolean') {
    return value ? def.id : ''
  }
  return `${def.id}=${value}`
}
