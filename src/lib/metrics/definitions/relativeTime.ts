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
  const dwell = new Array<number>(totalSlots).fill(0)
  const { startIndex, endIndex } = reader.getSegmentRange(ctx.stimulusId, ctx.participantId)
  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== 0) continue
    const start = reader.getSegmentStart(i)
    const end = reader.getSegmentEnd(i)
    if (ctx.timeEnd > 0 && start >= ctx.timeEnd) continue
    if (end <= ctx.timeStart) continue
    const dur = end - start
    dwell[anyFixationSlot] += dur
    const rawAois = reader.getRawAois(i)
    let hasAoi = false
    for (let r = 0; r < rawAois.length; r++) {
      if (hiddenAoisSet?.has(rawAois[r])) continue
      const slot = aoiLookup.get(engine.getAoiMapping(ctx.stimulusId, rawAois[r]))
      if (slot !== undefined) { dwell[slot] += dur; hasAoi = true }
    }
    if (!hasAoi) dwell[noAoiSlot] += dur
  }
  return dwell
}

function _getSlots(engine: DataEngine, ctx: MetricComputeContext): number[] {
  let map = _cache.get(engine)
  if (!map) { map = new Map(); _cache.set(engine, map) }
  const key = `${ctx.stimulusId}:${ctx.participantId}:${ctx.timeStart}:${ctx.timeEnd}`
  if (!map.has(key)) map.set(key, _scan(engine, ctx))
  return map.get(key)!
}

function _computeAllSlots(engine: DataEngine, ctx: MetricComputeContext): number[] {
  const dwell = _getSlots(engine, ctx)
  let total = 0
  for (const d of dwell) total += d
  return dwell.map(d => total > 0 ? (d / total) * 100 : 0)
}

defineMetric({
  id: 'relativeTime',
  label: 'Relative dwell time',
  description: 'Dwell time as a percentage of total fixation time on the stimulus. Normalises attention across participants with different overall scan durations.',
  unit: '%',
  category: 'duration',
  outputShape: 'aoi-vector',
  windowUnit: 'ms',
  computationModes: ['global', 'epoch', 'sliding'],
  searchTags: ['dwell', 'gaze', 'time', 'relative', 'percent', 'proportion', 'duration', 'aoi'],
  compute: (engine: DataEngine, ctx: MetricComputeContext, instance: MetricInstance) => {
    if (instance.windowing) {
      const { mode, windowSize, stepSize, reduction } = instance.windowing
      return applyGroupedTimeWindowing(
        mode, windowSize, stepSize ?? windowSize,
        ctx.timeStart, ctx.timeEnd, reduction,
        (tStart, tEnd) => _computeAllSlots(engine, { ...ctx, timeStart: tStart, timeEnd: tEnd })
      )
    }
    return _computeAllSlots(engine, ctx)
  },
  createScanner: (totalSlots, noAoiSlot, anyFixSlot) => {
    const dwell = new Array<number>(totalSlots).fill(0)
    return {
      push(_start, dur, slots) {
        dwell[anyFixSlot] += dur
        if (slots.length === 0) { dwell[noAoiSlot] += dur; return }
        for (const s of slots) dwell[s] += dur
      },
      finalize() {
        let total = 0; for (const d of dwell) total += d
        return dwell.map(d => total > 0 ? (d / total) * 100 : 0)
      },
    }
  },
})
