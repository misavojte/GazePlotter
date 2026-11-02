import { describe, it, expect } from 'vitest'
import { ALL_CAPS, makeTestEngine, testInstance } from './helpers/testEngine'
import { instanceMatchesContract, queryGroup, type PlotMetricContract } from '../src/lib/metrics'
import { resolvedThreshold } from '../src/lib/plots/scanpath-similarity/core/transformer'
import type { ScanpathSimilarityData } from '../src/lib/plots/scanpath-similarity/types'
import type { DataEngine } from '../src/lib/data/engine/dataEngine.svelte'

/** [start, end, x, y]; NaN x = a fixation without coordinates. */
type Fix = [number, number, number, number]

const STIM = 1

/** One engine, participants' fixations on stimulus 1. */
function engineOf(participants: Fix[][]): DataEngine {
  const stimuli = [[], participants]
  return makeTestEngine(
    stimuli.map(ps => ps.map(fs => fs.map(([s, e]) => [s, e, 0]))),
    {
      capabilities: ALL_CAPS,
      spatial: stimuli.map(ps => ps.map(fs => fs.map(([, , x, y]) => (Number.isNaN(x) ? null : [x, y])))),
    }
  )
}

function overlapMatrix(engine: DataEngine, radius: number, timeStart = 0, timeEnd = 0) {
  const inst = testInstance('heatmapOverlap', { kind: 'identity-participant-pair-matrix' }, { params: { radius } })
  const participantIds = engine.metadata!.participants.data.map((_, i) => i)
  const result = queryGroup(inst, { engine, stimulusId: STIM, participantIds, timeStart, timeEnd })
  if (result.shape !== 'participant-pair-matrix') throw new Error(`unexpected shape ${result.shape}`)
  return (i: number, j: number) => result.matrix[i * result.size + j]
}

describe('heatmapOverlap', () => {
  const engine = engineOf([
    [[0, 100, 100, 100], [100, 300, 400, 100]],
    [[0, 100, 100, 100], [100, 300, 400, 100]], // identical to P0
    [[0, 300, 800, 500]], // far from everyone
    [[0, 100, 110, 100], [100, 300, 400, 100]], // P0 with the first fixation nudged
  ])

  it('is 1 for identical maps, 0 for disjoint ones, symmetric, with diagonal 1', () => {
    const m = overlapMatrix(engine, 50)
    expect(m(0, 1)).toBe(1)
    expect(m(0, 2)).toBe(0)
    expect(m(0, 0)).toBe(1)
    expect(m(0, 3)).toBe(m(3, 0))
    expect(m(0, 3)).toBeGreaterThan(0.9)
    expect(m(0, 3)).toBeLessThan(1)
  })

  it('weights by fixation duration: a shared spot counts by its share of time', () => {
    // P0 spends 1/3 of its time where P4 spends all of it.
    const e = engineOf([
      [[0, 100, 100, 100], [100, 300, 400, 100]],
      [[0, 300, 100, 100]],
    ])
    expect(overlapMatrix(e, 50)(0, 1)).toBeCloseTo(1 / 3, 2)
  })

  it('rises with the radius for nearby but separate fixations', () => {
    const e = engineOf([[[0, 100, 100, 100]], [[0, 100, 140, 100]], [[0, 100, 600, 600]]])
    expect(overlapMatrix(e, 60)(0, 1)).toBeGreaterThan(overlapMatrix(e, 30)(0, 1))
  })

  it('clips fixations to the time range', () => {
    // Same first second, different afterwards.
    const e = engineOf([
      [[0, 1000, 100, 100], [1000, 2000, 400, 100]],
      [[0, 1000, 100, 100], [1000, 2000, 700, 500]],
    ])
    expect(overlapMatrix(e, 50)(0, 1)).toBeCloseTo(0.5, 2)
    expect(overlapMatrix(e, 50, 0, 1000)(0, 1)).toBe(1)
  })

  it('has no value for a participant without a located fixation', () => {
    const e = engineOf([[[0, 100, 100, 100]], [[0, 100, NaN, NaN]], [[0, 100, 100, 100]]])
    const m = overlapMatrix(e, 50)
    expect(m(1, 1)).toBeNaN()
    expect(m(0, 1)).toBeNaN()
    expect(m(0, 2)).toBe(1)
  })

  it('is hidden for datasets without coordinates', () => {
    const contract = {
      outputShape: 'participant-pair-matrix',
      windowing: 'forbidden',
      crossParticipant: 'group-axis',
    } as const satisfies PlotMetricContract
    const inst = testInstance('heatmapOverlap', { kind: 'identity-participant-pair-matrix' })
    expect(instanceMatchesContract(inst, contract, ALL_CAPS)).toBe(true)
    expect(instanceMatchesContract(inst, contract, { ...ALL_CAPS, spatial: false })).toBe(false)
  })
})

describe('scangraph Auto threshold', () => {
  // Pairs (0,1) 0.9, (0,2) 0.8, (1,2) 0.7: a high-baseline metric.
  const sim: ScanpathSimilarityData = {
    labels: ['a', 'b', 'c'],
    participantIds: [0, 1, 2],
    matrix: Float64Array.from([1, 0.9, 0.8, 0.9, 1, 0.7, 0.8, 0.7, 1]),
    size: 3,
  }

  it('keeps a manual threshold', () => {
    expect(resolvedThreshold(sim, { threshold: 0.75, edgePercent: 5 })).toBe(0.75)
  })

  it('at 0 draws the requested share of pairs', () => {
    expect(resolvedThreshold(sim, { threshold: 0, edgePercent: 34 })).toBe(0.9)
    expect(resolvedThreshold(sim, { threshold: 0, edgePercent: 67 })).toBe(0.8)
  })

  it('links the closest pair when the share rounds down to none', () => {
    expect(resolvedThreshold(sim, { threshold: 0, edgePercent: 5 })).toBe(0.9)
    expect(resolvedThreshold(sim, { threshold: 0, edgePercent: 0 })).toBe(1)
  })
})
