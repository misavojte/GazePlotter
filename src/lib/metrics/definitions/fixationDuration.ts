import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois } from '$lib/data/engine'
import { defineMetric } from '../defineMetric'
import { buildAoiSlots } from '../helpers/aoiSlots'
import { applyGroupedTimeWindowing } from '../helpers/windowing'
import type { MetricComputeContext, MetricInstance } from '../types'

const _cache = new WeakMap<object, Map<string, number[][]>>()

function _scan(engine: DataEngine, ctx: MetricComputeContext): number[][] {
  const aois = getAois(engine, ctx.stimulusId)
  const slots = buildAoiSlots(engine, ctx.stimulusId, aois)
  if (!slots) return []
  const { reader, totalSlots, noAoiSlot, anyFixationSlot, hiddenAoisSet, aoiLookup } = slots
  const durations: number[][] = Array.from({ length: totalSlots }, () => [])
  const { startIndex, endIndex } = reader.getSegmentRange(ctx.stimulusId, ctx.participantId)
  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== 0) continue
    const start = reader.getSegmentStart(i)
    const end = reader.getSegmentEnd(i)
    if (ctx.timeEnd > 0 && start >= ctx.timeEnd) continue
    if (end <= ctx.timeStart) continue
    const dur = end - start
    durations[anyFixationSlot].push(dur)
    const rawAois = reader.getRawAois(i)
    let hasAoi = false
    for (let r = 0; r < rawAois.length; r++) {
      if (hiddenAoisSet?.has(rawAois[r])) continue
      const slot = aoiLookup.get(engine.getAoiMapping(ctx.stimulusId, rawAois[r]))
      if (slot !== undefined) { durations[slot].push(dur); hasAoi = true }
    }
    if (!hasAoi) durations[noAoiSlot].push(dur)
  }
  return durations
}

function _mean(arr: number[]): number {
  if (arr.length === 0) return Number.NaN
  let sum = 0
  for (let i = 0; i < arr.length; i++) sum += arr[i]
  return sum / arr.length
}

function _getScan(engine: DataEngine, ctx: MetricComputeContext): number[][] {
  let map = _cache.get(engine)
  if (!map) { map = new Map(); _cache.set(engine, map) }
  const key = `${ctx.stimulusId}:${ctx.participantId}:${ctx.timeStart}:${ctx.timeEnd}`
  if (!map.has(key)) map.set(key, _scan(engine, ctx))
  return map.get(key)!
}

function _computeAllSlots(engine: DataEngine, ctx: MetricComputeContext): number[] {
  return _getScan(engine, ctx).map(_mean)
}

defineMetric({
  id: 'avgFixationDuration',
  label: 'Fixation duration',
  description: 'Mean duration (ms) of individual fixations on the AOI. Longer fixations typically indicate deeper cognitive processing.',
  unit: 'ms',
  category: 'duration',
  outputShape: 'aoi-vector',
  windowUnit: 'ms',
  computationModes: ['global', 'epoch', 'sliding'],
  searchTags: ['fixation', 'duration', 'average', 'mean', 'fix', 'aoi'],
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
  extractIndividuals: (engine: DataEngine, ctx: MetricComputeContext, aoiIndex: number) =>
    _getScan(engine, ctx)[aoiIndex] ?? [],
  createScanner: (totalSlots, noAoiSlot, anyFixSlot) => {
    const durations: number[][] = Array.from({ length: totalSlots }, () => [])
    return {
      push(_start, dur, slots) {
        durations[anyFixSlot].push(dur)
        if (slots.length === 0) { durations[noAoiSlot].push(dur); return }
        for (const s of slots) durations[s].push(dur)
      },
      finalize() {
        return durations.map(arr => {
          if (arr.length === 0) return Number.NaN
          let sum = 0; for (const d of arr) sum += d
          return sum / arr.length
        })
      },
      extractIndividuals: (aoiIndex) => durations[aoiIndex] ?? [],
    }
  },
})
