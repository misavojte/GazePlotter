import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAois } from '$lib/data/engine'
import { arraysHaveSameElements } from '$lib/shared/utils/mathUtils'
import { defineMetric } from '../defineMetric'
import type { MetricComputeContext, MetricInstance } from '../types'

// Cache: engine → Map<`${stimulusId}:${participantId}:${mode}`, Float64Array>
// Float64Array: flat row-major, size = (nAois + 1)², last slot = outside AOI
const _cache = new WeakMap<object, Map<string, Float64Array>>()

function _scan(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  mode: 'fixation' | 'visit',
): Float64Array {
  const reader = engine.getReader()
  const meta = engine.metadata
  if (!reader || !meta) return new Float64Array(0)

  const aois = getAois(engine, stimulusId)
  const aoiCount = aois.length
  const size = aoiCount + 1
  const outsideSlot = aoiCount

  const hiddenAois = meta.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenAoisSet = hiddenAois.length ? new Set(hiddenAois) : null

  const aoiLookup = new Map<number, number>()
  for (let i = 0; i < aoiCount; i++) aoiLookup.set(aois[i].id, i)

  const matrix = new Float64Array(size * size)
  const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)

  let prevIndices: number[] = []
  let prevDuration = 0
  let fixationIndex = 0

  for (let seg = startIndex; seg < endIndex; seg++) {
    if (reader.getSegmentCategory(seg) !== 0) continue

    const rawAois = reader.getRawAois(seg)
    let currIndices: number[]

    if (rawAois.length === 0) {
      currIndices = [outsideSlot]
    } else {
      const currentIndexSet = new Set<number>()
      for (let r = 0; r < rawAois.length; r++) {
        const rawId = rawAois[r]
        if (hiddenAoisSet?.has(rawId)) continue
        const idx = aoiLookup.get(engine.getAoiMapping(stimulusId, rawId))
        if (idx !== undefined) currentIndexSet.add(idx)
      }
      currIndices = Array.from(currentIndexSet)
      if (currIndices.length === 0) currIndices.push(outsideSlot)
    }

    if (fixationIndex > 0) {
      const isTransition =
        mode === 'fixation' || !arraysHaveSameElements(prevIndices, currIndices)

      if (isTransition) {
        for (let p = 0; p < prevIndices.length; p++) {
          const from = prevIndices[p]
          const rowOffset = from * size
          for (let c = 0; c < currIndices.length; c++) {
            matrix[rowOffset + currIndices[c]]++
          }
        }
      } else if (mode === 'visit') {
        prevDuration += reader.getSegmentEnd(seg) - reader.getSegmentStart(seg)
        continue
      }
    }

    prevIndices = currIndices
    prevDuration = reader.getSegmentEnd(seg) - reader.getSegmentStart(seg)
    fixationIndex++
  }

  return matrix
}

function _getMatrix(engine: DataEngine, stimulusId: number, participantId: number, mode: 'fixation' | 'visit'): Float64Array {
  let map = _cache.get(engine)
  if (!map) { map = new Map(); _cache.set(engine, map) }
  const key = `${stimulusId}:${participantId}:${mode}`
  if (!map.has(key)) map.set(key, _scan(engine, stimulusId, participantId, mode))
  return map.get(key)!
}

defineMetric({
  id: 'transitionCount',
  label: 'Transition count',
  description: 'Number of times gaze transitioned from one AOI (row) to another AOI (column). In fixation mode every consecutive pair counts; in visit mode only actual AOI changes count. Call with aoiIndex + aoiIndex2 to get a scalar for a specific pair.',
  unit: 'count',
  category: 'transition',
  outputShape: 'aoi-pair-matrix',
  windowUnit: 'ms',
  computationModes: ['global'],
  params: [
    {
      id: 'mode',
      label: 'Count mode',
      type: 'enum',
      default: 'fixation',
      options: [
        { value: 'fixation', label: 'Fixation pairs' },
        { value: 'visit', label: 'Visit changes' },
      ],
    },
  ],
  searchTags: ['transition', 'matrix', 'pair', 'aoi', 'count', 'sequence', 'markov'],
  compute(engine: DataEngine, ctx: MetricComputeContext, instance: MetricInstance): number[] {
    const mode = (instance.params.mode as 'fixation' | 'visit') ?? 'fixation'
    return Array.from(_getMatrix(engine, ctx.stimulusId, ctx.participantId, mode))
  },
})
