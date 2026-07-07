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
import { createReaderFromJson } from '../src/lib/data/binary/converters'
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

function createEngine(
  perParticipant: number[][][] = DEFAULT_SEGMENTS,
  hiddenAois: number[] = []
) {
  const segments: number[][][][] = [[], perParticipant]
  const reader = createReaderFromJson(segments)
  let appearanceVersion = 0
  return {
    metadata: {
      isOrdinalOnly: false,
      capabilities: { segmented: true, spatial: false, event: false },
      aois: {
        data: [[], [null, ['AOI 1', 'AOI 1', 'red'], ['AOI 2', 'AOI 2', 'blue']]],
        orderVector: [[], [1, 2]],
        hiddenAois: [[], hiddenAois],
      },
      categories: { data: [['Fixation', 'Fixation', '#000000']], orderVector: [] },
      participants: { data: [['P0', 'P0'], ['P1', 'P1']], orderVector: [] },
      participantsGroups: [],
      stimuli: { data: [['S0', 'S0'], ['S1', 'S1']], orderVector: [] },
      noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
      metricInstances: [],
    },
    getReader: () => reader,
    getAoiMapping: (_s: number, rawId: number) => rawId,
    // Structural version stays 0 throughout — none of these tests change
    // grouping/visibility, mirroring the real engine.
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
    // decode + hidden-drop + slot-dedupe block (kept duplicated for speed —
    // a shared per-fixation callback measured ~15% slower). This equivalence
    // pin is what keeps the copies from drifting. The data exercises both
    // invariants: a fixation tagged with a duplicate raw AOI id (dedupe) and
    // a hidden AOI (dropped before grouping).
    const segs: number[][][] = [
      [
        [0, 100, 0, 1, 1], // duplicate raw id → one slot after dedupe
        [100, 200, 0, 2], // hidden below → resolves to no slots
        [200, 300, 0, 1, 2], // mixed: one visible + one hidden
        [300, 400, 0], // no AOI at all
      ],
    ]
    // Fresh engines per path so neither can serve the other's cache entries.
    const e1 = createEngine(segs, [2])
    const e2 = createEngine(segs, [2])
    const instances = () => [
      vectorInst('fc', 'fixationCount'),
      vectorInst('at', 'absoluteTime'),
      vectorInst('rt', 'relativeTime'),
      vectorInst('vc', 'visitCount'),
    ]

    const batch = queryBatch(instances(), {
      engine: e1 as any,
      stimulusId: STIM,
      participantId: 0,
    })
    for (const inst of instances()) {
      const single = query(inst, {
        engine: e2 as any,
        stimulusId: STIM,
        participantId: 0,
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
