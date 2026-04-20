import './init'
import { getMetric, listMetrics } from './core/defineMetric'
import type { WindowingConfig } from './core/dsl'
import type { ParamDef } from './core/params'

export type { WindowingConfig } from './core/dsl'

export interface MetricInstance {
  id: number
  baseId: string
  params: Record<string, unknown>
  label: string
  system?: true
  windowing?: WindowingConfig
}

const SYSTEM_ID_OFFSET = 1000
const WINDOWED_ID_START = 12

// ─── Factories ───────────────────────────────────────────────────────────────

export function createSystemMetricInstances(): MetricInstance[] {
  return listMetrics()
    .filter(m => m.meta.outputShape !== 'aoi-pair-matrix')
    .map((m, idx) => ({
      id: idx + 1,
      baseId: m.meta.id,
      params: {},
      label: m.meta.label,
      system: true as const,
    }))
}

export function findSystemInstanceIdByBaseId(baseId: string): number | null {
  const metrics = listMetrics().filter(m => m.meta.outputShape !== 'aoi-pair-matrix')
  const idx = metrics.findIndex(m => m.meta.id === baseId)
  return idx < 0 ? null : idx + 1
}

export function reconcileSystemInstances(existing: MetricInstance[]): MetricInstance[] {
  const system = createSystemMetricInstances()
  const existingIds = new Set(existing.map(i => i.id))
  const result = [...existing]
  for (const s of system) if (!existingIds.has(s.id)) result.push(s)
  return result
}

/**
 * Default windowed instances are derived from each metric's `defaultWindowing`.
 * IDs are assigned in metric registration order starting at WINDOWED_ID_START (12).
 * A pinning test asserts that the first three emitted instances have IDs 12/13/14
 * and baseIds `averageFixationCount` / `absoluteTime` / `rqaDet`.
 */
export function createDefaultWindowedInstances(): MetricInstance[] {
  const out: MetricInstance[] = []
  let id = WINDOWED_ID_START
  for (const m of listMetrics()) {
    const wc = m.meta.defaultWindowing
    if (!wc) continue
    out.push({
      id: id++,
      baseId: m.meta.id,
      params: {},
      label: defaultInstanceLabel(m.meta.id, {}),
      windowing: wc,
    })
  }
  return out
}

export function createDefaultMetricInstances(): MetricInstance[] {
  return [...createSystemMetricInstances(), ...createDefaultWindowedInstances()]
}

export function nextInstanceId(existing: readonly MetricInstance[]): number {
  let max = SYSTEM_ID_OFFSET - 1
  for (const inst of existing) if (inst.id > max) max = inst.id
  return Math.max(max + 1, SYSTEM_ID_OFFSET)
}

export function resolveInstance(
  instances: readonly MetricInstance[],
  id: number,
): MetricInstance | undefined {
  return instances.find(i => i.id === id)
}

// ─── Label / readout helpers ─────────────────────────────────────────────────

export function defaultInstanceLabel(baseId: string, params: Record<string, unknown>): string {
  const m = getMetric(baseId)
  if (!m) return baseId
  if (m.meta.defaultLabel) return m.meta.defaultLabel(params)
  if (m.meta.params.length === 0) return m.meta.label

  const paramStrs = m.meta.params
    .map(p => formatParamShort(p, params[p.id] ?? p.default))
    .filter(s => s.length > 0)

  return paramStrs.length > 0 ? `${m.meta.label} (${paramStrs.join(', ')})` : m.meta.label
}

export function formatParamReadout(instance: MetricInstance): string[] {
  const m = getMetric(instance.baseId)
  if (!m || m.meta.params.length === 0) return []
  return m.meta.params
    .map(p => formatParamShort(p, instance.params[p.id] ?? p.default))
    .filter((s): s is string => s.length > 0)
}

export function formatWindowingReadout(instance: MetricInstance): string | null {
  const w = instance.windowing
  if (!w) return null
  const m = getMetric(instance.baseId)
  const isRqa = m?.meta.windowUnit === 'fixations'
  const unit = isRqa ? 'fix' : 'ms'
  const modeLabel = w.mode === 'epoch' ? 'Epoch' : 'Sliding'
  const showStep = !isRqa && w.stepSize != null && w.stepSize !== w.windowSize
  const stepStr = showStep ? ` / ${w.stepSize}ms step` : ''
  return `${modeLabel} ${w.windowSize}${unit}${stepStr} · ${w.reduction}`
}

function formatParamShort(def: ParamDef<unknown>, value: unknown): string {
  if (value === undefined || value === null) return ''
  if (def.type === 'enum') {
    const opt = def.options?.find(o => o.value === value)
    return `${def.id}=${opt?.label ?? String(value)}`
  }
  if (def.type === 'boolean') return value ? def.id : ''
  return `${def.id}=${value}`
}
