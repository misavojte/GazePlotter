/**
 * Formula-level verification for every registered metric. Each test uses a
 * small synthetic dataset and asserts the metric's output against a hand-
 * computed expected value — not against what the code happens to do today.
 *
 * Behaviour-level coverage lives in `barPlotDataCollection.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { AoiGroupReader } from '../src/lib/data/binary/reader.aoiGroup'
import {
  query,
  queryGroup,
  queryIndividuals,
  type MetricInstance,
  type Scope,
  type GroupScope,
} from '../src/lib/metrics'

const STIM = 1
const PID = 0

// Slot layout (2 AOIs): 0=AOI1, 1=AOI2, 2=noAoi, 3=anyFixation

function createEngine(segmentsForPid: number[][]) {
  // segmentsForPid = one participant's segments; shape number[][].
  // createReaderFromJson wants segments[stimulusId][participantId][segIdx][fieldIdx].
  const segments: number[][][][] = [
    [], // stimulus 0: empty
    [segmentsForPid], // stimulus 1: participant 0
  ]
  const reader = createReaderFromJson(segments)
  return {
    metadata: {
      isOrdinalOnly: false,
      capabilities: { segmented: true, spatial: false, event: false },
      aois: {
        data: [
          [],
          [null, ['AOI 1', 'AOI 1', 'red'], ['AOI 2', 'AOI 2', 'blue']],
        ],
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

function createMultiParticipantEngine(perParticipantSegments: number[][][]) {
  // perParticipantSegments[participantId] = that participant's segment rows.
  const segments: number[][][][] = [[], perParticipantSegments]
  const reader = createReaderFromJson(segments)
  const n = perParticipantSegments.length
  return {
    metadata: {
      isOrdinalOnly: false,
      capabilities: { segmented: true, spatial: false, event: false },
      aois: {
        data: [
          [],
          [null, ['AOI 1', 'AOI 1', 'red'], ['AOI 2', 'AOI 2', 'blue']],
        ],
        orderVector: [[], [1, 2]],
        hiddenAois: [[], []],
      },
      categories: { data: [['Fixation', 'Fixation', '#000000']], orderVector: [] },
      participants: { data: Array.from({ length: n }, (_, i) => [`P${i}`, `P${i}`]), orderVector: [] },
      participantsGroups: [],
      stimuli: { data: [['S0', 'S0'], ['S1', 'S1']], orderVector: [] },
      noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
      metricInstances: [],
    },
    getReader: () => reader,
    getAoiMapping: (_s: number, rawId: number) => rawId,
  }
}

/**
 * Engine factory for high-AOI-cardinality stress tests. Generates `n` AOIs
 * with distinct names (so no grouping collapses occur) and lays them out at
 * raw ids 1..n, matching the convention of `createEngine` above.
 */
function createWideEngine(n: number, segmentsForPid: number[][]) {
  const aoiData: (string[] | null)[] = [null]
  const order: number[] = []
  for (let i = 1; i <= n; i++) {
    aoiData.push([`AOI ${i}`, `AOI ${i}`, '#000000'])
    order.push(i)
  }
  const segments: number[][][][] = [[], [segmentsForPid]]
  const reader = createReaderFromJson(segments)
  return {
    metadata: {
      isOrdinalOnly: false,
      capabilities: { segmented: true, spatial: false, event: false },
      aois: {
        data: [[], aoiData],
        orderVector: [[], order],
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

/**
 * Production-realistic engine: uses the real AoiGroupReader.updateMap
 * (sharedMap/sharedSet logic, groupPool population) instead of an identity
 * getAoiMapping mock. Use this for tests that suspect a bug in the grouping
 * or in the interaction between the metric pipeline and the real reader.
 *
 * `aoiNames` controls both AOI count and grouping: repeated names → followers
 * collapse to the first occurrence's rep id.
 * `hiddenRawIds` are the raw ids the user has explicitly hidden.
 */
function createRealEngine(
  aoiNames: string[],
  hiddenRawIds: number[],
  segmentsForPid: number[][],
) {
  // aois.data[1] uses the [null, ...aois] convention so raw id i == data[1][i].
  const aoiData: (string[] | null)[] = [null]
  const order: number[] = []
  for (let i = 0; i < aoiNames.length; i++) {
    aoiData.push([aoiNames[i], aoiNames[i], '#000000'])
    order.push(i + 1)
  }
  const segments: number[][][][] = [[], [segmentsForPid]]
  const reader = createReaderFromJson(segments)

  const metadata = {
    isOrdinalOnly: false,
    capabilities: { segmented: true, spatial: false, event: false },
    aois: {
      data: [[], aoiData],
      orderVector: [[], order],
      hiddenAois: [[], hiddenRawIds],
    },
    categories: { data: [['Fixation', 'Fixation', '#000000']], orderVector: [] },
    participants: { data: [['P0', 'P0']], orderVector: [] },
    participantsGroups: [],
    stimuli: { data: [['S0', 'S0'], ['S1', 'S1']], orderVector: [] },
    noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
    metricInstances: [],
  }

  // Real AoiGroupReader runs the full updateMap (sharedMap + sharedSet +
  // groupPool population) — no identity short-circuit.
  const aoiGroupReader = new AoiGroupReader(reader)
  aoiGroupReader.updateMap(metadata as any)

  return {
    metadata,
    getReader: () => reader,
    getAoiGroupReader: () => aoiGroupReader,
    getAoiMapping: (sId: number, rawId: number) =>
      aoiGroupReader.getAoiMapping(sId, rawId),
  }
}

function inst(baseId: string, params: Record<string, unknown> = {}): MetricInstance {
  // Tests focus on raw formulas — use aoi-vector identity as a safe default;
  // absoluteTime/etc. are aoi-vector and transition metrics explicitly override.
  return {
    id: 't1', baseId, params, label: '',
    projection: baseId.startsWith('transition')
      ? { kind: 'identity-aoi-pair-matrix' }
      : baseId.startsWith('rqa')
        ? { kind: 'identity-scalar' }
        : { kind: 'identity-aoi-vector' },
  }
}

function scope(engine: any): Scope {
  return { engine, stimulusId: STIM, participantId: PID, timeStart: 0, timeEnd: 0 }
}

function values(result: ReturnType<typeof query>): number[] {
  if (result.shape === 'aoi-vector') return result.values
  if (result.shape === 'scalar') return [result.value]
  if (result.shape === 'aoi-pair-matrix') return result.matrix
  if (result.shape === 'participant-pair-matrix') return result.matrix
  if (result.shape === 'aoi-vector-timeseries') return result.vectors.flat()
  return result.values
}

function scalar(result: ReturnType<typeof query>): number {
  if (result.shape === 'scalar') return result.value
  throw new Error(`expected scalar result, got ${result.shape}`)
}

// ─── absoluteTime ───────────────────────────────────────────────────────────

describe('absoluteTime — Σ of fixation durations on the AOI', () => {
  it('multi-AOI fixation contributes its duration to BOTH overlapping AOIs', () => {
    // 3 fixations of 100ms: AOI1, [AOI1, AOI2], AOI2
    //   AOI1: 100 + 100 = 200
    //   AOI2: 100 + 100 = 200
    //   noAoi: 0
    //   anyFixation: 100 + 100 + 100 = 300 (each fixation counted once)
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 1, 2],
      [200, 300, 0, 2],
    ])
    const result = values(query(inst('absoluteTime'), scope(engine)))
    expect(result[0]).toBe(200)
    expect(result[1]).toBe(200)
    expect(result[2]).toBe(0)
    expect(result[3]).toBe(300)
  })
})

// ─── relativeTime ───────────────────────────────────────────────────────────

describe('relativeTime — (absolute / total fixation time) × 100', () => {
  it('non-overlapping AOIs + noAoi sum to 100%; anyFixation = 100%', () => {
    // 3 fixations of 100ms: AOI1, AOI2, noAoi
    //   total fixation time (anyFixation) = 300
    //   expected: AOI1=33.33, AOI2=33.33, noAoi=33.33, anyFixation=100
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 2],
      [200, 300, 0],
    ])
    const result = values(query(inst('relativeTime'), scope(engine)))
    expect(result[0]).toBeCloseTo(100 / 3, 6)
    expect(result[1]).toBeCloseTo(100 / 3, 6)
    expect(result[2]).toBeCloseTo(100 / 3, 6)
    expect(result[3]).toBe(100)
    expect(result[0] + result[1] + result[2]).toBeCloseTo(100, 6)
  })

  it('overlapping AOIs can push AOI sum above 100% (expected)', () => {
    // 1 fixation of 100ms in [AOI1, AOI2]
    //   AOI1=100, AOI2=100, noAoi=0, anyFixation=100
    //   relativeTime: AOI1=100, AOI2=100, noAoi=0, anyFixation=100
    const engine = createEngine([[0, 100, 0, 1, 2]])
    const result = values(query(inst('relativeTime'), scope(engine)))
    expect(result[0]).toBe(100)
    expect(result[1]).toBe(100)
    expect(result[2]).toBe(0)
    expect(result[3]).toBe(100)
  })

  it('zero fixations → NaN (0/0 is undefined, not a real 0%)', () => {
    // No gaze to normalise against: every slot is undefined, so the participant
    // drops out of cross-participant/window reduction instead of deflating it.
    const engine = createEngine([])
    const result = values(query(inst('relativeTime'), scope(engine)))
    expect(result[0]).toBeNaN()
    expect(result[3]).toBeNaN()
  })
})

// ─── fixationCount ──────────────────────────────────────────────────────────

describe('fixationCount — count of fixations landing in AOI', () => {
  it('counts per slot with overlaps and noAoi', () => {
    // 4 fixations: AOI1, [AOI1,AOI2], noAoi, AOI2
    //   AOI1=2, AOI2=2, noAoi=1, anyFixation=4
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 1, 2],
      [200, 300, 0],
      [300, 400, 0, 2],
    ])
    const result = values(query(inst('fixationCount'), scope(engine)))
    expect(result[0]).toBe(2)
    expect(result[1]).toBe(2)
    expect(result[2]).toBe(1)
    expect(result[3]).toBe(4)
  })
})

// ─── fixationDuration ───────────────────────────────────────────────────────

describe('fixationDuration — mean of per-fixation durations on AOI', () => {
  it('averages durations per slot; NaN when no fixations touch the slot', () => {
    // Fixations:
    //   100ms on AOI1, 300ms on AOI1, 200ms on AOI2
    //   mean AOI1 = 200, mean AOI2 = 200, noAoi = NaN, mean anyFixation = 200
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 400, 0, 1],
      [400, 600, 0, 2],
    ])
    const result = values(query(inst('fixationDuration'), scope(engine)))
    expect(result[0]).toBe(200)
    expect(result[1]).toBe(200)
    expect(Number.isNaN(result[2])).toBe(true)
    expect(result[3]).toBe(200)
  })
})

// ─── visitCount ─────────────────────────────────────────────────────────────

describe('visitCount — distinct entries; consecutive-same = one visit', () => {
  it('consecutive fixations on same AOI collapse; re-entry counts again', () => {
    // Fixations: AOI1, AOI1, AOI2, AOI1
    //   AOI1 visits: {0-1}, {3} → 2 entries
    //   AOI2 visits: {2} → 1 entry
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 1],
      [200, 300, 0, 2],
      [300, 400, 0, 1],
    ])
    const result = values(query(inst('visitCount'), scope(engine)))
    expect(result[0]).toBe(2)
    expect(result[1]).toBe(1)
  })
})

// ─── visitDuration ──────────────────────────────────────────────────────────

describe('visitDuration — mean sum-of-durations per visit', () => {
  it('one visit sums all fixation durations; re-entries create new visits', () => {
    // Fixations: AOI1 (0-100), AOI1 (100-200), AOI2 (200-300), AOI1 (300-400)
    //   AOI1 visits: [200ms, 100ms] → mean 150
    //   AOI2 visits: [100ms] → mean 100
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 1],
      [200, 300, 0, 2],
      [300, 400, 0, 1],
    ])
    const result = values(query(inst('visitDuration'), scope(engine)))
    expect(result[0]).toBe(150)
    expect(result[1]).toBe(100)
    expect(queryIndividuals(inst('visitDuration'), scope(engine), 0)).toEqual([200, 100])
  })

  it('counts a trailing zero-duration visit (anyFixation = 0, not dropped to NaN)', () => {
    // A single zero-duration fixation on AOI1 is a real (degenerate) visit; it
    // must be flushed to the anyFixation aggregate as 0, not silently dropped,
    // so anyFixation summarises the same visits as the per-AOI slots.
    const engine = createEngine([[100, 100, 0, 1]])
    const result = values(query(inst('visitDuration'), scope(engine)))
    expect(result[0]).toBe(0) // AOI1 visit dwell = 0 (recorded)
    expect(result[3]).toBe(0) // anyFixation = 0 (counted), not NaN
  })
})

// ─── timeToFirstFixation ────────────────────────────────────────────────────

describe('timeToFirstFixation — segment start of first fixation on AOI', () => {
  it('returns the start time of the first matching fixation; NaN if never', () => {
    // Fixations: noAoi (0-50), AOI1 (50-150)
    //   ttff[AOI1] = 50, ttff[AOI2] = NaN, ttff[noAoi] = 0, ttff[anyFixation] = 0
    const engine = createEngine([
      [0, 50, 0],
      [50, 150, 0, 1],
    ])
    const result = values(query(inst('timeToFirstFixation'), scope(engine)))
    expect(result[0]).toBe(50)
    expect(Number.isNaN(result[1])).toBe(true)
    expect(result[2]).toBe(0)
    expect(result[3]).toBe(0)
  })
})

// ─── firstFixationDuration ──────────────────────────────────────────────────

describe('firstFixationDuration — duration of the first fixation on AOI', () => {
  it('captures the FIRST fixation duration only, not subsequent ones', () => {
    // Fixations: AOI1 (0-100, dur=100), AOI1 (200-500, dur=300)
    //   firstFixDur[AOI1] = 100 (not 200 = mean)
    const engine = createEngine([
      [0, 100, 0, 1],
      [200, 500, 0, 1],
    ])
    const result = values(query(inst('firstFixationDuration'), scope(engine)))
    expect(result[0]).toBe(100)
    expect(Number.isNaN(result[1])).toBe(true)
  })
})

// ─── rqaRec ─────────────────────────────────────────────────────────────────

describe('rqaRec — REC% = 100 × 2R / (N(N−1))', () => {
  it('computes recurrence rate for sequence [1,1,2,1,1]', () => {
    // Single-AOI fixations: AOI1, AOI1, AOI2, AOI1, AOI1 → seq=[0,0,1,0,0] (slot indices)
    // Upper-triangle recurrent pairs (i<j, seq[i]==seq[j]):
    //   (0,1), (0,3), (0,4), (1,3), (1,4), (3,4) → R = 6, N = 5
    //   REC = 100 × 12 / 20 = 60%
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 1],
      [200, 300, 0, 2],
      [300, 400, 0, 1],
      [400, 500, 0, 1],
    ])
    expect(scalar(query(inst('rqaRec'), scope(engine)))).toBeCloseTo(60, 6)
  })

  it('returns 0% when no recurrences exist (all distinct AOIs)', () => {
    // Sequence [AOI1, AOI2] — no recurrent pairs
    //   REC should be 0, not NaN (REC=0 is a real fact, not missing data)
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 2],
    ])
    expect(scalar(query(inst('rqaRec'), scope(engine)))).toBe(0)
  })
})

// ─── rqaDet ─────────────────────────────────────────────────────────────────

describe('rqaDet — DET% = 100 × (points on diagonals ≥ L) / R', () => {
  it('computes determinism for sequence [1,1,2,1,1] with L_min=2', () => {
    // Same as rqaRec: R = 6.
    // Diagonal lines of length ≥ 2 in upper triangle (offset k = j - i):
    //   k=1: matrix values [1,0,0,1] → runs {1},{1}. None ≥ 2.
    //   k=2: [0,1,0] → runs {1}. None ≥ 2.
    //   k=3: [1,1] → run of length 2. DL += 2.
    //   k=4: [1] → length 1.
    // DL = 2
    // DET = 100 × 2 / 6 = 33.333…
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 1],
      [200, 300, 0, 2],
      [300, 400, 0, 1],
      [400, 500, 0, 1],
    ])
    expect(scalar(query(inst('rqaDet'), scope(engine)))).toBeCloseTo(100 / 3, 6)
  })
})

// ─── rqaLam ─────────────────────────────────────────────────────────────────

describe('rqaLam — LAM% = 100 × (HL + VL) / (2R); for symmetric matrix equals VL/R', () => {
  it('computes laminarity for sequence [1,1,2,1,1] with v_min=2', () => {
    // Same matrix as above. Horizontal runs of ≥ 2 in upper triangle:
    //   row 0 (cols 1,2,3,4): matrix [1,0,1,1] → run {cols 3,4} length 2. HL += 2.
    //   row 1 (cols 2,3,4): [0,1,1] → run length 2. HL += 2.
    //   rows 2,3: no runs ≥ 2.
    //   HL = 4
    // Vertical runs of ≥ 2:
    //   col 3 (rows 0,1,2): [1,1,0] → length 2. VL += 2.
    //   col 4 (rows 0,1,2,3): [1,1,0,1] → length 2 then 1. VL += 2.
    //   VL = 4
    // LAM = 100 × (4 + 4) / (2 × 6) = 66.666…
    // Equivalently VL/R = 4/6 = 66.67% — confirms the symmetric identity.
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 1],
      [200, 300, 0, 2],
      [300, 400, 0, 1],
      [400, 500, 0, 1],
    ])
    expect(scalar(query(inst('rqaLam'), scope(engine)))).toBeCloseTo(200 / 3, 6)
  })
})

// ─── transitionCount ────────────────────────────────────────────────────────

describe('transitionCount — count of AOI transitions (fixation pairs or visit changes)', () => {
  it('fixation mode: every consecutive pair counts', () => {
    // Fixations: AOI1, AOI1, AOI2. 2 consecutive pairs: AOI1→AOI1, AOI1→AOI2.
    // Matrix size = 3 (2 AOIs + outside). Row-major [from × size + to].
    //   AOI1→AOI1 (0→0): matrix[0*3+0] = 1
    //   AOI1→AOI2 (0→1): matrix[0*3+1] = 1
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 1],
      [200, 300, 0, 2],
    ])
    const result = values(query(inst('transitionCount', { mode: 'fixation' }), scope(engine)))
    expect(result[0 * 3 + 0]).toBe(1) // AOI1 → AOI1 (consecutive same)
    expect(result[0 * 3 + 1]).toBe(1) // AOI1 → AOI2
    expect(result[1 * 3 + 0]).toBe(0) // AOI2 → AOI1 (didn't happen)
  })

  it('visit mode: AOI-stable consecutive pairs are skipped', () => {
    // Same fixations. Consecutive-same (AOI1→AOI1) is a continuation, not a transition.
    //   Only AOI1→AOI2 counts.
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 1],
      [200, 300, 0, 2],
    ])
    const result = values(query(inst('transitionCount', { mode: 'visit' }), scope(engine)))
    expect(result[0 * 3 + 0]).toBe(0) // no self-transition in visit mode
    expect(result[0 * 3 + 1]).toBe(1) // AOI1 → AOI2 (the real transition)
  })

  it('reduction sum (the extensive default for counts) — queryGroup adds per-participant counts', () => {
    // Two participants, each with 1 AOI1→AOI2 transition.
    //   per-participant matrix[0, 1] = 1
    //   Sum across participants → matrix[0, 1] = 2
    //   (Default 'mean' would give 1, which is WRONG for counts.)
    const engine = createMultiParticipantEngine([
      [[0, 100, 0, 1], [100, 200, 0, 2]],
      [[0, 100, 0, 1], [100, 200, 0, 2]],
    ])
    const groupScope: GroupScope = {
      engine: engine as any,
      stimulusId: STIM,
      participantIds: [0, 1],
    }
    const result = queryGroup(inst('transitionCount', { mode: 'fixation' }), groupScope)
    expect(result.shape).toBe('aoi-pair-matrix')
    if (result.shape !== 'aoi-pair-matrix') throw new Error('expected pair matrix')
    expect(result.matrix[0 * 3 + 1]).toBe(2)
  })
})

// ─── transitionCount: high-AOI-cardinality stress ─────────────────────────

describe('transitionCount — 130-AOI cascade (high cardinality stress)', () => {
  it('fixation mode: cascading A→B→C…→AOI130 produces 129 unique-pair transitions, each count 1', () => {
    // 130 unique AOIs, 130 fixations: fixation i lands in raw AOI (i+1).
    // raw id i+1 → slot i (aoiLookup), so transitions: 0→1, 1→2, …, 128→129.
    // Matrix size = 131 (130 AOIs + outside).
    const N = 130
    const segs: number[][] = []
    for (let i = 0; i < N; i++) segs.push([i * 100, (i + 1) * 100, 0, i + 1])
    const engine = createWideEngine(N, segs)
    const result = values(query(inst('transitionCount', { mode: 'fixation' }), scope(engine)))
    const size = N + 1
    for (let i = 0; i < N - 1; i++) {
      expect(result[i * size + (i + 1)]).toBe(1)
    }
    // No self-transitions, no reverse transitions.
    let total = 0
    for (let i = 0; i < size * size; i++) total += result[i]
    expect(total).toBe(N - 1)
  })

  it('fixation mode: outside→outside self-transitions accumulate across consecutive No-AOI fixations', () => {
    // 5 consecutive No-AOI fixations sandwiched between two real-AOI fixations.
    // Expected transitions:
    //   AOI1 → outside (1)
    //   outside → outside (4)   ← the cell we suspect drops to zero on AdVolution
    //   outside → AOI2 (1)
    const N = 130
    const segs: number[][] = []
    segs.push([0, 100, 0, 1])
    for (let i = 0; i < 5; i++) segs.push([(i + 1) * 100, (i + 2) * 100, 0]) // no AOI
    segs.push([600, 700, 0, 2])
    const engine = createWideEngine(N, segs)
    const result = values(query(inst('transitionCount', { mode: 'fixation' }), scope(engine)))
    const size = N + 1
    const outside = N // outsideSlot index
    expect(result[0 * size + outside]).toBe(1)            // AOI1 → outside
    expect(result[outside * size + outside]).toBe(4)      // outside → outside  (CRITICAL)
    expect(result[outside * size + 1]).toBe(1)            // outside → AOI2
  })

  it('fixation mode: cascade interleaved with 2 No-AOI fixations between each real AOI', () => {
    // Sequence: A1, _, _, A2, _, _, A3, …, A130
    // For each AOI block i (i in 1..N-1):
    //   AOI_i → outside (1)
    //   outside → outside (1)
    //   outside → AOI_{i+1} (1)
    // Per AOI, single fixation → exactly 1 in-edge (from outside) and 1 out-edge (to outside),
    // except AOI 1 has only an out-edge and AOI N only an in-edge.
    // outside self-transitions: N-1.
    const N = 130
    const segs: number[][] = []
    let t = 0
    for (let i = 1; i <= N; i++) {
      segs.push([t, t + 100, 0, i]); t += 100
      if (i < N) {
        segs.push([t, t + 100, 0]); t += 100
        segs.push([t, t + 100, 0]); t += 100
      }
    }
    const engine = createWideEngine(N, segs)
    const result = values(query(inst('transitionCount', { mode: 'fixation' }), scope(engine)))
    const size = N + 1
    const outside = N

    // (outside, outside) self-transitions = N - 1
    expect(result[outside * size + outside]).toBe(N - 1)

    // Each AOI 1..N-1 has exactly one out-edge to outside
    for (let i = 0; i < N - 1; i++) {
      expect(result[i * size + outside]).toBe(1)
    }
    // Each AOI 2..N has exactly one in-edge from outside
    for (let i = 1; i < N; i++) {
      expect(result[outside * size + i]).toBe(1)
    }
    // AOI N has no out-edge; AOI 1 has no in-edge
    expect(result[(N - 1) * size + outside]).toBe(0)
    expect(result[outside * size + 0]).toBe(0)

    // No direct AOI→AOI transitions at all
    for (let from = 0; from < N; from++) {
      for (let to = 0; to < N; to++) {
        expect(result[from * size + to]).toBe(0)
      }
    }

    // Total transitions: (N-1) AOI→outside + (N-1) outside→outside + (N-1) outside→AOI = 3(N-1)
    let total = 0
    for (let i = 0; i < size * size; i++) total += result[i]
    expect(total).toBe(3 * (N - 1))
  })

  it('fixation mode: AOI grouping by shared display name — 130 raw AOIs grouped into 65 reps', () => {
    // 130 raw AOIs, paired so raw (2k-1) and raw (2k) share display name → both map to rep (2k-1).
    // 65 unique reps total. We fire ONE fixation per raw AOI (all 130), alternating
    // pair members (raw 1, then raw 2, then raw 3, raw 4, …). Both members of a pair
    // resolve to the same slot (k-1), so consecutive same-slot fixation pairs produce
    // a slot self-transition (k-1 → k-1). Pair transitions then jump to the next rep.
    //
    // Sequence (slots): 0, 0, 1, 1, 2, 2, …, 64, 64
    // Fixation-mode transitions:
    //   - 65 self-transitions on diagonal (0→0, 1→1, …, 64→64)
    //   - 64 jumps between consecutive reps (0→1, 1→2, …, 63→64)
    // Total: 65 + 64 = 129 transitions.
    const numGroups = 65
    const groupSize = 2
    const totalRaw = numGroups * groupSize // 130
    const aoiData: (string[] | null)[] = [null]
    const order: number[] = []
    for (let i = 1; i <= totalRaw; i++) {
      const groupIdx = Math.floor((i - 1) / groupSize) // 0..64
      const name = `Group ${groupIdx + 1}`
      aoiData.push([name, name, '#000000'])
      order.push(i)
    }
    const segs: number[][] = []
    for (let i = 1; i <= totalRaw; i++) {
      segs.push([(i - 1) * 100, i * 100, 0, i])
    }
    const segments: number[][][][] = [[], [segs]]
    const reader = createReaderFromJson(segments)
    const engine = {
      metadata: {
        isOrdinalOnly: false,
        capabilities: { segmented: true, spatial: false, event: false },
        aois: { data: [[], aoiData], orderVector: [[], order], hiddenAois: [[], []] },
        categories: { data: [['Fixation', 'Fixation', '#000']], orderVector: [] },
        participants: { data: [['P0', 'P0']], orderVector: [] },
        participantsGroups: [],
        stimuli: { data: [['S0', 'S0'], ['S1', 'S1']], orderVector: [] },
        noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
        metricInstances: [],
      },
      getReader: () => reader,
      // Simulate AoiGroupReader: each pair's first raw id is the rep.
      // raw 1,2 → 1 ;  raw 3,4 → 3 ;  …  raw (2k-1), 2k → (2k-1).
      getAoiMapping: (_s: number, rawId: number) =>
        Math.floor((rawId - 1) / groupSize) * groupSize + 1,
    }
    const result = values(query(inst('transitionCount', { mode: 'fixation' }), scope(engine)))
    const size = numGroups + 1 // 66

    // Self-transitions on the diagonal: every adjacent pair-member fires one
    for (let k = 0; k < numGroups; k++) {
      expect(result[k * size + k]).toBe(1)
    }
    // Forward jumps between consecutive reps
    for (let k = 0; k < numGroups - 1; k++) {
      expect(result[k * size + (k + 1)]).toBe(1)
    }
    let total = 0
    for (let i = 0; i < size * size; i++) total += result[i]
    expect(total).toBe(numGroups + (numGroups - 1)) // 65 + 64 = 129
  })

  it('REAL READER: 130 unique AOIs cascade — full AoiGroupReader.updateMap path', () => {
    const N = 130
    const names = Array.from({ length: N }, (_, i) => `AOI ${i + 1}`)
    const segs: number[][] = []
    for (let i = 0; i < N; i++) segs.push([i * 100, (i + 1) * 100, 0, i + 1])
    const engine = createRealEngine(names, [], segs)
    const result = values(query(inst('transitionCount', { mode: 'fixation' }), scope(engine)))
    const size = N + 1
    for (let i = 0; i < N - 1; i++) {
      expect(result[i * size + (i + 1)]).toBe(1)
    }
    let total = 0
    for (let i = 0; i < size * size; i++) total += result[i]
    expect(total).toBe(N - 1)
  })

  it('REAL READER: 40 AOIs, AdVolution-like interleaved cascade A1, _, _, A2, _, _, …', () => {
    // Matches the user's reported symptom shape exactly: single fixation per
    // real AOI, separated by runs of consecutive No-AOI fixations.
    const N = 40
    const names = Array.from({ length: N }, (_, i) => `AOI ${i + 1}`)
    const segs: number[][] = []
    let t = 0
    for (let i = 1; i <= N; i++) {
      segs.push([t, t + 100, 0, i]); t += 100
      if (i < N) {
        segs.push([t, t + 100, 0]); t += 100
        segs.push([t, t + 100, 0]); t += 100
      }
    }
    const engine = createRealEngine(names, [], segs)
    const result = values(query(inst('transitionCount', { mode: 'fixation' }), scope(engine)))
    const size = N + 1
    const outside = N

    // CRITICAL: the cell the user reports as zero in AdVolution
    expect(result[outside * size + outside]).toBe(N - 1)

    for (let i = 0; i < N - 1; i++) {
      expect(result[i * size + outside]).toBe(1)        // AOI_i → outside
    }
    for (let i = 1; i < N; i++) {
      expect(result[outside * size + i]).toBe(1)        // outside → AOI_{i+1}
    }
  })

  it('REAL READER: grouping by shared display name — 130 raw AOIs in 65 named pairs', () => {
    // Each pair shares a display name → AoiGroupReader.updateMap collapses follower
    // to representative via sharedMap. Fixation sequence visits ALL 130 raw ids
    // in order: raw1, raw2, raw3, …, raw130.
    // Slot sequence (after grouping): 0, 0, 1, 1, 2, 2, …, 64, 64.
    // → 65 self-transitions + 64 forward jumps = 129 total.
    const numGroups = 65
    const groupSize = 2
    const totalRaw = numGroups * groupSize
    const names: string[] = []
    for (let i = 0; i < totalRaw; i++) {
      const groupIdx = Math.floor(i / groupSize)
      names.push(`Group ${groupIdx + 1}`)
    }
    const segs: number[][] = []
    for (let i = 1; i <= totalRaw; i++) segs.push([(i - 1) * 100, i * 100, 0, i])

    const engine = createRealEngine(names, [], segs)
    const result = values(query(inst('transitionCount', { mode: 'fixation' }), scope(engine)))
    const size = numGroups + 1

    for (let k = 0; k < numGroups; k++) {
      expect(result[k * size + k]).toBe(1)              // diagonal: pair self-transition
    }
    for (let k = 0; k < numGroups - 1; k++) {
      expect(result[k * size + (k + 1)]).toBe(1)        // forward jump to next rep
    }
    let total = 0
    for (let i = 0; i < size * size; i++) total += result[i]
    expect(total).toBe(numGroups + (numGroups - 1))
  })

  it('REAL READER: hidden AOIs become outside fixations in the transition matrix', () => {
    // 40 unique AOIs, raw ids 10..20 hidden. Sequence: AOI 5, AOI 12 (hidden),
    // AOI 15 (hidden), AOI 18 (hidden), AOI 25. The 3 hidden-AOI fixations collapse
    // to outside (slot index = displayed-aoi-count). Expected fixation-mode transitions:
    //   AOI5 → outside, outside → outside (×2), outside → AOI25.
    const N = 40
    const hidden: number[] = []
    for (let i = 10; i <= 20; i++) hidden.push(i)
    const names = Array.from({ length: N }, (_, i) => `AOI ${i + 1}`)
    const segs: number[][] = [
      [0, 100, 0, 5],
      [100, 200, 0, 12],
      [200, 300, 0, 15],
      [300, 400, 0, 18],
      [400, 500, 0, 25],
    ]
    const engine = createRealEngine(names, hidden, segs)
    const result = values(query(inst('transitionCount', { mode: 'fixation' }), scope(engine)))

    // Displayed AOI count = 40 - 11 (hidden) = 29; outside = 29.
    const displayedCount = N - hidden.length
    const size = displayedCount + 1
    const outside = displayedCount

    // Find slot for raw 5 and raw 25 by looking at order (raws 1..40, hidden 10..20 removed).
    // Visible raws in order: 1..9, 21..40. → raw 5 = slot 4; raw 25 = slot 9 + (25-21) = 13.
    const slot5 = 4
    const slot25 = 13

    expect(result[slot5 * size + outside]).toBe(1)
    expect(result[outside * size + outside]).toBe(2)
    expect(result[outside * size + slot25]).toBe(1)

    // No direct AOI5 → AOI25 leak
    expect(result[slot5 * size + slot25]).toBe(0)

    let total = 0
    for (let i = 0; i < size * size; i++) total += result[i]
    expect(total).toBe(4) // 1 + 2 + 1
  })

  it('REAL READER: 50,000 fixation sequence with No-AOI runs (long-recording stress)', () => {
    // Simulates a 1h+ recording: ~50k fixations, mix of real AOIs and No-AOI.
    // Pattern: every 7th fixation lands in an AOI; the rest are No-AOI.
    // This exercises the long-sequence path without timing flakiness.
    const N = 40
    const names = Array.from({ length: N }, (_, i) => `AOI ${i + 1}`)
    const totalFix = 50_000
    const segs: number[][] = []
    let prevAoiSlot = -1
    let expectedOutsideSelf = 0
    let expectedAoiToOutside = 0
    let expectedOutsideToAoi = 0
    let wasOutside = false
    for (let i = 0; i < totalFix; i++) {
      const isAoi = (i % 7 === 0)
      if (isAoi) {
        const rawId = (i / 7 % N) + 1
        segs.push([i * 100, (i + 1) * 100, 0, rawId])
        if (wasOutside) expectedOutsideToAoi++
        prevAoiSlot = rawId - 1
        wasOutside = false
      } else {
        segs.push([i * 100, (i + 1) * 100, 0])
        if (wasOutside) expectedOutsideSelf++
        else if (prevAoiSlot >= 0) expectedAoiToOutside++
        wasOutside = true
      }
    }
    const engine = createRealEngine(names, [], segs)
    const result = values(query(inst('transitionCount', { mode: 'fixation' }), scope(engine)))
    const size = N + 1
    const outside = N
    expect(result[outside * size + outside]).toBe(expectedOutsideSelf)
    let aoiToOutSum = 0
    let outToAoiSum = 0
    for (let i = 0; i < N; i++) {
      aoiToOutSum += result[i * size + outside]
      outToAoiSum += result[outside * size + i]
    }
    expect(aoiToOutSum).toBe(expectedAoiToOutside)
    expect(outToAoiSum).toBe(expectedOutsideToAoi)
  })

  it('REAL READER: non-zero category segments are skipped (saccades between fixations)', () => {
    // Sequence: AOI1 (fix), saccade (cat=1, with AOI 99), AOI1 (fix), saccade, NoAoi (fix), saccade, NoAoi (fix)
    // Saccades MUST be skipped (getSegmentCategory !== FIXATION_CATEGORY_ID continue).
    // Expected fixation-mode transitions from the surviving fixations [AOI1, AOI1, _, _]:
    //   AOI1 → AOI1 (1)
    //   AOI1 → outside (1)
    //   outside → outside (1)
    const N = 40
    const names = Array.from({ length: N }, (_, i) => `AOI ${i + 1}`)
    const segs: number[][] = [
      [0, 100, 0, 1],      // fixation AOI1
      [100, 150, 1, 99],   // saccade  cat=1 (should be skipped). raw 99 doesn't exist, but category check fires first.
      [150, 250, 0, 1],    // fixation AOI1
      [250, 300, 1],       // saccade
      [300, 400, 0],       // fixation no-AOI
      [400, 450, 1],       // saccade
      [450, 550, 0],       // fixation no-AOI
    ]
    // Need to fix the raw 99 issue: AoiGroupReader.getAoiMapping throws for out-of-range raw ids.
    // For saccades, getRawAois IS called but only if the segment passes the category filter.
    // So this should be safe. But to be defensive, use a valid raw id (1) for the saccade.
    segs[1][3] = 1
    const engine = createRealEngine(names, [], segs)
    const result = values(query(inst('transitionCount', { mode: 'fixation' }), scope(engine)))
    const size = N + 1
    const outside = N
    expect(result[0 * size + 0]).toBe(1)            // AOI1 → AOI1
    expect(result[0 * size + outside]).toBe(1)      // AOI1 → outside
    expect(result[outside * size + outside]).toBe(1) // outside → outside
    let total = 0
    for (let i = 0; i < size * size; i++) total += result[i]
    expect(total).toBe(3)
  })

  it('STALE-CACHE: AOI visibility toggle (in-place updateMap) invalidates cached metric', () => {
    // Different invalidation path: the user keeps the dataset loaded but
    // toggles an AOI's hidden state. DataEngine.updateHiddenAoisBatch
    // re-runs AoiGroupReader.updateMap() with the new metadata — same
    // reader, but the groupPool is rewritten so the AOI→slot resolution
    // changes. The metric result must reflect that, not return the cached
    // pre-toggle matrix.
    //
    // Mechanism: updateMap() bumps AoiGroupReader.version, which is folded
    // into the metric cache key, so the next lookup misses → fresh compute.

    const engine = createRealEngine(
      ['AOI 1', 'AOI 2', 'AOI 3'],
      [],
      [
        [0, 100, 0, 1],
        [100, 200, 0, 2],
        [200, 300, 0, 3],
        [300, 400, 0, 1],
      ],
    )
    const fixCount = inst('fixationCount')

    // Phase 1: all three AOIs visible.
    const before = values(query(fixCount, scope(engine)))
    // slots 0..2 = AOIs, 3 = noAoi, 4 = anyFixation. Counts: [2, 1, 1, 0, 4].
    expect(before[0]).toBe(2)
    expect(before[1]).toBe(1)
    expect(before[2]).toBe(1)
    expect(before[3]).toBe(0)

    // Phase 2: hide AOI 2 (raw id 2). In production, DataEngine.updateHiddenAoisBatch
    // mutates metadata then calls _aoiGroupReader.updateMap(metadata). We mimic
    // that here directly on the helper-built reader.
    engine.metadata.aois.hiddenAois = [[], [2]] as any
    engine.getAoiGroupReader()!.updateMap(engine.metadata as any)

    const after = values(query(fixCount, scope(engine)))
    // AOI 2's fixation now becomes a noAoi fixation; the (now-2-AOI) layout is
    // slots 0..1 = AOI1, AOI3; slot 2 = noAoi; slot 3 = anyFixation.
    // Counts: [2, 1, 1, 4]. Length 4 (was 5).
    expect(after.length).toBe(4)
    expect(after[0]).toBe(2)            // AOI 1 unchanged
    expect(after[1]).toBe(1)            // AOI 3 (moved from slot 2 to slot 1)
    expect(after[2]).toBe(1)            // noAoi now holds AOI 2's fixation
    expect(after[3]).toBe(4)            // anyFixation
  })

  it('STALE-CACHE REPRO: demo-loaded-first → AdVolution serves stale demo matrix', () => {
    // Reproduces production: app boots with demo data, user views the
    // transition matrix in fixation mode (the default) → result cached against
    // the DataEngine instance. User then loads AdVolution → loadDataset
    // mutates the engine in place (same JS object, new reader/metadata).
    // Re-querying the SAME scope hits the WeakMap cache and returns the DEMO
    // matrix — wrong shape and wrong values for AdVolution.
    //
    // Visit mode escapes because in production the user typically views it
    // for the first time AFTER loading AdVolution → no pre-existing cache
    // entry under that params key.

    // --- Phase 1: "demo" — 2 AOIs, view fixation transitions (NOT visit) ---
    const engine: any = createRealEngine(
      ['AOI 1', 'AOI 2'],
      [],
      [
        [0, 100, 0, 1],
        [100, 200, 0, 2],
      ],
    )
    const fixInst = inst('transitionCount', { mode: 'fixation' })
    const visInst = inst('transitionCount', { mode: 'visit' })

    const demoFix = values(query(fixInst, scope(engine)))
    expect(demoFix.length).toBe(9) // 2 AOIs → 3×3

    // --- Phase 2: "AdVolution" — mutate the SAME engine object ---
    const advNames = Array.from({ length: 40 }, (_, i) => `AOI ${i + 1}`)
    const advSegs: number[][] = []
    let t = 0
    for (let i = 1; i <= 40; i++) {
      advSegs.push([t, t + 100, 0, i]); t += 100
      if (i < 40) {
        advSegs.push([t, t + 100, 0]); t += 100
        advSegs.push([t, t + 100, 0]); t += 100
      }
    }
    const advReplacement = createRealEngine(advNames, [], advSegs)
    engine.metadata = advReplacement.metadata
    engine.getReader = advReplacement.getReader
    engine.getAoiGroupReader = advReplacement.getAoiGroupReader
    engine.getAoiMapping = advReplacement.getAoiMapping

    // Visit mode: NOT cached during phase 1 → fresh compute on AdVolution → correct.
    const advVis = values(query(visInst, scope(engine)))
    expect(advVis.length, 'visit matrix is fresh').toBe(1681)

    // Fixation mode: CACHED during phase 1 → returns stale demo matrix.
    const advFix = values(query(fixInst, scope(engine)))
    expect(advFix.length, 'fixation matrix is stale (demo cached)').toBe(1681)
  })

  it('fixation mode: pure No-AOI run produces N-1 outside self-transitions', () => {
    // Pure no-AOI sequence of 10 fixations → 9 (outside, outside) self-transitions.
    const N = 130
    const segs: number[][] = []
    for (let i = 0; i < 10; i++) segs.push([i * 100, (i + 1) * 100, 0])
    const engine = createWideEngine(N, segs)
    const result = values(query(inst('transitionCount', { mode: 'fixation' }), scope(engine)))
    const size = N + 1
    const outside = N
    expect(result[outside * size + outside]).toBe(9)
    let total = 0
    for (let i = 0; i < size * size; i++) total += result[i]
    expect(total).toBe(9)
  })
})

// ─── fixationCount: high-AOI-cardinality stress ─────────────────────────────

describe('fixationCount — 130-AOI cascade (high cardinality stress)', () => {
  it('counts one fixation per AOI when each AOI is visited exactly once', () => {
    const N = 130
    const segs: number[][] = []
    for (let i = 0; i < N; i++) segs.push([i * 100, (i + 1) * 100, 0, i + 1])
    const engine = createWideEngine(N, segs)
    const result = values(query(inst('fixationCount'), scope(engine)))
    // slots: 0..129 = AOIs, 130 = noAoi, 131 = anyFixation
    for (let i = 0; i < N; i++) {
      expect(result[i]).toBe(1)
    }
    expect(result[N]).toBe(0)         // noAoi
    expect(result[N + 1]).toBe(N)     // anyFixation
  })

  it('counts N fixations into one AOI at slot index ≥ 32 (boundary for any 32-bit-shift assumption)', () => {
    // Hit slot 40 (raw id 41) repeatedly. If anything bitmask-encodes AOI ids
    // into a 32-bit int, slot 40 would either collide with slot 8 or vanish.
    const N = 130
    const segs: number[][] = []
    const TARGET_RAW = 41 // slot 40
    for (let i = 0; i < 20; i++) segs.push([i * 100, (i + 1) * 100, 0, TARGET_RAW])
    const engine = createWideEngine(N, segs)
    const result = values(query(inst('fixationCount'), scope(engine)))
    expect(result[40]).toBe(20)
    expect(result[8]).toBe(0) // would be non-zero if (1 << 40) collapsed to (1 << 8)
    expect(result[N + 1]).toBe(20)
  })
})

// ─── transitionDwellSum ─────────────────────────────────────────────────────

describe('transitionDwellSum — Σ of pre-transition durations per AOI pair', () => {
  it('fixation mode: sums the "from" fixation duration across all transitions', () => {
    // 3 fixations: AOI1(0-100, dur 100), AOI1(100-300, dur 200), AOI2(300-600, dur 300).
    //   Transition 1 (fix 0 → fix 1): from=AOI1, dur=100 → matrix[0, 0] += 100
    //   Transition 2 (fix 1 → fix 2): from=AOI1, dur=200 → matrix[0, 1] += 200
    //   Expected: matrix[0, 0] = 100, matrix[0, 1] = 200, rest = 0
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 300, 0, 1],
      [300, 600, 0, 2],
    ])
    const result = values(query(inst('transitionDwellSum', { mode: 'fixation' }), scope(engine)))
    expect(result[0 * 3 + 0]).toBe(100) // AOI1 → AOI1 (dur of first fixation)
    expect(result[0 * 3 + 1]).toBe(200) // AOI1 → AOI2 (dur of second fixation)
    expect(result[1 * 3 + 0]).toBe(0)
    expect(result[1 * 3 + 1]).toBe(0)
  })

  it('visit mode: sums the whole preceding visit duration (merged consecutive same-AOI)', () => {
    // Fixations: AOI1(0-100), AOI1(100-300), AOI2(300-600).
    //   Visit 1: AOI1 over 0..300 → total duration 300
    //   Visit 2: AOI2 over 300..600 → total duration 300
    //   Only transition: visit1(AOI1, 300ms) → visit2(AOI2)
    //   matrix[0, 1] = 300
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 300, 0, 1],
      [300, 600, 0, 2],
    ])
    const result = values(query(inst('transitionDwellSum', { mode: 'visit' }), scope(engine)))
    expect(result[0 * 3 + 1]).toBe(300)
    expect(result[0 * 3 + 0]).toBe(0) // no AOI1→AOI1 visit-transition
  })
})

// ─── transitionRelativeFrequency ────────────────────────────────────────────

describe('transitionRelativeFrequency — per-cell share of participant total, in %', () => {
  it('distributes counts as percentages of the total transition count', () => {
    // 4 fixations: AOI1, AOI2, AOI1, AOI2 → 3 transitions
    //   AOI1→AOI2 twice, AOI2→AOI1 once. total = 3.
    //   matrix[0,1] = 2/3 × 100 = 66.67
    //   matrix[1,0] = 1/3 × 100 = 33.33
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 2],
      [200, 300, 0, 1],
      [300, 400, 0, 2],
    ])
    const result = values(query(inst('transitionRelativeFrequency', { mode: 'fixation' }), scope(engine)))
    expect(result[0 * 3 + 1]).toBeCloseTo(66.6666, 3)
    expect(result[1 * 3 + 0]).toBeCloseTo(33.3333, 3)
    expect(result[0 * 3 + 0]).toBe(0)
    expect(result[1 * 3 + 1]).toBe(0)
    // All cells together must sum to 100%.
    const sum = result.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(100, 3)
  })

  it('emits NaN when the participant has no transitions at all', () => {
    // Single fixation → 0 transitions → all-NaN so group reduce excludes this participant.
    const engine = createEngine([[0, 100, 0, 1]])
    const result = values(query(inst('transitionRelativeFrequency', { mode: 'fixation' }), scope(engine)))
    expect(result.every(v => Number.isNaN(v))).toBe(true)
  })
})

// ─── transitionProbability ──────────────────────────────────────────────────

describe('transitionProbability — row-normalised Markov transition matrix, in %', () => {
  it('step=1: row-normalises counts per "from" AOI', () => {
    // Same sequence: AOI1, AOI2, AOI1, AOI2 → 3 transitions.
    //   Row 0 (from AOI1, 2 out-transitions, both to AOI2): matrix[0,1] = 100%.
    //   Row 1 (from AOI2, 1 out-transition, to AOI1):        matrix[1,0] = 100%.
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 2],
      [200, 300, 0, 1],
      [300, 400, 0, 2],
    ])
    const result = values(query(inst('transitionProbability', { mode: 'fixation', step: 1 }), scope(engine)))
    expect(result[0 * 3 + 1]).toBe(100)
    expect(result[1 * 3 + 0]).toBe(100)
    expect(result[0 * 3 + 0]).toBe(0)
  })

  it('step=2: returns P² (arrive at column after 2 transitions)', () => {
    // P = [[0, 1, 0], [1, 0, 0], [0, 0, 0]].
    // P² = [[1, 0, 0], [0, 1, 0], [0, 0, 0]].  (×100 for percent output)
    //   From AOI1 after 2 transitions → back at AOI1 with 100%.
    //   From AOI2 after 2 transitions → back at AOI2 with 100%.
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 2],
      [200, 300, 0, 1],
      [300, 400, 0, 2],
    ])
    const result = values(query(inst('transitionProbability', { mode: 'fixation', step: 2 }), scope(engine)))
    expect(result[0 * 3 + 0]).toBe(100)
    expect(result[1 * 3 + 1]).toBe(100)
    expect(result[0 * 3 + 1]).toBe(0)
  })

  it('emits NaN when no transitions exist at all', () => {
    const engine = createEngine([[0, 100, 0, 1]])
    const result = values(query(inst('transitionProbability', { mode: 'fixation', step: 1 }), scope(engine)))
    expect(result.every(v => Number.isNaN(v))).toBe(true)
  })

  it('emits NaN (not 0%) for a "from" AOI with no out-transitions', () => {
    // AOI1 → AOI2, then the scan ends: AOI2 is never left, so its row is an
    // undefined distribution. It must be NaN so it drops from cross-participant
    // reduction (keeping group rows summing to 100%), not a row of real 0%.
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 2],
    ])
    const result = values(query(inst('transitionProbability', { mode: 'fixation', step: 1 }), scope(engine)))
    expect(result[0 * 3 + 1]).toBe(100) // from AOI1 → AOI2 (real)
    expect(result[1 * 3 + 0]).toBeNaN() // from AOI2: no out-transition
    expect(result[1 * 3 + 1]).toBeNaN()
    expect(result[1 * 3 + 2]).toBeNaN()
  })
})

// ─── transitionDwellMean ────────────────────────────────────────────────────

describe('transitionDwellMean — per-cell mean of pre-transition dwell times', () => {
  it('fixation mode: cell-wise dwellSum / count', () => {
    // Fixations with durations:
    //   AOI1 (dur 100), AOI2 (dur 300), AOI1 (dur 200).
    //   Transitions:
    //     fix0 (AOI1, 100) → fix1 (AOI2): cell[0,1] dwellSum += 100, count++
    //     fix1 (AOI2, 300) → fix2 (AOI1): cell[1,0] dwellSum += 300, count++
    //   Means:
    //     cell[0,1] = 100/1 = 100
    //     cell[1,0] = 300/1 = 300
    //   Cells with count=0: NaN (not 0 — "no transition to average" ≠ "average is zero").
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 400, 0, 2],
      [400, 600, 0, 1],
    ])
    const result = values(query(inst('transitionDwellMean', { mode: 'fixation' }), scope(engine)))
    expect(result[0 * 3 + 1]).toBe(100)
    expect(result[1 * 3 + 0]).toBe(300)
    expect(Number.isNaN(result[0 * 3 + 0])).toBe(true)
    expect(Number.isNaN(result[1 * 3 + 1])).toBe(true)
  })

  it('averages across multiple transitions into the same cell', () => {
    // Fixations AOI1(dur 100), AOI2(dur 0), AOI1(dur 200), AOI2(dur 0).
    //   Transitions into [0,1] (AOI1→AOI2): twice, dwellSums = [100, 200]; count=2.
    //   Mean = 300 / 2 = 150.
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 100, 0, 2],
      [100, 300, 0, 1],
      [300, 300, 0, 2],
    ])
    const result = values(query(inst('transitionDwellMean', { mode: 'fixation' }), scope(engine)))
    expect(result[0 * 3 + 1]).toBe(150)
  })
})
