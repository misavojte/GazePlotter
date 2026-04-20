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
  const ttff = new Array<number>(totalSlots).fill(-1)
  const { startIndex, endIndex } = reader.getSegmentRange(ctx.stimulusId, ctx.participantId)
  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== 0) continue
    const start = reader.getSegmentStart(i)
    const end = reader.getSegmentEnd(i)
    if (ctx.timeEnd > 0 && start >= ctx.timeEnd) continue
    if (end <= ctx.timeStart) continue
    if (ttff[anyFixationSlot] === -1) ttff[anyFixationSlot] = start
    const rawAois = reader.getRawAois(i)
    let hasAoi = false
    for (let r = 0; r < rawAois.length; r++) {
      if (hiddenAoisSet?.has(rawAois[r])) continue
      const slot = aoiLookup.get(engine.getAoiMapping(ctx.stimulusId, rawAois[r]))
      if (slot !== undefined) {
        if (ttff[slot] === -1) ttff[slot] = start
        hasAoi = true
      }
    }
    if (!hasAoi && ttff[noAoiSlot] === -1) ttff[noAoiSlot] = start
  }
  return ttff
}

defineMetric({
  id: 'timeToFirstFixation',
  label: 'Time to first fixation',
  description: 'Elapsed time (ms) from stimulus onset until the first fixation on the AOI. Lower values mean the region captured attention earlier. Returns NaN if the AOI was never fixated.',
  unit: 'ms',
  category: 'ttf',
  outputShape: 'aoi-vector',
  windowUnit: 'ms',
  searchTags: ['ttff', 'ttf', 'first', 'fixation', 'time', 'latency', 'onset', 'aoi'],
  compute: (engine: DataEngine, ctx: MetricComputeContext, _instance: MetricInstance) => {
    let map = _cache.get(engine)
    if (!map) { map = new Map(); _cache.set(engine, map) }
    const key = `${ctx.stimulusId}:${ctx.participantId}:${ctx.timeStart}:${ctx.timeEnd}`
    if (!map.has(key)) map.set(key, _scan(engine, ctx))
    return map.get(key)!.map(v => v === -1 ? Number.NaN : v)
  },
  createScanner: (totalSlots, noAoiSlot, anyFixSlot) => {
    const ttff = new Array<number>(totalSlots).fill(-1)
    return {
      push(start, _dur, slots) {
        if (ttff[anyFixSlot] === -1) ttff[anyFixSlot] = start
        if (slots.length === 0) {
          if (ttff[noAoiSlot] === -1) ttff[noAoiSlot] = start
          return
        }
        for (const s of slots) if (ttff[s] === -1) ttff[s] = start
      },
      finalize: () => ttff.map(v => v === -1 ? Number.NaN : v),
    }
  },
})
