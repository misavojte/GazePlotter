import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { SEGMENT_STRIDE, SegmentField } from '$lib/data/binary'
import { buildAoiSlots } from './aoiSlots'
import { resolveParams } from './params'
import { getRecipe } from './defineMetric'
import { buildWindowFrame } from './dsl'
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
  const { startIndex: fStart, endIndex: fEnd } = reader.getFixationRange(
    stimulusId,
    participantId,
  )
  const segBuf = reader.segmentBufferRaw
  const aoiPool = reader.aoiPoolRaw
  const resolvedSlots: number[] = []
  let index = 0

  for (let k = fStart; k < fEnd; k++) {
    const i = reader.getFixationSegmentIndex(k)
    const base = i * SEGMENT_STRIDE
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
      const slot = aoiLookup.get(engine.getAoiMapping(stimulusId, rawId))
      if (slot !== undefined && resolvedSlots.indexOf(slot) === -1) resolvedSlots.push(slot)
    }

    const duration = end - start
    const frame = buildWindowFrame(start, end, duration, timeStart, timeEnd)
    const fix: FixationEvent = { start, duration, frame, slots: resolvedSlots, index }
    for (const a of active) a.onFixation(a.acc, fix, a.ctx)
    index++
  }

  return new Map(
    active.map(a => [a.inst.id, a.finalize(a.acc, slots, a.ctx)])
  )
}
