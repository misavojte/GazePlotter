import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { type BinaryBufferReader, SEGMENT_STRIDE, SegmentField } from '$lib/data/binary'
import { getAois, getParticipantEndTime } from '$lib/data/engine'
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
import { fillWindowFrame } from './dsl'
import type { AoiSlotInfo, FixationEvent, GroupAggregation, GroupScope, MetricRecipe, OutputShape, WindowFrame } from './dsl'
import type { MetricInstance } from '../instances'

export interface Scope {
  engine: DataEngine
  stimulusId: number
  participantId: number
  timeStart?: number
  timeEnd?: number
}

/**
 * Metric result cache.
 *
 * Keyed by the underlying `BinaryBufferReader` rather than the `DataEngine`
 * instance: `DataEngine.loadDataset` builds a fresh reader on every reload,
 * so the WeakMap bucket from the prior dataset becomes unreachable and is
 * GC'd. This means a workspace switch (e.g. demo → real data) can no longer
 * serve stale results from the previous dataset.
 *
 * The string cache key additionally includes `AoiGroupReader.version`, which
 * bumps on every `updateMap()` call (visibility toggles, AOI renames that
 * affect grouping). That way in-place AOI mutations that keep the same
 * reader also invalidate dependent entries without needing explicit
 * `clearCache()` plumbing at every call site.
 */
const _cache = new WeakMap<BinaryBufferReader, Map<string, number[]>>()

/** Shared placeholder for a reused ApplyContext's `rawValues` (always overwritten before use). */
const EMPTY_NUMBER_ARRAY: number[] = []

/**
 * Scalar / vector / matrix result for a single metric instance over a scope.
 * `timeline` is populated for both timeseries shapes and contains window
 * start times (ms for time-windowed, fixation indices for fixation-windowed).
 * `vectors` is populated only when `shape === 'aoi-vector-timeseries'` and
 * carries one aoi-vector per window (window-major, AOI-minor).
 *
 * `slots` is the authoritative `AoiSlotInfo` for the result's stimulus —
 * built once via `buildAoiSlots` and threaded through both the leaf and
 * windowed paths so downstream consumers (e.g. `wrapProjectedResult`,
 * plot transformers) never have to reconstruct slot indices from vector
 * lengths. Always present when the result is non-null.
 */
export interface ProjectedResult {
  shape: OutputShape
  values: number[]
  vectors?: number[][]
  slots: AoiSlotInfo
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
  // Group-shape recipes have no per-participant scan trio. queryGroup owns
  // their entry point via recipe.scanGroup; per-participant calls return null.
  if (recipe.rawShape === 'participant-pair-matrix') return null
  // Build slots once here; thread through every branch so the result has
  // an authoritative `AoiSlotInfo` and downstream code never reconstructs
  // it from vector length.
  const slots = buildAoiSlots(scope.engine, scope.stimulusId)
  if (!slots) return null
  const p = instance.projection

  if (p.kind !== 'windowed') {
    const raw = runSingleWindow(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
    const out = applyProjection(p, { aoiNames: getAoiNames(scope), rawValues: raw })
    return {
      shape: projectionOutputShape(p),
      values: out.values,
      slots,
      aoiMissing: out.aoiMissing,
    }
  }

  return runWindowed(recipe, instance, scope, p, slots)
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
  if (!recipe.individuals || !recipe.finalize) return []
  const out = scanAccumulator(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
  if (!out) return []
  // finalize may flush pending state (e.g., visitDuration's activeDwells) before
  // individuals inspects the accumulator.
  recipe.finalize(out.acc, out.slots, { params: out.params, slots: out.slots })
  return recipe.individuals(out.acc, slotIndex)
}

/**
 * Per-fixation individual values for EVERY slot from a SINGLE participant scan.
 *
 * `runIndividuals` re-scans the participant for each slot it is asked about, so
 * a caller iterating slots (the AOI-comparison bar plot) pays one full fixation
 * scan per (slot × participant) — and unlike the aggregate `query` path it is
 * uncached, so a per-fixation metric with an `individuals` recipe (e.g. "Was
 * fixated") stalls on large datasets. The accumulator is identical for every
 * slot (one scan fills all slots), so scan + finalize once and read each slot
 * out of the shared accumulator. Returns `null` for recipes without an
 * individuals/finalize pair (the caller falls back to the cached aggregate).
 */
export function runIndividualsAllSlots(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
): number[][] | null {
  if (!recipe.individuals || !recipe.finalize) return null
  const out = scanAccumulator(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
  if (!out) return null
  recipe.finalize(out.acc, out.slots, { params: out.params, slots: out.slots })
  const total = out.slots.totalSlots
  const perSlot: number[][] = new Array(total)
  for (let s = 0; s < total; s++) perSlot[s] = recipe.individuals(out.acc, s)
  return perSlot
}

// ─── Windowed dispatch ────────────────────────────────────────────────────────

function runWindowed(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  p: WindowedProjection,
  slots: AoiSlotInfo,
): ProjectedResult {
  return recipe.windowUnit === 'fixations'
    ? runFixationWindowed(recipe, instance, scope, p, slots)
    : runTimeWindowed(recipe, instance, scope, p, slots)
}

/**
 * Time-windowed projection over one participant.
 *
 * Single-scan fan-out: the participant's fixations are read from the binary
 * reader ONCE, resolved to AOI slots ONCE, and each resolved fixation is
 * dispatched to every window it overlaps — instead of re-scanning (and
 * re-resolving slots) per window. Equivalent to running an isolated
 * `scanAccumulator` per window: each window keeps its own accumulator, sees
 * the same fixations in time order, with the same per-window {@link WindowFrame}
 * (clip + midpoint) and the same per-window fixation index. Output is therefore
 * bit-identical to the former per-window loop, but the cost drops from
 * `windows × fixationsPerWindow` to `fixations × overlapFactor`
 * (`overlapFactor = windowSize / stepSize`, 1 for non-overlapping epochs), with
 * the heavy AOI resolution paid once per fixation rather than once per window.
 *
 * `runFixationWindowed` already single-scans (into `acc.seq`); only the
 * time-windowed path carried the redundant rescan.
 */
function runTimeWindowed(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  p: WindowedProjection,
  slots: AoiSlotInfo,
): ProjectedResult {
  const { window, inner } = p
  const tStart = scope.timeStart ?? 0
  const tEnd = scope.timeEnd ?? 0
  const isVector = PROJECTION_LEAVES[inner.kind].outputShape === 'aoi-vector'
  const outShape: OutputShape = isVector ? 'aoi-vector-timeseries' : 'scalar-timeseries'
  const empty = (): ProjectedResult =>
    isVector
      ? { shape: outShape, values: [], vectors: [], slots, aoiMissing: false, timeline: [] }
      : { shape: outShape, values: [], slots, aoiMissing: false, timeline: [] }

  if (tEnd <= tStart) return empty()
  // No per-participant trio → nothing to scan (group-shape recipes never reach here).
  if (!recipe.init || !recipe.onFixation || !recipe.finalize) return empty()

  const windowSize = window.windowSize
  const step = window.stepSize > 0 ? window.stepSize : windowSize

  // Timeline: window start times that fully fit within the scope.
  const timeline: number[] = []
  for (let wStart = tStart; wStart + windowSize <= tEnd; wStart += step) {
    timeline.push(wStart)
  }
  const W = timeline.length
  if (W === 0) return empty()

  // Resolved slots (reader + AOI lookup) built ONCE per participant, the
  // redundancy the former per-window `scanAccumulator` paid every window.
  const resolved = buildAoiSlots(scope.engine, scope.stimulusId)
  if (!resolved) return empty()

  // Resolve params once. Window accumulators are created LAZILY when the scan
  // reaches a window and FINALIZED + FREED the instant the scan cursor passes
  // the window's end — so at most ~overlapFactor (windowSize/stepSize) live at
  // once, never all W. Holding all W alive was a heap blow-up on huge datasets:
  // one heavyweight accumulator (visitDuration keeps per-AOI dwell lists, Maps,
  // Sets) times tens of thousands of windows reached ~1 GB.
  const params = resolveParams(recipe.params, instance.params)
  const ctx = { params, slots }
  const init = recipe.init
  const onFixation = recipe.onFixation
  const finalize = recipe.finalize
  const aoiNames = getAoiNames(scope)

  // accs[w] holds an accumulator only while window w is open (sparse).
  const accs: any[] = new Array(W)
  // Per-window fixation ordinal — matches the `index` an isolated per-window
  // scan would assign (0-based, in time order, over that window's fixations).
  const indices = new Int32Array(W)
  const values: number[] = isVector ? [] : new Array(W)
  const vectors: number[][] = isVector ? new Array(W) : []
  let aoiMissing = false
  let nextClose = 0

  // Identity leaves (`identity-aoi-vector` / `identity-scalar`) pass the recipe's
  // finalize output straight through, so we use it directly and skip the
  // `applyProjection` call + its `ApplyContext` literal + the copy it returns.
  // Non-identity leaves reduce/reshape; they reuse one `ApplyContext` object.
  const isIdentity = inner.kind === 'identity-aoi-vector' || inner.kind === 'identity-scalar'
  const projCtx = { aoiNames, rawValues: EMPTY_NUMBER_ARRAY }

  const finalizeWindow = (w: number): void => {
    // Untouched window (no fixation landed in it) → finalize a fresh empty acc,
    // the same result the former per-window scan produced for an empty range.
    const acc = accs[w] ?? init(ctx)
    const raw = finalize(acc, slots, ctx)
    accs[w] = undefined // free the accumulator and anything it retained
    if (isIdentity) {
      if (isVector) vectors[w] = raw
      else values[w] = raw[0] ?? Number.NaN
      return
    }
    projCtx.rawValues = raw
    const out = applyProjection(inner, projCtx)
    if (out.aoiMissing) aoiMissing = true
    if (isVector) vectors[w] = out.values
    else values[w] = out.values[0] ?? Number.NaN
  }

  // Single pass over the participant's fixations.
  const { reader, hiddenAoisSet, aoiLookup } = resolved
  const { startIndex: fStart, endIndex: fEnd } = reader.getFixationRange(
    scope.stimulusId,
    scope.participantId,
  )
  const segBuf = reader.segmentBufferRaw
  const aoiPool = reader.aoiPoolRaw
  const stim = scope.stimulusId
  const engine = scope.engine
  const resolvedSlots: number[] = []

  // Reused across every (fixation, window) dispatch — no per-dispatch
  // allocation. onFixation reads these synchronously and never retains them
  // (same invariant that lets `resolvedSlots` be shared). On a huge dataset
  // with heavy window overlap this is the difference between millions of
  // short-lived frame/event objects (GC churn) and none.
  const frame: WindowFrame = {
    windowStart: 0,
    windowEnd: 0,
    start: 0,
    end: 0,
    duration: 0,
    isClipped: false,
    midpointInWindow: true,
  }
  const fixEvent: FixationEvent = {
    start: 0,
    duration: 0,
    frame,
    slots: resolvedSlots,
    index: 0,
  }

  for (let k = fStart; k < fEnd; k++) {
    const i = reader.getFixationSegmentIndex(k)
    const base = i * SEGMENT_STRIDE
    const start = segBuf[base + SegmentField.START_TIME]
    const end = segBuf[base + SegmentField.END_TIME]
    // Fixations are time-ordered by start; once past the scope none can overlap.
    if (start >= tEnd) break
    if (end <= tStart) continue

    // Sweep: close every window the cursor has passed. `start` only grows, so a
    // window with `wEnd <= start` can receive no further fixation → finalize+free.
    while (nextClose < W && timeline[nextClose] + windowSize <= start) {
      finalizeWindow(nextClose)
      nextClose++
    }

    // Resolve AOI slots ONCE; reused across every window this fixation hits.
    resolvedSlots.length = 0
    const aoiCount = segBuf[base + SegmentField.AOI_COUNT] | 0
    const aoiPtr = segBuf[base + SegmentField.AOI_POINTER] | 0
    for (let r = 0; r < aoiCount; r++) {
      const rawId = aoiPool[aoiPtr + r]
      if (hiddenAoisSet?.has(rawId)) continue
      const slot = aoiLookup.get(engine.getAoiMapping(stim, rawId))
      if (slot !== undefined && resolvedSlots.indexOf(slot) === -1) resolvedSlots.push(slot)
    }

    const duration = end - start
    fixEvent.start = start
    fixEvent.duration = duration
    // Overlapping window range. A fixation overlaps window w iff
    // `start < timeline[w] + windowSize && end > timeline[w]`. Compute a
    // superset range arithmetically, then trim both edges with the exact
    // predicate (robust to float ms); the satisfying windows are contiguous
    // since timeline[w] is monotonic.
    let wLo = Math.floor((start - windowSize - tStart) / step)
    let wHi = Math.ceil((end - tStart) / step)
    // Lower edge never precedes `nextClose` — those windows are already closed.
    if (wLo < nextClose) wLo = nextClose
    if (wHi > W - 1) wHi = W - 1
    while (wLo <= wHi && !(start < timeline[wLo] + windowSize && end > timeline[wLo])) wLo++
    while (wHi >= wLo && !(start < timeline[wHi] + windowSize && end > timeline[wHi])) wHi--

    const mid = start + duration * 0.5
    for (let w = wLo; w <= wHi; w++) {
      let acc = accs[w]
      if (acc === undefined) acc = accs[w] = init(ctx)
      const wStart = timeline[w]
      const wEnd = wStart + windowSize
      // Inlined `fillWindowFrame` (bounded case — windowed scope is always
      // bounded) to avoid a call per dispatch in the hot loop.
      const fStartClip = start > wStart ? start : wStart
      const fEndClip = end < wEnd ? end : wEnd
      frame.windowStart = wStart
      frame.windowEnd = wEnd
      frame.start = fStartClip
      frame.end = fEndClip
      frame.duration = fEndClip - fStartClip
      frame.isClipped = start < wStart || end > wEnd
      frame.midpointInWindow = mid >= wStart && mid < wEnd
      fixEvent.index = indices[w]++
      onFixation(acc, fixEvent, ctx)
    }
  }

  // Finalize every window still open after the last fixation (incl. trailing gaps).
  while (nextClose < W) {
    finalizeWindow(nextClose)
    nextClose++
  }

  return isVector
    ? { shape: outShape, values: [], vectors, slots, aoiMissing, timeline }
    : { shape: outShape, values, slots, aoiMissing, timeline }
}

function runFixationWindowed(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  p: WindowedProjection,
  slots: AoiSlotInfo,
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
  if (!out) return { shape: 'scalar-timeseries', values: [], slots, aoiMissing: false, timeline: [] }
  const acc: any = out.acc
  const seq: number[] | undefined = acc?.seq
  if (!Array.isArray(seq)) {
    throw new Error(`[metrics] recipe ${recipe.id} with windowUnit 'fixations' must accumulate into { seq: number[] }`)
  }

  const N = seq.length
  const { windowSize, stepSize } = p.window
  const step = stepSize
  if (N < windowSize) return { shape: 'scalar-timeseries', values: [], slots, aoiMissing: false, timeline: [] }

  const values: number[] = []
  const timeline: number[] = []
  const ctx = { params: out.params, slots: out.slots }
  for (let start = 0; start + windowSize <= N; start += step) {
    values.push(recipe.windowedFinalize!(out.acc, start, start + windowSize, ctx))
    timeline.push(start)
  }
  return { shape: 'scalar-timeseries', values, slots, aoiMissing: false, timeline }
}

// ─── Group-aggregated windowed dispatch ──────────────────────────────────────

/**
 * Aggregate a windowed projection across all participants in a `GroupScope`,
 * per the recipe's `groupAggregation` (mean / median / sum). Returns a single
 * timeseries shape — `aoi-vector-timeseries` when the inner leaf emits
 * aoi-vector, `scalar-timeseries` when it emits scalar — matching the
 * per-participant `query()` output shapes so consumers don't need a separate
 * code path.
 *
 * Algorithm:
 *   1. Resolve a canonical time range from `group.{timeStart,timeEnd}`,
 *      falling back to `[0, max participant end]` when bounds are absent.
 *   2. Generate the timeline once from the projection's window/step.
 *   3. Per participant, run `runTimeWindowed` over the canonical range
 *      clamped to that participant's own data-end (`min(tEnd, participantEnd)`),
 *      collecting per-cell values (window × slot for vector, window for
 *      scalar). Participants whose data ends earlier produce shorter
 *      timeseries; their absent trailing windows are simply skipped by the
 *      per-cell gather (rather than synthesised as a misleading 0), so each
 *      window is reduced only over the participants present there.
 *   4. Per (window[, slot]) cell, drop NaNs and apply `reduceFinite` with
 *      the recipe's `groupAggregation` (or `mean` if the recipe's
 *      `groupAggregationGuard` rejects the requested method).
 *
 * Caller-side: `query.ts:queryGroup` dispatches windowed projections here
 * instead of the legacy "first participant only" placeholder.
 */
export function runWindowedGroup(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  group: GroupScope,
  p: WindowedProjection,
  method: GroupAggregation,
  reduce: (values: readonly number[], method: GroupAggregation) => number,
): ProjectedResult | null {
  const slots = buildAoiSlots(group.engine, group.stimulusId)
  if (!slots) return null

  const isVector = PROJECTION_LEAVES[p.inner.kind].outputShape === 'aoi-vector'
  const outShape: OutputShape = isVector ? 'aoi-vector-timeseries' : 'scalar-timeseries'

  // Recipe-level last-ditch guard: if the requested aggregation is
  // scientifically incoherent for this projection (e.g. `sum` over a
  // windowed `relativeTime`), fall back to `mean`. UI/validator usually
  // catches this upstream; stale workspaces could still trip it here.
  const guardReason = recipe.groupAggregationGuard?.(p, method)
  const effectiveMethod = guardReason ? 'mean' : method

  // Canonical time range. Explicit group bounds win; otherwise the union
  // of participants' data spans [0, max participant end].
  const tStart = group.timeStart ?? 0
  let tEnd = group.timeEnd ?? 0
  if (!(tEnd > tStart)) {
    let maxEnd = 0
    for (const pid of group.participantIds) {
      const pe = getParticipantEndTime(group.engine, group.stimulusId, pid)
      if (pe > maxEnd) maxEnd = pe
    }
    tEnd = maxEnd
  }
  if (tEnd <= tStart) {
    return isVector
      ? { shape: outShape, values: [], vectors: [], slots, aoiMissing: false, timeline: [] }
      : { shape: outShape, values: [], slots, aoiMissing: false, timeline: [] }
  }

  const { window } = p
  const timeline: number[] = []
  for (let wStart = tStart; wStart + window.windowSize <= tEnd; wStart += window.stepSize) {
    timeline.push(wStart)
  }
  const W = timeline.length

  const stride = isVector ? slots.totalSlots : 1

  // Cross-participant reduction is STREAMING for mean / sum / proportion: each
  // participant's windowed result folds into flat typed sufficient-statistics
  // (sum + finite-count per window·slot) and is then discarded. Peak memory is
  // O(W·slots), not O(P·W·slots) — the former retained `number[][][]` for every
  // participant was the ~500 MB / GC blow-up on huge datasets. `median` needs
  // the full per-cell sample, so it keeps the collect path (currently
  // unreachable: no windowable metric declares `median`).
  const streaming = effectiveMethod !== 'median'
  const groupSum = streaming ? new Float64Array(W * stride) : null
  const groupCount = streaming ? new Int32Array(W * stride) : null
  const perPVectors: number[][][] = []
  const perPValues: number[][] = []
  let aoiMissing = false

  for (const pid of group.participantIds) {
    // Clamp each participant's window range to their own recording end.
    // `runTimeWindowed` only emits windows that fully fit within the scope, so
    // without this clamp a participant whose data ends before `tEnd` still gets
    // windows synthesised past their last fixation — and those empty windows
    // finalize to a real 0 (counts, dwell) or 0% (relativeTime), not NaN, so
    // they would drag the group mean toward zero in the tail. Clamping drops
    // them (a shorter per-participant array → no contribution at trailing
    // windows, so `groupCount` stays lower there and each window is reduced
    // only over participants present in it). `getParticipantEndTime` is O(1).
    const pEnd = getParticipantEndTime(group.engine, group.stimulusId, pid)
    const scope: Scope = {
      engine: group.engine,
      stimulusId: group.stimulusId,
      participantId: pid,
      timeStart: tStart,
      timeEnd: Math.min(tEnd, pEnd),
    }
    const r = runTimeWindowed(recipe, instance, scope, p, slots)
    if (r.aoiMissing) aoiMissing = true

    if (!streaming) {
      if (isVector) perPVectors.push(r.vectors ?? [])
      else perPValues.push(r.values ?? [])
      continue
    }

    // Fold this participant into the typed sufficient-statistics, then drop it.
    if (isVector) {
      const vs = r.vectors ?? []
      const wMax = Math.min(vs.length, W)
      for (let w = 0; w < wMax; w++) {
        const row = vs[w]
        const base = w * stride
        for (let s = 0; s < stride; s++) {
          const x = row[s]
          if (Number.isFinite(x)) {
            groupSum![base + s] += x
            groupCount![base + s]++
          }
        }
      }
    } else {
      const vals = r.values ?? []
      const wMax = Math.min(vals.length, W)
      for (let w = 0; w < wMax; w++) {
        const x = vals[w]
        if (Number.isFinite(x)) {
          groupSum![w] += x
          groupCount![w]++
        }
      }
    }
  }

  // Finalize. mean/proportion = sum/count, sum = sum, NaN when count 0 — the
  // exact result `reduceFinite` produces over the same finite values per cell.
  if (streaming) {
    const isSum = effectiveMethod === 'sum'
    if (isVector) {
      const vectors: number[][] = new Array(W)
      for (let w = 0; w < W; w++) {
        const v = new Array<number>(stride)
        const base = w * stride
        for (let s = 0; s < stride; s++) {
          const c = groupCount![base + s]
          v[s] = c === 0 ? Number.NaN : isSum ? groupSum![base + s] : groupSum![base + s] / c
        }
        vectors[w] = v
      }
      return { shape: outShape, values: [], vectors, slots, aoiMissing, timeline }
    }
    const values = new Array<number>(W)
    for (let w = 0; w < W; w++) {
      const c = groupCount![w]
      values[w] = c === 0 ? Number.NaN : isSum ? groupSum![w] : groupSum![w] / c
    }
    return { shape: outShape, values, slots, aoiMissing, timeline }
  }

  // median fallback: per-cell reduce over the collected per-participant sample.
  if (isVector) {
    const vectors: number[][] = new Array(W)
    const cell: number[] = []
    for (let w = 0; w < W; w++) {
      const v: number[] = new Array(slots.totalSlots).fill(Number.NaN)
      for (let s = 0; s < slots.totalSlots; s++) {
        cell.length = 0
        for (const pv of perPVectors) {
          const x = pv[w]?.[s]
          if (typeof x === 'number') cell.push(x)
        }
        v[s] = reduce(cell, effectiveMethod)
      }
      vectors[w] = v
    }
    return { shape: outShape, values: [], vectors, slots, aoiMissing, timeline }
  }
  const values: number[] = new Array(W).fill(Number.NaN)
  const cell: number[] = []
  for (let w = 0; w < W; w++) {
    cell.length = 0
    for (const pv of perPValues) {
      const x = pv[w]
      if (typeof x === 'number') cell.push(x)
    }
    values[w] = reduce(cell, effectiveMethod)
  }
  return { shape: outShape, values, slots, aoiMissing, timeline }
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
  if (!recipe.finalize) return []
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
  // Per-participant scan trio. Group-shape recipes (participant-pair-matrix)
  // never reach here — runProjected and queryBatch filter them upstream.
  if (!recipe.init || !recipe.onFixation) return null
  const slots = buildAoiSlots(scope.engine, scope.stimulusId)
  if (!slots) return null
  const params = resolveParams(recipe.params, instance.params)
  const ctx = { params, slots }
  const acc = recipe.init(ctx)

  const { reader, hiddenAoisSet, aoiLookup } = slots
  const { startIndex: fStart, endIndex: fEnd } = reader.getFixationRange(
    scope.stimulusId,
    scope.participantId,
  )
  const segBuf = reader.segmentBufferRaw
  const aoiPool = reader.aoiPoolRaw
  const stim = scope.stimulusId
  const engine = scope.engine
  const resolvedSlots: number[] = []

  // Reused across every fixation — no per-fixation allocation. onFixation reads
  // these synchronously and never retains them (same invariant as resolvedSlots
  // and the windowed driver above). Re-deriving a per-fixation metric over a
  // huge dataset (e.g. switching to "Was fixated") otherwise allocates a fresh
  // frame + event object per fixation — millions of short-lived objects, which
  // dominated the scan in profiling.
  const frame: WindowFrame = {
    windowStart: 0,
    windowEnd: 0,
    start: 0,
    end: 0,
    duration: 0,
    isClipped: false,
    midpointInWindow: true,
  }
  const fixEvent: FixationEvent = {
    start: 0,
    duration: 0,
    frame,
    slots: resolvedSlots,
    index: 0,
  }
  let index = 0

  for (let k = fStart; k < fEnd; k++) {
    const i = reader.getFixationSegmentIndex(k)
    const base = i * SEGMENT_STRIDE
    // `fixationIndex` is guaranteed category-0 by construction — no filter here.
    const start = segBuf[base + SegmentField.START_TIME]
    const end = segBuf[base + SegmentField.END_TIME]
    if (timeEnd > 0 && start >= timeEnd) break
    if (end <= timeStart) continue

    resolvedSlots.length = 0
    const aoiCount = segBuf[base + SegmentField.AOI_COUNT] | 0
    const aoiPtr = segBuf[base + SegmentField.AOI_POINTER] | 0
    for (let r = 0; r < aoiCount; r++) {
      const rawId = aoiPool[aoiPtr + r]
      if (hiddenAoisSet?.has(rawId)) continue
      const slot = aoiLookup.get(engine.getAoiMapping(stim, rawId))
      // Dedupe so recipes testing `slots.length === 1` (e.g. RQA's
      // single-AOI filter) and counters iterating slots treat a fixation
      // tagged by multiple raw IDs that map to the same AOI slot as a
      // single labelled fixation, matching extractFixationSequence.
      if (slot !== undefined && resolvedSlots.indexOf(slot) === -1) resolvedSlots.push(slot)
    }

    const duration = end - start
    fillWindowFrame(frame, start, end, duration, timeStart, timeEnd)
    fixEvent.start = start
    fixEvent.duration = duration
    fixEvent.index = index
    recipe.onFixation(acc, fixEvent, ctx)
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

function cacheKey(engine: DataEngine, instance: MetricInstance, scope: Scope, tStart: number, tEnd: number): string {
  const p = paramsKey(instance.params)
  const v = engine.getAoiGroupReader?.()?.version ?? 0
  return `v${v}|${instance.baseId}|${p}|${scope.stimulusId}|${scope.participantId}|${tStart}|${tEnd}`
}

function paramsKey(params: Record<string, unknown> | undefined): string {
  if (!params) return ''
  const keys = Object.keys(params).sort()
  return keys.map(k => `${k}=${String(params[k])}`).join(',')
}

function cacheGet(engine: DataEngine, scope: Scope, instance: MetricInstance, tStart: number, tEnd: number): number[] | undefined {
  const reader = engine.getReader()
  if (!reader) return undefined
  const map = _cache.get(reader)
  if (!map) return undefined
  return map.get(cacheKey(engine, instance, scope, tStart, tEnd))
}

function cacheSet(engine: DataEngine, scope: Scope, instance: MetricInstance, tStart: number, tEnd: number, value: number[]): void {
  const reader = engine.getReader()
  if (!reader) return
  let map = _cache.get(reader)
  if (!map) { map = new Map(); _cache.set(reader, map) }
  map.set(cacheKey(engine, instance, scope, tStart, tEnd), value)
}

// Re-export PROJECTION_LEAVES and leafOf so runtime consumers can peek.
export { PROJECTION_LEAVES, leafOf }
export type { Projection }
