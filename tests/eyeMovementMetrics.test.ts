/**
 * Eye-movement metrics: the category-parameterized scan source
 * (`scanSource: 'categoryParam'`) and the fixation-gap metric.
 *
 * The load-bearing pin is scan-source equivalence: `movementCount` at type
 * Fixation must equal `fixationCount`'s any-fixation total — the category
 * walk and the prebuilt fixation index must select the same segments. The
 * other pins: batch==single through the scanner's per-instance delegation,
 * windowed==unwindowed composition on the trio path, MERGE-fold widening
 * (same displayed name = same logical entity), and cache invalidation when
 * the category table changes under an unchanged reader.
 */
import { describe, it, expect } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import { query, queryBatch, type MetricInstance, type Scope } from '../src/lib/metrics'

const STIM = 1

const CATEGORIES = [
  ['Fixation', 'Fixation', '#000000'],
  ['Saccade', 'Saccade', '#111111'],
  ['Blink', 'Blink', '#222222'],
]

// P0 timeline (rows: [start, end, categoryId, ...rawAoiIds]):
// fixations [0,100] [130,200] [220,300] [340,400], saccades [100,130] (30 ms)
// and [300,340] (40 ms), one blink [200,220] (20 ms).
// Inter-fixation gaps: 30, 20, 40 ms.
const SEGMENTS: number[][][] = [
  [
    [0, 100, 0, 1],
    [100, 130, 1],
    [130, 200, 0, 2],
    [200, 220, 2],
    [220, 300, 0, 1],
    [300, 340, 1],
    [340, 400, 0],
  ],
]

function createEngine(categories: string[][] = CATEGORIES, segments: number[][][] = SEGMENTS) {
  return makeTestEngine([[], segments], { categories })
}

function scalarInst(id: string, baseId: string, params: Record<string, unknown> = {}): MetricInstance {
  return { id, baseId, params, label: '', projection: { kind: 'identity-scalar' } }
}

function windowedScalarInst(id: string, baseId: string, params: Record<string, unknown> = {}): MetricInstance {
  return {
    id,
    baseId,
    params,
    label: '',
    projection: {
      kind: 'windowed',
      window: { windowSize: 100, stepSize: 100 },
      inner: { kind: 'identity-scalar' },
    },
  }
}

function scalarValue(engine: unknown, inst: MetricInstance, scope: Partial<Scope> = {}): number {
  const r = query(inst, { engine: engine as any, stimulusId: STIM, participantId: 0, ...scope })
  if (r.shape !== 'scalar') throw new Error(`unexpected shape ${r.shape}`)
  return r.value
}

describe('eye-movement category scan (scanSource: categoryParam)', () => {
  it('movementCount at type Fixation equals fixationCount (scan-source equivalence pin)', () => {
    const engine = createEngine()
    const fc = query(
      { id: 'fc', baseId: 'fixationCount', params: {}, label: '', projection: { kind: 'identity-aoi-vector' } },
      { engine: engine as any, stimulusId: STIM, participantId: 0 },
    )
    if (fc.shape !== 'aoi-vector') throw new Error('unexpected shape')
    const anyFixationTotal = fc.values[fc.slots.anyFixationSlot]

    const mc = scalarValue(engine, scalarInst('mc', 'movementCount', { eyeMovementType: 'Fixation' }))
    expect(anyFixationTotal).toBe(4)
    expect(mc).toBe(anyFixationTotal)
  })

  it('counts, durations, and total time per type match hand-computed literals', () => {
    const engine = createEngine()
    expect(scalarValue(engine, scalarInst('c1', 'movementCount', { eyeMovementType: 'Saccade' }))).toBe(2)
    expect(scalarValue(engine, scalarInst('c2', 'movementCount', { eyeMovementType: 'Blink' }))).toBe(1)

    expect(scalarValue(engine, scalarInst('d1', 'movementDuration', { eyeMovementType: 'Saccade', statistic: 'mean' }))).toBe(35)
    expect(scalarValue(engine, scalarInst('d2', 'movementDuration', { eyeMovementType: 'Saccade', statistic: 'max' }))).toBe(40)
    expect(scalarValue(engine, scalarInst('d3', 'movementDuration', { eyeMovementType: 'Saccade', statistic: 'min' }))).toBe(30)
    expect(scalarValue(engine, scalarInst('d4', 'movementDuration', { eyeMovementType: 'Blink', statistic: 'mean' }))).toBe(20)

    expect(scalarValue(engine, scalarInst('t1', 'movementTime', { eyeMovementType: 'Saccade' }))).toBe(70)
    expect(scalarValue(engine, scalarInst('t2', 'movementTime', { eyeMovementType: 'Blink' }))).toBe(20)
  })

  it('a type the dataset does not record: count 0, time 0, duration NaN', () => {
    const engine = createEngine()
    expect(scalarValue(engine, scalarInst('c', 'movementCount', { eyeMovementType: 'Smooth pursuit' }))).toBe(0)
    expect(scalarValue(engine, scalarInst('t', 'movementTime', { eyeMovementType: 'Smooth pursuit' }))).toBe(0)
    expect(scalarValue(engine, scalarInst('d', 'movementDuration', { eyeMovementType: 'Smooth pursuit' }))).toBeNaN()
  })

  it('MERGE fold: two raw categories displayed under one name are scanned together', () => {
    // Raw id 3 ('SaccadeVariant') displays as 'Saccade' — same displayed name
    // = same logical entity, so the scan must include both raw ids.
    const merged = [...CATEGORIES, ['SaccadeVariant', 'Saccade', '#333333']]
    const segments = SEGMENTS[0].map(row => (row[0] === 300 ? [300, 340, 3] : row))
    const engine = createEngine(merged, [segments])
    expect(scalarValue(engine, scalarInst('c', 'movementCount', { eyeMovementType: 'Saccade' }))).toBe(2)
    expect(scalarValue(engine, scalarInst('t', 'movementTime', { eyeMovementType: 'Saccade' }))).toBe(70)
  })

  it('time-bounded scope: midpoint membership gates counts, overlap clips time', () => {
    const engine = createEngine()
    const bounded = { timeStart: 0, timeEnd: 320 }
    // Second saccade [300,340]: midpoint 320 falls outside [0,320) → not counted;
    // its in-window overlap [300,320) still contributes 20 ms of time.
    expect(scalarValue(engine, scalarInst('c', 'movementCount', { eyeMovementType: 'Saccade' }), bounded)).toBe(1)
    expect(scalarValue(engine, scalarInst('t', 'movementTime', { eyeMovementType: 'Saccade' }), bounded)).toBe(50)
  })

  it('windowed values compose: per-window counts and clipped times sum to the unwindowed totals', () => {
    const engine = createEngine()
    const scope = { engine: engine as any, stimulusId: STIM, participantId: 0, timeStart: 0, timeEnd: 400 }

    const count = query(windowedScalarInst('wc', 'movementCount', { eyeMovementType: 'Saccade' }), scope)
    if (count.shape !== 'scalar-timeseries') throw new Error('unexpected shape')
    expect(count.values).toEqual([0, 1, 0, 1])

    const time = query(windowedScalarInst('wt', 'movementTime', { eyeMovementType: 'Saccade' }), scope)
    if (time.shape !== 'scalar-timeseries') throw new Error('unexpected shape')
    expect(time.values).toEqual([0, 30, 0, 40])
    expect(time.values.reduce((a, b) => a + b, 0)).toBe(
      scalarValue(engine, scalarInst('t', 'movementTime', { eyeMovementType: 'Saccade' })),
    )
  })

  it('queryBatch equals per-instance query for category-scanning recipes (delegation pin)', () => {
    // Fresh engines per path so neither can serve the other's cache entries.
    const e1 = createEngine()
    const e2 = createEngine()
    const instances = () => [
      scalarInst('mc', 'movementCount', { eyeMovementType: 'Saccade' }),
      scalarInst('md', 'movementDuration', { eyeMovementType: 'Blink', statistic: 'mean' }),
      scalarInst('mt', 'movementTime', { eyeMovementType: 'Saccade' }),
      scalarInst('ifi', 'interFixationInterval', { statistic: 'mean' }),
    ]

    const batch = queryBatch(instances(), { engine: e1 as any, stimulusId: STIM, participantId: 0 })
    for (const inst of instances()) {
      const single = query(inst, { engine: e2 as any, stimulusId: STIM, participantId: 0 })
      expect(batch.get(inst.id), inst.baseId).toEqual(single)
    }
  })

  it('a category rename under an unchanged reader invalidates (cache token pin)', () => {
    // Renames edit metadata only — the reader (the cache's WeakMap key) and the
    // structural version both stay put, so freshness must come from the
    // category table riding in the cache KEY.
    const engine = createEngine()
    const inst = () => scalarInst('c', 'movementCount', { eyeMovementType: 'Saccade' })
    expect(scalarValue(engine, inst())).toBe(2)

    engine.metadata.categories.data[1] = ['Saccade', 'SaccadeRenamed', '#111111']
    expect(scalarValue(engine, inst())).toBe(0)
    expect(scalarValue(engine, scalarInst('c2', 'movementCount', { eyeMovementType: 'SaccadeRenamed' }))).toBe(2)
  })

  it('delimiter characters in names cannot collide the cache token (stale-cache pin)', () => {
    // Both tables below serialize identically under naive ',' / ':' joining
    // ("c0:F,1:S,2:B,2:X|") — the token must use non-typable separators so
    // the rename still invalidates.
    const engine = createEngine([
      ['Fixation', 'F', '#000000'],
      ['Saccade', 'S', '#111111'],
      ['Blink', 'B,2:X', '#222222'],
    ])
    const inst = () => scalarInst('c', 'movementCount', { eyeMovementType: 'X' })
    expect(scalarValue(engine, inst())).toBe(0)

    engine.metadata.categories.data[1] = ['Saccade', 'S,2:B', '#111111']
    engine.metadata.categories.data[2] = ['Blink', 'X', '#222222']
    expect(scalarValue(engine, inst())).toBe(1)
  })
})

describe('inter-fixation interval', () => {
  it('summarizes the gaps between consecutive fixations', () => {
    const engine = createEngine()
    expect(scalarValue(engine, scalarInst('m', 'interFixationInterval', { statistic: 'mean' }))).toBe(30)
    expect(scalarValue(engine, scalarInst('md', 'interFixationInterval', { statistic: 'median' }))).toBe(30)
    expect(scalarValue(engine, scalarInst('mx', 'interFixationInterval', { statistic: 'max' }))).toBe(40)
    expect(scalarValue(engine, scalarInst('mn', 'interFixationInterval', { statistic: 'min' }))).toBe(20)
  })

  it('back-to-back fixations yield NaN, not a fake 0', () => {
    // Pre-segmented exports often store fixations contiguously; a zero gap
    // carries no inter-fixation episode, so nothing accumulates.
    const engine = createEngine([['Fixation', 'Fixation', '#000000']], [[[0, 100, 0], [100, 200, 0], [200, 300, 0]]])
    expect(scalarValue(engine, scalarInst('m', 'interFixationInterval', { statistic: 'mean' }))).toBeNaN()
  })
})
