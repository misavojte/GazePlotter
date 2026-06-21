import './init'
import { getMetric, getRecipe } from './core/defineMetric'
import { resolveParams, paramToLabel, type ParamDef } from './core/params'
import {
  identityFor,
  projectionToLabel,
  type Projection,
  type LeafProjection,
} from './core/projection'
import { STARTING_METRICS } from './startingMetrics'

export type { Projection, LeafProjection, AoiRef, AoiReducer, MatrixReducer, WindowSpec } from './core/projection'

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
}

// ─── Instance construction ──────────────────────────────────────────────────

/**
 * Single constructor for a `MetricInstance`. All instance-creation paths route
 * through here — `DataEngine.addMetricInstance`, starter seeding, and future
 * agent-callable compute APIs — so a metric instance always carries fully
 * resolved params, a valid projection, and a non-empty label regardless of
 * where it came from.
 *
 *   - `id`         defaults to `crypto.randomUUID()`. Starters pass their slug.
 *   - `params`     are run through `resolveParams` so any missing keys are
 *                  filled with the recipe's declared defaults (and primitive
 *                  values get coerced to the declared type).
 *   - `projection` defaults to the recipe's identity leaf (`identityFor`).
 *   - `label`      defaults to `defaultInstanceLabel(baseId, params, projection)`.
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
}): MetricInstance | null {
  const recipe = getRecipe(opts.baseId)
  if (!recipe) return null
  const projection = opts.projection ?? identityFor(recipe.rawShape)
  const params = resolveParams(recipe.params, opts.params) as Record<string, unknown>
  const label = opts.label?.trim() || defaultInstanceLabel(opts.baseId, params, projection)
  return {
    id: opts.id ?? crypto.randomUUID(),
    baseId: opts.baseId,
    params,
    projection,
    label,
  }
}

// ─── Starter instances (from the shared settings file) ──────────────────────

export function buildStarterInstances(): MetricInstance[] {
  return STARTING_METRICS.map(spec => {
    const inst = createMetricInstance({
      id: spec.id,
      baseId: spec.baseId,
      params: spec.params,
      projection: spec.projection,
      label: spec.label,
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

// ─── Label / readout helpers ─────────────────────────────────────────────────

/**
 * Human-readable default label for a metric instance, composed from declarative
 * parts in the shared mid-dot grammar — `"<quantity> · <param> · … · <projection>"`.
 * No per-metric label callbacks: the quantity is the recipe's bare `meta.label`,
 * each param renders itself via {@link paramToLabel} (so the same param reads
 * identically across every metric, with no ad-hoc brackets/parens), and the
 * projection readout (leaf + window) trails last.
 *
 * Examples:
 *   - default fixation transitions:  `"Transitions · Fixation pairs"`
 *   - visit, 2-step, windowed:        `"Transition probability · Visit changes · 2-step · 500 ms window"`
 *   - matrix-row from AOI "CTA":      `"Transitions · Fixation pairs · from AOI "CTA""`
 *   - similarity, collapsed:          `"Scanpath similarity · Levenshtein · collapsed"`
 */
export function defaultInstanceLabel(
  baseId: string,
  params: Record<string, unknown>,
  projection?: Projection,
): string {
  const m = getMetric(baseId)
  if (!m) return baseId
  const parts: string[] = [m.meta.label]
  for (const def of m.meta.params) {
    const q = paramToLabel(def, params[def.id] ?? def.default)
    if (q) parts.push(q)
  }
  if (projection) {
    const projSuffix = projectionToLabel(projection, m.meta.windowUnit ?? 'ms')
    if (projSuffix.length > 0) parts.push(projSuffix)
  }
  return parts.join(' · ')
}

/** Human-readable readout of the projection (including window suffix). */
export function formatProjectionReadout(instance: MetricInstance): string | null {
  const m = getMetric(instance.baseId)
  const unit = m?.meta.windowUnit ?? 'ms'
  const label = projectionToLabel(instance.projection, unit)
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

