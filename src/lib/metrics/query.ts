import './init'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getRecipe } from './core/defineMetric'
import { runRecipe, runIndividuals, projectRawOutput, type Scope } from './core/runtime'
import { scanBatch } from './core/scanner'
import type { AoiSlotInfo, OutputShape } from './core/dsl'
import type { Projection } from './core/projection'
import type { MetricInstance } from './instances'

export type { Scope } from './core/runtime'

export interface GroupScope {
  engine: DataEngine
  stimulusId: number
  participantIds: readonly number[]
  timeStart?: number
  timeEnd?: number
}

/**
 * Every MetricResult carries `provenance` describing exactly how the number
 * was produced — recipe + params + projection + windowing. Q1-paper exports
 * and future MCP callers can cite this verbatim.
 */
export interface MetricProvenance {
  baseId: string
  params: Record<string, unknown>
  projection?: Projection
  windowing?: import('./core/dsl').WindowingConfig
  /** True when an AOI reference in the projection could not be resolved. */
  aoiMissing?: boolean
}

export type MetricResult =
  | { shape: 'scalar';          metricId: string; unit: string; value: number; isFinite: boolean; provenance: MetricProvenance }
  | { shape: 'aoi-vector';      metricId: string; unit: string; values: number[]; slots: AoiSlotInfo; provenance: MetricProvenance }
  | { shape: 'aoi-pair-matrix'; metricId: string; unit: string; matrix: number[]; size: number; provenance: MetricProvenance }

/** Compute a metric instance for a single participant. */
export function query(instance: MetricInstance, scope: Scope): MetricResult {
  const recipe = getRecipe(instance.baseId)
  if (!recipe) return emptyResult(instance, 'scalar', '')
  const raw = runRecipe(recipe, instance, scope)
  return wrapResult(recipe.id, recipe.unit, recipe.outputShape, raw, scope, instance)
}

/**
 * Compute many instances in a single segment pass per participant. Instances
 * with windowing config take the standard `query()` path (separate scans).
 */
export function queryBatch(instances: readonly MetricInstance[], scope: Scope): Map<number, MetricResult> {
  const out = new Map<number, MetricResult>()
  const windowed: MetricInstance[] = []
  const plain: MetricInstance[] = []
  for (const inst of instances) (inst.windowing ? windowed : plain).push(inst)

  if (plain.length > 0) {
    const raws = scanBatch(
      scope.engine,
      scope.stimulusId,
      scope.participantId,
      plain,
      scope.timeStart ?? 0,
      scope.timeEnd ?? 0,
    )
    for (const inst of plain) {
      const recipe = getRecipe(inst.baseId)
      if (!recipe) continue
      const raw = raws.get(inst.id)
      if (!raw) continue
      out.set(inst.id, wrapResult(recipe.id, recipe.unit, recipe.outputShape, raw, scope, inst))
    }
  }
  for (const inst of windowed) out.set(inst.id, query(inst, scope))
  return out
}

/** Compute a metric instance aggregated across participants using the recipe's `groupAggregation`. */
export function queryGroup(instance: MetricInstance, group: GroupScope): MetricResult {
  const recipe = getRecipe(instance.baseId)
  if (!recipe) return emptyResult(instance, 'scalar', '')
  const perParticipant = group.participantIds.map(pid =>
    runRecipe(recipe, instance, {
      engine: group.engine, stimulusId: group.stimulusId, participantId: pid,
      timeStart: group.timeStart, timeEnd: group.timeEnd,
    })
  )
  const reduced = reducePerSlot(perParticipant, recipe.groupAggregation ?? 'mean')
  const scope: Scope = {
    engine: group.engine, stimulusId: group.stimulusId, participantId: -1,
    timeStart: group.timeStart, timeEnd: group.timeEnd,
  }
  return wrapResult(recipe.id, recipe.unit, recipe.outputShape, reduced, scope, instance)
}

/** Per-fixation individual values for the given slot (for box-plot individuals). */
export function queryIndividuals(instance: MetricInstance, scope: Scope, slotIndex: number): number[] {
  const recipe = getRecipe(instance.baseId)
  if (!recipe) return []
  return runIndividuals(recipe, instance, scope, slotIndex)
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function wrapResult(
  metricId: string,
  unit: string,
  rawShape: OutputShape,
  raw: number[],
  scope: Scope,
  instance: MetricInstance
): MetricResult {
  const projected = projectRawOutput(raw, rawShape, instance.projection, scope)
  const provenance: MetricProvenance = {
    baseId: instance.baseId,
    params: instance.params,
    projection: instance.projection,
    windowing: instance.windowing,
    aoiMissing: projected.aoiMissing || undefined,
  }
  const values = projected.values
  const shape = projected.effectiveShape

  if (shape === 'scalar') {
    const v = values[0] ?? Number.NaN
    return { shape: 'scalar', metricId, unit, value: v, isFinite: Number.isFinite(v), provenance }
  }
  if (shape === 'aoi-vector') {
    const slots = deriveSlotInfo(values.length)
    return { shape: 'aoi-vector', metricId, unit, values, slots, provenance }
  }
  const size = Math.round(Math.sqrt(values.length))
  return { shape: 'aoi-pair-matrix', metricId, unit, matrix: values, size, provenance }
}

function deriveSlotInfo(totalSlots: number): AoiSlotInfo {
  const noAoiSlot = totalSlots - 2
  const anyFixationSlot = totalSlots - 1
  return { totalSlots, noAoiSlot, anyFixationSlot }
}

function emptyResult(instance: MetricInstance | string, shape: OutputShape, unit: string): MetricResult {
  const baseId = typeof instance === 'string' ? instance : instance.baseId
  const provenance: MetricProvenance = typeof instance === 'string'
    ? { baseId, params: {} }
    : { baseId: instance.baseId, params: instance.params, projection: instance.projection, windowing: instance.windowing }
  const metricId = baseId
  if (shape === 'scalar') return { shape: 'scalar', metricId, unit, value: Number.NaN, isFinite: false, provenance }
  if (shape === 'aoi-vector') return { shape: 'aoi-vector', metricId, unit, values: [], slots: { totalSlots: 0, noAoiSlot: 0, anyFixationSlot: 0 }, provenance }
  return { shape: 'aoi-pair-matrix', metricId, unit, matrix: [], size: 0, provenance }
}

function reducePerSlot(rows: number[][], method: 'mean' | 'median' | 'sum'): number[] {
  if (rows.length === 0) return []
  const slotCount = rows[0].length
  const out = new Array<number>(slotCount)
  for (let s = 0; s < slotCount; s++) {
    const vals: number[] = []
    for (const row of rows) {
      const v = row[s]
      if (Number.isFinite(v)) vals.push(v)
    }
    if (vals.length === 0) { out[s] = Number.NaN; continue }
    if (method === 'sum') { let sum = 0; for (const v of vals) sum += v; out[s] = sum }
    else if (method === 'mean') { let sum = 0; for (const v of vals) sum += v; out[s] = sum / vals.length }
    else {
      const sorted = [...vals].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      out[s] = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }
  }
  return out
}
