import './init'
import { getRecipe } from './core/defineMetric'
import { resolveParams } from './core/params'
import {
  runProjected,
  runIndividuals,
  runIndividualsAllSlots,
  runRaw,
  runWindowedGroup,
  type Scope,
} from './core/runtime'
import { scanBatch } from './core/scanner'
import { buildAoiSlots } from './core/aoiSlots'
import type { GroupAggregation } from './core/dsl'
import {
  applyProjection,
  projectionOutputShape,
  type Projection,
} from './core/projection'
import type { AoiSlotInfo, GroupScope, OutputShape } from './core/dsl'
import { getAois } from '$lib/data/engine'
import type { MetricInstance } from './instances'

export type { Scope } from './core/runtime'
export type { GroupScope } from './core/dsl'

/**
 * Every MetricResult carries `provenance` describing exactly how the number
 * was produced — recipe + params + projection. Q1-paper exports and future
 * MCP callers can cite this verbatim.
 */
export interface MetricProvenance {
  baseId: string
  params: Record<string, unknown>
  projection: Projection
  /** True when an AOI reference in the projection could not be resolved. */
  aoiMissing?: boolean
}

export type MetricResult =
  | { shape: 'scalar';                     metricId: string; unit: string; value: number; isFinite: boolean; provenance: MetricProvenance }
  | { shape: 'aoi-vector';                 metricId: string; unit: string; values: number[]; slots: AoiSlotInfo; provenance: MetricProvenance }
  | { shape: 'aoi-pair-matrix';            metricId: string; unit: string; matrix: number[]; size: number; provenance: MetricProvenance }
  | { shape: 'participant-pair-matrix';    metricId: string; unit: string; matrix: number[]; size: number; participantIds: number[]; provenance: MetricProvenance }
  | { shape: 'scalar-timeseries';          metricId: string; unit: string; values: number[]; timeline: number[]; provenance: MetricProvenance }
  | { shape: 'aoi-vector-timeseries';      metricId: string; unit: string; vectors: number[][]; timeline: number[]; slots: AoiSlotInfo; provenance: MetricProvenance }

/** Compute a metric instance for a single participant. */
export function query(instance: MetricInstance, scope: Scope): MetricResult {
  const recipe = getRecipe(instance.baseId)
  if (!recipe) return emptyResult(instance, 'scalar', '')
  // Group-shape recipes (participant-pair-matrix) need a participant set,
  // not a single Scope. Per-participant projections from the group result are
  // a Phase 2 concern; for now, single-participant queries return empty.
  if (recipe.rawShape === 'participant-pair-matrix') {
    return emptyResult(instance, 'participant-pair-matrix', recipe.unit)
  }
  const projected = runProjected(instance, scope)
  if (!projected) return emptyResult(instance, 'scalar', recipe.unit)
  return wrapProjectedResult(recipe.id, recipe.unit, instance, projected)
}

/**
 * Compute many instances in a single segment pass per participant. Windowed
 * instances fall back to the standard `query()` path (separate scans).
 */
export function queryBatch(instances: readonly MetricInstance[], scope: Scope): Map<string, MetricResult> {
  const out = new Map<string, MetricResult>()
  const windowed: MetricInstance[] = []
  const plain: MetricInstance[] = []
  for (const inst of instances) {
    // Group-shape recipes don't compose with per-participant batch evaluation.
    // Consumers that need them call queryGroup directly.
    const r = getRecipe(inst.baseId)
    if (r?.rawShape === 'participant-pair-matrix') continue
    ;(inst.projection.kind === 'windowed' ? windowed : plain).push(inst)
  }

  if (plain.length > 0) {
    const raws = scanBatch(
      scope.engine,
      scope.stimulusId,
      scope.participantId,
      plain,
      scope.timeStart ?? 0,
      scope.timeEnd ?? 0,
    )
    const slots = buildAoiSlots(scope.engine, scope.stimulusId)
    if (slots) {
      const aoiNames = getAois(scope.engine, scope.stimulusId).map(a => a.displayedName)
      for (const inst of plain) {
        const recipe = getRecipe(inst.baseId)
        if (!recipe) continue
        const raw = raws.get(inst.id)
        if (!raw) continue
        const applied = applyProjection(inst.projection, { aoiNames, rawValues: raw })
        out.set(inst.id, wrapProjectedResult(recipe.id, recipe.unit, inst, {
          shape: projectionOutputShape(inst.projection),
          values: applied.values,
          slots,
          aoiMissing: applied.aoiMissing,
        }))
      }
    }
  }
  for (const inst of windowed) out.set(inst.id, query(inst, scope))
  return out
}

/** Compute a metric instance aggregated across participants using the recipe's `groupAggregation`. */
export function queryGroup(instance: MetricInstance, group: GroupScope): MetricResult {
  const recipe = getRecipe(instance.baseId)
  if (!recipe) return emptyResult(instance, 'scalar', '')
  // Group-shape recipes own the full computation. Per-slot reduction across
  // participants doesn't apply — participants ARE the matrix axis.
  if (recipe.rawShape === 'participant-pair-matrix') {
    if (!recipe.scanGroup) return emptyResult(instance, 'participant-pair-matrix', recipe.unit)
    const params = resolveParams(recipe.params, instance.params)
    const groupResult = recipe.scanGroup(group, params)
    const provenance: MetricProvenance = {
      baseId: instance.baseId,
      params: instance.params,
      projection: instance.projection,
    }
    return {
      shape: 'participant-pair-matrix',
      metricId: recipe.id,
      unit: recipe.unit,
      matrix: groupResult.matrix,
      size: groupResult.participantIds.length,
      participantIds: groupResult.participantIds,
      provenance,
    }
  }
  // The instance may pin a cross-participant statistic (mean / sum / median)
  // overriding the recipe default; absent ⇒ recipe default ⇒ mean. The
  // recipe's `groupAggregationGuard` is the last-ditch veto on an incoherent
  // combination (e.g. summing a per-participant percentage) — UI/validators
  // catch it upstream, but a stale instance falls back to mean here.
  const method = effectiveGroupMethod(recipe, instance)
  if (instance.projection.kind === 'windowed') {
    // Native cross-participant aggregation for windowed projections —
    // dispatched into the runtime so plot transformers don't reimplement
    // per-cell reduction. (runWindowedGroup re-applies the guard internally;
    // passing the already-resolved method is idempotent.)
    const projected = runWindowedGroup(
      recipe,
      instance,
      group,
      instance.projection,
      method,
      reduceFinite,
    )
    if (!projected) return emptyResult(instance, 'scalar', recipe.unit)
    return wrapProjectedResult(recipe.id, recipe.unit, instance, projected)
  }
  const perParticipant = group.participantIds.map(pid =>
    runRaw(recipe, instance, {
      engine: group.engine, stimulusId: group.stimulusId, participantId: pid,
      timeStart: group.timeStart, timeEnd: group.timeEnd,
    })
  )
  const reduced = reducePerSlot(perParticipant, method)
  const aoiNames = getAois(group.engine, group.stimulusId).map(a => a.displayedName)
  const applied = applyProjection(instance.projection, { aoiNames, rawValues: reduced })
  const slots = buildAoiSlots(group.engine, group.stimulusId)
  if (!slots) return emptyResult(instance, 'scalar', recipe.unit)
  return wrapProjectedResult(recipe.id, recipe.unit, instance, {
    shape: projectionOutputShape(instance.projection),
    values: applied.values,
    slots,
    aoiMissing: applied.aoiMissing,
  })
}

/** Per-fixation individual values for the given slot (for box-plot individuals). */
export function queryIndividuals(instance: MetricInstance, scope: Scope, slotIndex: number): number[] {
  const recipe = getRecipe(instance.baseId)
  if (!recipe) return []
  return runIndividuals(recipe, instance, scope, slotIndex)
}

/**
 * Per-fixation individual values for every slot from ONE participant scan
 * (indexed by slot). For callers that need all slots — the AOI-comparison bar
 * plot — this avoids the per-slot rescan of {@link queryIndividuals}. Returns
 * `null` for recipes without an individuals recipe (use the aggregate `query`).
 */
export function queryIndividualsAllSlots(instance: MetricInstance, scope: Scope): number[][] | null {
  const recipe = getRecipe(instance.baseId)
  if (!recipe) return null
  return runIndividualsAllSlots(recipe, instance, scope)
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Resolve the cross-participant reduction for a group query: the instance's
 * `groupAggregation` override wins, else the recipe default, else `mean`. The
 * recipe's `groupAggregationGuard` then has a final veto — if the resolved
 * method is incoherent for this projection it falls back to `mean`.
 */
function effectiveGroupMethod(
  recipe: { groupAggregation?: GroupAggregation; groupAggregationGuard?: (p: Projection, m: GroupAggregation) => string | null },
  instance: MetricInstance,
): GroupAggregation {
  const requested = instance.groupAggregation ?? recipe.groupAggregation ?? 'mean'
  return recipe.groupAggregationGuard?.(instance.projection, requested) ? 'mean' : requested
}

function wrapProjectedResult(
  metricId: string,
  unit: string,
  instance: MetricInstance,
  projected: {
    shape: OutputShape
    values: number[]
    vectors?: number[][]
    slots: AoiSlotInfo
    aoiMissing: boolean
    timeline?: number[]
  },
): MetricResult {
  const provenance: MetricProvenance = {
    baseId: instance.baseId,
    params: instance.params,
    projection: instance.projection,
    aoiMissing: projected.aoiMissing || undefined,
  }
  const { values, shape, slots } = projected
  if (shape === 'scalar') {
    const v = values[0] ?? Number.NaN
    return { shape, metricId, unit, value: v, isFinite: Number.isFinite(v), provenance }
  }
  if (shape === 'aoi-vector') {
    return { shape, metricId, unit, values, slots, provenance }
  }
  if (shape === 'scalar-timeseries') {
    return { shape, metricId, unit, values, timeline: projected.timeline ?? [], provenance }
  }
  if (shape === 'aoi-vector-timeseries') {
    const vectors = projected.vectors ?? []
    return { shape, metricId, unit, vectors, timeline: projected.timeline ?? [], slots, provenance }
  }
  if (shape === 'participant-pair-matrix') {
    // queryGroup short-circuits scanGroup recipes upstream; this branch only
    // fires if a future per-participant projection feeds this path.
    const size = Math.round(Math.sqrt(values.length))
    return { shape, metricId, unit, matrix: values, size, participantIds: [], provenance }
  }
  const size = Math.round(Math.sqrt(values.length))
  return { shape: 'aoi-pair-matrix', metricId, unit, matrix: values, size, provenance }
}

function emptyResult(
  instance: MetricInstance | string,
  shape: 'scalar' | 'aoi-vector' | 'aoi-pair-matrix' | 'participant-pair-matrix',
  unit: string,
): MetricResult {
  const baseId = typeof instance === 'string' ? instance : instance.baseId
  const provenance: MetricProvenance = typeof instance === 'string'
    ? { baseId, params: {}, projection: { kind: 'identity-scalar' } }
    : { baseId: instance.baseId, params: instance.params, projection: instance.projection }
  const metricId = baseId
  if (shape === 'scalar') return { shape: 'scalar', metricId, unit, value: Number.NaN, isFinite: false, provenance }
  if (shape === 'aoi-vector') return { shape: 'aoi-vector', metricId, unit, values: [], slots: { totalSlots: 0, noAoiSlot: 0, anyFixationSlot: 0 }, provenance }
  if (shape === 'participant-pair-matrix') return { shape: 'participant-pair-matrix', metricId, unit, matrix: [], size: 0, participantIds: [], provenance }
  return { shape: 'aoi-pair-matrix', metricId, unit, matrix: [], size: 0, provenance }
}

/**
 * Reduce a flat list of values across a single dimension via mean / sum /
 * median. Non-finite entries (`NaN`, `Infinity`) are filtered before
 * reduction; an all-NaN input yields `NaN`. The atomic primitive that
 * `reducePerSlot` (per-slot 2D reduction) and `runWindowedGroup` (per-cell
 * 3D reduction across windows × slots) both compose against — keeping the
 * actual reduction maths in one place.
 */
export function reduceFinite(
  values: readonly number[],
  method: GroupAggregation,
): number {
  const valid = values.filter(Number.isFinite)
  if (valid.length === 0) return Number.NaN
  if (method === 'sum') return valid.reduce((a, b) => a + b, 0)
  // `proportion` (the fraction of finite 0/1 values) is numerically the mean.
  if (method === 'mean' || method === 'proportion') return valid.reduce((a, b) => a + b, 0) / valid.length
  
  // median
  const s = [...valid].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

/**
 * 2D reduction: rows × slots → one value per slot. Thin wrapper over
 * `reduceFinite` — keeps the per-slot iteration here while the actual
 * reduction maths lives in one place.
 */
function reducePerSlot(rows: number[][], method: GroupAggregation): number[] {
  if (rows.length === 0) return []
  const slotCount = rows[0].length
  const out = new Array<number>(slotCount)
  const column: number[] = new Array(rows.length)
  for (let s = 0; s < slotCount; s++) {
    for (let r = 0; r < rows.length; r++) column[r] = rows[r][s]
    out[s] = reduceFinite(column, method)
  }
  return out
}
