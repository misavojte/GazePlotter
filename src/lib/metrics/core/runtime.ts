import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { type BinaryBufferReader, SEGMENT_STRIDE, SegmentField } from '$lib/data/binary'
import { getAois, getParticipantEndTime } from '$lib/data/engine'
import { buildAoiSlots } from './aoiSlots'
import { categoryCacheToken, resolveScanIndex } from './categoryScan'
import { resolveParams } from './params'
import { getRecipe } from './defineMetric'
import {
  applyProjection,
  leafDef,
  leafOf,
  PROJECTION_LEAVES,
  projectionOutputShape,
  windowKey,
  type Projection,
  type WindowedProjection,
} from './projection'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import { fillWindowFrame } from './dsl'
import type { AoiSlotInfo, FixationEvent, GroupScope, MetricRecipe, OutputShape, WindowFrame } from './dsl'
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
   * Per-plot AOI SELECTION id. Threaded into every buildAoiSlots / getAoiNames /
   * slot-signature below so the plot's reduced alphabet drives its numbers.
   * Out-of-selection AOI fixations resolve to no-AOI (compute-honest). The slot
   * signature reflects the selection, so the result cache discriminates
   * selections and equal visible sets share. `undefined` → all AOIs
   * (byte-identical to before this field existed).
   */
  aoiSelectionId?: number
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
 * Each reader's bucket is versioned by `AoiGroupReader.version` — the
 * STRUCTURAL version, which bumps when grouping or visibility changes (both
 * alter scan results). A version change starts a fresh bucket, so entries
 * never accumulate across structural edits.
 *
 * Cosmetic AOI edits deliberately do NOT reset the bucket (a color-only save
 * keeps every entry — pinned by tests). But metric results also depend on
 * what the structural version cannot see: slot ORDER (`buildAoiSlots`
 * follows display order, and a pure reorder bumps nothing structural) and,
 * for windowed results, AOI display NAMES (inner leaves resolve AoiRefs by
 * name). Those ride in the cache KEY as slot signatures instead — a reorder
 * or rename changes the signature and misses; a color edit leaves it intact
 * and hits. Participant/stimulus edits change neither, so re-deriving every
 * plot after a participant rename on a huge dataset is answered entirely
 * from cache.
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
 * Slot signatures: ORDER (raw results are per-slot arrays in display order)
 * and NAMES (windowed results resolve AoiRefs by displayed name). Memoized on
 * the frozen array `getAois` returns — that reference is stable per
 * (reader, stimulus, appearanceVersion) and swaps on every AOI edit, so the
 * array identity is the invalidation token and the strings are built once
 * per edit, not once per query.
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
  const slots = buildAoiSlots(scope.engine, scope.stimulusId, scope.aoiSelectionId)
  if (!slots) return null
  const projection = instance.projection

  if (projection.kind !== 'windowed') {
    const raw = runSingleWindow(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
    const out = applyProjection(projection, { aoiNames: getAoiNames(scope), rawValues: raw })
    return {
      shape: projectionOutputShape(projection),
      values: out.values,
      slots,
      aoiMissing: out.aoiMissing,
    }
  }

  return runWindowed(recipe, instance, scope, projection, slots)
}

/** Raw finalize output — no projection. Feeds queryGroup's per-participant reduction. */
export function runRaw(recipe: MetricRecipe<any, any>, instance: MetricInstance, scope: Scope): number[] {
  return runSingleWindow(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
}

/**
 * Per-fixation individual values for EVERY slot from a SINGLE participant
 * scan (finalize may flush pending state — e.g. visitDuration's activeDwells
 * — before individuals inspects the accumulator). One scan fills all slots;
 * callers read the slot they need, so there is deliberately no per-slot
 * variant — it would invite one full rescan per (slot × participant).
 * Returns `null` for recipes without an individuals/finalize pair (the
 * caller falls back to the cached aggregate).
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
  projection: WindowedProjection,
  slots: AoiSlotInfo,
): ProjectedResult {
  return recipe.windowUnit === 'fixations'
    ? runFixationWindowed(recipe, instance, scope, projection, slots)
    : runTimeWindowed(recipe, instance, scope, projection, slots)
}

/**
 * Cached wrapper around the per-participant time-windowed scan — the most
 * expensive query in the app (aoi-stream, evolving-metrics, and every group
 * fold call it per participant). A workspace redraw that didn't touch AOIs
 * (participant rename, layout command) is answered entirely from here.
 */
function runTimeWindowed(
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
    computeTimeWindowedFused(recipe, scope, projection, slots) ??
      computeTimeWindowed(recipe, instance, scope, projection, slots)
  )
  map?.set(key, result)
  return result
}

/**
 * Fused driver for the additive `recipe.accumulation` kinds (see the field's
 * docs in dsl.ts): one flat Float64Array(W × slots) accumulated in a pure
 * numeric loop, so per fixation the driver touches no objects at all. The
 * resolved slot set is an integer bitmask up to 31 AOI slots (dedupe is a
 * single OR, the same fast path AoiGroupReader uses) and a reused scratch
 * array beyond that — wide-AOI stimuli keep the fused speed, only the dedupe
 * container changes. Returns null for 'stateful' recipes (→ general driver).
 */
function computeTimeWindowedFused(
  recipe: MetricRecipe<any, any>,
  scope: Scope,
  projection: WindowedProjection,
  slots: AoiSlotInfo,
): ProjectedResult | null {
  const accumulation = recipe.accumulation
  // Also keeps category-scanning recipes out: they are 'stateful' by
  // registration invariant, so this driver's fixation-index iteration and
  // per-AOI-slot assembly stay valid without a scan-source branch.
  if (!accumulation || accumulation === 'stateful') return null

  const { window, inner } = projection
  const tStart = scope.timeStart ?? 0
  const tEnd = scope.timeEnd ?? 0
  const isVector = PROJECTION_LEAVES[inner.kind].outputShape === 'aoi-vector'
  const outShape: OutputShape = isVector ? 'aoi-vector-timeseries' : 'scalar-timeseries'
  const empty = (): ProjectedResult =>
    isVector
      ? { shape: outShape, values: [], vectors: [], slots, aoiMissing: false, timeline: [] }
      : { shape: outShape, values: [], slots, aoiMissing: false, timeline: [] }

  if (tEnd <= tStart) return empty()
  const resolved = buildAoiSlots(scope.engine, scope.stimulusId, scope.aoiSelectionId)
  if (!resolved) return empty()

  const windowSize = window.windowSize
  const step = window.stepSize > 0 ? window.stepSize : windowSize
  const timeline: number[] = []
  for (let wStart = tStart; wStart + windowSize <= tEnd; wStart += step) {
    timeline.push(wStart)
  }
  const W = timeline.length
  if (W === 0) return empty()

  const stride = slots.totalSlots
  const anyIdx = slots.anyFixationSlot
  const noIdx = slots.noAoiSlot
  const slotSums = new Float64Array(W * stride)
  const isDurationWeighted = accumulation !== 'midpointCount'
  // ≤31 AOI slots: the slot set is a bitmask register. Beyond that (e.g.
  // 120-AOI stimuli) it is this reused scratch array — same fused loop,
  // same zero allocations, only the dedupe container changes.
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

    // Same decode + resolve semantics as the scan trio (KEEP IN SYNC with
    // scanAccumulator/computeTimeWindowed/scanBatch; pinned by the
    // windowed==oracle suite) — dedupe collapses into the bitmask OR, or
    // an indexOf over the handful of AOIs a single fixation carries.
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
      let v: number
      if (isDurationWeighted) {
        const s0 = start > wStart ? start : wStart
        const wEnd = wStart + windowSize
        const e0 = end < wEnd ? end : wEnd
        v = e0 - s0
      } else {
        if (mid < wStart || mid >= wStart + windowSize) continue
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

  // Output assembly — per-window normalize + inner projection, matching the
  // general driver's finalizeWindow semantics exactly.
  const normalize = accumulation === 'clippedDurationShare'
  const isIdentity = inner.kind === 'identity-aoi-vector' || inner.kind === 'identity-scalar'
  const projCtx = { aoiNames: getAoiNames(scope), rawValues: EMPTY_NUMBER_ARRAY }
  const values: number[] = isVector ? [] : new Array(W)
  const vectors: number[][] = isVector ? new Array(W) : []
  let aoiMissing = false
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
    if (out.aoiMissing) aoiMissing = true
    if (isVector) vectors[w] = out.values
    else values[w] = out.values[0] ?? Number.NaN
  }

  return isVector
    ? { shape: outShape, values: [], vectors, slots, aoiMissing, timeline }
    : { shape: outShape, values, slots, aoiMissing, timeline }
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
  const resolved = buildAoiSlots(scope.engine, scope.stimulusId, scope.aoiSelectionId)
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

  // Single pass over the participant's scanned segments (the recipe's scan
  // source: fixation index by default, category walk for categoryParam).
  const { reader, rawToSlot } = resolved
  const { idx: scanIdx, start: sStart, end: sEnd } = resolveScanIndex(
    recipe,
    params,
    scope.engine,
    reader,
    scope.stimulusId,
    scope.participantId,
  )
  const segBuf = reader.segmentBufferRaw
  const aoiPool = reader.aoiPoolRaw
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

  for (let k = sStart; k < sEnd; k++) {
    const i = scanIdx[k]
    const base = i * SEGMENT_STRIDE
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

    // Resolve AOI slots ONCE; reused across every window this fixation hits.
    // KEEP IN SYNC with scanAccumulator/scanBatch — this decode + resolve +
    // dedupe block is a scientific invariant, inlined in all three scans
    // for speed (a shared per-fixation callback measured ~15% slower) and
    // pinned by the batch==single and windowed==oracle equivalence tests.
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

/** Cached wrapper — same contract as `runTimeWindowed`. */
function runFixationWindowed(
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
  const result = freezeProjectedResult(computeFixationWindowed(recipe, instance, scope, projection, slots))
  map?.set(key, result)
  return result
}

function computeFixationWindowed(
  recipe: MetricRecipe<any, any>,
  instance: MetricInstance,
  scope: Scope,
  projection: WindowedProjection,
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
  if (projection.inner.kind !== 'identity-scalar') {
    throw new Error(`[metrics] fixation-windowed recipe ${recipe.id} requires identity-scalar inner, got ${projection.inner.kind}`)
  }

  const out = scanAccumulator(recipe, instance, scope, scope.timeStart ?? 0, scope.timeEnd ?? 0)
  if (!out) return { shape: 'scalar-timeseries', values: [], slots, aoiMissing: false, timeline: [] }
  const acc: any = out.acc
  const seq: number[] | undefined = acc?.seq
  if (!Array.isArray(seq)) {
    throw new Error(`[metrics] recipe ${recipe.id} with windowUnit 'fixations' must accumulate into { seq: number[] }`)
  }

  const N = seq.length
  const { windowSize, stepSize } = projection.window
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
 * per the effective cross-participant `reduction` (mean / sum). Returns a single
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
 *   4. Per (window[, slot]) cell, drop NaNs and reduce by `method`
 *      (`mean` = sum/count, `sum` = sum), NaN when the cell has no finite value.
 *
 * Caller-side: `query.ts:queryGroup` dispatches windowed projections here
 * instead of the legacy "first participant only" placeholder.
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
  const outShape: OutputShape = isVector ? 'aoi-vector-timeseries' : 'scalar-timeseries'

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

  const { window } = projection
  const timeline: number[] = []
  for (let wStart = tStart; wStart + window.windowSize <= tEnd; wStart += window.stepSize) {
    timeline.push(wStart)
  }
  const W = timeline.length

  const stride = isVector ? slots.totalSlots : 1

  // Cross-participant reduction STREAMS (both `mean` and `sum`): each
  // participant's windowed result folds into flat typed sufficient-statistics
  // (sum + finite-count per window·slot) and is then discarded. Peak memory is
  // O(W·slots), not O(P·W·slots) — the former retained `number[][][]` for every
  // participant was the ~500 MB / GC blow-up on huge datasets.
  const groupSum = new Float64Array(W * stride)
  const groupCount = new Int32Array(W * stride)
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
      aoiSelectionId: group.aoiSelectionId,
    }
    const r = runTimeWindowed(recipe, instance, scope, projection, slots)
    if (r.aoiMissing) aoiMissing = true

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

  // Finalize. mean = sum/count, sum = sum, NaN when count 0 — the exact result
  // `reduceFinite` produces over the same finite values per cell.
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
    return { shape: outShape, values: [], vectors, slots, aoiMissing, timeline }
  }
  const values = new Array<number>(W)
  for (let w = 0; w < W; w++) {
    const c = groupCount[w]
    values[w] = c === 0 ? Number.NaN : isSum ? groupSum[w] : groupSum[w] / c
  }
  return { shape: outShape, values, slots, aoiMissing, timeline }
}

// ─── Internals ────────────────────────────────────────────────────────────────

interface ScanOutput<A> { acc: A; slots: AoiSlotInfo; params: Record<string, unknown> }

/** Exported for scanBatch: category-scanning recipes compute per instance here. */
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
  const result = recipe.finalize(out.acc, out.slots, { params: out.params, slots: out.slots })
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
  // Per-participant scan trio. Group-shape recipes (participant-pair-matrix)
  // never reach here — runProjected and queryBatch filter them upstream.
  if (!recipe.init || !recipe.onFixation) return null
  const slots = buildAoiSlots(scope.engine, scope.stimulusId, scope.aoiSelectionId)
  if (!slots) return null
  const params = resolveParams(recipe.params, instance.params)
  const ctx = { params, slots }
  const acc = recipe.init(ctx)

  const { reader, rawToSlot } = slots
  const { idx: scanIdx, start: sStart, end: sEnd } = resolveScanIndex(
    recipe,
    params,
    scope.engine,
    reader,
    scope.stimulusId,
    scope.participantId,
  )
  const segBuf = reader.segmentBufferRaw
  const aoiPool = reader.aoiPoolRaw
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

  for (let k = sStart; k < sEnd; k++) {
    const i = scanIdx[k]
    const base = i * SEGMENT_STRIDE
    // `scanIdx` is pre-filtered by construction (the fixation index, or the
    // recipe's category walk) — no per-segment filter here.
    const start = segBuf[base + SegmentField.START_TIME]
    const end = segBuf[base + SegmentField.END_TIME]
    if (timeEnd > 0 && start >= timeEnd) break
    if (end <= timeStart) continue

    // KEEP IN SYNC with computeTimeWindowed/scanBatch — this decode + resolve
    // + dedupe block is a scientific invariant, inlined in all three scans
    // for speed (a shared per-fixation callback measured ~15% slower) and
    // pinned by the equivalence tests. `rawToSlot` folds the hidden-drop and
    // AOI-group mapping into one table read; the dedupe makes recipes testing
    // `slots.length === 1` (e.g. RQA's single-AOI filter) treat a fixation
    // tagged by multiple raw IDs that map to the same AOI slot as a single
    // labelled fixation, matching extractFixationSequence (that alignment is
    // pinned by tests/fixationSequenceAlignment.test.ts).
    resolvedSlots.length = 0
    const aoiCount = segBuf[base + SegmentField.AOI_COUNT] | 0
    const aoiPtr = segBuf[base + SegmentField.AOI_POINTER] | 0
    for (let r = 0; r < aoiCount; r++) {
      const slot = rawToSlot[aoiPool[aoiPtr + r]]
      if (slot >= 0 && resolvedSlots.indexOf(slot) === -1) resolvedSlots.push(slot)
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
    return getAois(scope.engine, scope.stimulusId, scope.aoiSelectionId).map(
      a => a.displayedName
    )
  } catch {
    return []
  }
}

// ─── Cache (per-reader bucket, keyed on baseId+params+scope+time range) ──────

function rawCacheKey(engine: DataEngine, instance: MetricInstance, stimulusId: number, participantId: number, tStart: number, tEnd: number, aoiSelectionId?: number): string {
  // The slot ORDER signature is computed from the selection-narrowed getAois, so
  // it already discriminates AOI selections (and two selections resolving to the
  // same visible set share, which is correct). No separate selection token.
  const sig = slotSignatures(engine, stimulusId, aoiSelectionId)
  // categoryCacheToken is '' except for category-scanning recipes, whose
  // results also depend on the category table (see categoryScan.ts).
  return `r|${categoryCacheToken(engine, instance.baseId)}o${sig.order}|${instance.baseId}|${paramsKey(instance.params)}|${stimulusId}|${participantId}|${tStart}|${tEnd}`
}

function windowedCacheKey(instance: MetricInstance, scope: Scope, projection: WindowedProjection): string {
  // The projection shapes windowed results (timeline + inner leaf), so it is
  // part of the identity — keyed with the projection system's own vocabulary
  // (`windowKey` + per-leaf `cacheKey`, total over every leaf kind).
  const proj = `${windowKey(projection.window)}~${leafDef(projection.inner).cacheKey(projection.inner)}`
  // sig.order/sig.names reflect the selection-narrowed getAois (see rawCacheKey).
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
 * Cached windowed results are frozen and SHARED — no defensive copies. No
 * consumer mutates result arrays (the leaf path already hands out fresh
 * arrays via `applyProjection`'s spread), and the freeze turns any future
 * violation into a loud TypeError instead of silent cache corruption.
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

