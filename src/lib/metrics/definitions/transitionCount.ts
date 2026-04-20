import { defineMetric } from '../core/defineMetric'
import { enumParam } from '../core/params'
import { arraysHaveSameElements } from '$lib/shared/utils/mathUtils'

const params = [
  enumParam('mode', 'Count mode', 'fixation' as 'fixation' | 'visit', [
    { value: 'fixation', label: 'Fixation pairs' },
    { value: 'visit',    label: 'Visit changes' },
  ]),
] as const

interface Acc {
  size: number
  matrix: Float64Array
  prevIndices: number[]
  fixationIndex: number
  outsideSlot: number
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
  searchTags: ['transition', 'matrix', 'pair', 'aoi', 'count', 'sequence', 'markov'],
  params,
  init: ({ slots }): Acc => {
    const aoiCount = slots.totalSlots - 2
    const size = aoiCount + 1
    return {
      size,
      matrix: new Float64Array(size * size),
      prevIndices: [],
      fixationIndex: 0,
      outsideSlot: aoiCount,
    }
  },
  onFixation: (acc, { slots }, { params: p }) => {
    const curr: number[] = slots.length === 0 ? [acc.outsideSlot] : [...slots]
    if (acc.fixationIndex > 0) {
      const isTransition = p.mode === 'fixation' || !arraysHaveSameElements(acc.prevIndices, curr)
      if (isTransition) {
        for (let pi = 0; pi < acc.prevIndices.length; pi++) {
          const from = acc.prevIndices[pi]
          const rowOffset = from * acc.size
          for (let c = 0; c < curr.length; c++) acc.matrix[rowOffset + curr[c]]++
        }
      } else if (p.mode === 'visit') {
        // stay within visit: skip updating prevIndices
        return
      }
    }
    acc.prevIndices = curr
    acc.fixationIndex++
  },
  finalize: (acc) => Array.from(acc.matrix),
})
