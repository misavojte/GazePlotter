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

/** How the number was produced — recipe + params + projection. Every
 *  MetricResult carries one, so a paper export can cite it verbatim. */
export interface MetricProvenance {
  baseId: string
  params: Record<string, unknown>
  projection: Projection
  /** True when a reference the projection names (an AOI, an eye-movement
   *  type, an event channel) could not be resolved in this dataset. */
  refMissing?: boolean
}

export type MetricResult =
  | { shape: 'scalar';                     metricId: string; unit: string; value: number; isFinite: boolean; provenance: MetricProvenance }
  | { shape: 'aoi-vector';                 metricId: string; unit: string; values: number[]; slots: AoiSlotInfo; provenance: MetricProvenance }
  /** One value per eye-movement type, in the canonical `categoryGroups` order
      (consumers derive names via `categoryGroupNames(engine)`). */
  | { shape: 'category-vector';            metricId: string; unit: string; values: number[]; provenance: MetricProvenance }
  /** One value per event channel of the scope's stimulus, in `eventGroups`
      order (consumers derive names via `eventGroupNames(engine, stimulusId)`). */
  | { shape: 'event-vector';               metricId: string; unit: string; values: number[]; provenance: MetricProvenance }
  | { shape: 'aoi-pair-matrix';            metricId: string; unit: string; matrix: number[]; size: number; provenance: MetricProvenance }
  | { shape: 'participant-pair-matrix';    metricId: string; unit: string; matrix: number[]; size: number; participantIds: number[]; provenance: MetricProvenance }
  | { shape: 'scalar-timeseries';          metricId: string; unit: string; values: number[]; timeline: number[]; provenance: MetricProvenance }
  | { shape: 'aoi-vector-timeseries';      metricId: string; unit: string; vectors: number[][]; timeline: number[]; slots: AoiSlotInfo; provenance: MetricProvenance }

/** Compute a metric instance for a single participant. */
export function query(instance: MetricInstance, scope: Scope): MetricResult {
  const recipe = getRecipe(instance.baseId)
  if (!recipe) return emptyResult(instance, 'scalar', '')
  // Group-shape recipes need a participant SET, not a single Scope.
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
    // Group-shape recipes don't compose with per-participant batching;
    // consumers call queryGroup directly.
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
          projectLeaf(recipe, inst.projection, scope.engine, scope.stimulusId, aoiNames, raw, slots)))
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
  // Group-shape recipes own the full computation: participants ARE the axis,
  // so there is nothing to reduce across.
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
  // Resolved in ONE place, shared with the label, so what is computed always
  // matches what is disclosed.
  const method = resolveReduction(instance)
  if (instance.projection.kind === 'windowed') {
    // Into the runtime, so plot transformers don't reimplement per-cell reduction.
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
    projectLeaf(recipe, instance.projection, group.engine, group.stimulusId, aoiNames, reduced, slots))
}

/** Per-event values by slot from ONE participant scan — the beeswarm's dots.
 *  `null` for recipes with no `individuals`; use the aggregate `query`. */
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
 * THE beeswarm-pooling rule for every distribution plot: pool each
 * participant's per-EVENT sample per slot, tagged with who contributed it.
 *
 * A metric declaring `individuals` contributes EVERY event as its own dot; one
 * without contributes a single dot per participant from the cached aggregate.
 * Non-finite values drop — NaN means "no such sample here" and must leave the
 * distribution rather than sit at zero and drag it, while a real 0 is data.
 *
 * ONE scan per participant regardless of slot count: the per-slot individuals
 * come from a single accumulator, and the aggregate is fetched lazily, only
 * for slots needing the fallback. Callers pass the slots they will draw, so a
 * narrowed plot does no extra work. Within a slot, values stay in participant
 * order — the dot order the tooltips rely on.
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
    // Lazy + reused: the fallback for slots with no individuals, and the only
    // source for metrics without the hook. `query` is cached, so this scans at
    // most once per participant.
    let aggregate: number[] | undefined
    const aggregateAt = (slot: number): number => {
      if (!aggregate) {
        const r = query(instance, scope)
        // Whichever vector shape the plot's contract admitted.
        aggregate =
          r.shape === 'aoi-vector' || r.shape === 'category-vector' || r.shape === 'event-vector'
            ? r.values
            : []
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
  if (shape === 'event-vector') {
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
    // Unreachable today: queryGroup short-circuits scanGroup recipes upstream.
    const size = Math.round(Math.sqrt(values.length))
    return { shape, metricId, unit, matrix: values, size, participantIds: [], provenance }
  }
  const size = Math.round(Math.sqrt(values.length))
  return { shape: 'aoi-pair-matrix', metricId, unit, matrix: values, size, provenance }
}

/** Provenance always describes the real instance: there is no synthesized
 *  fallback, so an empty result stays as citable as a populated one. */
function emptyResult(
  instance: MetricInstance,
  shape: 'scalar' | 'aoi-vector' | 'aoi-pair-matrix' | 'participant-pair-matrix',
  unit: string,
): MetricResult {
  const metricId = instance.baseId
  const provenance: MetricProvenance = {
    baseId: instance.baseId,
    params: instance.params,
    projection: instance.projection,
  }
  if (shape === 'scalar') return { shape: 'scalar', metricId, unit, value: Number.NaN, isFinite: false, provenance }
  if (shape === 'aoi-vector') return { shape: 'aoi-vector', metricId, unit, values: [], slots: { totalSlots: 0, noAoiSlot: 0, anyFixationSlot: 0 }, provenance }
  if (shape === 'participant-pair-matrix') return { shape: 'participant-pair-matrix', metricId, unit, matrix: [], size: 0, participantIds: [], provenance }
  return { shape: 'aoi-pair-matrix', metricId, unit, matrix: [], size: 0, provenance }
}

/** rows × slots → one value per slot. Only the iteration lives here; the
 *  reduction maths stays in `reduceFinite`. */
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
