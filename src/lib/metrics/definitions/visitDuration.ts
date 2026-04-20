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
  const dwellDurations: number[][] = Array.from({ length: totalSlots }, () => [])
  const { startIndex, endIndex } = reader.getSegmentRange(ctx.stimulusId, ctx.participantId)

  const previousAois = new Set<number>()
  const activeDwellDurations = new Map<number, number>()
  let wasInNoAoi = false
  let currentNoAoiDwell = 0
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
        currentNoAoiDwell = dur
        currentAnyFixationDwell = dur
        wasInNoAoi = true
      } else {
        currentNoAoiDwell += dur
        currentAnyFixationDwell += dur
      }
      for (const [idx, d] of activeDwellDurations.entries()) {
        dwellDurations[idx].push(d)
      }
      activeDwellDurations.clear()
      previousAois.clear()
    } else {
      if (wasInNoAoi) {
        dwellDurations[noAoiSlot].push(currentNoAoiDwell)
        dwellDurations[anyFixationSlot].push(currentAnyFixationDwell)
        currentNoAoiDwell = 0
        currentAnyFixationDwell = 0
        wasInNoAoi = false
      }

      const setsMatch =
        currentAoiIndices.length === previousAois.size &&
        currentAoiIndices.every(idx => previousAois.has(idx))

      if (previousAois.size > 0 && !setsMatch) {
        if (currentAnyFixationDwell > 0) {
          dwellDurations[anyFixationSlot].push(currentAnyFixationDwell)
        }
        currentAnyFixationDwell = dur
      } else if (previousAois.size === 0) {
        currentAnyFixationDwell = dur
      } else {
        currentAnyFixationDwell += dur
      }

      for (const idx of currentAoiIndices) {
        if (previousAois.has(idx)) {
          activeDwellDurations.set(idx, (activeDwellDurations.get(idx) ?? 0) + dur)
        } else {
          activeDwellDurations.set(idx, dur)
        }
      }

      for (const prevIdx of previousAois) {
        if (!currentAoiIndicesSet.has(prevIdx)) {
          const d = activeDwellDurations.get(prevIdx)
          if (d !== undefined) dwellDurations[prevIdx].push(d)
          activeDwellDurations.delete(prevIdx)
        }
      }

      previousAois.clear()
      for (const idx of currentAoiIndices) previousAois.add(idx)
    }
  }

  for (const [idx, d] of activeDwellDurations.entries()) {
    dwellDurations[idx].push(d)
  }
  if (wasInNoAoi) {
    dwellDurations[noAoiSlot].push(currentNoAoiDwell)
  }
  if (currentAnyFixationDwell > 0) {
    dwellDurations[anyFixationSlot].push(currentAnyFixationDwell)
  }

  return dwellDurations
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
  id: 'avgDwellDuration',
  label: 'Visit duration',
  description: 'Mean duration (ms) per distinct visit to the AOI. A visit begins on first entry and ends when gaze leaves; consecutive fixations in the same AOI accumulate as one visit.',
  unit: 'ms',
  category: 'duration',
  outputShape: 'aoi-vector',
  windowUnit: 'ms',
  computationModes: ['global', 'epoch', 'sliding'],
  searchTags: ['visit', 'dwell', 'duration', 'average', 'mean', 'aoi'],
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
    const dwellDurations: number[][] = Array.from({ length: totalSlots }, () => [])
    const previousAois = new Set<number>()
    const activeDwellDurations = new Map<number, number>()
    let wasInNoAoi = false
    let currentNoAoiDwell = 0
    let currentAnyFixationDwell = 0
    return {
      push(_start, dur, slots) {
        if (slots.length === 0) {
          if (!wasInNoAoi) {
            currentNoAoiDwell = dur; currentAnyFixationDwell = dur; wasInNoAoi = true
          } else {
            currentNoAoiDwell += dur; currentAnyFixationDwell += dur
          }
          for (const [idx, d] of activeDwellDurations.entries()) dwellDurations[idx].push(d)
          activeDwellDurations.clear()
          previousAois.clear()
        } else {
          if (wasInNoAoi) {
            dwellDurations[noAoiSlot].push(currentNoAoiDwell)
            dwellDurations[anyFixSlot].push(currentAnyFixationDwell)
            currentNoAoiDwell = 0; currentAnyFixationDwell = 0; wasInNoAoi = false
          }
          const setsMatch = slots.length === previousAois.size && slots.every(s => previousAois.has(s))
          if (previousAois.size > 0 && !setsMatch) {
            if (currentAnyFixationDwell > 0) dwellDurations[anyFixSlot].push(currentAnyFixationDwell)
            currentAnyFixationDwell = dur
          } else if (previousAois.size === 0) {
            currentAnyFixationDwell = dur
          } else {
            currentAnyFixationDwell += dur
          }
          for (let i = 0; i < slots.length; i++) {
            const idx = slots[i]
            activeDwellDurations.set(idx, (previousAois.has(idx) ? (activeDwellDurations.get(idx) ?? 0) : 0) + dur)
          }
          for (const prevIdx of previousAois) {
            if (!slots.includes(prevIdx)) {
              const d = activeDwellDurations.get(prevIdx)
              if (d !== undefined) { dwellDurations[prevIdx].push(d); activeDwellDurations.delete(prevIdx) }
            }
          }
          previousAois.clear()
          for (let i = 0; i < slots.length; i++) previousAois.add(slots[i])
        }
      },
      finalize() {
        for (const [idx, d] of activeDwellDurations.entries()) dwellDurations[idx].push(d)
        if (wasInNoAoi) dwellDurations[noAoiSlot].push(currentNoAoiDwell)
        if (currentAnyFixationDwell > 0) dwellDurations[anyFixSlot].push(currentAnyFixationDwell)
        return dwellDurations.map(arr => {
          if (arr.length === 0) return Number.NaN
          let sum = 0; for (const d of arr) sum += d
          return sum / arr.length
        })
      },
      extractIndividuals: (aoiIndex) => dwellDurations[aoiIndex] ?? [],
    }
  },
})
