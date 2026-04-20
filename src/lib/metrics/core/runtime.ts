import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois } from '$lib/data/engine'
import { buildAoiSlots } from './aoiSlots'
import { resolveParams } from './params'
import { getRecipe } from './defineMetric'
import {
  applyProjection,
  computeEffectiveShape,
  type Projection,
} from './projection'
import type { AoiSlotInfo, FixationEvent, MetricRecipe, OutputShape, Reduction, WindowingConfig } from './dsl'
import type { MetricInstance } from '../instances'

export interface Scope {
  engine: DataEngine
  stimulusId: number
  participantId: number
  timeStart?: number
  timeEnd?: number
}

const _cache = new WeakMap<DataEngine, Map<string, number[]>>()

/**
 * Core compute path. Returns a raw number[] matching the recipe's finalize shape:
 *  - scalar         → [value]
 *  - aoi-vector     → [v0, v1, …, vNoAoi, vAnyFix]
 *  - aoi-pair-matrix → flattened row-major matrix
 * Consumers should use `query()` in `../query.ts` for typed results.
 */
export function runRecipe(recipe: MetricRecipe<any, any>, instance: MetricInstance, scope: Scope): number[] {
  const timeStart = scope.timeStart ?? 0
  const timeEnd = scope.timeEnd ?? 0

  if (instance.windowing) {
    if (recipe.windowUnit === 'fixations') {
      return runFixationWindowed(recipe, instance, instance.windowing, scope, timeStart, timeEnd)
    }
    return runTimeWindowed(recipe, instance, instance.windowing, scope, timeStart, timeEnd)
  }

  return runSingleWindow(recipe, instance, scope, timeStart, timeEnd)
}

/** Convenience bridge used by consumers via MetricInstance.baseId. Returns [] if id not found. */
export function runMetric(instance: MetricInstance, scope: Scope): number[] {
  const recipe = getRecipe(instance.baseId)
  if (!recipe) return []
  return runRecipe(recipe, instance, scope)
}

/**
 * Run the recipe and apply the instance's projection. Returns the projected
 * values along with the *effective* shape the consumer should treat them as.
 * When `instance.projection` is absent or identity, this is equivalent to
 * `runRecipe` wrapped with the recipe's raw shape.
 */
export interface ProjectedResult {
  values: number[]
  effectiveShape: OutputShape
  rawShape: OutputShape
  aoiMissing: boolean
}

export function runProjected(instance: MetricInstance, scope: Scope): ProjectedResult | null {
  const recipe = getRecipe(instance.baseId)
  if (!recipe) return null
  const raw = runRecipe(recipe, instance, scope)
  return projectRawOutput(raw, recipe.outputShape, instance.projection, scope)
}

export function projectRawOutput(
  raw: number[],
  rawShape: OutputShape,
  projection: Projection | undefined,
  scope: Scope
): ProjectedResult {
  const aoiNames = getAoiNames(scope)
  const { values, aoiMissing } = applyProjection(raw, rawShape, projection, { aoiNames })
  return {
    values,
    effectiveShape: computeEffectiveShape(rawShape, projection),
    rawShape,
    aoiMissing,
  }
}

function getAoiNames(scope: Scope): string[] {
  try {
    return getAois(scope.engine, scope.stimulusId).map(a => a.displayedName)
  } catch {
    return []
  }
}

export function runIndividuals(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  slotIndex: number,
): number[] {
  if (!recipe.individuals) return []
  const out = scanAccumulator(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
  if (!out) return []
  // finalize may flush pending state (e.g., visitDuration's activeDwells) before
  // individuals inspects the accumulator.
  recipe.finalize(out.acc, out.slots, { params: out.params, slots: out.slots })
  return recipe.individuals(out.acc, slotIndex)
}

// ─── Internals ────────────────────────────────────────────────────────────────

interface ScanOutput<A> { acc: A; slots: AoiSlotInfo; params: Record<string, unknown> }

function runSingleWindow(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  timeStart: number,
  timeEnd: number,
): number[] {
  const cached = cacheGet(scope.engine, scope, instance, timeStart, timeEnd)
  if (cached) return cached
  const out = scanAccumulator(recipe, instance, scope, timeStart, timeEnd)
  if (!out) return []
  const result = recipe.finalize(out.acc, out.slots, { params: out.params, slots: out.slots })
  cacheSet(scope.engine, scope, instance, timeStart, timeEnd, result)
  return result
}

function runTimeWindowed(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  windowing: WindowingConfig,
  scope: Scope,
  timeStart: number,
  timeEnd: number,
): number[] {
  const { mode, windowSize, stepSize, reduction } = windowing
  if (timeEnd <= timeStart) return []
  const step = mode === 'epoch' ? windowSize : (stepSize ?? windowSize)
  const perWindow: number[][] = []
  for (let wStart = timeStart; wStart + windowSize <= timeEnd; wStart += step) {
    perWindow.push(runSingleWindow(recipe, instance, scope, wStart, wStart + windowSize))
  }
  if (perWindow.length === 0) return []
  const slotCount = perWindow[0].length
  const result = new Array<number>(slotCount)
  for (let s = 0; s < slotCount; s++) {
    result[s] = reduceScalars(perWindow.map(w => w[s] ?? Number.NaN), reduction)
  }
  return result
}

function runFixationWindowed(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  windowing: WindowingConfig,
  scope: Scope,
  timeStart: number,
  timeEnd: number,
): number[] {
  if (!recipe.windowedFinalize) {
    throw new Error(`[metrics] recipe ${recipe.id} uses windowUnit 'fixations' but defines no windowedFinalize hook`)
  }
  const out = scanAccumulator(recipe, instance, scope, timeStart, timeEnd)
  if (!out) return []
  const acc: any = out.acc
  const seq: number[] | undefined = acc?.seq
  if (!Array.isArray(seq)) {
    throw new Error(`[metrics] recipe ${recipe.id} with windowUnit 'fixations' must accumulate into { seq: number[] }`)
  }
  const N = seq.length
  const { mode, windowSize, stepSize, reduction } = windowing
  const step = mode === 'epoch' ? windowSize : (stepSize ?? 1)
  if (N < windowSize) {
    return fillOutputShape(recipe.outputShape, Number.NaN, out.slots)
  }
  const scalars: number[] = []
  const ctx = { params: out.params, slots: out.slots }
  for (let start = 0; start + windowSize <= N; start += step) {
    scalars.push(recipe.windowedFinalize!(out.acc, start, start + windowSize, ctx))
  }
  const reduced = reduceScalars(scalars, reduction)
  return fillOutputShape(recipe.outputShape, reduced, out.slots)
}

function fillOutputShape(shape: MetricRecipe<any, any>['outputShape'], value: number, slots: AoiSlotInfo): number[] {
  if (shape === 'scalar') return [value]
  if (shape === 'aoi-vector') return new Array<number>(slots.totalSlots).fill(value)
  return new Array<number>((slots.totalSlots - 2 + 1) ** 2).fill(value)
}

export function scanAccumulator(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  timeStart: number,
  timeEnd: number,
): ScanOutput<any> | null {
  const slots = buildAoiSlots(scope.engine, scope.stimulusId)
  if (!slots) return null
  const params = resolveParams(recipe.params, instance.params)
  const ctx = { params, slots }
  const acc = recipe.init(ctx)

  const { reader, hiddenAoisSet, aoiLookup } = slots
  const { startIndex, endIndex } = reader.getSegmentRange(scope.stimulusId, scope.participantId)
  const resolvedSlots: number[] = []
  let index = 0

  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== 0) continue
    const start = reader.getSegmentStart(i)
    const end = reader.getSegmentEnd(i)
    if (timeEnd > 0 && start >= timeEnd) continue
    if (end <= timeStart) continue

    resolvedSlots.length = 0
    const rawAois = reader.getRawAois(i)
    for (let r = 0; r < rawAois.length; r++) {
      const rawId = rawAois[r]
      if (hiddenAoisSet?.has(rawId)) continue
      const slot = aoiLookup.get(scope.engine.getAoiMapping(scope.stimulusId, rawId))
      if (slot !== undefined) resolvedSlots.push(slot)
    }

    recipe.onFixation(acc, { start, duration: end - start, slots: resolvedSlots, index }, ctx)
    index++
  }
  return { acc, slots, params }
}

// ─── Cache (per-engine, keyed on baseId+params+time range) ────────────────────

function cacheKey(instance: MetricInstance, scope: Scope, tStart: number, tEnd: number): string {
  const p = paramsKey(instance.params)
  return `${instance.baseId}|${p}|${scope.stimulusId}|${scope.participantId}|${tStart}|${tEnd}`
}

function paramsKey(params: Record<string, unknown> | undefined): string {
  if (!params) return ''
  const keys = Object.keys(params).sort()
  return keys.map(k => `${k}=${String(params[k])}`).join(',')
}

function cacheGet(engine: DataEngine, scope: Scope, instance: MetricInstance, tStart: number, tEnd: number): number[] | undefined {
  const map = _cache.get(engine)
  if (!map) return undefined
  return map.get(cacheKey(instance, scope, tStart, tEnd))
}

function cacheSet(engine: DataEngine, scope: Scope, instance: MetricInstance, tStart: number, tEnd: number, value: number[]): void {
  let map = _cache.get(engine)
  if (!map) { map = new Map(); _cache.set(engine, map) }
  map.set(cacheKey(instance, scope, tStart, tEnd), value)
}

// ─── Reduction ────────────────────────────────────────────────────────────────

function reduceScalars(values: readonly number[], method: Reduction): number {
  const valid: number[] = []
  for (const v of values) if (Number.isFinite(v)) valid.push(v)
  if (valid.length === 0) return Number.NaN
  switch (method) {
    case 'mean':  { let s = 0; for (const v of valid) s += v; return s / valid.length }
    case 'max':   { let m = valid[0]; for (let i = 1; i < valid.length; i++) if (valid[i] > m) m = valid[i]; return m }
    case 'min':   { let m = valid[0]; for (let i = 1; i < valid.length; i++) if (valid[i] < m) m = valid[i]; return m }
    case 'final': return valid[valid.length - 1]
  }
}
