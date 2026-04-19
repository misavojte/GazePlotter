import { METRIC_DEFS, getMetricDef } from './registry'
import type { MetricInstance } from '$lib/data/types'
import type { MetricParamDef } from './types'

const SYSTEM_ID_OFFSET = 1000

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

export function createDefaultWindowedInstances(): MetricInstance[] {
  return [
    {
      id: 12,
      baseId: 'averageFixationCount',
      params: {},
      label: 'Fixation count',
      windowing: { mode: 'epoch', windowSize: 2000, reduction: 'mean' },
    },
    {
      id: 13,
      baseId: 'absoluteTime',
      params: {},
      label: 'Absolute dwell time',
      windowing: { mode: 'epoch', windowSize: 2000, reduction: 'mean' },
    },
    {
      id: 14,
      baseId: 'rqaDet',
      params: { l_min: 2 },
      label: 'DET (L_min=2)',
      windowing: { mode: 'epoch', windowSize: 20, reduction: 'mean' },
    },
  ]
}

export function createDefaultMetricInstances(): MetricInstance[] {
  return [...createSystemMetricInstances(), ...createDefaultWindowedInstances()]
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
  const def = getMetricDef(instance.baseId)
  const isRqa = def?.windowUnit === 'fixations'
  const unit = isRqa ? 'fix' : 'ms'
  const modeLabel = w.mode === 'epoch' ? 'Epoch' : 'Sliding'
  const showStep = !isRqa && w.stepSize != null && w.stepSize !== w.windowSize
  const stepStr = showStep ? ` / ${w.stepSize}ms step` : ''
  return `${modeLabel} ${w.windowSize}${unit}${stepStr} · ${w.reduction}`
}

function formatParamShort(def: MetricParamDef, value: unknown): string {
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
