import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { collectTransitionMetrics } from '../src/lib/plots/transition-matrix/core/collector'
import {
  transformToRelativeFrequency,
  transformToProbability,
  transformToKStepProbability,
  transformToAverageDwellTime,
} from '../src/lib/plots/transition-matrix/core/transformer'

function createMockEngine(segments: number[][][][]) {
  const reader = createReaderFromJson(segments)

  return {
    metadata: {
      isOrdinalOnly: false,
      aois: {
        data: [[], [
          ['AOI A', 'AOI A', 'red'],
          ['AOI B', 'AOI B', 'blue'],
        ]],
        orderVector: [[], [1, 2]],
        hiddenAois: [[], []],
      },
      categories: {
        data: [['Fixation', 'Fixation', '#000000']],
        orderVector: [],
      },
      participants: {
        data: Array.from({ length: 102 }, (_, i) => [`P${i}`, `P${i}`]),
        orderVector: [],
      },
      participantsGroups: [],
      stimuli: {
        data: [['S0', 'S0'], ['S1', 'S1']],
        orderVector: [],
      },
      noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
    },
    getReader: () => reader,
    getAoiMapping: (_stimulusId: number, rawId: number) => rawId,
  }
}

describe('Transition Matrix Aggregation', () => {
  const stimulusId = 1
  const aois = [
    { id: 1, displayedName: 'AOI A' },
    { id: 2, displayedName: 'AOI B' },
  ] as any
  const participantIds = [101]

  describe('Collector (collectTransitionMetrics)', () => {
    it('collects transitions in fixation mode', () => {
      const engine = createMockEngine([
        [],
        Array.from({ length: 102 }, (_, participantId) =>
          participantId === 101
            ? [
                [0, 100, 0, 1],
                [100, 200, 0, 2],
                [200, 300, 0, 1],
                [300, 400, 0],
              ]
            : []
        ),
      ])

      const result = collectTransitionMetrics(
        engine as any,
        stimulusId,
        participantIds,
        aois,
        'fixation'
      )

      expect(result.sumMatrix[1]).toBe(1)
      expect(result.sumMatrix[3]).toBe(1)
      expect(result.sumMatrix[2]).toBe(1)
      expect(result.totalTransitions).toBe(3)
    })

    it('collects transitions in visit mode (combines same-AOI segments)', () => {
      const engine = createMockEngine([
        [],
        Array.from({ length: 102 }, (_, participantId) =>
          participantId === 101
            ? [
                [0, 100, 0, 1],
                [100, 200, 0, 1],
                [200, 300, 0, 2],
                [300, 400, 0, 2],
                [400, 500, 0, 1],
              ]
            : []
        ),
      ])

      const result = collectTransitionMetrics(
        engine as any,
        stimulusId,
        participantIds,
        aois,
        'visit'
      )

      expect(result.sumMatrix[1]).toBe(1)
      expect(result.sumMatrix[3]).toBe(1)
      expect(result.totalTransitions).toBe(2)
      expect(result.dwellTimeMatrix[1]).toBe(200)
      expect(result.dwellTimeMatrix[3]).toBe(200)
    })
  })

  describe('Transformers', () => {
    it('transformToRelativeFrequency', () => {
      const matrix = new Float64Array([10, 20, 30, 40])
      const total = 100
      const result = transformToRelativeFrequency(matrix, total)
      expect(result).toEqual(new Float64Array([10, 20, 30, 40]))
    })

    it('transformToProbability (row-normalized)', () => {
      const matrix = new Float64Array([10, 10, 0, 100])
      const result = transformToProbability(matrix, 2)
      expect(result).toEqual(new Float64Array([50, 50, 0, 100]))
    })

    it('transformToAverageDwellTime', () => {
      const dwellTime = new Float64Array([1000, 500])
      const dwellCount = new Int32Array([10, 2])
      const result = transformToAverageDwellTime(dwellTime, dwellCount)
      expect(result).toEqual(new Float64Array([100, 250]))
    })

    it('transformToKStepProbability (2-step)', () => {
      const matrix = new Float64Array([1, 1, 1, 0])
      const result = transformToKStepProbability(matrix, 2, 2)
      expect(result).toEqual(new Float64Array([75, 25, 50, 50]))
    })
  })

  describe('Edge Cases', () => {
    it('handles zero transitions in relative frequency', () => {
      const result = transformToRelativeFrequency(new Float64Array([0, 0]), 0)
      expect(result).toEqual(new Float64Array([0, 0]))
    })

    it('handles zero row sums in probability', () => {
      const result = transformToProbability(new Float64Array([0, 0, 10, 10]), 2)
      expect(result).toEqual(new Float64Array([0, 0, 50, 50]))
    })
  })
})
