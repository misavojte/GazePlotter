import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois } from '$lib/data/engine'
import { defineMetric } from '../defineMetric'
import { buildAoiSlots } from '../helpers/aoiSlots'
import { applyGroupedTimeWindowing } from '../helpers/windowing'
import type { MetricComputeContext, MetricInstance } from '../types'

const _cache = new WeakMap<object, Map<string, number[]>>()

function _scan(engine: DataEngine, ctx: MetricComputeContext): number[] {
  const aois = getAois(engine, ctx.stimulusId)
  const slots = buildAoiSlots(engine, ctx.stimulusId, aois)
  if (!slots) return []
  const { reader, totalSlots, noAoiSlot, anyFixationSlot, hiddenAoisSet, aoiLookup } = slots
  const counts = new Array<number>(totalSlots).fill(0)
  const { startIndex, endIndex } = reader.getSegmentRange(ctx.stimulusId, ctx.participantId)
  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== 0) continue
    const start = reader.getSegmentStart(i)
    const end = reader.getSegmentEnd(i)
    if (ctx.timeEnd > 0 && start >= ctx.timeEnd) continue
    if (end <= ctx.timeStart) continue
    counts[anyFixationSlot]++
    const rawAois = reader.getRawAois(i)
    let hasAoi = false
    for (let r = 0; r < rawAois.length; r++) {
      if (hiddenAoisSet?.has(rawAois[r])) continue
      const slot = aoiLookup.get(engine.getAoiMapping(ctx.stimulusId, rawAois[r]))
      if (slot !== undefined) { counts[slot]++; hasAoi = true }
    }
    if (!hasAoi) counts[noAoiSlot]++
  }
  return counts
}

function _getSlots(engine: DataEngine, ctx: MetricComputeContext): number[] {
  let map = _cache.get(engine)
  if (!map) { map = new Map(); _cache.set(engine, map) }
  const key = `${ctx.stimulusId}:${ctx.participantId}:${ctx.timeStart}:${ctx.timeEnd}`
  if (!map.has(key)) map.set(key, _scan(engine, ctx))
  return map.get(key)!
}

defineMetric({
  id: 'averageFixationCount',
  label: 'Fixation count',
  description: 'Total count of fixations on the AOI. Unlike visit count, each fixation separated by a saccade is counted even within the same visit.',
  unit: 'count',
  category: 'counts',
  outputShape: 'aoi-vector',
  windowUnit: 'ms',
  computationModes: ['global', 'epoch', 'sliding'],
  searchTags: ['fixation', 'count', 'number', 'fix', 'aoi'],
  compute: (engine: DataEngine, ctx: MetricComputeContext, instance: MetricInstance) => {
    if (instance.windowing) {
      const { mode, windowSize, stepSize, reduction } = instance.windowing
      return applyGroupedTimeWindowing(
        mode, windowSize, stepSize ?? windowSize,
        ctx.timeStart, ctx.timeEnd, reduction,
        (tStart, tEnd) => _getSlots(engine, { ...ctx, timeStart: tStart, timeEnd: tEnd })
      )
    }
    return _getSlots(engine, ctx)
  },
  createScanner: (totalSlots, noAoiSlot, anyFixSlot) => {
    const counts = new Array<number>(totalSlots).fill(0)
    return {
      push(_start, _dur, slots) {
        counts[anyFixSlot]++
        if (slots.length === 0) { counts[noAoiSlot]++; return }
        for (const s of slots) counts[s]++
      },
      finalize: () => counts,
    }
  },
})
