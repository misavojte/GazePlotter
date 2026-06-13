/**
 * Runtime tests for the windowed × aoi-vector projection path.
 *
 * `runTimeWindowed()` synthesizes `aoi-vector-timeseries` results when the
 * inner leaf emits aoi-vector. These tests verify the wiring end-to-end:
 *   - `query()` returns shape: 'aoi-vector-timeseries' with vectors[][]
 *   - per-window AOI values match the recipe's per-window finalize output
 *   - timeline carries window-start times in ms
 *   - empty time range → empty result
 *
 * Boundary semantics: a fixation crossing window boundaries contributes only
 * its IN-WINDOW PORTION (clippedDuration) to duration recipes. This matches
 * fractional-occupancy semantics and is required for windowed dwell-time
 * sums to be scientifically meaningful (any-overlap full duration would
 * inflate totals across overlapping windows).
 */
import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import {
  query,
  queryGroup,
  type GroupScope,
  type MetricInstance,
  type Scope,
} from '../src/lib/metrics'
import { getRecipe } from '../src/lib/metrics/core/defineMetric'

// Recipe registry lookup helper — bypasses the public Metric/meta surface
// to reach the recipe's behavioural hooks (e.g. `groupAggregationGuard`)
// for direct unit testing.
function getRecipeForTest(id: string) {
  const r = getRecipe(id)
  if (!r) throw new Error(`recipe ${id} not registered`)
  return r
}

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

function windowedAoiVectorInst(baseId: string, windowSize = 100, stepSize = 100): MetricInstance {
  return {
    id: 't1', baseId, params: {}, label: '',
    projection: {
      kind: 'windowed',
      window: { windowSize, stepSize },
      inner: { kind: 'identity-aoi-vector' },
    },
  }
}

function scope(engine: any, timeStart = 0, timeEnd = 0): Scope {
  return { engine, stimulusId: STIM, participantId: PID, timeStart, timeEnd }
}

describe('runTimeWindowed × identity-aoi-vector → aoi-vector-timeseries', () => {
  it('per-window aoi-vectors — fixations cleanly inside their windows', () => {
    // F1 [0,100] AOI1, F2 [100,200] AOI2, F3 [200,300] AOI1
    // windows: [0,100), [100,200), [200,300)
    // expected: AOI1 dur per window = [100, 0, 100]; AOI2 = [0, 100, 0]
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 2],
      [200, 300, 0, 1],
    ])
    const result = query(windowedAoiVectorInst('absoluteTime'), scope(engine, 0, 300))

    expect(result.shape).toBe('aoi-vector-timeseries')
    if (result.shape !== 'aoi-vector-timeseries') return
    expect(result.vectors).toHaveLength(3)
    expect(result.timeline).toEqual([0, 100, 200])
    // each vector is [AOI1, AOI2, noAoi, anyFixation]
    expect(result.vectors[0][0]).toBe(100) // window 0: AOI1=100
    expect(result.vectors[0][1]).toBe(0)   // window 0: AOI2=0
    expect(result.vectors[1][0]).toBe(0)   // window 1: AOI1=0
    expect(result.vectors[1][1]).toBe(100) // window 1: AOI2=100
    expect(result.vectors[2][0]).toBe(100) // window 2: AOI1=100
    expect(result.vectors[2][1]).toBe(0)   // window 2: AOI2=0
  })

  it('empty time range → empty vectors + empty timeline', () => {
    const engine = createEngine([[0, 100, 0, 1]])
    const result = query(windowedAoiVectorInst('absoluteTime'), scope(engine, 0, 0))

    expect(result.shape).toBe('aoi-vector-timeseries')
    if (result.shape !== 'aoi-vector-timeseries') return
    expect(result.vectors).toHaveLength(0)
    expect(result.timeline).toHaveLength(0)
  })

  it('slots field is populated from aoi-vector layout', () => {
    const engine = createEngine([
      [0, 100, 0, 1],
      [100, 200, 0, 2],
    ])
    const result = query(windowedAoiVectorInst('absoluteTime'), scope(engine, 0, 200))

    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    // slot layout: 2 AOIs + noAoi + anyFixation = 4 slots total
    expect(result.slots.totalSlots).toBe(4)
    expect(result.slots.noAoiSlot).toBe(2)
    expect(result.slots.anyFixationSlot).toBe(3)
  })

  it('cross-window fixation: clipped duration per window (fractional occupancy)', () => {
    // F1 [50, 250] AOI1 — spans windows [0,100), [100,200), [200,300)
    // absoluteTime uses clippedDuration = min(end, wEnd) - max(start, wStart):
    //   window [0,100):   min(250,100) - max(50,0)   = 50
    //   window [100,200): min(250,200) - max(50,100) = 100
    //   window [200,300): min(250,300) - max(50,200) = 50
    // Sum across windows = 200 = the fixation's actual duration (no double-counting).
    const engine = createEngine([[50, 250, 0, 1]])
    const result = query(windowedAoiVectorInst('absoluteTime'), scope(engine, 0, 300))

    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    expect(result.vectors).toHaveLength(3)
    expect(result.vectors[0][0]).toBe(50)
    expect(result.vectors[1][0]).toBe(100)
    expect(result.vectors[2][0]).toBe(50)
    // Sum across windows = original fixation duration
    const total = result.vectors.reduce((s, v) => s + v[0], 0)
    expect(total).toBe(200)
  })

  it('fixationCount per AOI per window', () => {
    // F1 [0,50] AOI1, F2 [50,100] AOI2, F3 [100,150] AOI1
    // Window 100ms × 100ms step, range [0, 200]
    // window [0,100): F1+F2 → AOI1=1, AOI2=1
    // window [100,200): F3 → AOI1=1, AOI2=0
    const engine = createEngine([
      [0, 50, 0, 1],
      [50, 100, 0, 2],
      [100, 150, 0, 1],
    ])
    const result = query(windowedAoiVectorInst('fixationCount'), scope(engine, 0, 200))

    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    expect(result.vectors).toHaveLength(2)
    expect(result.vectors[0][0]).toBe(1) // window 0: AOI1 count=1
    expect(result.vectors[0][1]).toBe(1) // window 0: AOI2 count=1
    expect(result.vectors[1][0]).toBe(1) // window 1: AOI1 count=1
    expect(result.vectors[1][1]).toBe(0) // window 1: AOI2 count=0
  })

  it('provenance carries the windowed projection', () => {
    const engine = createEngine([[0, 100, 0, 1]])
    const inst = windowedAoiVectorInst('absoluteTime', 100, 100)
    const result = query(inst, scope(engine, 0, 100))

    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    expect(result.provenance.baseId).toBe('absoluteTime')
    expect(result.provenance.projection).toEqual(inst.projection)
  })

  it('windowed fixationCount: SW-RQA middle-fixation membership (per-window sums = unwindowed total)', () => {
    // F1 [50, 250] AOI1 — its midpoint is at t = 150, so it belongs to
    // window [100, 200) under the SW-RQA convention.
    //   window [0, 100):   midpoint 150 not in window → count = 0
    //   window [100, 200): midpoint 150 in window     → count = 1
    //   window [200, 300): midpoint 150 not in window → count = 0
    // Sum across windows = 1 = the unwindowed fixation count.
    //
    // (Status quo any-overlap would have given 1+1+1 = 3, treble-counting the
    // fixation. The SW-RQA correction makes per-window counts compose
    // cleanly to the unwindowed total — codified ET aggregation rule.)
    const engine = createEngine([[50, 250, 0, 1]])
    const result = query(
      windowedAoiVectorInst('fixationCount'),
      scope(engine, 0, 300)
    )

    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    expect(result.vectors).toHaveLength(3)
    expect(result.vectors[0][0]).toBe(0) // [0,100): AOI1
    expect(result.vectors[1][0]).toBe(1) // [100,200): AOI1
    expect(result.vectors[2][0]).toBe(0) // [200,300): AOI1
    // anyFixation slot also obeys the rule.
    expect(result.vectors[0][3]).toBe(0)
    expect(result.vectors[1][3]).toBe(1)
    expect(result.vectors[2][3]).toBe(0)
    // Sum across windows = unwindowed count.
    const total = result.vectors.reduce((s, v) => s + v[0], 0)
    expect(total).toBe(1)
  })

  it('windowed visitCount: SW-RQA middle-fixation membership applies to visit boundaries too', () => {
    // F1 [50, 250] AOI1 — single fixation, single visit. Its midpoint
    // (t=150) belongs to window [100, 200). Per-window visit counts:
    //   [0, 100):   0
    //   [100, 200): 1
    //   [200, 300): 0
    const engine = createEngine([[50, 250, 0, 1]])
    const result = query(
      windowedAoiVectorInst('visitCount'),
      scope(engine, 0, 300)
    )

    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    expect(result.vectors).toHaveLength(3)
    expect(result.vectors[0][0]).toBe(0)
    expect(result.vectors[1][0]).toBe(1)
    expect(result.vectors[2][0]).toBe(0)
    const total = result.vectors.reduce((s, v) => s + v[0], 0)
    expect(total).toBe(1)
  })

  it('windowed fixationDuration: midpoint membership for which window, full duration for the value', () => {
    // F1 [50, 250] AOI1, duration 200 ms. Its midpoint (t=150) belongs to
    // window [100, 200) → contributes its FULL duration (200) to that
    // window's mean — NOT the clipped 100 ms. The mean describes "typical
    // fixation length on this AOI", not "typical overlap with the window".
    const engine = createEngine([[50, 250, 0, 1]])
    const result = query(
      windowedAoiVectorInst('fixationDuration'),
      scope(engine, 0, 300)
    )

    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    expect(result.vectors).toHaveLength(3)
    expect(Number.isNaN(result.vectors[0][0])).toBe(true) // no fixations belong to [0,100)
    expect(result.vectors[1][0]).toBe(200)                 // mean over the one fixation in [100,200)
    expect(Number.isNaN(result.vectors[2][0])).toBe(true) // no fixations belong to [200,300)
  })

  it('WindowFrame.duration matches legacy aoi-stream collector overlap math', () => {
    // Re-derives the load-bearing parity property from the recipe layer:
    // for the same fixture (F[50,250] AOI1, 100 ms windows), absoluteTime's
    // per-window contribution equals the in-window overlap exactly.
    // This is the *fractional sub-bin overlap* the legacy collector
    // computed via its diff/partial accumulators.
    const engine = createEngine([[50, 250, 0, 1]])
    const result = query(
      windowedAoiVectorInst('absoluteTime'),
      scope(engine, 0, 300)
    )

    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    // Window [0,100):   overlap = 100 - 50  = 50
    // Window [100,200): overlap = 200 - 100 = 100
    // Window [200,300): overlap = 250 - 200 = 50
    expect(result.vectors[0][0]).toBe(50)
    expect(result.vectors[1][0]).toBe(100)
    expect(result.vectors[2][0]).toBe(50)
  })
})

describe('queryGroup: windowed × aoi-vector cross-participant aggregation', () => {
  function groupScope(
    engine: any,
    participantIds: number[],
    timeStart = 0,
    timeEnd = 0,
  ): GroupScope {
    return { engine, stimulusId: STIM, participantIds, timeStart, timeEnd }
  }

  it('aggregates per-participant aoi-vector-timeseries via the recipe groupAggregation (default mean)', () => {
    // 3 participants, each with 1 fixation entirely inside one of the
    // three 100 ms windows. fixationCount per AOI per window aggregated
    // via mean = (1 + 0 + 0) / 3 ≈ 0.333... per windowed slot occupied.
    const engine = createMultiParticipantEngine([
      [[10, 80, 0, 1]],   // P0: AOI1 in [0,100)
      [[110, 180, 0, 1]], // P1: AOI1 in [100,200)
      [[210, 280, 0, 1]], // P2: AOI1 in [200,300)
    ])
    const result = queryGroup(
      windowedAoiVectorInst('fixationCount'),
      groupScope(engine, [0, 1, 2], 0, 300),
    )

    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    expect(result.vectors).toHaveLength(3)
    // Each participant contributes 1 to its own window. Mean across the
    // three participants is 1/3 ≈ 0.333... in each window.
    for (let w = 0; w < 3; w++) {
      expect(result.vectors[w][0]).toBeCloseTo(1 / 3, 6)
    }
  })

  it('respects per-recipe groupAggregation: absoluteTime defaults to mean', () => {
    // Same fixture as above but absoluteTime: each participant contributes
    // 70 ms to one window. Mean across N=3 participants = 70/3.
    const engine = createMultiParticipantEngine([
      [[10, 80, 0, 1]],
      [[110, 180, 0, 1]],
      [[210, 280, 0, 1]],
    ])
    const result = queryGroup(
      windowedAoiVectorInst('absoluteTime'),
      groupScope(engine, [0, 1, 2], 0, 300),
    )

    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    expect(result.vectors[0][0]).toBeCloseTo(70 / 3, 6)
    expect(result.vectors[1][0]).toBeCloseTo(70 / 3, 6)
    expect(result.vectors[2][0]).toBeCloseTo(70 / 3, 6)
  })

  it('threads result.slots so consumers never reconstruct slot layout', () => {
    const engine = createMultiParticipantEngine([
      [[10, 80, 0, 1]],
      [[110, 180, 0, 1]],
    ])
    const result = queryGroup(
      windowedAoiVectorInst('fixationCount'),
      groupScope(engine, [0, 1], 0, 300),
    )
    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    // 2 AOIs + noAoi + anyFixation = 4 slots. noAoiSlot = 2.
    expect(result.slots.totalSlots).toBe(4)
    expect(result.slots.noAoiSlot).toBe(2)
    expect(result.slots.anyFixationSlot).toBe(3)
  })

  it('falls back to participant max-end when group.timeEnd is unset', () => {
    const engine = createMultiParticipantEngine([
      [[10, 80, 0, 1]],
      [[210, 280, 0, 1]],
    ])
    // No explicit timeEnd → runWindowedGroup falls back to max participant
    // end (~280) and computes 2 windows for 100 ms binning ([0,100) and
    // [100,200) — third window [200,300) needs end ≥ 300 to include).
    const result = queryGroup(
      windowedAoiVectorInst('fixationCount'),
      { engine, stimulusId: STIM, participantIds: [0, 1] } as unknown as GroupScope,
    )
    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    expect(result.vectors.length).toBeGreaterThanOrEqual(2)
  })

  it('ragged-length recordings: a short participant does not dilute later windows toward zero', () => {
    // Two participants, 100 ms windows, requested range [0, 200] → 2 windows
    // ([0,100), [100,200)). AOI1 = slot 0, noAoi = slot 2, anyFixation = 3.
    //
    //   P0 (full-length): F[10,90] AOI1 (mid 50 → w0) + F[110,200] AOI1
    //                     (mid 155 → w1). Recording ends at 200 → fully
    //                     covers BOTH windows. AOI1 count = [1, 1].
    //   P1 (short):       F[10,100] AOI1 (mid 55 → w0) only. Recording ends
    //                     at 100 → fully covers w0, has NO data in w1.
    //                     AOI1 count = [1] (w1 absent).
    //
    // Window [0,100): both participants present → mean(1, 1) = 1.
    // Window [100,200): only P0 has data. The fix clamps P1's scan to its
    // own data-end (100), so P1 contributes NOTHING to w1 → mean(1) = 1.
    // WITHOUT the clamp, P1's empty w1 would finalize to a real 0 and the
    // mean would be (1 + 0) / 2 = 0.5 — silently-wrong dilution toward zero.
    const engine = createMultiParticipantEngine([
      [[10, 90, 0, 1], [110, 200, 0, 1]], // P0: ends at 200
      [[10, 100, 0, 1]],                   // P1: ends at 100
    ])
    const result = queryGroup(
      windowedAoiVectorInst('fixationCount'),
      groupScope(engine, [0, 1], 0, 200),
    )

    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    expect(result.vectors).toHaveLength(2)
    // w0: both participants contribute 1.
    expect(result.vectors[0][0]).toBeCloseTo(1, 6) // AOI1
    expect(result.vectors[0][3]).toBeCloseTo(1, 6) // anyFixation
    // w1: P1's recording ended at 100, so only P0 (count 1) is averaged.
    // The mean is 1 — NOT 0.5 (which is what counting P1's empty window
    // as a real 0 would give).
    expect(result.vectors[1][0]).toBeCloseTo(1, 6) // AOI1 — undiluted
    expect(result.vectors[1][3]).toBeCloseTo(1, 6) // anyFixation — undiluted
  })

  it('ragged-length recordings: relativeTime tail is not diluted by absent participants', () => {
    // Same ragged fixture as above, but with relativeTime (%). An empty
    // window finalizes to all-zeros (total fixation time = 0 → share = 0),
    // so without the clamp the short participant's absent tail would drag
    // the percentage mean down too. With the clamp, w1 reflects only P0,
    // whose entire windowed dwell is on AOI1 → 100%.
    const engine = createMultiParticipantEngine([
      [[10, 90, 0, 1], [110, 200, 0, 1]], // P0: ends at 200, all on AOI1
      [[10, 100, 0, 1]],                   // P1: ends at 100
    ])
    const result = queryGroup(
      windowedAoiVectorInst('relativeTime'),
      groupScope(engine, [0, 1], 0, 200),
    )

    if (result.shape !== 'aoi-vector-timeseries') throw new Error('wrong shape')
    expect(result.vectors).toHaveLength(2)
    // w1: only P0 present, 100% of its dwell on AOI1. A spurious 0 from P1
    // would have made this mean(100, 0) = 50.
    expect(result.vectors[1][0]).toBeCloseTo(100, 6)
  })

  it('relativeTime declares a groupAggregationGuard rejecting `sum` over windowed projections', () => {
    // Cross-participant `sum` of percentages is incoherent (yields
    // `≈ N · share`, no physical meaning). The guard returns a non-null
    // reason for `sum + windowed`; mean and median pass through. UI/
    // validator should consume this; runtime in `runWindowedGroup` falls
    // back to mean if a stale instance trips it.
    const projection = {
      kind: 'windowed' as const,
      window: { windowSize: 100, stepSize: 100 },
      inner: { kind: 'identity-aoi-vector' as const },
    }
    const r = getRecipeForTest('relativeTime')
    expect(typeof r.groupAggregationGuard).toBe('function')
    const sumReason = r.groupAggregationGuard!(projection, 'sum')
    expect(typeof sumReason).toBe('string')
    expect(sumReason).toMatch(/sum/i)
    expect(r.groupAggregationGuard!(projection, 'mean')).toBeNull()
    expect(r.groupAggregationGuard!(projection, 'median')).toBeNull()
  })
})
