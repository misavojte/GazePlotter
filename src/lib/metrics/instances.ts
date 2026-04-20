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
const AOI_PAIR_ID_START = 50

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
  const seeded = [
    ...createSystemMetricInstances(),
    ...createDefaultWindowedInstances(),
    ...createDefaultAoiPairInstances(),
  ]
  const existingIds = new Set(existing.map(i => i.id))
  const result = [...existing]
  for (const s of seeded) if (!existingIds.has(s.id)) result.push(s)
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
      system: true as const,
    })
  }
  return out
}

/**
 * Default aoi-pair-matrix instances, derived from each metric's `defaultParamSets`.
 * Needed because `createSystemMetricInstances` filters out aoi-pair-matrix metrics
 * (they can't expose a sensible default with empty params). Every pair-matrix
 * metric that declares `defaultParamSets` emits one instance per entry.
 *
 * IDs assigned deterministically from AOI_PAIR_ID_START (50) in metric-registration
 * × param-set order. Current layout:
 *   50 → transitionCount   { mode: 'fixation' }
 *   51 → transitionCount   { mode: 'visit' }
 *   52 → transitionDwellSum { mode: 'fixation' }
 *   53 → transitionDwellSum { mode: 'visit' }
 */
export function createDefaultAoiPairInstances(): MetricInstance[] {
  const out: MetricInstance[] = []
  let id = AOI_PAIR_ID_START
  for (const m of listMetrics()) {
    if (m.meta.outputShape !== 'aoi-pair-matrix') continue
    for (const params of m.meta.defaultParamSets) {
      out.push({
        id: id++,
        baseId: m.meta.id,
        params: { ...params },
        label: defaultInstanceLabel(m.meta.id, params),
        system: true as const,
      })
    }
  }
  return out
}

export function createDefaultMetricInstances(): MetricInstance[] {
  return [
    ...createSystemMetricInstances(),
    ...createDefaultWindowedInstances(),
    ...createDefaultAoiPairInstances(),
  ]
}

/**
 * Resolve a plot's stored `metricInstanceId` with a graceful fallback. When the
 * stored id points to an instance that no longer exists (user deleted a custom
 * instance), returns the first system instance matching `fallbackBaseId`.
 *
 * Render-time (lazy) fallback — no eager mutation of plot settings on deletion.
 * The next save will persist the fallback id.
 */
export function resolveInstanceWithFallback(
  instanceId: number | null,
  fallbackBaseId: string,
  library: readonly MetricInstance[],
): MetricInstance | null {
  if (instanceId != null) {
    const direct = library.find(i => i.id === instanceId)
    if (direct) return direct
  }
  return library.find(i => i.system && i.baseId === fallbackBaseId) ?? null
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
    // Just the option label — the enum's purpose is usually clear from context
    // (e.g. "Fixation pairs" instead of "mode=Fixation pairs").
    const opt = def.options?.find(o => o.value === value)
    return opt?.label ?? String(value)
  }
  if (def.type === 'boolean') return value ? def.id : ''
  return `${def.id}=${value}`
}
