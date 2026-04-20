import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois } from '$lib/data/engine'
import { defineMetric } from '../defineMetric'
import { buildAoiSlots } from '../helpers/aoiSlots'
import type { MetricComputeContext, MetricInstance } from '../types'

const _cache = new WeakMap<object, Map<string, number[]>>()

function _scan(engine: DataEngine, ctx: MetricComputeContext): number[] {
  const aois = getAois(engine, ctx.stimulusId)
  const slots = buildAoiSlots(engine, ctx.stimulusId, aois)
  if (!slots) return []
  const { reader, totalSlots, noAoiSlot, anyFixationSlot, hiddenAoisSet, aoiLookup } = slots
  const first = new Array<number>(totalSlots).fill(-1)
  const { startIndex, endIndex } = reader.getSegmentRange(ctx.stimulusId, ctx.participantId)
  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== 0) continue
    const start = reader.getSegmentStart(i)
    const end = reader.getSegmentEnd(i)
    if (ctx.timeEnd > 0 && start >= ctx.timeEnd) continue
    if (end <= ctx.timeStart) continue
    const dur = end - start
    if (first[anyFixationSlot] === -1) first[anyFixationSlot] = dur
    const rawAois = reader.getRawAois(i)
    let hasAoi = false
    for (let r = 0; r < rawAois.length; r++) {
      if (hiddenAoisSet?.has(rawAois[r])) continue
      const slot = aoiLookup.get(engine.getAoiMapping(ctx.stimulusId, rawAois[r]))
      if (slot !== undefined) {
        if (first[slot] === -1) first[slot] = dur
        hasAoi = true
      }
    }
    if (!hasAoi && first[noAoiSlot] === -1) first[noAoiSlot] = dur
  }
  return first
}

defineMetric({
  id: 'avgFirstFixationDuration',
  label: 'First fixation duration',
  description: 'Duration (ms) of the very first fixation on the AOI. Reflects initial processing depth upon first encounter. Returns NaN if the AOI was never fixated.',
  unit: 'ms',
  category: 'ttf',
  outputShape: 'aoi-vector',
  windowUnit: 'ms',
  searchTags: ['first', 'fixation', 'duration', 'ttf', 'aoi'],
  compute: (engine: DataEngine, ctx: MetricComputeContext, _instance: MetricInstance) => {
    let map = _cache.get(engine)
    if (!map) { map = new Map(); _cache.set(engine, map) }
    const key = `${ctx.stimulusId}:${ctx.participantId}:${ctx.timeStart}:${ctx.timeEnd}`
    if (!map.has(key)) map.set(key, _scan(engine, ctx))
    return map.get(key)!.map(v => v === -1 ? Number.NaN : v)
  },
  createScanner: (totalSlots, noAoiSlot, anyFixSlot) => {
    const first = new Array<number>(totalSlots).fill(-1)
    return {
      push(_start, dur, slots) {
        if (first[anyFixSlot] === -1) first[anyFixSlot] = dur
        if (slots.length === 0) {
          if (first[noAoiSlot] === -1) first[noAoiSlot] = dur
          return
        }
        for (const s of slots) if (first[s] === -1) first[s] = dur
      },
      finalize: () => first.map(v => v === -1 ? Number.NaN : v),
    }
  },
})
