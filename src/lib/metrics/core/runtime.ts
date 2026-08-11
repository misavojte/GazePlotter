import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { type BinaryBufferReader, SEGMENT_STRIDE, SegmentField } from '$lib/data/binary'
import { getAois, getParticipantEndTime } from '$lib/data/engine'
import { buildAoiSlots } from './aoiSlots'
import {
  categoryCacheToken,
  categoryGroupNames,
  resolveScanIndex,
} from './categoryScan'
import { resolveParams } from './params'
import { getRecipe } from './defineMetric'
import {
  applyProjection,
  leafOf,
  PROJECTION_LEAVES,
  projectionCacheKey,
  projectionOutputShape,
  projectionSummaryStatistic,
  type Projection,
  type WindowedProjection,
} from './projection'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import { fillWindowFrame } from './dsl'
import type { AoiSlotInfo, FixationEvent, GroupScope, InitCtx, MetricRecipe, OutputShape, WindowFrame } from './dsl'
import type { GroupReduction } from './measurement'
import type { MetricInstance } from '../instances'

/**
 * Naming convention in this module:
 * - `run*`     — public entry points; may answer from the result cache.
 * - `compute*` — pure computation, always executes; never touches the cache.
 * - `scan*`    — one pass over a participant's fixation segments.
 * - `cache*`   — result-cache access (see `_resultCache`).
 */
export interface Scope {
  engine: DataEngine
  stimulusId: number
  participantId: number
  timeStart?: number
  timeEnd?: number
  /**
   * Per-plot AOI SELECTION id, threaded into every buildAoiSlots /
   * getAoiNames / slot-signature below so the plot's reduced alphabet drives
   * its numbers. Out-of-selection AOI fixations resolve to no-AOI
   * (compute-honest). `undefined` → all AOIs.
   */
  aoiSelectionId?: number
}

/**
 * Metric result cache.
 *
 * Keyed by the `BinaryBufferReader`, not the `DataEngine`: `loadDataset`
 * builds a fresh reader per reload, so the prior dataset's bucket becomes
 * unreachable and a workspace switch cannot serve stale results.
 *
 * Each bucket is versioned by `AoiGroupReader.version` — the STRUCTURAL
 * version, which bumps when grouping or visibility changes. Cosmetic AOI edits
 * deliberately do NOT reset it (a color-only save keeps every entry, pinned by
 * tests).
 *
 * Two things the structural version cannot see ride in the cache KEY as slot
 * signatures instead: slot ORDER (a pure reorder bumps nothing structural) and,
 * for windowed results, AOI display NAMES (inner leaves resolve AoiRefs by
 * name). Participant/stimulus edits change neither, so re-deriving every plot
 * after a participant rename is answered entirely from cache.
 */
type MetricCacheBucket = { version: number; map: Map<string, unknown> }
const _resultCache = new WeakMap<BinaryBufferReader, MetricCacheBucket>()

function cacheMapFor(engine: DataEngine): Map<string, unknown> | null {
  const reader = engine.getReader()
  if (!reader) return null
  const version = engine.getAoiGroupReader?.()?.version ?? 0
  let bucket = _resultCache.get(reader)
  if (!bucket || bucket.version !== version) {
    bucket = { version, map: new Map() }
    _resultCache.set(reader, bucket)
  }
  return bucket.map
}

/**
 * Memoized on the frozen array `getAois` returns: that reference is stable per
 * (reader, stimulus, appearanceVersion) and swaps on every AOI edit, so the
 * array identity IS the invalidation token and the strings are built once per
 * edit rather than once per query.
 */
type SlotSignatures = { order: string; names: string }
const EMPTY_SIGNATURES: SlotSignatures = { order: '', names: '' }
const _signatureCache = new WeakMap<
  readonly ExtendedInterpretedDataType[],
  SlotSignatures
>()

function slotSignatures(
  engine: DataEngine,
  stimulusId: number,
  aoiSelectionId?: number
): SlotSignatures {
  let aois: readonly ExtendedInterpretedDataType[]
  try {
    aois = getAois(engine, stimulusId, aoiSelectionId)
  } catch {
    return EMPTY_SIGNATURES
  }
  let sig = _signatureCache.get(aois)
  if (!sig) {
    sig = {
      order: aois.map(a => a.id).join('.'),
      names: aois.map(a => a.displayedName).join('\x1f'),
    }
    _signatureCache.set(aois, sig)
  }
  return sig
}

/** Shared placeholder for a reused ApplyContext's `rawValues` (always overwritten before use). */
const EMPTY_NUMBER_ARRAY: number[] = []

/**
 * Scalar / vector / matrix result for one metric instance over a scope.
 * `timeline` holds window start times (ms, or fixation indices when
 * fixation-windowed). `vectors` is populated only for
 * `aoi-vector-timeseries`: one aoi-vector per window, window-major.
 *
 * `slots` is built once and threaded through both paths, so no downstream
 * consumer reconstructs slot indices from vector lengths.
 */
export interface ProjectedResult {
  shape: OutputShape
  values: number[]
  vectors?: number[][]
  slots: AoiSlotInfo
  refMissing: boolean
  timeline?: number[]
}

/**
 * Apply a LEAF projection to one finalize output and wrap it — the single
 * declaration of which `ApplyContext` a recipe gets (`categoryNames` exactly
 * when its raw shape is `category-vector`) and how applied values become a
 * result. Shared by `runProjected`, `queryBatch`, and `queryGroup`.
 *
 * The windowed drivers do NOT use this: they re-point one reused
 * `ApplyContext` per window instead of constructing one per call.
 */
export function projectLeaf(
  recipe: MetricRecipe<any, any>,
  projection: Projection,
  engine: DataEngine,
  aoiNames: readonly string[],
  rawValues: readonly number[],
  slots: AoiSlotInfo,
): ProjectedResult {
  const applied = applyProjection(projection, {
    aoiNames,
    rawValues,
    ...(recipe.rawShape === 'category-vector'
      ? { categoryNames: categoryGroupNames(engine) }
      : {}),
  })
  return {
    shape: projectionOutputShape(projection),
    values: applied.values,
    slots,
    refMissing: applied.refMissing,
  }
}

/**
 * Run an instance's recipe and apply its projection. Single entry point for
 * consumers; dispatches on projection.kind (leaf vs windowed).
 */
export function runProjected(instance: MetricInstance, scope: Scope): ProjectedResult | null {
  const recipe = getRecipe(instance.baseId)
  if (!recipe) return null
  // Group-shape recipes have no scan trio; queryGroup owns them via scanGroup.
  if (recipe.rawShape === 'participant-pair-matrix') return null
  const slots = buildAoiSlots(scope.engine, scope.stimulusId, scope.aoiSelectionId)
  if (!slots) return null
  const projection = instance.projection

  if (projection.kind !== 'windowed') {
    const raw = runSingleWindow(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
    return projectLeaf(recipe, projection, scope.engine, getAoiNames(scope), raw, slots)
  }

  return runWindowed(recipe, instance, scope, projection, slots)
}

/** Raw finalize output — no projection. Feeds queryGroup's per-participant reduction. */
export function runRaw(recipe: MetricRecipe<any, any>, instance: MetricInstance, scope: Scope): number[] {
  return runSingleWindow(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
}

/**
 * Per-event values for EVERY slot from ONE participant scan. No per-slot
 * variant exists on purpose: it would invite a full rescan per (slot ×
 * participant). `null` for recipes with no `individuals` — the caller falls
 * back to the cached aggregate.
 */
export function runIndividualsAllSlots(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
): number[][] | null {
  if (!recipe.individuals) return null
  const out = scanAccumulator(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
  if (!out) return null
  recipe.flush?.(out.acc, out.ctx.slots)
  return recipe.individuals(out.acc)
}

// ─── Windowed dispatch ────────────────────────────────────────────────────────

/**
 * THE cached entry point for every windowed projection, direct or per
 * participant of a group fold. The most expensive query in the app, so a
 * redraw that didn't touch AOIs is answered entirely from here.
 *
 * Driver choice by `windowUnit`, in ONE place: fixation-windowed recipes slice
 * their accumulated sequence; time-windowed ones take the fused numeric pass
 * when their `accumulation` allows it, the scan trio otherwise.
 */
function runWindowed(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  projection: WindowedProjection,
  slots: AoiSlotInfo,
): ProjectedResult {
  const map = cacheMapFor(scope.engine)
  const key = map ? windowedCacheKey(instance, scope, projection) : ''
  const hit = map?.get(key) as ProjectedResult | undefined
  if (hit) return hit
  const result = freezeProjectedResult(
    recipe.windowUnit === 'fixations'
      ? computeFixationWindowed(recipe, instance, scope, projection, slots)
      : computeTimeWindowedFused(recipe, scope, projection, slots) ??
          computeTimeWindowed(recipe, instance, scope, projection, slots)
  )
  map?.set(key, result)
  return result
}

/**
 * Window starts that FULLY fit within `[tStart, tEnd)` — the invariant,
 * declared once for all three drivers. A partial trailing window is never
 * emitted: its value would rest on less data than every window it is compared
 * against.
 */
function buildTimeline(tStart: number, tEnd: number, windowSize: number, step: number): number[] {
  const timeline: number[] = []
  for (let wStart = tStart; wStart + windowSize <= tEnd; wStart += step) timeline.push(wStart)
  return timeline
}

/**
 * The one place the vector/scalar arms are written. Callers must pass FRESH
 * arrays — results are frozen and cached, never shared between calls.
 */
function timeseriesResult(
  isVector: boolean,
  slots: AoiSlotInfo,
  timeline: number[],
  values: number[],
  vectors: number[][],
  refMissing: boolean,
): ProjectedResult {
  return isVector
    ? { shape: 'aoi-vector-timeseries', values: [], vectors, slots, refMissing, timeline }
    : { shape: 'scalar-timeseries', values, slots, refMissing, timeline }
}

/** Fresh arrays per call (see above). */
function emptyTimeseries(isVector: boolean, slots: AoiSlotInfo): ProjectedResult {
  return timeseriesResult(isVector, slots, [], [], [], false)
}

/**
 * Fused driver for the additive `recipe.accumulation` kinds (see dsl.ts): one
 * flat Float64Array(W × slots) filled in a pure numeric loop, touching no
 * objects per fixation. The slot set is an integer bitmask up to 31 AOI slots
 * (dedupe is a single OR) and a reused scratch array beyond — wide-AOI stimuli
 * keep the fused speed, only the dedupe container changes. Null for 'stateful'
 * recipes, which fall through to the general driver.
 */
function computeTimeWindowedFused(
  recipe: MetricRecipe<any, any>,
  scope: Scope,
  projection: WindowedProjection,
  slots: AoiSlotInfo,
): ProjectedResult | null {
  const accumulation = recipe.accumulation
  // Also keeps category-scanning recipes out — they are 'stateful' by
  // registration invariant, so the fixation-index iteration and per-AOI-slot
  // assembly below stay valid without a scan-source branch.
  if (!accumulation || accumulation === 'stateful') return null

  const { window, inner } = projection
  const tStart = scope.timeStart ?? 0
  const tEnd = scope.timeEnd ?? 0
  const isVector = PROJECTION_LEAVES[inner.kind].outputShape === 'aoi-vector'
  const empty = (): ProjectedResult => emptyTimeseries(isVector, slots)

  if (tEnd <= tStart) return empty()
  const resolved = buildAoiSlots(scope.engine, scope.stimulusId, scope.aoiSelectionId)
  if (!resolved) return empty()

  const windowSize = window.windowSize
  const step = window.stepSize > 0 ? window.stepSize : windowSize
  const timeline = buildTimeline(tStart, tEnd, windowSize, step)
  const W = timeline.length
  if (W === 0) return empty()

  const stride = slots.totalSlots
  const anyIdx = slots.anyFixationSlot
  const noIdx = slots.noAoiSlot
  const slotSums = new Float64Array(W * stride)
  const isDurationWeighted = accumulation !== 'midpointCount'
  const ownWindowOnly = recipe.windowMembership === 'own'
  const useBitmask = noIdx <= 31
  const wideSlotScratch: number[] = []

  const { reader, rawToSlot } = resolved
  const { startIndex: fStart, endIndex: fEnd } = reader.getFixationRange(
    scope.stimulusId,
    scope.participantId,
  )
  const segBuf = reader.segmentBufferRaw
  const aoiPool = reader.aoiPoolRaw

  for (let k = fStart; k < fEnd; k++) {
    const i = reader.getFixationSegmentIndex(k)
    const base = i * SEGMENT_STRIDE
    const start = segBuf[base + SegmentField.START_TIME]
    const end = segBuf[base + SegmentField.END_TIME]
    if (start >= tEnd) break
    if (end <= tStart) continue

    // KEEP IN SYNC with scanAccumulator/computeTimeWindowed/scanBatch (pinned
    // by the windowed==oracle suite) — same decode + resolve, with the dedupe
    // collapsed into the bitmask OR.
    let mask = 0
    const aoiCount = segBuf[base + SegmentField.AOI_COUNT] | 0
    const aoiPtr = segBuf[base + SegmentField.AOI_POINTER] | 0
    if (useBitmask) {
      for (let r = 0; r < aoiCount; r++) {
        const slot = rawToSlot[aoiPool[aoiPtr + r]]
        if (slot >= 0) mask |= 1 << slot
      }
    } else {
      wideSlotScratch.length = 0
      for (let r = 0; r < aoiCount; r++) {
        const slot = rawToSlot[aoiPool[aoiPtr + r]]
        if (slot >= 0 && wideSlotScratch.indexOf(slot) === -1) wideSlotScratch.push(slot)
      }
    }

    // Same overlapping-window range math as the general driver.
    let wLo = Math.floor((start - windowSize - tStart) / step)
    let wHi = Math.ceil((end - tStart) / step)
    if (wLo < 0) wLo = 0
    if (wHi > W - 1) wHi = W - 1
    while (wLo <= wHi && !(start < timeline[wLo] + windowSize && end > timeline[wLo])) wLo++
    while (wHi >= wLo && !(start < timeline[wHi] + windowSize && end > timeline[wHi])) wHi--

    const mid = start + (end - start) * 0.5
    for (let w = wLo; w <= wHi; w++) {
      const wStart = timeline[w]
      // The SAME declared membership the general driver enforces, so the two
      // engines cannot drift. Separate axis from the weighting below: membership
      // decides whether the fixation belongs here, weighting decides by how much.
      if (ownWindowOnly && (mid < wStart || mid >= wStart + windowSize)) continue
      let v: number
      if (isDurationWeighted) {
        const s0 = start > wStart ? start : wStart
        const wEnd = wStart + windowSize
        const e0 = end < wEnd ? end : wEnd
        v = e0 - s0
      } else {
        v = 1
      }
      const rowBase = w * stride
      slotSums[rowBase + anyIdx] += v
      if (useBitmask) {
        if (mask === 0) {
          slotSums[rowBase + noIdx] += v
        } else {
          let m = mask
          while (m !== 0) {
            const lsb = m & -m
            slotSums[rowBase + (31 - Math.clz32(lsb))] += v
            m ^= lsb
          }
        }
      } else if (wideSlotScratch.length === 0) {
        slotSums[rowBase + noIdx] += v
      } else {
        for (let s = 0; s < wideSlotScratch.length; s++) slotSums[rowBase + wideSlotScratch[s]] += v
      }
    }
  }

  // Per-window normalize + inner projection, matching the general driver's
  // finalizeWindow semantics exactly.
  const normalize = accumulation === 'clippedDurationShare'
  const isIdentity = inner.kind === 'identity-aoi-vector' || inner.kind === 'identity-scalar'
  const projCtx = { aoiNames: getAoiNames(scope), rawValues: EMPTY_NUMBER_ARRAY }
  const values: number[] = isVector ? [] : new Array(W)
  const vectors: number[][] = isVector ? new Array(W) : []
  let refMissing = false
  const row: number[] = new Array(stride)

  for (let w = 0; w < W; w++) {
    const rowBase = w * stride
    if (normalize) {
      const total = slotSums[rowBase + anyIdx]
      for (let s = 0; s < stride; s++) {
        row[s] = total > 0 ? (slotSums[rowBase + s] / total) * 100 : Number.NaN
      }
    } else {
      for (let s = 0; s < stride; s++) row[s] = slotSums[rowBase + s]
    }
    if (isIdentity) {
      if (isVector) vectors[w] = row.slice()
      else values[w] = row[0] ?? Number.NaN
      continue
    }
    projCtx.rawValues = row
    const out = applyProjection(inner, projCtx)
    if (out.refMissing) refMissing = true
    if (isVector) vectors[w] = out.values
    else values[w] = out.values[0] ?? Number.NaN
  }

  return timeseriesResult(isVector, slots, timeline, values, vectors, refMissing)
}

/**
 * Time-windowed projection over one participant, as a single-scan fan-out:
 * fixations are read and resolved to AOI slots ONCE, then dispatched to every
 * window they overlap. Equivalent to an isolated `scanAccumulator` per window
 * — each window keeps its own accumulator and sees the same fixations in time
 * order, with the same {@link WindowFrame} and per-window fixation index — but
 * costs `fixations × overlapFactor` instead of `windows × fixationsPerWindow`,
 * with the heavy AOI resolution paid once per fixation.
 */
function computeTimeWindowed(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  projection: WindowedProjection,
  slots: AoiSlotInfo,
): ProjectedResult {
  const { window, inner } = projection
  const tStart = scope.timeStart ?? 0
  const tEnd = scope.timeEnd ?? 0
  const isVector = PROJECTION_LEAVES[inner.kind].outputShape === 'aoi-vector'
  const empty = (): ProjectedResult => emptyTimeseries(isVector, slots)

  if (tEnd <= tStart) return empty()
  // No per-participant trio → nothing to scan (group-shape recipes never reach here).
  if (!recipe.init || !recipe.onFixation || !recipe.finalize) return empty()

  const windowSize = window.windowSize
  const step = window.stepSize > 0 ? window.stepSize : windowSize
  const timeline = buildTimeline(tStart, tEnd, windowSize, step)
  const W = timeline.length
  if (W === 0) return empty()

  const resolved = buildAoiSlots(scope.engine, scope.stimulusId, scope.aoiSelectionId)
  if (!resolved) return empty()

  // Window accumulators are created LAZILY on reach and FINALIZED + FREED the
  // instant the cursor passes the window's end, so at most ~overlapFactor live
  // at once, never all W. Holding all W was a ~1 GB heap blow-up (a heavyweight
  // accumulator like visitDuration's × tens of thousands of windows).
  // Every window of a run shares one extent, so scopeDurationMs is a per-scan
  // constant and the one-shared-ctx contract holds.
  const params = resolveParams(recipe.params, instance.params)
  const scan = resolveScanIndex(
    recipe,
    scope.engine,
    resolved.reader,
    scope.stimulusId,
    scope.participantId,
  )
  const ctx = {
    params,
    slots,
    scopeDurationMs: windowSize,
    categorySlotCount: scan.categorySlotCount,
    summaryStatistic: projectionSummaryStatistic(instance.projection),
  }
  const init = recipe.init
  const onFixation = recipe.onFixation
  const finalize = recipe.finalize
  // Hoisted out of the dispatch loop: one boolean test per (fixation, window),
  // and it SKIPS a call rather than adding one.
  const ownWindowOnly = recipe.windowMembership === 'own'
  const aoiNames = getAoiNames(scope)

  // accs[w] holds an accumulator only while window w is open (sparse).
  const accs: any[] = new Array(W)
  // Per-window fixation ordinal — matches the `index` an isolated per-window
  // scan would assign (0-based, in time order, over that window's fixations).
  const indices = new Int32Array(W)
  const values: number[] = isVector ? [] : new Array(W)
  const vectors: number[][] = isVector ? new Array(W) : []
  let refMissing = false
  let nextClose = 0

  // Identity leaves pass finalize's output straight through, so use it
  // directly and skip applyProjection's ApplyContext literal and copy.
  // Non-identity leaves reshape; they reuse one ApplyContext.
  const isIdentity = inner.kind === 'identity-aoi-vector' || inner.kind === 'identity-scalar'
  const projCtx = {
    aoiNames,
    rawValues: EMPTY_NUMBER_ARRAY as readonly number[],
    ...(recipe.rawShape === 'category-vector'
      ? { categoryNames: categoryGroupNames(scope.engine) }
      : {}),
  }

  const finalizeWindow = (w: number): void => {
    // An untouched window finalizes a fresh empty acc — what an isolated scan
    // over an empty range would produce.
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
    if (out.refMissing) refMissing = true
    if (isVector) vectors[w] = out.values
    else values[w] = out.values[0] ?? Number.NaN
  }

  // Single pass over the recipe's scan source: the fixation index by default,
  // the full category walk otherwise.
  const { reader, rawToSlot } = resolved
  const { idx: scanIdx, start: sStart, end: sEnd, catSlots: scanCatSlots } = scan
  const segBuf = reader.segmentBufferRaw
  const aoiPool = reader.aoiPoolRaw
  const resolvedSlots: number[] = []

  // Reused across every (fixation, window) dispatch: onFixation reads these
  // synchronously and never retains them, the same invariant that lets
  // `resolvedSlots` be shared. Under heavy window overlap this is the
  // difference between millions of short-lived objects and none.
  const frame: WindowFrame = {
    windowStart: 0,
    windowEnd: 0,
    start: 0,
    end: 0,
    duration: 0,
  }
  const fixEvent: FixationEvent = {
    start: 0,
    duration: 0,
    frame,
    slots: resolvedSlots,
    index: 0,
    categorySlot: -1,
  }

  for (let k = sStart; k < sEnd; k++) {
    const i = scanIdx[k]
    const base = i * SEGMENT_STRIDE
    // Null on every fixation scan — one predictable branch (see scanAccumulator).
    if (scanCatSlots !== null) fixEvent.categorySlot = scanCatSlots[k]
    const start = segBuf[base + SegmentField.START_TIME]
    const end = segBuf[base + SegmentField.END_TIME]
    // Scanned segments are time-ordered by start; once past the scope none can overlap.
    if (start >= tEnd) break
    if (end <= tStart) continue

    // Sweep: close every window the cursor has passed. `start` only grows, so a
    // window with `wEnd <= start` can receive no further fixation → finalize+free.
    while (nextClose < W && timeline[nextClose] + windowSize <= start) {
      finalizeWindow(nextClose)
      nextClose++
    }

    // Resolved ONCE, reused across every window this fixation hits.
    // KEEP IN SYNC with scanAccumulator/scanBatch — this decode + resolve +
    // dedupe block is a scientific invariant, inlined in all three scans for
    // speed (a shared per-fixation callback measured ~15% slower) and pinned
    // by the batch==single and windowed==oracle equivalence tests.
    resolvedSlots.length = 0
    const aoiCount = segBuf[base + SegmentField.AOI_COUNT] | 0
    const aoiPtr = segBuf[base + SegmentField.AOI_POINTER] | 0
    for (let r = 0; r < aoiCount; r++) {
      const slot = rawToSlot[aoiPool[aoiPtr + r]]
      if (slot >= 0 && resolvedSlots.indexOf(slot) === -1) resolvedSlots.push(slot)
    }

    const duration = end - start
    fixEvent.start = start
    fixEvent.duration = duration
    // A fixation overlaps window w iff
    // `start < timeline[w] + windowSize && end > timeline[w]`. Take a superset
    // range arithmetically, then trim both edges with the exact predicate
    // (robust to float ms); satisfying windows are contiguous because
    // timeline[w] is monotonic.
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
      // Init BEFORE the membership gate: a window whose overlapping fixations are
      // all non-members has still been evaluated, so a count reports 0, not NaN.
      if (acc === undefined) acc = accs[w] = init(ctx)
      const wStart = timeline[w]
      const wEnd = wStart + windowSize
      // THE membership gate, for every metric, written once. Declared per recipe
      // (`windowMembership`) instead of an `if` copied into each `onFixation`,
      // which is how three recipes ended up with the rule for a different family.
      if (ownWindowOnly && !(mid >= wStart && mid < wEnd)) continue
      // Inlined `fillWindowFrame`, bounded case (a windowed scope always is),
      // to avoid a call per dispatch in the hot loop.
      const fStartClip = start > wStart ? start : wStart
      const fEndClip = end < wEnd ? end : wEnd
      frame.windowStart = wStart
      frame.windowEnd = wEnd
      frame.start = fStartClip
      frame.end = fEndClip
      frame.duration = fEndClip - fStartClip
      fixEvent.index = indices[w]++
      onFixation(acc, fixEvent, ctx)
    }
  }

  // Finalize every window still open after the last fixation (incl. trailing gaps).
  while (nextClose < W) {
    finalizeWindow(nextClose)
    nextClose++
  }

  return timeseriesResult(isVector, slots, timeline, values, vectors, refMissing)
}

function computeFixationWindowed(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  projection: WindowedProjection,
  slots: AoiSlotInfo,
): ProjectedResult {
  // These slice the accumulator directly, and the registry + validator pin the
  // inner leaf to identity-scalar, so a window is just windowedFinalize.
  if (!recipe.windowedFinalize) {
    throw new Error(`[metrics] recipe ${recipe.id} uses windowUnit 'fixations' but defines no windowedFinalize hook`)
  }
  if (projection.inner.kind !== 'identity-scalar') {
    throw new Error(`[metrics] fixation-windowed recipe ${recipe.id} requires identity-scalar inner, got ${projection.inner.kind}`)
  }

  const out = scanAccumulator(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
  if (!out) return emptyTimeseries(false, slots)
  const acc: any = out.acc
  const seq: number[] | undefined = acc?.seq
  if (!Array.isArray(seq)) {
    throw new Error(`[metrics] recipe ${recipe.id} with windowUnit 'fixations' must accumulate into { seq: number[] }`)
  }

  const N = seq.length
  const { windowSize, stepSize } = projection.window
  // Same normalisation the two time-windowed drivers do; a persisted 0 would
  // hang the loop below.
  const step = stepSize > 0 ? stepSize : windowSize
  if (N < windowSize) return emptyTimeseries(false, slots)

  const values: number[] = []
  const timeline: number[] = []
  for (let start = 0; start + windowSize <= N; start += step) {
    values.push(recipe.windowedFinalize!(out.acc, start, start + windowSize, out.ctx))
    timeline.push(start)
  }
  return timeseriesResult(false, slots, timeline, values, [], false)
}

// ─── Group-aggregated windowed dispatch ──────────────────────────────────────

/**
 * Aggregate a windowed projection across a `GroupScope` by the effective
 * `reduction`. Emits the same timeseries shapes as per-participant `query()`,
 * so consumers need no separate code path.
 *
 * The time range is the group's bounds, or `[0, max participant end]`. Each
 * participant's run is clamped to their own data-end, so a shorter recording
 * simply contributes nothing at trailing windows rather than a synthesised 0,
 * and every window reduces over only the participants present in it.
 */
export function runWindowedGroup(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  group: GroupScope,
  projection: WindowedProjection,
  method: GroupReduction,
): ProjectedResult | null {
  const slots = buildAoiSlots(group.engine, group.stimulusId, group.aoiSelectionId)
  if (!slots) return null

  const isVector = PROJECTION_LEAVES[projection.inner.kind].outputShape === 'aoi-vector'

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
  if (tEnd <= tStart) return emptyTimeseries(isVector, slots)

  const { window } = projection
  // Same normalisation the per-participant drivers do; a persisted 0 step would
  // make buildTimeline loop forever.
  const timeline = buildTimeline(
    tStart, tEnd, window.windowSize,
    window.stepSize > 0 ? window.stepSize : window.windowSize
  )
  const W = timeline.length

  const stride = isVector ? slots.totalSlots : 1

  // The reduction STREAMS: each participant's result folds into flat typed
  // sufficient-statistics (sum + finite-count per window·slot) and is then
  // discarded. Peak memory O(W·slots), not O(P·W·slots) — retaining
  // `number[][][]` per participant was a ~500 MB blow-up on huge datasets.
  const groupSum = new Float64Array(W * stride)
  const groupCount = new Int32Array(W * stride)
  let refMissing = false

  for (const pid of group.participantIds) {
    // Clamp to this participant's recording end. Without it, windows past
    // their last fixation are still synthesised and finalize to a real 0
    // (counts, dwell) or 0% (relativeTime), not NaN — dragging the group mean
    // toward zero in the tail. `getParticipantEndTime` is O(1).
    const pEnd = getParticipantEndTime(group.engine, group.stimulusId, pid)
    const scope: Scope = {
      engine: group.engine,
      stimulusId: group.stimulusId,
      participantId: pid,
      timeStart: tStart,
      timeEnd: Math.min(tEnd, pEnd),
      aoiSelectionId: group.aoiSelectionId,
    }
    const r = runWindowed(recipe, instance, scope, projection, slots)
    if (r.refMissing) refMissing = true

    if (isVector) {
      const vs = r.vectors ?? []
      const wMax = Math.min(vs.length, W)
      for (let w = 0; w < wMax; w++) {
        const row = vs[w]
        const base = w * stride
        for (let s = 0; s < stride; s++) {
          const x = row[s]
          if (Number.isFinite(x)) {
            groupSum[base + s] += x
            groupCount[base + s]++
          }
        }
      }
    } else {
      const vals = r.values ?? []
      const wMax = Math.min(vals.length, W)
      for (let w = 0; w < wMax; w++) {
        const x = vals[w]
        if (Number.isFinite(x)) {
          groupSum[w] += x
          groupCount[w]++
        }
      }
    }
  }

  // The exact result `reduceFinite` produces over the same finite cell values.
  const isSum = method === 'sum'
  if (isVector) {
    const vectors: number[][] = new Array(W)
    for (let w = 0; w < W; w++) {
      const v = new Array<number>(stride)
      const base = w * stride
      for (let s = 0; s < stride; s++) {
        const c = groupCount[base + s]
        v[s] = c === 0 ? Number.NaN : isSum ? groupSum[base + s] : groupSum[base + s] / c
      }
      vectors[w] = v
    }
    return timeseriesResult(true, slots, timeline, [], vectors, refMissing)
  }
  const values = new Array<number>(W)
  for (let w = 0; w < W; w++) {
    const c = groupCount[w]
    values[w] = c === 0 ? Number.NaN : isSum ? groupSum[w] : groupSum[w] / c
  }
  return timeseriesResult(false, slots, timeline, values, [], refMissing)
}

// ─── Internals ────────────────────────────────────────────────────────────────

/**
 * The accumulator plus the very `InitCtx` the scan ran with. Carrying the ctx
 * OBJECT means `finalize` receives exactly what `init`/`onFixation` saw, and a
 * new InitCtx field is declared once in dsl.ts and filled once here rather
 * than threaded through every caller's rebuilt literal.
 */
interface ScanOutput<A> {
  acc: A
  ctx: InitCtx<Record<string, unknown>>
}

/** Exported for scanBatch, where category-scanning recipes compute per instance. */
export function runSingleWindow(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  timeStart: number,
  timeEnd: number,
): number[] {
  if (!recipe.finalize) return []
  const cached = cacheGetRaw(scope.engine, instance, scope.stimulusId, scope.participantId, timeStart, timeEnd, scope.aoiSelectionId)
  if (cached) return cached
  const out = scanAccumulator(recipe, instance, scope, timeStart, timeEnd)
  if (!out) return []
  const result = recipe.finalize(out.acc, out.ctx.slots, out.ctx)
  cacheSetRaw(scope.engine, instance, scope.stimulusId, scope.participantId, timeStart, timeEnd, result, scope.aoiSelectionId)
  return result
}

export function scanAccumulator(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  timeStart: number,
  timeEnd: number,
): ScanOutput<any> | null {
  // Group-shape recipes never reach here — filtered upstream.
  if (!recipe.init || !recipe.onFixation) return null
  const ownWindowOnly = recipe.windowMembership === 'own'
  const slots = buildAoiSlots(scope.engine, scope.stimulusId, scope.aoiSelectionId)
  if (!slots) return null
  const params = resolveParams(recipe.params, instance.params)
  const { reader, rawToSlot } = slots
  const scan = resolveScanIndex(
    recipe,
    scope.engine,
    reader,
    scope.stimulusId,
    scope.participantId,
  )
  const { idx: scanIdx, start: sStart, end: sEnd, catSlots: scanCatSlots } = scan
  // See InitCtx.scopeDurationMs.
  const scopeDurationMs =
    timeEnd > 0
      ? timeEnd - timeStart
      : reader.getParticipantEndTime(scope.stimulusId, scope.participantId)
  const ctx = {
    params,
    slots,
    scopeDurationMs,
    categorySlotCount: scan.categorySlotCount,
    summaryStatistic: projectionSummaryStatistic(instance.projection),
  }
  const acc = recipe.init(ctx)
  const segBuf = reader.segmentBufferRaw
  const aoiPool = reader.aoiPoolRaw
  const resolvedSlots: number[] = []

  // Reused across every fixation, same invariant as resolvedSlots and the
  // windowed driver. A fresh frame + event per fixation is millions of
  // short-lived objects on a huge dataset, and dominated the scan in profiling.
  const frame: WindowFrame = {
    windowStart: 0,
    windowEnd: 0,
    start: 0,
    end: 0,
    duration: 0,
  }
  const fixEvent: FixationEvent = {
    start: 0,
    duration: 0,
    frame,
    slots: resolvedSlots,
    index: 0,
    categorySlot: -1,
  }
  let index = 0

  for (let k = sStart; k < sEnd; k++) {
    const i = scanIdx[k]
    const base = i * SEGMENT_STRIDE
    // `scanIdx` is pre-resolved by construction, so no filter here; the null
    // check is one predictable branch, dwarfed by the decode block below.
    if (scanCatSlots !== null) fixEvent.categorySlot = scanCatSlots[k]
    const start = segBuf[base + SegmentField.START_TIME]
    const end = segBuf[base + SegmentField.END_TIME]
    if (timeEnd > 0 && start >= timeEnd) break
    if (end <= timeStart) continue

    // KEEP IN SYNC with computeTimeWindowed/scanBatch — this decode + resolve
    // + dedupe block is a scientific invariant, inlined in all three scans for
    // speed (a shared per-fixation callback measured ~15% slower) and pinned
    // by the equivalence tests. `rawToSlot` folds the hidden-drop and AOI-group
    // mapping into one table read. The dedupe makes a fixation tagged by
    // several raw IDs mapping to one slot read as singly-labelled to recipes
    // testing `slots.length === 1` (RQA), matching extractFixationSequence —
    // pinned by tests/fixationSequenceAlignment.test.ts.
    resolvedSlots.length = 0
    const aoiCount = segBuf[base + SegmentField.AOI_COUNT] | 0
    const aoiPtr = segBuf[base + SegmentField.AOI_POINTER] | 0
    for (let r = 0; r < aoiCount; r++) {
      const slot = rawToSlot[aoiPool[aoiPtr + r]]
      if (slot >= 0 && resolvedSlots.indexOf(slot) === -1) resolvedSlots.push(slot)
    }

    const duration = end - start
    const midInScope = fillWindowFrame(frame, start, end, timeStart, timeEnd)
    // A bounded scope is one window, so the declared membership applies here too.
    if (ownWindowOnly && !midInScope) continue
    fixEvent.start = start
    fixEvent.duration = duration
    fixEvent.index = index
    recipe.onFixation(acc, fixEvent, ctx)
    index++
  }
  return { acc, ctx }
}

function getAoiNames(scope: Scope): string[] {
  try {
    return getAois(scope.engine, scope.stimulusId, scope.aoiSelectionId).map(
      a => a.displayedName
    )
  } catch {
    return []
  }
}

// ─── Cache (per-reader bucket, keyed on baseId+params+scope+time range) ──────

function rawCacheKey(engine: DataEngine, instance: MetricInstance, stimulusId: number, participantId: number, tStart: number, tEnd: number, aoiSelectionId?: number): string {
  // The ORDER signature comes from the selection-narrowed getAois, so it
  // already discriminates selections (and two resolving to the same visible
  // set share, which is correct). No separate selection token.
  const sig = slotSignatures(engine, stimulusId, aoiSelectionId)
  // A non-mean summary statistic changes a sample-summarizing recipe's
  // finalize output, so it keys its own entry; 'mean' shares with
  // identity-vector raws, since both ARE the mean vector.
  const st = projectionSummaryStatistic(instance.projection)
  return `r|${categoryCacheToken(engine, instance.baseId)}o${sig.order}|${instance.baseId}|${paramsKey(instance.params)}${st === 'mean' ? '' : `|st:${st}`}|${stimulusId}|${participantId}|${tStart}|${tEnd}`
}

function windowedCacheKey(instance: MetricInstance, scope: Scope, projection: WindowedProjection): string {
  // The projection shapes windowed results, so it is part of the identity.
  // Encoded by `projectionCacheKey`, which owns the format for every leaf kind
  // — this used to inline a second, differently-shaped encoding of the same
  // thing, free to drift from the one the projection layer exports.
  const proj = projectionCacheKey(projection)
  const sig = slotSignatures(scope.engine, scope.stimulusId, scope.aoiSelectionId)
  return `w|${categoryCacheToken(scope.engine, instance.baseId)}o${sig.order}|n${sig.names}|${proj}|${instance.baseId}|${paramsKey(instance.params)}|${scope.stimulusId}|${scope.participantId}|${scope.timeStart ?? 0}|${scope.timeEnd ?? 0}`
}

function paramsKey(params: Record<string, unknown> | undefined): string {
  if (!params) return ''
  const keys = Object.keys(params).sort()
  return keys.map(k => `${k}=${String(params[k])}`).join(',')
}

/**
 * Raw (unprojected) finalize output — consulted by `runSingleWindow` and the
 * batch scanner so both single and batch paths share one entry per instance.
 */
export function cacheGetRaw(engine: DataEngine, instance: MetricInstance, stimulusId: number, participantId: number, tStart: number, tEnd: number, aoiSelectionId?: number): number[] | undefined {
  return cacheMapFor(engine)?.get(rawCacheKey(engine, instance, stimulusId, participantId, tStart, tEnd, aoiSelectionId)) as number[] | undefined
}

export function cacheSetRaw(engine: DataEngine, instance: MetricInstance, stimulusId: number, participantId: number, tStart: number, tEnd: number, value: number[], aoiSelectionId?: number): void {
  cacheMapFor(engine)?.set(rawCacheKey(engine, instance, stimulusId, participantId, tStart, tEnd, aoiSelectionId), value)
}

/**
 * Cached windowed results are SHARED, with no defensive copies — no consumer
 * mutates them today, and the freeze turns any future violation into a loud
 * TypeError instead of silent cache corruption.
 */
function freezeProjectedResult(r: ProjectedResult): ProjectedResult {
  Object.freeze(r.values)
  if (r.vectors) {
    for (const row of r.vectors) Object.freeze(row)
    Object.freeze(r.vectors)
  }
  if (r.timeline) Object.freeze(r.timeline)
  return Object.freeze(r)
}

