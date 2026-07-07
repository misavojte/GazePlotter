/**
 * Equivalence guard for the single-scan fan-out in `runTimeWindowed`.
 *
 * The optimization replaced a per-window re-scan with one scan that dispatches
 * each resolved fixation to every window it overlaps. Correctness claim: the
 * windowed timeseries is identical to running an INDEPENDENT non-windowed query
 * over each window's `[wStart, wStart + windowSize)` scope (the former
 * per-window algorithm). This file checks that against an oracle built from the
 * leaf (non-windowed) path — which still uses `runSingleWindow`/`scanAccumulator`,
 * a code path the fan-out does not touch — for SLIDING windows (step < size),
 * where a single fixation lands in several overlapping windows.
 */
import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { query, type MetricInstance, type Scope } from '../src/lib/metrics'
import type { LeafProjection } from '../src/lib/metrics/core/projection'

const STIM = 1
const PID = 0

// Slot layout (2 AOIs): 0=AOI1, 1=AOI2, 2=noAoi, 3=anyFixation
function createEngine(segmentsForPid: number[][]) {
  const segments: number[][][][] = [[], [segmentsForPid]]
  const reader = createReaderFromJson(segments)
  return {
    metadata: {
      isOrdinalOnly: false,
      capabilities: { segmented: true, spatial: false, event: false },
      aois: {
        data: [[], [null, ['AOI 1', 'AOI 1', 'red'], ['AOI 2', 'AOI 2', 'blue']]],
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

function scope(engine: any, timeStart: number, timeEnd: number): Scope {
  return { engine, stimulusId: STIM, participantId: PID, timeStart, timeEnd }
}

function windowedInst(
  baseId: string,
  inner: LeafProjection,
  windowSize: number,
  stepSize: number
): MetricInstance {
  return {
    id: 'w',
    baseId,
    params: {},
    label: '',
    projection: { kind: 'windowed', window: { windowSize, stepSize }, inner },
  }
}

function leafInst(baseId: string, inner: LeafProjection): MetricInstance {
  return { id: 'l', baseId, params: {}, label: '', projection: inner }
}

/** Independent oracle: per-window non-windowed query over [wStart, wStart+size). */
function oracleTimeline(
  engine: any,
  baseId: string,
  inner: LeafProjection,
  isVector: boolean,
  tStart: number,
  tEnd: number,
  windowSize: number,
  stepSize: number
): { timeline: number[]; cells: number[][] } {
  const timeline: number[] = []
  const cells: number[][] = []
  for (let wStart = tStart; wStart + windowSize <= tEnd; wStart += stepSize) {
    const r = query(leafInst(baseId, inner), scope(engine, wStart, wStart + windowSize))
    timeline.push(wStart)
    // Leaf shapes: 'aoi-vector' exposes `.values`, 'scalar' exposes `.value`.
    if (isVector) {
      cells.push(r.shape === 'aoi-vector' ? r.values : [])
    } else {
      cells.push([r.shape === 'scalar' ? r.value : Number.NaN])
    }
  }
  return { timeline, cells }
}

const sameNum = (a: number, b: number) =>
  (Number.isNaN(a) && Number.isNaN(b)) || a === b

describe('runTimeWindowed fan-out == per-window oracle (sliding windows)', () => {
  // Fixations spanning multiple 200 ms windows on a 50 ms step → each lands in
  // up to 4 overlapping windows, exercising the multi-window dispatch.
  const FIX = [
    [0, 100, 0, 1],
    [100, 250, 0, 2],
    [250, 400, 0, 1],
    [400, 550, 0, 2],
    [560, 600, 0, 1],
  ]
  const WIN = 200
  const STEP = 50
  const T0 = 0
  const T1 = 600

  const cases: Array<{ name: string; baseId: string; inner: LeafProjection; vector: boolean }> = [
    { name: 'absoluteTime (dwell, clipped duration)', baseId: 'absoluteTime', inner: { kind: 'identity-aoi-vector' }, vector: true },
    { name: 'relativeTime (dwell %, clipped)', baseId: 'relativeTime', inner: { kind: 'identity-aoi-vector' }, vector: true },
    { name: 'fixationCount (midpoint membership)', baseId: 'fixationCount', inner: { kind: 'identity-aoi-vector' }, vector: true },
    { name: 'visitCount (midpoint membership)', baseId: 'visitCount', inner: { kind: 'identity-aoi-vector' }, vector: true },
    { name: 'visitDuration (stateful finalize flush)', baseId: 'visitDuration', inner: { kind: 'identity-aoi-vector' }, vector: true },
    { name: 'fixated (binary presence, within-window thresholds)', baseId: 'fixated', inner: { kind: 'identity-aoi-vector' }, vector: true },
    { name: 'fixationCount → aggregate-aoi sum (scalar)', baseId: 'fixationCount', inner: { kind: 'aggregate-aoi', reducer: 'sum' }, vector: false },
  ]

  for (const c of cases) {
    it(`${c.name}`, () => {
      const engine = createEngine(FIX)
      const result = query(windowedInst(c.baseId, c.inner, WIN, STEP), scope(engine, T0, T1))
      const oracle = oracleTimeline(engine, c.baseId, c.inner, c.vector, T0, T1, WIN, STEP)

      if (result.shape !== 'aoi-vector-timeseries' && result.shape !== 'scalar-timeseries') {
        throw new Error(`unexpected shape ${result.shape}`)
      }
      expect(result.timeline).toEqual(oracle.timeline)
      expect(oracle.timeline.length).toBeGreaterThan(1)

      const gotCells: number[][] = c.vector
        ? (result.shape === 'aoi-vector-timeseries' ? result.vectors : [])
        : (result.shape === 'scalar-timeseries' ? result.values.map(v => [v]) : [])
      expect(gotCells).toHaveLength(oracle.cells.length)

      for (let w = 0; w < oracle.cells.length; w++) {
        const expCell = oracle.cells[w]
        const gotCell = gotCells[w]
        for (let s = 0; s < expCell.length; s++) {
          expect(
            sameNum(gotCell[s], expCell[s]),
            `window ${w} (t=${oracle.timeline[w]}) slot ${s}: fan-out=${gotCell[s]} oracle=${expCell[s]}`
          ).toBe(true)
        }
      }
    })
  }

  it('non-overlapping epoch (step === size) also matches the oracle', () => {
    const engine = createEngine(FIX)
    const result = query(windowedInst('absoluteTime', { kind: 'identity-aoi-vector' }, 150, 150), scope(engine, 0, 600))
    const oracle = oracleTimeline(engine, 'absoluteTime', { kind: 'identity-aoi-vector' }, true, 0, 600, 150, 150)
    if (result.shape !== 'aoi-vector-timeseries') throw new Error('shape')
    expect(result.timeline).toEqual(oracle.timeline)
    for (let w = 0; w < oracle.cells.length; w++) {
      for (let s = 0; s < oracle.cells[w].length; s++) {
        expect(sameNum(result.vectors[w][s], oracle.cells[w][s])).toBe(true)
      }
    }
  })

  it('clipped dwell composes: overlapping windows each see only their in-window portion', () => {
    // A single fixation [100, 500] on AOI1; 200 ms windows, 100 ms step over
    // [0, 600]. Each window's AOI1 dwell must equal the in-window overlap, and
    // must match the independent per-window oracle exactly.
    const engine = createEngine([[100, 500, 0, 1]])
    const result = query(windowedInst('absoluteTime', { kind: 'identity-aoi-vector' }, 200, 100), scope(engine, 0, 600))
    const oracle = oracleTimeline(engine, 'absoluteTime', { kind: 'identity-aoi-vector' }, true, 0, 600, 200, 100)
    if (result.shape !== 'aoi-vector-timeseries') throw new Error('shape')
    for (let w = 0; w < oracle.cells.length; w++) {
      expect(result.vectors[w][0]).toBe(oracle.cells[w][0])
    }
  })
})

describe('fused windowed driver — wide stimuli (120 AOIs, array slot-set path)', () => {
  // Past 31 AOI slots the fused driver switches from the bitmask register to
  // the reused scratch array; this pins that path against the same oracle.
  const N_AOIS = 120

  function createWideEngine(segmentsForPid: number[][]) {
    const segments: number[][][][] = [[], [segmentsForPid]]
    const reader = createReaderFromJson(segments)
    const aoiRows: (string[] | null)[] = [null]
    const order: number[] = []
    for (let i = 1; i <= N_AOIS; i++) {
      aoiRows.push([`AOI ${i}`, `AOI ${i}`, 'red'])
      order.push(i)
    }
    return {
      metadata: {
        isOrdinalOnly: false,
        capabilities: { segmented: true, spatial: false, event: false },
        aois: { data: [[], aoiRows], orderVector: [[], order], hiddenAois: [[], []] },
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

  // Fixations spread across high slot ids (> 31), with multi-AOI tags, a
  // DUPLICATE raw id (dedupe invariant), and untagged fixations (noAoi slot).
  const WIDE_FIX: number[][] = []
  for (let i = 0; i < 24; i++) {
    const t = i * 25
    const id = 1 + ((i * 37) % N_AOIS)
    const id2 = 1 + ((i * 53) % N_AOIS)
    WIDE_FIX.push(i % 5 === 0 ? [t, t + 20, 0] : [t, t + 20, 0, id, id2, id])
  }

  for (const baseId of ['absoluteTime', 'relativeTime', 'fixationCount']) {
    it(`${baseId} matches the per-window oracle at ${N_AOIS} AOIs`, () => {
      const engine = createWideEngine(WIDE_FIX)
      const inner: LeafProjection = { kind: 'identity-aoi-vector' }
      const result = query(windowedInst(baseId, inner, 200, 50), scope(engine, 0, 600))
      const oracle = oracleTimeline(engine, baseId, inner, true, 0, 600, 200, 50)
      if (result.shape !== 'aoi-vector-timeseries') throw new Error('shape')
      expect(result.timeline).toEqual(oracle.timeline)
      for (let w = 0; w < oracle.cells.length; w++) {
        for (let s = 0; s < oracle.cells[w].length; s++) {
          expect(
            sameNum(result.vectors[w][s], oracle.cells[w][s]),
            `window ${w} slot ${s}: fused=${result.vectors[w][s]} oracle=${oracle.cells[w][s]}`
          ).toBe(true)
        }
      }
    })
  }
})
