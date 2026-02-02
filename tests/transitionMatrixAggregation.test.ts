import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectTransitionMetrics } from '../src/lib/plots/transition-matrix/core/collector'
import {
  transformToRelativeFrequency,
  transformToProbability,
  transformToKStepProbability,
  transformToAverageDwellTime,
} from '../src/lib/plots/transition-matrix/core/transformer'
import { getSegments } from '$lib/data/engine'

vi.mock('$lib/data/engine', () => ({
  getSegments: vi.fn(),
}))

describe('Transition Matrix Aggregation', () => {
  const stimulusId = 1
  const aois = [
    { id: 1, displayedName: 'AOI A' },
    { id: 2, displayedName: 'AOI B' },
  ] as any
  const participantIds = [101]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Collector (collectTransitionMetrics)', () => {
    it('collects transitions in fixation mode', () => {
      // Segments: A -> B -> A -> (No AOI)
      const mockedSegments = [
        { start: 0, end: 100, aoi: [{ id: 1 }] },
        { start: 100, end: 200, aoi: [{ id: 2 }] },
        { start: 200, end: 300, aoi: [{ id: 1 }] },
        { start: 300, end: 400, aoi: [] },
      ]
      vi.mocked(getSegments).mockReturnValue(mockedSegments as any)

      const result = collectTransitionMetrics(
        stimulusId,
        participantIds,
        aois,
        'fixation'
      )

      // size = 2 aois + 1 (Outside) = 3
      // A(0), B(1), Outside(2)
      // Matrix (flat row-major):
      // Row 0 (A): [A->A, A->B, A->Out]
      // Row 1 (B): [B->A, B->B, B->Out]
      // Row 2 (Out): [Out->A, Out->B, Out->Out]

      // Transitions:
      // A -> B (Row 0, Col 1) -> Index 0*3 + 1 = 1
      // B -> A (Row 1, Col 0) -> Index 1*3 + 0 = 3
      // A -> Outside (Row 0, Col 2) -> Index 0*3 + 2 = 2

      expect(result.sumMatrix[1]).toBe(1)
      expect(result.sumMatrix[3]).toBe(1)
      expect(result.sumMatrix[2]).toBe(1)
      expect(result.totalTransitions).toBe(3)
    })

    it('collects transitions in visit mode (combines same-AOI segments)', () => {
      // Segments: A -> A -> B -> B -> A
      const mockedSegments = [
        { start: 0, end: 100, aoi: [{ id: 1 }] },
        { start: 100, end: 200, aoi: [{ id: 1 }] },
        { start: 200, end: 300, aoi: [{ id: 2 }] },
        { start: 300, end: 400, aoi: [{ id: 2 }] },
        { start: 400, end: 500, aoi: [{ id: 1 }] },
      ]
      vi.mocked(getSegments).mockReturnValue(mockedSegments as any)

      const result = collectTransitionMetrics(
        stimulusId,
        participantIds,
        aois,
        'visit'
      )

      // Transitions:
      // Visit 1 (A: 0-200) -> Visit 2 (B: 200-400) -> Transition A->B (Idx 1)
      // Visit 2 (B: 200-400) -> Visit 3 (A: 400-500) -> Transition B->A (Idx 3)

      expect(result.sumMatrix[1]).toBe(1)
      expect(result.sumMatrix[3]).toBe(1)
      expect(result.totalTransitions).toBe(2)

      // Dwell times:
      // Visit 1 duration = 200. Transition A->B should record dwell of A = 200.
      // Visit 2 duration = 200. Transition B->A should record dwell of B = 200.
      expect(result.dwellTimeMatrix[1]).toBe(200)
      expect(result.dwellTimeMatrix[3]).toBe(200)
    })
  })

  describe('Transformers', () => {
    const size = 2 // Simple 2x2 for testing (e.g. AOI A and Outside)
    // 0: A, 1: Outside

    it('transformToRelativeFrequency', () => {
      const matrix = new Float64Array([10, 20, 30, 40])
      const total = 100
      const result = transformToRelativeFrequency(matrix, total)
      expect(result).toEqual(new Float64Array([10, 20, 30, 40]))
    })

    it('transformToProbability (row-normalized)', () => {
      // Row 0: 10, 10 -> Sum 20 -> 50%, 50%
      // Row 1: 0, 100 -> Sum 100 -> 0%, 100%
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
      // Probability Matrix P:
      // 0.5  0.5
      // 1.0  0.0
      // P^2 = [0.5*0.5 + 0.5*1.0, 0.5*0.5 + 0.5*0.0] = [0.75, 0.25]
      //       [1.0*0.5 + 0.0*1.0, 1.0*0.5 + 0.0*0.0] = [0.5, 0.5]
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
