import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois } from '$lib/data/engine'
import { buildAoiSlots } from './aoiSlots'
import { resolveParams } from './params'
import { getRecipe } from './defineMetric'
import {
  applyProjection,
  leafOf,
  PROJECTION_LEAVES,
  projectionOutputShape,
  type Projection,
  type WindowedProjection,
} from './projection'
import type { AoiSlotInfo, MetricRecipe, OutputShape } from './dsl'
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
 * Scalar / vector / matrix result for a single metric instance over a scope.
 * `timeline` is populated only when `shape === 'scalar-timeseries'` and
 * contains window start times (ms for time-windowed, fixation indices for
 * fixation-windowed).
 */
export interface ProjectedResult {
  shape: OutputShape
  values: number[]
  aoiMissing: boolean
  timeline?: number[]
}

/**
 * Run an instance's recipe and apply its projection. Single entry point for
 * consumers; dispatches on projection.kind (leaf vs windowed).
 */
export function runProjected(instance: MetricInstance, scope: Scope): ProjectedResult | null {
  const recipe = getRecipe(instance.baseId)
  if (!recipe) return null
  const p = instance.projection

  if (p.kind !== 'windowed') {
    const raw = runSingleWindow(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
    const out = applyProjection(p, { aoiNames: getAoiNames(scope), rawValues: raw })
    return {
      shape: projectionOutputShape(p),
      values: out.values,
      aoiMissing: out.aoiMissing,
    }
  }

  return runWindowed(recipe, instance, scope, p)
}

/** Raw finalize output for the recipe — no projection. Used by scanner batch path. */
export function runRaw(recipe: MetricRecipe<any, any>, instance: MetricInstance, scope: Scope): number[] {
  return runSingleWindow(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
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

// ─── Windowed dispatch ────────────────────────────────────────────────────────

function runWindowed(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  p: WindowedProjection,
): ProjectedResult {
  return recipe.windowUnit === 'fixations'
    ? runFixationWindowed(recipe, instance, scope, p)
    : runTimeWindowed(recipe, instance, scope, p)
}

function runTimeWindowed(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  p: WindowedProjection,
): ProjectedResult {
  const { window, inner } = p
  const tStart = scope.timeStart ?? 0
  const tEnd = scope.timeEnd ?? 0
  if (tEnd <= tStart) return { shape: 'scalar-timeseries', values: [], aoiMissing: false, timeline: [] }

  const step = window.mode === 'epoch' ? window.windowSize : (window.stepSize ?? window.windowSize)
  const values: number[] = []
  const timeline: number[] = []
  const aoiNames = getAoiNames(scope)
  let aoiMissing = false

  for (let wStart = tStart; wStart + window.windowSize <= tEnd; wStart += step) {
    const raw = runSingleWindow(recipe, instance, scope, wStart, wStart + window.windowSize)
    const out = applyProjection(inner, { aoiNames, rawValues: raw })
    if (out.aoiMissing) aoiMissing = true
    values.push(out.values[0] ?? Number.NaN)
    timeline.push(wStart)
  }
  return { shape: 'scalar-timeseries', values, aoiMissing, timeline }
}

function runFixationWindowed(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  p: WindowedProjection,
): ProjectedResult {
  // Fixation-windowed recipes slice the accumulator directly. The inner leaf
  // must be identity-scalar (enforced by registry + validator), so the per-window
  // scalar is just `windowedFinalize(acc, from, to)` wrapped into ApplyResult.
  if (!recipe.windowedFinalize) {
    throw new Error(`[metrics] recipe ${recipe.id} uses windowUnit 'fixations' but defines no windowedFinalize hook`)
  }
  // Registry guarantees: wrapper's inner is always scalar, and fixation-windowed
  // recipes have rawShape === 'scalar'. Only identity-scalar is compatible.
  if (p.inner.kind !== 'identity-scalar') {
    throw new Error(`[metrics] fixation-windowed recipe ${recipe.id} requires identity-scalar inner, got ${p.inner.kind}`)
  }

  const out = scanAccumulator(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
  if (!out) return { shape: 'scalar-timeseries', values: [], aoiMissing: false, timeline: [] }
  const acc: any = out.acc
  const seq: number[] | undefined = acc?.seq
  if (!Array.isArray(seq)) {
    throw new Error(`[metrics] recipe ${recipe.id} with windowUnit 'fixations' must accumulate into { seq: number[] }`)
  }

  const N = seq.length
  const { mode, windowSize, stepSize } = p.window
  const step = mode === 'epoch' ? windowSize : (stepSize ?? 1)
  if (N < windowSize) return { shape: 'scalar-timeseries', values: [], aoiMissing: false, timeline: [] }

  const values: number[] = []
  const timeline: number[] = []
  const ctx = { params: out.params, slots: out.slots }
  for (let start = 0; start + windowSize <= N; start += step) {
    values.push(recipe.windowedFinalize!(out.acc, start, start + windowSize, ctx))
    timeline.push(start)
  }
  return { shape: 'scalar-timeseries', values, aoiMissing: false, timeline }
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
      // Dedupe so recipes testing `slots.length === 1` (e.g. RQA's
      // single-AOI filter) and counters iterating slots treat a fixation
      // tagged by multiple raw IDs that map to the same AOI slot as a
      // single labelled fixation, matching extractFixationSequence.
      if (slot !== undefined && resolvedSlots.indexOf(slot) === -1) resolvedSlots.push(slot)
    }

    recipe.onFixation(acc, { start, duration: end - start, slots: resolvedSlots, index }, ctx)
    index++
  }
  return { acc, slots, params }
}

function getAoiNames(scope: Scope): string[] {
  try {
    return getAois(scope.engine, scope.stimulusId).map(a => a.displayedName)
  } catch {
    return []
  }
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

// Re-export PROJECTION_LEAVES and leafOf so runtime consumers can peek.
export { PROJECTION_LEAVES, leafOf }
export type { Projection }
