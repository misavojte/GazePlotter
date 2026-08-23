import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { SEGMENT_STRIDE, SegmentField } from '$lib/data/binary'
import { buildAoiSlots } from './aoiSlots'
import { resolveParams } from './params'
import { projectionSummaryStatistic } from './projection'
import { getRecipe } from './defineMetric'
import { fillWindowFrame } from './dsl'
import { cacheGetRaw, cacheSetRaw, makeScanCursor, runSingleWindow } from './runtime'
import type { InitCtx, MetricRecipe } from './dsl'
import type { MetricInstance } from '../instances'

/**
 * Iterate a participant's fixations once and fan the results out to every
 * instance, keyed by instance id. Windowed instances are skipped; their
 * per-window scan needs `runProjected()`.
 */
export function scanBatch(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  instances: readonly MetricInstance[],
  timeStart: number = 0,
  timeEnd: number = 0,
  /** Same reduced slot layout + raw cache key as the single-participant path,
   *  so batch==single holds under a selection. */
  aoiSelectionId?: number,
): Map<string, number[]> {
  const slots = buildAoiSlots(engine, stimulusId, aoiSelectionId)
  if (!slots) return new Map()
  // One scan, one extent, shared by every instance's ctx.
  const scopeDurationMs =
    timeEnd > 0
      ? timeEnd - timeStart
      : slots.reader.getParticipantEndTime(stimulusId, participantId)

  type ActiveInstance = {
    inst: MetricInstance
    onFixation: NonNullable<MetricRecipe<any, any>['onFixation']>
    /** Declared membership; a bounded scope is one window. See MetricRecipe.windowMembership. */
    ownWindowOnly: boolean
    finalize: NonNullable<MetricRecipe<any, any>['finalize']>
    acc: any
    ctx: InitCtx<Record<string, unknown>>
  }

  const results = new Map<string, number[]>()
  const active: ActiveInstance[] = []
  for (const inst of instances) {
    if (inst.projection.kind === 'windowed') continue
    const recipe = getRecipe(inst.baseId)
    if (!recipe) continue
    // Category-vector recipes iterate every segment and event-vector ones the
    // occurrence stream, not the fixation index, so they can't join this pass.
    // Each computes via the single path against the same raw cache, so
    // batch==single holds by construction.
    if (recipe.scanSource === 'categories' || recipe.scanSource === 'events') {
      results.set(
        inst.id,
        runSingleWindow(recipe, inst, { engine, stimulusId, participantId, aoiSelectionId }, timeStart, timeEnd),
      )
      continue
    }
    // Group-shape recipes expose no trio; they own their evaluation.
    const { init, onFixation, finalize } = recipe
    if (!init || !onFixation || !finalize) continue
    // Same cache as runSingleWindow — only the misses join the scan.
    const cached = cacheGetRaw(engine, inst, stimulusId, participantId, timeStart, timeEnd, aoiSelectionId)
    if (cached) {
      results.set(inst.id, cached)
      continue
    }
    const params = resolveParams(recipe.params, inst.params)
    // axisSlotCount 0: axis-scanning recipes were delegated above, so nothing
    // here indexes a per-type or per-channel vector. The summary statistic,
    // though, is NOT constant across the batch — the aoi-vector duration
    // metrics summarize samples too, and a `pick-aoi · median` instance must
    // collapse by median here exactly as on the single path, or it poisons
    // the statistic-keyed raw cache.
    const ctx = {
      params,
      slots,
      scopeDurationMs,
      axisSlotCount: 0,
      summaryStatistic: projectionSummaryStatistic(inst.projection),
    }
    active.push({
      inst, onFixation, finalize, acc: init(ctx), ctx,
      ownWindowOnly: recipe.windowMembership === 'own',
    })
  }
  if (active.length === 0) return results

  const { reader, rawToSlot } = slots
  const { startIndex: fStart, endIndex: fEnd } = reader.getFixationRange(
    stimulusId,
    participantId,
  )
  const segBuf = reader.segmentBufferRaw
  const aoiPool = reader.aoiPoolRaw
  const resolvedSlots: number[] = []
  const { frame, fixEvent } = makeScanCursor(resolvedSlots)
  let index = 0

  for (let k = fStart; k < fEnd; k++) {
    const i = reader.getFixationSegmentIndex(k)
    const base = i * SEGMENT_STRIDE
    const start = segBuf[base + SegmentField.START_TIME]
    const end = segBuf[base + SegmentField.END_TIME]
    if (timeEnd > 0 && start >= timeEnd) break
    if (end <= timeStart) continue

    // KEEP IN SYNC with scanAccumulator/computeTimeWindowed — inlined in all
    // three scans for speed (a shared per-fixation callback measured ~15%
    // slower); pinned by the batch==single equivalence test.
    resolvedSlots.length = 0
    const aoiCount = segBuf[base + SegmentField.AOI_COUNT] | 0
    const aoiPtr = segBuf[base + SegmentField.AOI_POINTER] | 0
    for (let r = 0; r < aoiCount; r++) {
      const slot = rawToSlot[aoiPool[aoiPtr + r]]
      if (slot >= 0 && resolvedSlots.indexOf(slot) === -1) resolvedSlots.push(slot)
    }

    const duration = end - start
    const midInScope = fillWindowFrame(frame, start, end, timeStart, timeEnd)
    fixEvent.start = start
    fixEvent.duration = duration
    fixEvent.index = index
    for (const a of active) {
      if (a.ownWindowOnly && !midInScope) continue
      a.onFixation(a.acc, fixEvent, a.ctx)
    }
    index++
  }

  for (const a of active) {
    const raw = a.finalize(a.acc, slots, a.ctx)
    cacheSetRaw(engine, a.inst, stimulusId, participantId, timeStart, timeEnd, raw, aoiSelectionId)
    results.set(a.inst.id, raw)
  }
  return results
}
