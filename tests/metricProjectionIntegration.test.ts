/**
 * End-to-end projection test: ensures that applying a `projection` to a
 * MetricInstance causes `query()` to reshape its result accordingly. Mirrors
 * the engine fixture from metricFormulas.test.ts so the binary reader path
 * is exercised.
 */
import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import {
  query,
  instanceMatchesContract,
  type MetricInstance,
  type PlotMetricContract,
  type Scope,
} from '../src/lib/metrics'

const STIM = 1
const PID = 0

const GLOBAL_SCALAR_CONTRACT: PlotMetricContract = {
  outputShape: 'scalar',
  windowing: 'forbidden',
  multiSelect: true,
}

function createEngine(segmentsForPid: number[][]) {
  const segments: number[][][][] = [[], [segmentsForPid]]
  const reader = createReaderFromJson(segments)
  return {
    metadata: {
      isOrdinalOnly: false,
      capabilities: { segmented: true, spatial: false, event: false },
      aois: {
        data: [[], [null, ['Nav', 'Nav', 'red'], ['CTA', 'CTA', 'blue']]],
        orderVector: [[], [1, 2]],
        hiddenAois: [[], []],
      },
      categories: { data: [['Fixation', 'Fixation', '#000000']], orderVector: [] },
      participants: { data: [['P0', 'P0']], orderVector: [] },
      participantsGroups: [],
      stimuli: { data: [['S0', 'S0'], ['S1', 'S1']], orderVector: [] },
      noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
      metricInstances: [],
    },
    getReader: () => reader,
    getAoiMapping: (_s: number, rawId: number) => rawId,
  }
}

const scope = (engine: any): Scope => ({
  engine, stimulusId: STIM, participantId: PID, timeStart: 0, timeEnd: 0,
})

// Segments: [startTime, endTime, categoryId, ...aoiIds]
// category 0 = Fixation. Two fixations: 100ms on Nav, 200ms on CTA.
const SEGMENTS = [
  [0, 100, 0, 1],
  [100, 300, 0, 2],
]

describe('projection via query()', () => {
  it('aoi-vector identity returns raw per-AOI values', () => {
    const engine = createEngine(SEGMENTS)
    const instance: MetricInstance = {
      id: 't1', baseId: 'absoluteTime', params: {}, label: '',
      projection: { kind: 'identity-aoi-vector' },
    }
    const r = query(instance, scope(engine))
    expect(r.shape).toBe('aoi-vector')
    if (r.shape !== 'aoi-vector') return
    expect(r.values[0]).toBe(100) // Nav
    expect(r.values[1]).toBe(200) // CTA
  })

  it('pick-aoi by name reshapes to scalar', () => {
    const engine = createEngine(SEGMENTS)
    const instance: MetricInstance = {
      id: 't1', baseId: 'absoluteTime', params: {}, label: '',
      projection: { kind: 'pick-aoi', aoiRef: { by: 'name', name: 'CTA' } },
    }
    const r = query(instance, scope(engine))
    expect(r.shape).toBe('scalar')
    if (r.shape !== 'scalar') return
    expect(r.value).toBe(200)
    expect(r.provenance.projection).toEqual({ kind: 'pick-aoi', aoiRef: { by: 'name', name: 'CTA' } })
    expect(r.provenance.aoiMissing).toBeUndefined()
  })

  it('pick-aoi missing name sets aoiMissing in provenance', () => {
    const engine = createEngine(SEGMENTS)
    const instance: MetricInstance = {
      id: 't1', baseId: 'absoluteTime', params: {}, label: '',
      projection: { kind: 'pick-aoi', aoiRef: { by: 'name', name: 'DoesNotExist' } },
    }
    const r = query(instance, scope(engine))
    expect(r.shape).toBe('scalar')
    if (r.shape !== 'scalar') return
    expect(Number.isNaN(r.value)).toBe(true)
    expect(r.provenance.aoiMissing).toBe(true)
  })

  it('aggregate-aoi mean excludes noAoi & anyFixation slots', () => {
    const engine = createEngine(SEGMENTS)
    const instance: MetricInstance = {
      id: 't1', baseId: 'absoluteTime', params: {}, label: '',
      projection: { kind: 'aggregate-aoi', reducer: 'mean' },
    }
    const r = query(instance, scope(engine))
    expect(r.shape).toBe('scalar')
    if (r.shape !== 'scalar') return
    expect(r.value).toBe(150) // (100 + 200) / 2
  })

  it('invalid saved instance drops from contract (matrix-aggregate on probability)', () => {
    const invalid: MetricInstance = {
      id: 't1', baseId: 'transitionProbability', params: { mode: 'fixation', step: 1 }, label: '',
      projection: { kind: 'matrix-aggregate', reducer: 'mean' },
    }
    expect(instanceMatchesContract(invalid, GLOBAL_SCALAR_CONTRACT)).toBe(false)
  })

  it('valid saved instance stays in contract (matrix-cell on probability)', () => {
    const valid: MetricInstance = {
      id: 't2', baseId: 'transitionProbability', params: { mode: 'fixation', step: 1 }, label: '',
      projection: {
        kind: 'matrix-cell',
        fromAoi: { by: 'name', name: 'Nav' },
        toAoi:   { by: 'name', name: 'CTA' },
      },
    }
    expect(instanceMatchesContract(valid, GLOBAL_SCALAR_CONTRACT)).toBe(true)
  })

  it('transition matrix + matrix-diagonal → aoi-vector', () => {
    const engine = createEngine(SEGMENTS)
    const instance: MetricInstance = {
      id: 't1', baseId: 'transitionCount', params: { mode: 'fixation' }, label: '',
      projection: { kind: 'matrix-diagonal' },
    }
    const r = query(instance, scope(engine))
    expect(r.shape).toBe('aoi-vector')
  })
})
