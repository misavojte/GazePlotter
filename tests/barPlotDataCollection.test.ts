import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import '../src/lib/metrics/init'
import { query, queryIndividuals, type MetricInstance, type Scope } from '../src/lib/metrics'

// Stimulus 1 has 2 AOIs (raw IDs 1 and 2)
// Slot layout: 0=AOI1, 1=AOI2, 2=noAoi, 3=anyFixation
function createMockEngine(segments: number[][][][]) {
  const reader = createReaderFromJson(segments)

  return {
    metadata: {
      isOrdinalOnly: false,
      capabilities: { segmented: true, spatial: false, event: false },
      aois: {
        data: [
          [],
          [
            null,
            ['AOI 1', 'AOI 1', 'red'],
            ['AOI 2', 'AOI 2', 'blue'],
          ],
        ],
        orderVector: [[], [1, 2]],
        hiddenAois: [[], []],
      },
      categories: {
        data: [['Fixation', 'Fixation', '#000000']],
        orderVector: [],
      },
      participants: {
        data: Array.from({ length: 103 }, (_, i) => [`P${i}`, `P${i}`]),
        orderVector: [],
      },
      participantsGroups: [],
      stimuli: {
        data: [['S0', 'S0'], ['S1', 'S1']],
        orderVector: [],
      },
      noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
      metricInstances: [],
    },
    getReader: () => reader,
    getAoiMapping: (_stimulusId: number, rawId: number) => rawId,
  }
}

const STIM = 1

function inst(baseId: string): MetricInstance {
  return { id: 0, baseId, params: {}, label: '', projection: { kind: 'identity-aoi-vector' } }
}

function scope(engine: any, participantId: number, tStart = 0, tEnd = 0): Scope {
  return { engine, stimulusId: STIM, participantId, timeStart: tStart, timeEnd: tEnd }
}

function values(result: ReturnType<typeof query>): number[] {
  if (result.shape === 'aoi-vector') return result.values
  if (result.shape === 'scalar') return [result.value]
  if (result.shape === 'aoi-pair-matrix') return result.matrix
  return result.values
}

describe('Metric definitions — segment data collection', () => {
  it('absoluteTime: accumulates dwell time across segments with multiple AOIs', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, (_, i) =>
        i === 101
          ? [[0, 100, 0, 1], [100, 300, 0, 1, 2], [300, 350, 0], [350, 500, 0, 2]]
          : []
      ),
    ])

    const result = values(query(inst('absoluteTime'), scope(engine, 101)))
    // slot 0 = AOI1: segments [0,100] and [100,300] → 100+200=300
    expect(result[0]).toBe(300)
    // slot 1 = AOI2: segments [100,300] and [350,500] → 200+150=350
    expect(result[1]).toBe(350)
    // slot 2 = noAoi: segment [300,350] → 50
    expect(result[2]).toBe(50)
    // slot 3 = anyFixation: all fixation segments → 500
    expect(result[3]).toBe(500)
  })

  it('fixationCount: counts fixations per AOI slot', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, (_, i) =>
        i === 101
          ? [[0, 100, 0, 1], [100, 300, 0, 1, 2], [300, 350, 0], [350, 500, 0, 2]]
          : []
      ),
    ])

    const result = values(query(inst('averageFixationCount'), scope(engine, 101)))
    expect(result[0]).toBe(2) // AOI1: 2 fixations
    expect(result[1]).toBe(2) // AOI2: 2 fixations
    expect(result[2]).toBe(1) // noAoi: 1 fixation
    expect(result[3]).toBe(4) // anyFixation: 4
  })

  it('visitCount: consecutive segments in same AOI count as one visit', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, (_, i) =>
        i === 101
          ? [[0, 100, 0, 1], [100, 200, 0, 1], [200, 300, 0, 1]]
          : []
      ),
    ])

    expect(values(query(inst('averageEntries'), scope(engine, 101)))[0]).toBe(1)
  })

  it('visitDuration: consecutive segments in same AOI accumulate as one dwell', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, (_, i) =>
        i === 101
          ? [[0, 100, 0, 1], [100, 200, 0, 1], [200, 300, 0, 1]]
          : []
      ),
    ])

    const dwell = values(query(inst('avgDwellDuration'), scope(engine, 101)))
    // One visit of 300ms total → mean = 300
    expect(dwell[0]).toBe(300)
    expect(queryIndividuals(inst('avgDwellDuration'), scope(engine, 101), 0)).toEqual([300])
  })

  it('visitCount: AOI overlap — both AOIs receive an entry', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, (_, i) =>
        i === 101 ? [[0, 100, 0, 1, 2]] : []
      ),
    ])

    const result = values(query(inst('averageEntries'), scope(engine, 101)))
    expect(result[0]).toBe(1) // AOI1
    expect(result[1]).toBe(1) // AOI2
  })

  it('timeToFirstFixation: captures TTFF from the first segment', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, (_, i) =>
        i === 101 ? [[50, 100, 0, 1]] : []
      ),
    ])

    const result = values(query(inst('timeToFirstFixation'), scope(engine, 101)))
    expect(result[0]).toBe(50)  // AOI1 TTFF
    expect(result[3]).toBe(50)  // anyFixation TTFF
  })

  it('timeToFirstFixation: noAoi fixation before AOI fixation', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, (_, i) =>
        i === 101 ? [[0, 50, 0], [50, 100, 0, 1]] : []
      ),
    ])

    const result = values(query(inst('timeToFirstFixation'), scope(engine, 101)))
    expect(result[2]).toBe(0)   // noAoi TTFF = 0
    expect(result[0]).toBe(50)  // AOI1 TTFF = 50
    expect(result[3]).toBe(0)   // anyFixation TTFF = 0
  })

  it('absoluteTime: returns zeros for participants with no data', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, () => [] as number[][]),
    ])

    const result = values(query(inst('absoluteTime'), scope(engine, 101)))
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(0)
    expect(result[3]).toBe(0)
  })

  it('timeToFirstFixation: returns NaN for participants with no data', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, () => [] as number[][]),
    ])

    expect(Number.isNaN(values(query(inst('timeToFirstFixation'), scope(engine, 101)))[0])).toBe(true)
  })

  it('absoluteTime: correctly separates values across multiple participants', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 103 }, (_, i) => {
        if (i === 101) return [[0, 100, 0, 1]]
        if (i === 102) return [[0, 200, 0, 2]]
        return []
      }),
    ])

    const r101 = values(query(inst('absoluteTime'), scope(engine, 101)))
    const r102 = values(query(inst('absoluteTime'), scope(engine, 102)))
    expect(r101[0]).toBe(100) // P101 AOI1
    expect(r101[1]).toBe(0)   // P101 AOI2
    expect(r102[0]).toBe(0)   // P102 AOI1
    expect(r102[1]).toBe(200) // P102 AOI2
  })
})
