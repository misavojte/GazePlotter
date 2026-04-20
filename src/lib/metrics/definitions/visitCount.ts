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
  const entries = new Array<number>(totalSlots).fill(0)
  const { startIndex, endIndex } = reader.getSegmentRange(ctx.stimulusId, ctx.participantId)

  const previousAois = new Set<number>()
  let wasInNoAoi = false
  let currentAnyFixationDwell = 0
  const currentAoiIndicesSet = new Set<number>()

  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== 0) continue
    const start = reader.getSegmentStart(i)
    const end = reader.getSegmentEnd(i)
    if (ctx.timeEnd > 0 && start >= ctx.timeEnd) continue
    if (end <= ctx.timeStart) continue
    const dur = end - start

    currentAoiIndicesSet.clear()
    const rawAois = reader.getRawAois(i)
    for (let r = 0; r < rawAois.length; r++) {
      if (hiddenAoisSet?.has(rawAois[r])) continue
      const slot = aoiLookup.get(engine.getAoiMapping(ctx.stimulusId, rawAois[r]))
      if (slot !== undefined) currentAoiIndicesSet.add(slot)
    }
    const currentAoiIndices = Array.from(currentAoiIndicesSet)

    if (currentAoiIndices.length === 0) {
      if (!wasInNoAoi) {
        entries[noAoiSlot]++
        entries[anyFixationSlot]++
        currentAnyFixationDwell = dur
        wasInNoAoi = true
      } else {
        currentAnyFixationDwell += dur
      }
      previousAois.clear()
    } else {
      const setsMatch =
        currentAoiIndices.length === previousAois.size &&
        currentAoiIndices.every(idx => previousAois.has(idx))

      if (previousAois.size > 0 && !setsMatch) {
        entries[anyFixationSlot]++
        currentAnyFixationDwell = dur
      } else if (previousAois.size === 0) {
        entries[anyFixationSlot]++
        currentAnyFixationDwell = dur
      } else {
        currentAnyFixationDwell += dur
      }

      for (const idx of currentAoiIndices) {
        if (!previousAois.has(idx)) entries[idx]++
      }

      wasInNoAoi = false
      previousAois.clear()
      for (const idx of currentAoiIndices) previousAois.add(idx)
    }
  }

  return entries
}

function _getSlots(engine: DataEngine, ctx: MetricComputeContext): number[] {
  let map = _cache.get(engine)
  if (!map) { map = new Map(); _cache.set(engine, map) }
  const key = `${ctx.stimulusId}:${ctx.participantId}:${ctx.timeStart}:${ctx.timeEnd}`
  if (!map.has(key)) map.set(key, _scan(engine, ctx))
  return map.get(key)!
}

defineMetric({
  id: 'averageEntries',
  label: 'Visit count',
  description: 'Number of distinct visits (entries) to the AOI. Each return after leaving counts as a new visit. Reflects revisitation frequency and scanning strategy.',
  unit: 'count',
  category: 'counts',
  outputShape: 'aoi-vector',
  windowUnit: 'ms',
  computationModes: ['global', 'epoch', 'sliding'],
  searchTags: ['visit', 'entry', 'entries', 'count', 'aoi', 'number', 'transitions'],
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
    const entries = new Array<number>(totalSlots).fill(0)
    const prevAois = new Set<number>()
    let wasInNoAoi = false
    return {
      push(_start, _dur, slots) {
        if (slots.length === 0) {
          if (!wasInNoAoi) { entries[noAoiSlot]++; entries[anyFixSlot]++; wasInNoAoi = true }
          prevAois.clear()
        } else {
          const setsMatch = slots.length === prevAois.size && slots.every(s => prevAois.has(s))
          if (!setsMatch || prevAois.size === 0) entries[anyFixSlot]++
          for (const s of slots) if (!prevAois.has(s)) entries[s]++
          wasInNoAoi = false
          prevAois.clear()
          for (const s of slots) prevAois.add(s)
        }
      },
      finalize: () => entries,
    }
  },
})
