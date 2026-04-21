import './init'
import { getMetric, getRecipe, listRecipeIds } from './core/defineMetric'
import type { ParamDef } from './core/params'
import {
  identityFor,
  projectionToLabel,
  type Projection,
  type LeafProjection,
} from './core/projection'

export type { Projection, LeafProjection, AoiRef, AoiReducer, MatrixReducer, WindowSpec } from './core/projection'

export interface MetricInstance {
  id: number
  baseId: string
  params: Record<string, unknown>
  label: string
  /** Required. Defaults to the recipe's identity leaf for its raw shape. */
  projection: Projection
}

const SYSTEM_ID_OFFSET = 1000
const WINDOWED_ID_START = 12
const AOI_PAIR_ID_START = 50

// ─── Starter instances (system defaults) ────────────────────────────────────

/**
 * Emits the seed set of metric instances for a fresh project. Three partitions,
 * walked in recipe registration order so IDs are stable across runs:
 *
 *   Phase 1 (IDs 1+)  — identity instance for every non-matrix recipe.
 *   Phase 2 (IDs 12+) — recipe.starterInstances entries with a windowed projection.
 *   Phase 3 (IDs 50+) — recipe.starterInstances entries for matrix recipes (params variants).
 *
 * Starters are user-owned from the moment they're seeded: no protected / hidden
 * tier. A pinning test asserts ID 50 = transitionCount (fixation),
 * 52 = transitionProbability (fix, step=1), 53 = transitionDwellMean (fixation).
 * Do not reorder metric definition imports.
 */
export function buildStarterInstances(): MetricInstance[] {
  const recipes = listRecipeIds().map(id => getRecipe(id)!).filter(Boolean)
  const out: MetricInstance[] = []

  // Phase 1: identity instance per non-matrix recipe
  let id = 1
  for (const r of recipes) {
    if (r.rawShape === 'aoi-pair-matrix') continue
    out.push({
      id: id++,
      baseId: r.id,
      params: {},
      label: defaultInstanceLabel(r.id, {}),
      projection: identityFor(r.rawShape),
    })
  }

  // Phase 2: windowed starters
  id = WINDOWED_ID_START
  for (const r of recipes) {
    for (const starter of r.starterInstances ?? []) {
      if (starter.projection?.kind !== 'windowed') continue
      const params = { ...(starter.params ?? {}) } as Record<string, unknown>
      out.push({
        id: id++,
        baseId: r.id,
        params,
        label: starter.label ?? defaultInstanceLabel(r.id, params, starter.projection),
        projection: starter.projection,
      })
    }
  }

  // Phase 3: matrix starters (param variants)
  id = AOI_PAIR_ID_START
  for (const r of recipes) {
    if (r.rawShape !== 'aoi-pair-matrix') continue
    for (const starter of r.starterInstances ?? []) {
      if (starter.projection && starter.projection.kind === 'windowed') continue
      const params = { ...(starter.params ?? {}) } as Record<string, unknown>
      const projection = starter.projection ?? identityFor(r.rawShape)
      out.push({
        id: id++,
        baseId: r.id,
        params,
        label: starter.label ?? defaultInstanceLabel(r.id, params, projection),
        projection,
      })
    }
  }

  return out
}

// ── Legacy-compatibility phase helpers (used by V5→V8 workspace migrations) ─
// These exist so historical migrations can seed the exact partition they used
// to. Prefer buildStarterInstances() in new code.

export function createSystemMetricInstances(): MetricInstance[] {
  return buildStarterInstances().filter(i => i.id < WINDOWED_ID_START)
}

export function createDefaultWindowedInstances(): MetricInstance[] {
  return buildStarterInstances().filter(i => i.id >= WINDOWED_ID_START && i.id < AOI_PAIR_ID_START)
}

export function createDefaultAoiPairInstances(): MetricInstance[] {
  return buildStarterInstances().filter(i => i.id >= AOI_PAIR_ID_START)
}

export function createDefaultMetricInstances(): MetricInstance[] {
  return buildStarterInstances()
}

/**
 * Resolves a baseId to its sequential starter instance ID (Phase 1). Useful for
 * legacy workspace migrations that need to translate pre-id string tags into
 * numeric instance ids. Returns null when no Phase 1 starter matches.
 */
export function findSystemInstanceIdByBaseId(baseId: string): number | null {
  const recipes = listRecipeIds().map(id => getRecipe(id)!)
  let id = 1
  for (const r of recipes) {
    if (r.rawShape === 'aoi-pair-matrix') continue
    if (r.id === baseId) return id
    id++
  }
  return null
}

export function nextInstanceId(existing: readonly MetricInstance[]): number {
  let max = SYSTEM_ID_OFFSET - 1
  for (const inst of existing) if (inst.id > max) max = inst.id
  return Math.max(max + 1, SYSTEM_ID_OFFSET)
}

export function resolveInstance(
  instances: readonly MetricInstance[],
  id: number | null,
): MetricInstance | undefined {
  if (id == null) return undefined
  return instances.find(i => i.id === id)
}

// ─── Label / readout helpers ─────────────────────────────────────────────────

export function defaultInstanceLabel(
  baseId: string,
  params: Record<string, unknown>,
  projection?: Projection,
): string {
  const m = getMetric(baseId)
  if (!m) return baseId
  const base = m.meta.defaultLabel
    ? m.meta.defaultLabel(params)
    : m.meta.params.length === 0
      ? m.meta.label
      : (() => {
          const paramStrs = m.meta.params
            .map(p => formatParamShort(p, params[p.id] ?? p.default))
            .filter(s => s.length > 0)
          return paramStrs.length > 0
            ? `${m.meta.label} (${paramStrs.join(', ')})`
            : m.meta.label
        })()

  const projLabel = projection ? projectionToLabel(projection) : ''
  return projLabel ? `${base} · ${projLabel}` : base
}

/** Human-readable readout of the projection (including window suffix). */
export function formatProjectionReadout(instance: MetricInstance): string | null {
  const label = projectionToLabel(instance.projection)
  return label.length > 0 ? label : null
}

export function formatParamReadout(instance: MetricInstance): string[] {
  const m = getMetric(instance.baseId)
  if (!m || m.meta.params.length === 0) return []
  return m.meta.params
    .map(p => formatParamShort(p, instance.params[p.id] ?? p.default))
    .filter((s): s is string => s.length > 0)
}

function formatParamShort(def: ParamDef<unknown>, value: unknown): string {
  if (value === undefined || value === null) return ''
  if (def.type === 'enum') {
    const opt = def.options?.find(o => o.value === value)
    return opt?.label ?? String(value)
  }
  if (def.type === 'boolean') return value ? def.id : ''
  return `${def.id}=${value}`
}

// ─── Convenience constructors ────────────────────────────────────────────────

export function makeLeafInstance(
  id: number,
  baseId: string,
  params: Record<string, unknown>,
  leaf: LeafProjection,
  label?: string,
): MetricInstance {
  return {
    id, baseId, params,
    projection: leaf,
    label: label ?? defaultInstanceLabel(baseId, params, leaf),
  }
}
