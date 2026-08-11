/**
 * Metric cache behavior: what must be answered from cache and what must
 * invalidate it.
 *
 * The bucket is keyed on the STRUCTURAL AoiGroupReader version (grouping /
 * visibility changes); slot ORDER and NAME signatures ride in the cache key,
 * so a pure AOI reorder misses (slot order follows display order) while a
 * color-only edit still hits (pinned in aoiSelectors.test.ts). Participant /
 * stimulus edits change neither, so re-deriving plots after a participant
 * rename is answered entirely from cache (the motivating large-dataset stall).
 */
import { describe, it, expect, vi } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import {
  query,
  queryBatch,
  queryGroup,
  type MetricInstance,
  type Scope,
} from '../src/lib/metrics'

const STIM = 1

// Slot layout (2 AOIs): 0=AOI1, 1=AOI2, 2=noAoi, 3=anyFixation
// Default data — P0 fixations: AOI1 ×2, AOI2 ×1. P1: AOI2 ×1, AOI1 ×1.
const DEFAULT_SEGMENTS: number[][][] = [
  [
    [0, 100, 0, 1],
    [100, 200, 0, 2],
    [200, 300, 0, 1],
  ],
  [
    [0, 150, 0, 2],
    [150, 300, 0, 1],
  ],
]

function createEngine(perParticipant: number[][][] = DEFAULT_SEGMENTS) {
  let appearanceVersion = 0
  return {
    ...makeTestEngine([[], perParticipant], {
      participants: [['P0', 'P0'], ['P1', 'P1']],
    }),
    // Structural version stays 0 throughout — none of these tests change
    // grouping, mirroring the real engine.
    getAoiGroupReader: () => ({ version: 0, appearanceVersion }),
    /** Simulates updateMap() — bumps on every AOI edit in the real engine. */
    bumpAoiVersion: () => {
      appearanceVersion++
    },
  }
}

function vectorInst(id: string, baseId: string): MetricInstance {
  return {
    id,
    baseId,
    params: {},
    label: '',
    projection: { kind: 'identity-aoi-vector' },
  }
}

/** An AOI pick carrying a summary `statistic` (the summary-projection channel). */
function pickInst(
  id: string,
  baseId: string,
  statistic: 'mean' | 'median' | 'max' | 'min',
): MetricInstance {
  return {
    id,
    baseId,
    params: {},
    label: '',
    projection: { kind: 'pick-aoi', aoiRef: { by: 'slot', slot: 0 }, statistic },
  }
}

function windowedInst(id: string, baseId: string): MetricInstance {
  return {
    id,
    baseId,
    params: {},
    label: '',
    projection: {
      kind: 'windowed',
      window: { windowSize: 100, stepSize: 100 },
      inner: { kind: 'identity-aoi-vector' },
    },
  }
}

describe('metric cache', () => {
  it('answers a repeat query from cache after a participant rename (no rescan)', () => {
    const engine = createEngine()
    const s: Scope = { engine: engine as any, stimulusId: STIM, participantId: 0 }
    const inst = vectorInst('fc', 'fixationCount')

    const first = query(inst, s)
    engine.metadata.participants.data[0] = ['P0', 'Renamed participant']
    const spy = vi.spyOn(engine.getReader(), 'getFixationRange')
    const second = query(inst, s)

    expect(spy).not.toHaveBeenCalled()
    expect(second).toEqual(first)
  })

  it('queryBatch consults the same cache — a repeat batch never rescans', () => {
    const engine = createEngine()
    const s: Scope = { engine: engine as any, stimulusId: STIM, participantId: 0 }
    const insts = [vectorInst('fc', 'fixationCount'), vectorInst('at', 'absoluteTime')]

    const r1 = queryBatch(insts, s)
    const spy = vi.spyOn(engine.getReader(), 'getFixationRange')
    const r2 = queryBatch(insts, s)

    expect(spy).not.toHaveBeenCalled()
    expect(r2).toEqual(r1)
  })

  it('caches windowed queries; per-participant results are frozen and shared', () => {
    const engine = createEngine()
    const group = { engine: engine as any, stimulusId: STIM, participantIds: [0, 1] }
    const inst = windowedInst('w', 'absoluteTime')

    const g1 = queryGroup(inst, group)
    const spy = vi.spyOn(engine.getReader(), 'getFixationRange')
    const g2 = queryGroup(inst, group)
    expect(spy).not.toHaveBeenCalled()
    expect(g2).toEqual(g1)

    // Group folds build fresh arrays, so mutating a group result can never
    // reach the cache.
    if (g2.shape !== 'aoi-vector-timeseries') throw new Error('unexpected shape')
    g2.vectors[0][0] = 12345
    g2.timeline[0] = -1
    const g3 = queryGroup(inst, group)
    expect(g3).toEqual(g1)

    // Per-participant windowed results are zero-copy: the SAME frozen arrays
    // are shared across hits, and mutation throws instead of corrupting.
    const scope = { engine: engine as any, stimulusId: STIM, participantId: 0 }
    const q1 = query(inst, scope)
    const q2 = query(inst, scope)
    if (q1.shape !== 'aoi-vector-timeseries' || q2.shape !== 'aoi-vector-timeseries')
      throw new Error('unexpected shape')
    expect(q2.vectors).toBe(q1.vectors)
    expect(Object.isFrozen(q1.vectors)).toBe(true)
  })

  it('queryBatch equals per-instance query for every recipe (scan equivalence)', () => {
    // The batch scanner and the single-scan path inline the same fixation
    // decode + slot-resolve + dedupe block (kept duplicated for speed —
    // a shared per-fixation callback measured ~15% slower). This equivalence
    // pin is what keeps the copies from drifting. The data exercises both
    // invariants: a fixation tagged with a duplicate raw AOI id (dedupe) and
    // an out-of-selection AOI (resolves to no slot).
    //
    // Durations on the kept AOI are deliberately UNEQUAL (100 / 200 / 600 →
    // mean 300, median 200, max 600, min 100). With equal durations every
    // summary statistic coincides and the sample-summarizing instances below
    // would agree across paths no matter which statistic the batch used.
    const segs: number[][][] = [
      [
        [0, 100, 0, 1, 1], // duplicate raw id → one slot after dedupe
        [100, 200, 0, 2], // outside the selection → resolves to no slots
        [200, 400, 0, 1, 2], // mixed: one selected + one out-of-selection
        [400, 1000, 0, 1], // the long one, so the statistics diverge
        [1000, 1100, 0], // no AOI at all
      ],
    ]
    const selections = [{ id: 9, name: 'Focus', names: ['AOI 1'] }]
    // Fresh engines per path so neither can serve the other's cache entries.
    const e1 = createEngine(segs)
    const e2 = createEngine(segs)
    e1.metadata.aois.selections = selections
    e2.metadata.aois.selections = selections
    const instances = () => [
      vectorInst('fc', 'fixationCount'),
      vectorInst('at', 'absoluteTime'),
      vectorInst('rt', 'relativeTime'),
      vectorInst('vc', 'visitCount'),
      // Sample-summarizing recipes with a NON-MEAN summary on the pick. The
      // batch path builds its own InitCtx, so it must read the statistic off
      // each instance's projection rather than assume mean — otherwise it
      // computes the mean AND writes it into the raw cache under the median's
      // key, poisoning the single path that shares that entry.
      pickInst('fd-med', 'fixationDuration', 'median'),
      pickInst('vd-max', 'visitDuration', 'max'),
      pickInst('fd-mean', 'fixationDuration', 'mean'),
    ]

    const batch = queryBatch(instances(), {
      engine: e1 as any,
      stimulusId: STIM,
      participantId: 0,
      aoiSelectionId: 9,
    })
    for (const inst of instances()) {
      const single = query(inst, {
        engine: e2 as any,
        stimulusId: STIM,
        participantId: 0,
        aoiSelectionId: 9,
      })
      expect(batch.get(inst.id), inst.baseId).toEqual(single)
    }
  })

  it('an AOI edit invalidates: rescans and reflects new slot order (reorder bug pin)', () => {
    const engine = createEngine()
    const s: Scope = { engine: engine as any, stimulusId: STIM, participantId: 0 }
    const inst = vectorInst('fc', 'fixationCount')

    const before = query(inst, s)
    if (before.shape !== 'aoi-vector') throw new Error('unexpected shape')
    expect(before.values[0]).toBe(2) // AOI 1
    expect(before.values[1]).toBe(1) // AOI 2

    // Reorder AOIs (display order flips). The real engine calls updateMap()
    // on every AOI edit, bumping appearanceVersion; slot order follows the
    // display order, so cached vectors indexed by the OLD order are stale.
    engine.metadata.aois.orderVector = [[], [2, 1]]
    engine.bumpAoiVersion()

    const spy = vi.spyOn(engine.getReader(), 'getFixationRange')
    const after = query(inst, s)
    expect(spy).toHaveBeenCalled()
    if (after.shape !== 'aoi-vector') throw new Error('unexpected shape')
    expect(after.values[0]).toBe(1) // AOI 2 first now
    expect(after.values[1]).toBe(2) // AOI 1 second
  })
})
