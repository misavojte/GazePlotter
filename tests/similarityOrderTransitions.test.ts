import { describe, it, expect } from 'vitest'
import { aoiTable, makeTestEngine, testInstance } from './helpers/testEngine'
import { queryGroup } from '../src/lib/metrics'
import { reorderSimilarity, similarityOrder } from '../src/lib/plots/scanpath-similarity/core/order'
import type { ScanpathSimilarityData } from '../src/lib/plots/scanpath-similarity/types'

describe('similarityOrder', () => {
  // Two groups interleaved in list order: {0, 2} and {1, 3}.
  const m = [
    1, 0.1, 0.9, 0.2,
    0.1, 1, 0.1, 0.8,
    0.9, 0.1, 1, 0.1,
    0.2, 0.8, 0.1, 1,
  ]

  it('seats each group side by side, linking the groups at their closest ends', () => {
    const order = similarityOrder(m, 4)
    expect([...order].sort()).toEqual([0, 1, 2, 3])
    const pos = (p: number) => order.indexOf(p)
    expect(Math.abs(pos(0) - pos(2))).toBe(1)
    expect(Math.abs(pos(1) - pos(3))).toBe(1)
    // 0 and 3 are the closest cross-group pair (0.2), so they meet in the middle.
    expect(Math.abs(pos(0) - pos(3))).toBe(1)
  })

  it('is deterministic and handles tiny and missing data', () => {
    expect(similarityOrder(m, 4)).toEqual(similarityOrder(m, 4))
    expect(similarityOrder([], 0)).toEqual([])
    expect(similarityOrder([1], 1)).toEqual([0])
    // Participant 2 has no values: it ends up at an end, never between the pair.
    const withNaN = [1, 0.9, NaN, 0.9, 1, NaN, NaN, NaN, NaN]
    expect(similarityOrder(withNaN, 3).indexOf(2)).not.toBe(1)
  })

  it('reorders labels, ids and both matrix axes together', () => {
    const data: ScanpathSimilarityData = {
      labels: ['a', 'b', 'c', 'd'],
      participantIds: [10, 11, 12, 13],
      matrix: Float64Array.from(m),
      size: 4,
    }
    const out = reorderSimilarity(data, [2, 0, 3, 1])
    expect(out.labels).toEqual(['c', 'a', 'd', 'b'])
    expect(out.participantIds).toEqual([12, 10, 13, 11])
    expect(out.matrix[0 * 4 + 1]).toBe(0.9) // c-a
    expect(out.matrix[2 * 4 + 3]).toBe(0.8) // d-b
    expect(out.matrix[3 * 4 + 3]).toBe(1)
  })
})

describe('transitionSimilarity', () => {
  const { data, order } = aoiTable(['A', 'B'])
  const seq = (aois: number[]) => aois.map((a, k) => [k * 100, (k + 1) * 100, 0, a])
  const engine = makeTestEngine(
    [[], [seq([1, 2, 1, 2]), seq([1, 2, 1, 2]), seq([1, 1, 1, 1]), seq([2, 1, 2, 1])]],
    { aoiData: [[], data], aoiOrderVector: [[], order] }
  )
  const run = (mode: 'visit' | 'fixation') => {
    const inst = testInstance('transitionSimilarity', { kind: 'identity-participant-pair-matrix' }, { params: { mode } })
    const r = queryGroup(inst, { engine, stimulusId: 1, participantIds: [0, 1, 2, 3] })
    if (r.shape !== 'participant-pair-matrix') throw new Error(r.shape)
    return (i: number, j: number) => r.matrix[i * r.size + j]
  }

  it('compares the mix of AOI changes', () => {
    const m = run('visit')
    expect(m(0, 1)).toBe(1)
    expect(m(0, 0)).toBe(1)
    // ABAB: A→B 2, B→A 1. BABA: A→B 1, B→A 2. cos = 4 / 5.
    expect(m(0, 3)).toBe(0.8)
    expect(m(3, 0)).toBe(0.8)
  })

  it('has no value for a participant without transitions', () => {
    const m = run('visit')
    expect(m(2, 2)).toBeNaN()
    expect(m(0, 2)).toBeNaN()
  })

  it('counts staying in an AOI in fixation mode', () => {
    const m = run('fixation')
    expect(m(2, 2)).toBe(1)
    expect(m(0, 2)).toBe(0) // AAAA only stays in A; ABAB never does
  })
})
