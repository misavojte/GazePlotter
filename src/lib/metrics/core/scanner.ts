import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { buildAoiSlots } from './aoiSlots'
import { resolveParams } from './params'
import { getRecipe } from './defineMetric'
import type { FixationEvent, InitCtx, MetricRecipe } from './dsl'
import type { MetricInstance } from '../instances'

/**
 * Iterate a participant's fixation segments exactly once and fan results out to
 * every instance. Returns a Map<instanceId, number[]> matching each recipe's
 * `finalize` output shape. Windowed instances are skipped — their per-window
 * scan requires `runProjected()` in runtime.ts.
 */
export function scanBatch(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  instances: readonly MetricInstance[],
  timeStart: number = 0,
  timeEnd: number = 0,
): Map<string, number[]> {
  const slots = buildAoiSlots(engine, stimulusId)
  if (!slots) return new Map()

  type Active = {
    inst: MetricInstance
    onFixation: NonNullable<MetricRecipe<any, any>['onFixation']>
    finalize: NonNullable<MetricRecipe<any, any>['finalize']>
    acc: any
    ctx: InitCtx<Record<string, unknown>>
  }

  const active: Active[] = []
  for (const inst of instances) {
    if (inst.projection.kind === 'windowed') continue
    const recipe = getRecipe(inst.baseId)
    if (!recipe) continue
    // Group-shape recipes own their evaluation via scanGroup; they don't
    // expose the per-participant trio that this batch path requires.
    const { init, onFixation, finalize } = recipe
    if (!init || !onFixation || !finalize) continue
    const params = resolveParams(recipe.params, inst.params)
    const ctx = { params, slots }
    active.push({ inst, onFixation, finalize, acc: init(ctx), ctx })
  }
  if (active.length === 0) return new Map()

  const { reader, hiddenAoisSet, aoiLookup } = slots
  const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)
  const resolvedSlots: number[] = []
  let index = 0

  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== 0) continue
    const start = reader.getSegmentStart(i)
    const end = reader.getSegmentEnd(i)
    if (timeEnd > 0 && start >= timeEnd) break
    if (end <= timeStart) continue

    resolvedSlots.length = 0
    const rawAois = reader.getRawAois(i)
    for (let r = 0; r < rawAois.length; r++) {
      const rawId = rawAois[r]
      if (hiddenAoisSet?.has(rawId)) continue
      const slot = aoiLookup.get(engine.getAoiMapping(stimulusId, rawId))
      if (slot !== undefined && resolvedSlots.indexOf(slot) === -1) resolvedSlots.push(slot)
    }

    const duration = end - start
    const bounded = timeEnd > 0
    const windowStart = bounded ? timeStart : 0
    const windowEnd = bounded ? timeEnd : Number.POSITIVE_INFINITY
    const frameStart = Math.max(start, windowStart)
    const frameEnd = bounded ? Math.min(end, windowEnd) : end
    const frameDuration = frameEnd - frameStart
    const isClipped = bounded && (start < windowStart || end > windowEnd)
    const mid = start + duration / 2
    const midpointInWindow = bounded ? mid >= windowStart && mid < windowEnd : true
    const frame = {
      windowStart,
      windowEnd,
      start: frameStart,
      end: frameEnd,
      duration: frameDuration,
      isClipped,
      midpointInWindow,
    }
    const fix: FixationEvent = { start, duration, frame, slots: resolvedSlots, index }
    for (const a of active) a.onFixation(a.acc, fix, a.ctx)
    index++
  }

  const out = new Map<string, number[]>()
  for (const a of active) {
    out.set(a.inst.id, a.finalize(a.acc, slots, a.ctx))
  }
  return out
}
