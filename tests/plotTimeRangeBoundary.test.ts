/**
 * Boundary-semantics coverage for the per-plot time-range control
 * (`settings.timelineStart` / `settings.timelineEnd`) on the three plots that
 * previously had no way to restrict their input window:
 *
 *   - transition-matrix (routes through the metrics engine)
 *   - recurrence        (custom collector, NOT the metrics engine)
 *   - scanpath-similarity / participantPairSimilarity recipe
 *
 * The contract:
 *   - For the recurrence and scanpath collectors a fixation is kept when its
 *     *onset* falls in `[timeStart, timeEnd)` — rule B (half-open, start-based).
 *     A fixation onset exactly at `timeEnd` is excluded; one exactly at
 *     `timeStart` is included.
 *   - For transition-matrix the runtime forwards `timeStart` / `timeEnd` to
 *     the metric scope. We assert here only that the forwarded values reach
 *     the engine and exclude fixations entirely outside the window — the
 *     engine's exact in-window semantics are owned by `metrics/core/scanner.ts`
 *     and exercised in `metricFormulas.test.ts`.
 */

import { describe, it, expect } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import {
  queryGroup,
  type GroupScope,
  type MetricInstance,
} from '../src/lib/metrics'
import { collectFixations } from '../src/lib/plots/recurrence/core/collector'
import {
  collectScanpath,
  collectAllScanpaths,
} from '../src/lib/metrics/core/scanpathEncoding'

const STIM = 1

/**
 * Engine fixture with two AOIs (raw 1, raw 2). Segments are per-participant;
 * each segment is `[start, end, category, ...rawAoiIds]`. `category === 0`
 * means a fixation. Returned engine has `getAoiGroupReader` so the scanpath
 * encoder can run.
 */
function makeEngine(perParticipantSegments: number[][][]) {
  return makeTestEngine([[], perParticipantSegments], { aoiMapping: 'group' })
}

function inst(baseId: string, params: Record<string, unknown> = {}): MetricInstance {
  return {
    id: 't1',
    baseId,
    params,
    label: '',
    projection: { kind: 'identity-aoi-pair-matrix' },
  }
}

// ───────────────────────── recurrence: collectFixations ─────────────────────

describe('recurrence collectFixations — boundary rule B (start ∈ [timeStart, timeEnd))', () => {
  // Three fixations with onsets at 0, 100, 200. Window [100, 200) keeps only
  // the fixation onset-at-100; onset-at-200 is excluded (half-open upper).
  const engine = makeEngine([
    [
      [0, 50, 0, 1],     // onset 0 — excluded by lower bound
      [100, 150, 0, 1],  // onset 100 — INCLUDED (lower edge is inclusive)
      [200, 250, 0, 2],  // onset 200 — excluded by upper bound (half-open)
    ],
  ])

  it('keeps onset-at-timeStart (lower edge inclusive)', () => {
    const fixations = collectFixations(engine, STIM, 0, false, 100, 200)
    expect(fixations).not.toBeNull()
    expect(fixations!.length).toBe(1)
    expect(fixations![0].duration).toBe(50)
  })

  it('excludes onset-at-timeEnd (upper edge exclusive)', () => {
    // Same engine, widen the window so the third fixation's onset is the
    // upper boundary value. It must NOT be included.
    const fixations = collectFixations(engine, STIM, 0, false, 0, 200)
    expect(fixations).not.toBeNull()
    expect(fixations!.length).toBe(2) // onsets 0 and 100 — not 200
  })

  it('timeEnd <= 0 is unbounded above', () => {
    const fixations = collectFixations(engine, STIM, 0, false, 100, 0)
    expect(fixations!.length).toBe(2) // onsets 100 and 200
  })

  it('default args (0, 0) return all fixations', () => {
    const fixations = collectFixations(engine, STIM, 0, false)
    expect(fixations!.length).toBe(3)
  })
})

// ───────────────────────── scanpath-similarity: collectScanpath ─────────────

describe('collectScanpath — boundary rule B (start ∈ [timeStart, timeEnd))', () => {
  // Same three-fixation participant as above. AOI letters are assigned in
  // order of the stimulus's visible AOIs: raw id 1 → 'A', raw id 2 → 'B'.
  const engine = makeEngine([
    [
      [0, 50, 0, 1],     // 'A' — onset 0
      [100, 150, 0, 1],  // 'A' — onset 100
      [200, 250, 0, 2],  // 'B' — onset 200
    ],
  ])
  const aois = [
    { id: 1, displayedName: 'AOI 1', originalName: 'AOI 1', color: 'red' },
    { id: 2, displayedName: 'AOI 2', originalName: 'AOI 2', color: 'blue' },
  ] as any

  it('window [100, 200) keeps only the middle fixation (onset 100)', () => {
    const sp = collectScanpath(engine, STIM, 0, aois, false, 100, 200)
    expect(sp).toBe('A')
  })

  it('window [0, 200) excludes the onset-at-200 fixation', () => {
    const sp = collectScanpath(engine, STIM, 0, aois, false, 0, 200)
    expect(sp).toBe('AA')
  })

  it('window [100, 0) (unbounded upper) keeps onsets 100 and 200', () => {
    const sp = collectScanpath(engine, STIM, 0, aois, false, 100, 0)
    expect(sp).toBe('AB')
  })

  it('collectAllScanpaths forwards the window per-participant', () => {
    const entries = collectAllScanpaths(
      engine,
      STIM,
      [0],
      aois,
      false,
      100,
      200,
    )
    expect(entries).toHaveLength(1)
    expect(entries[0].scanpath).toBe('A')
  })

  it('default args (0, 0) preserve the full scanpath', () => {
    const sp = collectScanpath(engine, STIM, 0, aois, false)
    expect(sp).toBe('AAB')
  })
})

// ─────────────── transition-matrix: time-range forwarded to engine ──────────

describe('queryGroup(transitionCount) — GroupScope.timeStart/timeEnd narrow the matrix', () => {
  // Three fixations from one participant: AOI1 → AOI1 → AOI2.
  // Without windowing, this yields transitions AOI1→AOI1 and AOI1→AOI2.
  // Restricting the window to skip the first fixation collapses the sequence
  // to AOI1 → AOI2, so the AOI1→AOI1 cell drops to 0.
  const engine = makeEngine([
    [
      [0, 50, 0, 1],     // AOI1, onset 0
      [100, 150, 0, 1],  // AOI1, onset 100
      [200, 250, 0, 2],  // AOI2, onset 200
    ],
  ])

  function matrixOf(group: GroupScope): number[] {
    const r = queryGroup(inst('transitionCount', { mode: 'fixation' }), group)
    if (r.shape !== 'aoi-pair-matrix') throw new Error('expected aoi-pair-matrix')
    return Array.from(r.matrix)
  }

  it('full window (no bounds) yields both transitions', () => {
    const m = matrixOf({
      engine: engine,
      stimulusId: STIM,
      participantIds: [0],
    })
    // size = 3 (AOI1, AOI2, outside). Indices [from*3 + to].
    expect(m[0 * 3 + 0]).toBe(1) // AOI1 → AOI1
    expect(m[0 * 3 + 1]).toBe(1) // AOI1 → AOI2
  })

  it('window starting after the first fixation drops the AOI1→AOI1 transition', () => {
    const m = matrixOf({
      engine: engine,
      stimulusId: STIM,
      participantIds: [0],
      timeStart: 80,  // excludes fixation at onset 0
      timeEnd: 0,
    })
    expect(m[0 * 3 + 0]).toBe(0) // AOI1 → AOI1 no longer present
    expect(m[0 * 3 + 1]).toBe(1) // AOI1 → AOI2 survives
  })

  it('window ending before the last fixation drops the AOI1→AOI2 transition', () => {
    const m = matrixOf({
      engine: engine,
      stimulusId: STIM,
      participantIds: [0],
      timeStart: 0,
      timeEnd: 180,   // excludes fixation at onset 200
    })
    expect(m[0 * 3 + 0]).toBe(1) // AOI1 → AOI1 retained
    expect(m[0 * 3 + 1]).toBe(0) // AOI1 → AOI2 dropped (target excluded)
  })
})
