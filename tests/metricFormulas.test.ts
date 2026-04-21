/**
 * Formula-level verification for every registered metric. Each test uses a
 * small synthetic dataset and asserts the metric's output against a hand-
 * computed expected value — not against what the code happens to do today.
 *
 * Behaviour-level coverage lives in `barPlotDataCollection.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import '../src/lib/metrics/init'
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

  it('zero fixations → zeros (no divide-by-zero)', () => {
    const engine = createEngine([])
    const result = values(query(inst('relativeTime'), scope(engine)))
    expect(result[0]).toBe(0)
    expect(result[3]).toBe(0)
  })
})

// ─── averageFixationCount ───────────────────────────────────────────────────

describe('averageFixationCount — count of fixations landing in AOI', () => {
  it('counts per slot with overlaps and noAoi', () => {
    // 4 fixations: AOI1, [AOI1,AOI2], noAoi, AOI2
    //   AOI1=2, AOI2=2, noAoi=1, anyFixation=4
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 1, 2],
      [200, 300, 0],
      [300, 400, 0, 2],
    ])
    const result = values(query(inst('averageFixationCount'), scope(engine)))
    expect(result[0]).toBe(2)
    expect(result[1]).toBe(2)
    expect(result[2]).toBe(1)
    expect(result[3]).toBe(4)
  })
})

// ─── avgFixationDuration ────────────────────────────────────────────────────

describe('avgFixationDuration — mean of per-fixation durations on AOI', () => {
  it('averages durations per slot; NaN when no fixations touch the slot', () => {
    // Fixations:
    //   100ms on AOI1, 300ms on AOI1, 200ms on AOI2
    //   mean AOI1 = 200, mean AOI2 = 200, noAoi = NaN, mean anyFixation = 200
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 400, 0, 1],
      [400, 600, 0, 2],
    ])
    const result = values(query(inst('avgFixationDuration'), scope(engine)))
    expect(result[0]).toBe(200)
    expect(result[1]).toBe(200)
    expect(Number.isNaN(result[2])).toBe(true)
    expect(result[3]).toBe(200)
  })
})

// ─── averageEntries (visitCount) ────────────────────────────────────────────

describe('averageEntries — distinct entries; consecutive-same = one visit', () => {
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
    const result = values(query(inst('averageEntries'), scope(engine)))
    expect(result[0]).toBe(2)
    expect(result[1]).toBe(1)
  })
})

// ─── avgDwellDuration (visitDuration) ───────────────────────────────────────

describe('avgDwellDuration — mean sum-of-durations per visit', () => {
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
    const result = values(query(inst('avgDwellDuration'), scope(engine)))
    expect(result[0]).toBe(150)
    expect(result[1]).toBe(100)
    expect(queryIndividuals(inst('avgDwellDuration'), scope(engine), 0)).toEqual([200, 100])
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

// ─── avgFirstFixationDuration ───────────────────────────────────────────────

describe('avgFirstFixationDuration — duration of the first fixation on AOI', () => {
  it('captures the FIRST fixation duration only, not subsequent ones', () => {
    // Fixations: AOI1 (0-100, dur=100), AOI1 (200-500, dur=300)
    //   firstFixDur[AOI1] = 100 (not 200 = mean)
    const engine = createEngine([
      [0, 100, 0, 1],
      [200, 500, 0, 1],
    ])
    const result = values(query(inst('avgFirstFixationDuration'), scope(engine)))
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

  it('groupAggregation: sum — queryGroup adds per-participant counts', () => {
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
