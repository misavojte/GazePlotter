import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import '../src/lib/metrics/init'
import { getMetricDef } from '../src/lib/metrics/defineMetric'

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
const FAKE = { id: 0, baseId: '', params: {}, label: '' }
function ctx(participantId: number, tStart = 0, tEnd = 0) {
  return { stimulusId: STIM, participantId, timeStart: tStart, timeEnd: tEnd }
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

    const def = getMetricDef('absoluteTime')!
    const inst = { ...FAKE, baseId: 'absoluteTime' }
    const result = def.compute(engine as any, ctx(101), inst)
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

    const def = getMetricDef('averageFixationCount')!
    const inst = { ...FAKE, baseId: 'averageFixationCount' }
    const result = def.compute(engine as any, ctx(101), inst)
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

    const def = getMetricDef('averageEntries')!
    const inst = { ...FAKE, baseId: 'averageEntries' }
    expect(def.compute(engine as any, ctx(101), inst)[0]).toBe(1)
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

    const def = getMetricDef('avgDwellDuration')!
    const inst = { ...FAKE, baseId: 'avgDwellDuration' }
    // One visit of 300ms total → mean = 300
    expect(def.compute(engine as any, ctx(101), inst)[0]).toBe(300)
    expect(def.extractIndividuals!(engine as any, ctx(101), 0, inst)).toEqual([300])
  })

  it('visitCount: AOI overlap — both AOIs receive an entry', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, (_, i) =>
        i === 101 ? [[0, 100, 0, 1, 2]] : []
      ),
    ])

    const def = getMetricDef('averageEntries')!
    const inst = { ...FAKE, baseId: 'averageEntries' }
    const result = def.compute(engine as any, ctx(101), inst)
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

    const def = getMetricDef('timeToFirstFixation')!
    const inst = { ...FAKE, baseId: 'timeToFirstFixation' }
    const result = def.compute(engine as any, ctx(101), inst)
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

    const def = getMetricDef('timeToFirstFixation')!
    const inst = { ...FAKE, baseId: 'timeToFirstFixation' }
    const result = def.compute(engine as any, ctx(101), inst)
    expect(result[2]).toBe(0)   // noAoi TTFF = 0
    expect(result[0]).toBe(50)  // AOI1 TTFF = 50
    expect(result[3]).toBe(0)   // anyFixation TTFF = 0
  })

  it('absoluteTime: returns zeros for participants with no data', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, () => [] as number[][]),
    ])

    const def = getMetricDef('absoluteTime')!
    const inst = { ...FAKE, baseId: 'absoluteTime' }
    const result = def.compute(engine as any, ctx(101), inst)
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(0)
    expect(result[3]).toBe(0)
  })

  it('timeToFirstFixation: returns NaN for participants with no data', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, () => [] as number[][]),
    ])

    const def = getMetricDef('timeToFirstFixation')!
    const inst = { ...FAKE, baseId: 'timeToFirstFixation' }
    expect(Number.isNaN(def.compute(engine as any, ctx(101), inst)[0])).toBe(true)
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

    const def = getMetricDef('absoluteTime')!
    const inst = { ...FAKE, baseId: 'absoluteTime' }
    const r101 = def.compute(engine as any, ctx(101), inst)
    const r102 = def.compute(engine as any, ctx(102), inst)
    expect(r101[0]).toBe(100) // P101 AOI1
    expect(r101[1]).toBe(0)   // P101 AOI2
    expect(r102[0]).toBe(0)   // P102 AOI1
    expect(r102[1]).toBe(200) // P102 AOI2
  })
})
