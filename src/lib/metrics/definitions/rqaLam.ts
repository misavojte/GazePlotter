import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois } from '$lib/data/engine'
import { defineMetric } from '../defineMetric'
import { buildAoiSlots } from '../helpers/aoiSlots'
import { applyFixationWindowing } from '../helpers/windowing'
import { computeRqaAoiScalar } from '../rqaAoiCompute'
import type { MetricComputeContext, MetricInstance } from '../types'

const _cache = new WeakMap<object, Map<string, number[]>>()

function _scan(engine: DataEngine, ctx: MetricComputeContext): number[] {
  const aois = getAois(engine, ctx.stimulusId)
  const slots = buildAoiSlots(engine, ctx.stimulusId, aois)
  if (!slots) return []
  const { reader, hiddenAoisSet, aoiLookup } = slots
  const { startIndex, endIndex } = reader.getSegmentRange(ctx.stimulusId, ctx.participantId)
  const seq: number[] = []
  const aoiSet = new Set<number>()
  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== 0) continue
    aoiSet.clear()
    const rawAois = reader.getRawAois(i)
    for (let r = 0; r < rawAois.length; r++) {
      if (hiddenAoisSet?.has(rawAois[r])) continue
      const slot = aoiLookup.get(engine.getAoiMapping(ctx.stimulusId, rawAois[r]))
      if (slot !== undefined) aoiSet.add(slot)
    }
    if (aoiSet.size === 1) seq.push(aoiSet.values().next().value!)
  }
  return seq
}

function _getSeq(engine: DataEngine, ctx: MetricComputeContext): number[] {
  let map = _cache.get(engine)
  if (!map) { map = new Map(); _cache.set(engine, map) }
  const key = `${ctx.stimulusId}:${ctx.participantId}`
  if (!map.has(key)) map.set(key, _scan(engine, ctx))
  return map.get(key)!
}

defineMetric({
  id: 'rqaLam',
  label: 'Laminarity',
  description: 'Laminarity (%): fraction of recurrent fixation pairs forming vertical lines in the recurrence matrix. High values indicate the gaze repeatedly dwells on the same AOI before transitioning.',
  unit: '%',
  category: 'rqa-aoi',
  outputShape: 'aoi-vector',
  windowUnit: 'fixations',
  computationModes: ['global', 'epoch', 'sliding'],
  params: [
    { id: 'v_min', label: 'Min line', type: 'integer', default: 2, min: 2, max: 20 },
  ],
  searchTags: ['rqa', 'laminarity', 'lam', 'vertical', 'nonlinear', 'aoi', 'sequence'],
  compute: (engine: DataEngine, ctx: MetricComputeContext, instance: MetricInstance) => {
    const totalSlots = getAois(engine, ctx.stimulusId).length + 2
    const seq = _getSeq(engine, ctx)
    let scalar: number
    if (instance.windowing) {
      const { mode, windowSize, stepSize, reduction } = instance.windowing
      scalar = applyFixationWindowing(
        mode, windowSize, stepSize ?? 1, reduction,
        sub => computeRqaAoiScalar(instance, sub),
        seq
      )
    } else {
      scalar = computeRqaAoiScalar(instance, seq)
    }
    return new Array<number>(totalSlots).fill(scalar)
  },
  createScanner: (totalSlots, _noAoiSlot, _anyFixSlot, instance) => {
    const seq: number[] = []
    return {
      push(_start, _dur, slots) {
        if (slots.length === 1) seq.push(slots[0])
      },
      finalize() {
        const scalar = computeRqaAoiScalar(instance, seq)
        return new Array<number>(totalSlots).fill(scalar)
      },
    }
  },
})
