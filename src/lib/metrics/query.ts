import './init'
import { getRecipe } from './core/defineMetric'
import { resolveParams } from './core/params'
import {
  projectLeaf,
  runProjected,
  runIndividualsAllSlots,
  runRaw,
  runWindowedGroup,
  type Scope,
} from './core/runtime'
import { scanBatch } from './core/scanner'
import { buildAoiSlots } from './core/aoiSlots'
import { reduceFinite } from './core/aggregation'
import type { GroupReduction } from './core/measurement'
import type { Projection } from './core/projection'
import type { AoiSlotInfo, GroupScope, OutputShape } from './core/dsl'
import { getAois } from '$lib/data/engine'
import { resolveReduction, type MetricInstance } from './instances'

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
  /** True when a reference the projection names (an AOI, an eye-movement type)
   *  could not be resolved in this dataset. */
  refMissing?: boolean
}

export type MetricResult =
  | { shape: 'scalar';                     metricId: string; unit: string; value: number; isFinite: boolean; provenance: MetricProvenance }
  | { shape: 'aoi-vector';                 metricId: string; unit: string; values: number[]; slots: AoiSlotInfo; provenance: MetricProvenance }
  /** One value per eye-movement type, in the canonical `categoryGroups` order
      (consumers derive names via `categoryGroupNames(engine)`). */
  | { shape: 'category-vector';            metricId: string; unit: string; values: number[]; provenance: MetricProvenance }
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
      scope.aoiSelectionId,
    )
    const slots = buildAoiSlots(scope.engine, scope.stimulusId, scope.aoiSelectionId)
    if (slots) {
      const aoiNames = getAois(scope.engine, scope.stimulusId, scope.aoiSelectionId).map(a => a.displayedName)
      for (const inst of plain) {
        const recipe = getRecipe(inst.baseId)
        if (!recipe) continue
        const raw = raws.get(inst.id)
        if (!raw) continue
        out.set(inst.id, wrapProjectedResult(recipe.id, recipe.unit, inst,
          projectLeaf(recipe, inst.projection, scope.engine, aoiNames, raw, slots)))
      }
    }
  }
  for (const inst of windowed) out.set(inst.id, query(inst, scope))
  return out
}

/** Compute a metric instance reduced across participants per the effective `reduction`. */
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
  // The effective cross-participant reduction — resolved in ONE place
  // (`resolveReduction`) shared with the label, so what's computed always
  // matches what's disclosed. Instance override (when sound) → metric default;
  // request === result, no silent downgrade.
  const method = resolveReduction(instance)
  if (instance.projection.kind === 'windowed') {
    // Native cross-participant reduction for windowed projections — dispatched
    // into the runtime so plot transformers don't reimplement per-cell reduction.
    const projected = runWindowedGroup(
      recipe,
      instance,
      group,
      instance.projection,
      method,
    )
    if (!projected) return emptyResult(instance, 'scalar', recipe.unit)
    return wrapProjectedResult(recipe.id, recipe.unit, instance, projected)
  }
  const perParticipant = group.participantIds.map(pid =>
    runRaw(recipe, instance, {
      engine: group.engine, stimulusId: group.stimulusId, participantId: pid,
      timeStart: group.timeStart, timeEnd: group.timeEnd,
      aoiSelectionId: group.aoiSelectionId,
    })
  )
  const reduced = reducePerSlot(perParticipant, method)
  const aoiNames = getAois(group.engine, group.stimulusId, group.aoiSelectionId).map(a => a.displayedName)
  const slots = buildAoiSlots(group.engine, group.stimulusId, group.aoiSelectionId)
  if (!slots) return emptyResult(instance, 'scalar', recipe.unit)
  return wrapProjectedResult(recipe.id, recipe.unit, instance,
    projectLeaf(recipe, instance.projection, group.engine, aoiNames, reduced, slots))
}

/**
 * Per-fixation individual values for every slot from ONE participant scan
 * (indexed by slot — box-plot/beeswarm individuals). Returns `null` for
 * recipes without an individuals recipe (use the aggregate `query`).
 */
export function queryIndividualsAllSlots(instance: MetricInstance, scope: Scope): number[][] | null {
  const recipe = getRecipe(instance.baseId)
  if (!recipe) return null
  return runIndividualsAllSlots(recipe, instance, scope)
}

/** Per-slot pooled sample, each array parallel to the requested `slots`. */
export interface PooledIndividuals {
  values: number[][]
  names: string[][]
}

/**
 * THE beeswarm-pooling rule, for every distribution plot: pool each
 * participant's per-EVENT sample per slot, tagged with who contributed it.
 *
 * A metric declaring an `individuals` recipe (fixationDuration's raw
 * fixations, movementDuration's raw segments) contributes EVERY event as its
 * own dot; one without contributes a single dot per participant from the
 * cached aggregate vector. Non-finite values drop — NaN means "this
 * participant has no such sample" (no fixations in that AOI, no segments of
 * that type) and must leave the distribution rather than sit at zero and drag
 * it, while a real 0 (a count) is data and stays.
 *
 * Costs ONE scan per participant regardless of slot count: the per-slot
 * individuals come from a single accumulator and the aggregate is fetched
 * lazily, at most once, only for slots that need the fallback. Callers pass
 * the slots they will actually draw (the AOI slots incl. sentinels, or just
 * the SELECTION-kept type slots), so a narrowed plot does no extra work.
 *
 * Within each slot, values stay in participant order — the dot order the
 * figure and its tooltips rely on.
 */
export function queryPooledIndividuals(
  instance: MetricInstance,
  scopes: readonly Scope[],
  participantNames: readonly string[],
  slots: readonly number[],
): PooledIndividuals {
  const values: number[][] = slots.map(() => [])
  const names: string[][] = slots.map(() => [])

  for (let p = 0; p < scopes.length; p++) {
    const scope = scopes[p]
    const name = participantNames[p]
    const perSlot = queryIndividualsAllSlots(instance, scope)
    // Lazy + reused: the fallback for slots this participant has no
    // individuals for, and the only source for metrics without the recipe.
    // `query` is cached, so it scans at most once per participant.
    let aggregate: number[] | undefined
    const aggregateAt = (slot: number): number => {
      if (!aggregate) {
        const r = query(instance, scope)
        // Whichever vector shape the plot's contract admitted — the shapes
        // stay separate declarations, this only reads the values off one.
        aggregate = r.shape === 'aoi-vector' || r.shape === 'category-vector' ? r.values : []
      }
      return aggregate[slot] ?? Number.NaN
    }

    for (let i = 0; i < slots.length; i++) {
      const individuals = perSlot?.[slots[i]]
      if (individuals && individuals.length > 0) {
        for (let k = 0; k < individuals.length; k++) {
          const v = individuals[k]
          if (Number.isFinite(v)) {
            values[i].push(v)
            names[i].push(name)
          }
        }
      } else {
        const v = aggregateAt(slots[i])
        if (Number.isFinite(v)) {
          values[i].push(v)
          names[i].push(name)
        }
      }
    }
  }
  return { values, names }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function wrapProjectedResult(
  metricId: string,
  unit: string,
  instance: MetricInstance,
  projected: {
    shape: OutputShape
    values: number[]
    vectors?: number[][]
    slots: AoiSlotInfo
    refMissing: boolean
    timeline?: number[]
  },
): MetricResult {
  const provenance: MetricProvenance = {
    baseId: instance.baseId,
    params: instance.params,
    projection: instance.projection,
    refMissing: projected.refMissing || undefined,
  }
  const { values, shape, slots } = projected
  if (shape === 'scalar') {
    const v = values[0] ?? Number.NaN
    return { shape, metricId, unit, value: v, isFinite: Number.isFinite(v), provenance }
  }
  if (shape === 'aoi-vector') {
    return { shape, metricId, unit, values, slots, provenance }
  }
  if (shape === 'category-vector') {
    return { shape, metricId, unit, values, provenance }
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
 * 2D reduction: rows × slots → one value per slot. Thin wrapper over
 * `reduceFinite` (in `core/aggregation.ts`) — keeps the per-slot iteration here
 * while the actual reduction maths lives in one place.
 */
function reducePerSlot(rows: number[][], method: GroupReduction): number[] {
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
