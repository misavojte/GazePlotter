/**
 * Eye-movement metrics: the category-vector shape (`scanSource: 'categories'`)
 * and the fixation-gap metric.
 *
 * The type axis is a SHAPE, never a parameter: recipes produce one value per
 * displayed-name group (canonical `categoryGroups` order, Fixation first) and
 * a single type is extracted via the `pick-category` PROJECTION — the exact
 * aoi-vector / pick-aoi pattern. Load-bearing pins: scan equivalence (the
 * Fixation slot must equal `fixationCount`'s any-fixation total), the order
 * contract, MERGE-fold slot folding, batch==single through the scanner's
 * per-instance delegation, windowed pick-category composition, the
 * scopeDurationMs share denominator, and cache invalidation when the category
 * table changes under an unchanged reader.
 */
import { describe, it, expect } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import {
  getMetric,
  metricIsCreatableInContract,
  query,
  queryBatch,
  queryIndividualsAllSlots,
  type MetricInstance,
  type PlotMetricContract,
  type Scope,
} from '../src/lib/metrics'
import { getRecipe } from '../src/lib/metrics/core/defineMetric'
import { recipeSupports } from '../src/lib/metrics/core/validation'

const STIM = 1

const CATEGORIES = [
  ['Fixation', 'Fixation', '#000000'],
  ['Saccade', 'Saccade', '#111111'],
  ['Blink', 'Blink', '#222222'],
]

// P0 timeline (rows: [start, end, categoryId, ...rawAoiIds]):
// fixations [0,100] [130,200] [220,300] [340,400] (durations 100/70/80/60),
// saccades [100,130] (30 ms) and [300,340] (40 ms), one blink [200,220]
// (20 ms). Recording ends 400. Axis slots: 0=Fixation, 1=Saccade, 2=Blink.
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
  // Clone the category rows: the cache pin below mutates its engine's table
  // in place, and a shared module-level fixture would leak into later engines.
  return makeTestEngine([[], segments], { categories: categories.map(r => [...r]) })
}

function vectorInst(id: string, baseId: string, params: Record<string, unknown> = {}): MetricInstance {
  return { id, baseId, params, label: '', projection: { kind: 'identity-category-vector' } }
}

function pickInst(id: string, baseId: string, categoryName: string, params: Record<string, unknown> = {}): MetricInstance {
  return { id, baseId, params, label: '', projection: { kind: 'pick-category', categoryName } }
}

function summaryPickInst(id: string, baseId: string, categoryName: string, statistic: 'mean' | 'median' | 'max' | 'min'): MetricInstance {
  return { id, baseId, params: {}, label: '', projection: { kind: 'pick-category', categoryName, statistic } }
}

function windowedPickInst(id: string, baseId: string, categoryName: string): MetricInstance {
  return {
    id,
    baseId,
    params: {},
    label: '',
    projection: {
      kind: 'windowed',
      window: { windowSize: 100, stepSize: 100 },
      inner: { kind: 'pick-category', categoryName },
    },
  }
}

function vectorValues(engine: unknown, inst: MetricInstance, scope: Partial<Scope> = {}): number[] {
  const r = query(inst, { engine: engine as any, stimulusId: STIM, participantId: 0, ...scope })
  if (r.shape !== 'category-vector') throw new Error(`unexpected shape ${r.shape}`)
  return r.values
}

function scalarValue(engine: unknown, inst: MetricInstance, scope: Partial<Scope> = {}): number {
  const r = query(inst, { engine: engine as any, stimulusId: STIM, participantId: 0, ...scope })
  if (r.shape !== 'scalar') throw new Error(`unexpected shape ${r.shape}`)
  return r.value
}

describe('category-vector eye-movement metrics (scanSource: categories)', () => {
  it('the Fixation slot equals fixationCount (scan-source equivalence pin)', () => {
    const engine = createEngine()
    const fc = query(
      { id: 'fc', baseId: 'fixationCount', params: {}, label: '', projection: { kind: 'identity-aoi-vector' } },
      { engine: engine as any, stimulusId: STIM, participantId: 0 },
    )
    if (fc.shape !== 'aoi-vector') throw new Error('unexpected shape')
    const anyFixationTotal = fc.values[fc.slots.anyFixationSlot]

    expect(anyFixationTotal).toBe(4)
    expect(vectorValues(engine, vectorInst('mc', 'movementCount'))[0]).toBe(anyFixationTotal)
    expect(scalarValue(engine, pickInst('mcf', 'movementCount', 'Fixation'))).toBe(anyFixationTotal)
  })

  it('vectors follow the canonical axis order with hand-computed literals', () => {
    const engine = createEngine()
    expect(vectorValues(engine, vectorInst('c', 'movementCount'))).toEqual([4, 2, 1])
    // Duration carries NO summary param: the vector is the per-type MEAN, and
    // the full per-event sample rides `individuals` for distribution plots.
    expect(vectorValues(engine, vectorInst('d', 'movementDuration'))).toEqual([77.5, 35, 20])
    expect(vectorValues(engine, vectorInst('t', 'movementTime'))).toEqual([310, 70, 20])
  })

  it('pick-category extracts one type by displayed name; unknown names are NaN', () => {
    const engine = createEngine()
    expect(scalarValue(engine, pickInst('p1', 'movementCount', 'Saccade'))).toBe(2)
    expect(scalarValue(engine, pickInst('p2', 'movementTime', 'Blink'))).toBe(20)
    // Trimmed matching — the canonical displayed-name rule.
    expect(scalarValue(engine, pickInst('p3', 'movementCount', ' Saccade '))).toBe(2)
    expect(scalarValue(engine, pickInst('p4', 'movementCount', 'Smooth pursuit'))).toBeNaN()
  })

  it('the summary statistic rides the pick projection, never the vector or a param', () => {
    const engine = createEngine()
    // Identity vector: always the unmarked mean — no summary concept at all.
    expect(vectorValues(engine, vectorInst('d', 'movementDuration'))).toEqual([77.5, 35, 20])
    // The SUMMARY states its collapse (per participant, before any group
    // reduction). Fixation sample [100, 70, 80, 60]; Saccade [30, 40].
    expect(scalarValue(engine, summaryPickInst('m1', 'movementDuration', 'Fixation', 'median'))).toBe(75)
    expect(scalarValue(engine, summaryPickInst('m2', 'movementDuration', 'Fixation', 'max'))).toBe(100)
    expect(scalarValue(engine, summaryPickInst('m3', 'movementDuration', 'Saccade', 'min'))).toBe(30)
    // No statistic → mean, identical to the vector's slot (and its raw cache).
    expect(scalarValue(engine, pickInst('m4', 'movementDuration', 'Saccade'))).toBe(35)
    // Per-window collapse: [0,200) fixations [100, 70], [200,400) [80, 60].
    const wmax = query({
      id: 'wm', baseId: 'movementDuration', params: {}, label: '',
      projection: {
        kind: 'windowed',
        window: { windowSize: 200, stepSize: 200 },
        inner: { kind: 'pick-category', categoryName: 'Fixation', statistic: 'max' },
      },
    }, { engine: engine as any, stimulusId: STIM, participantId: 0, timeStart: 0, timeEnd: 400 })
    if (wmax.shape !== 'scalar-timeseries') throw new Error('unexpected shape')
    expect(wmax.values).toEqual([100, 80])
    // Declaration gate, mirroring aggregate-aoi: a statistic is valid only
    // where the recipe declares a per-event sample (`sampleSummary`).
    expect(
      recipeSupports(getRecipe('movementDuration')!, { kind: 'pick-category', categoryName: 'Saccade', statistic: 'median' })
    ).toBe(true)
    expect(
      recipeSupports(getRecipe('movementCount')!, { kind: 'pick-category', categoryName: 'Saccade', statistic: 'median' })
    ).toContain('no per-event sample')
  })

  it('queryIndividualsAllSlots samples per TYPE slot for category-vector recipes', () => {
    const engine = createEngine()
    const perSlot = queryIndividualsAllSlots(
      vectorInst('d', 'movementDuration'),
      { engine: engine as any, stimulusId: STIM, participantId: 0 }
    )
    // Per-event durations on the canonical axis: fixations, saccades, blink.
    expect(perSlot).toEqual([[100, 70, 80, 60], [30, 40], [20]])
  })

  it('MERGE fold: two raw categories displayed under one name share a slot', () => {
    const merged = [...CATEGORIES, ['SaccadeVariant', 'Saccade', '#333333']]
    const segments = SEGMENTS[0].map(row => (row[0] === 300 ? [300, 340, 3] : row))
    const engine = createEngine(merged, [segments])
    // Axis stays [Fixation, Saccade, Blink] — id 3 folds into the Saccade slot.
    expect(vectorValues(engine, vectorInst('c', 'movementCount'))).toEqual([4, 2, 1])
    expect(scalarValue(engine, pickInst('t', 'movementTime', 'Saccade'))).toBe(70)
  })

  it('time-bounded scope: midpoint membership gates counts, overlap clips time', () => {
    const engine = createEngine()
    const bounded = { timeStart: 0, timeEnd: 320 }
    // Midpoints in [0, 320): fixations 50/165/260 (370 is out), saccades 115
    // (320 is out), blink 210.
    expect(vectorValues(engine, vectorInst('c', 'movementCount'), bounded)).toEqual([3, 1, 1])
    // Clipped overlap: fixations 100+70+80 (the 4th starts past the bound),
    // saccades 30+20, blink 20.
    expect(vectorValues(engine, vectorInst('t', 'movementTime'), bounded)).toEqual([250, 50, 20])
  })

  it('movementTimeShare: share of recording, of a bounded range, and per window', () => {
    const engine = createEngine()
    // Of the 400 ms recording: fixations 310, saccades 70, blink 20.
    expect(vectorValues(engine, vectorInst('s', 'movementTimeShare'))).toEqual([77.5, 17.5, 5])
    // Bounded [0, 320): clipped 250/50/20 of 320.
    expect(
      vectorValues(engine, vectorInst('s2', 'movementTimeShare'), { timeStart: 0, timeEnd: 320 })
    ).toEqual([78.125, 15.625, 6.25])
    // Windowed pick-category: each window's share is of the WINDOW size.
    const windowed = query(windowedPickInst('ws', 'movementTimeShare', 'Saccade'), {
      engine: engine as any, stimulusId: STIM, participantId: 0, timeStart: 0, timeEnd: 400,
    })
    if (windowed.shape !== 'scalar-timeseries') throw new Error('unexpected shape')
    expect(windowed.values).toEqual([0, 30, 0, 40])
  })

  it('windowed pick-category counts compose to the unwindowed total', () => {
    const engine = createEngine()
    const windowed = query(windowedPickInst('wc', 'movementCount', 'Saccade'), {
      engine: engine as any, stimulusId: STIM, participantId: 0, timeStart: 0, timeEnd: 400,
    })
    if (windowed.shape !== 'scalar-timeseries') throw new Error('unexpected shape')
    expect(windowed.values).toEqual([0, 1, 0, 1])
    expect(windowed.values.reduce((a, b) => a + b, 0)).toBe(
      scalarValue(engine, pickInst('c', 'movementCount', 'Saccade'))
    )
  })

  it('the identity vector cannot be windowed (only scalar leaves window)', () => {
    const recipe = getRecipe('movementCount')!
    const verdict = recipeSupports(recipe, {
      kind: 'windowed',
      window: { windowSize: 100, stepSize: 100 },
      inner: { kind: 'identity-category-vector' },
    })
    expect(typeof verdict).toBe('string')
  })

  it('queryBatch equals per-instance query for category-vector recipes (delegation pin)', () => {
    // Fresh engines per path so neither can serve the other's cache entries.
    const e1 = createEngine()
    const e2 = createEngine()
    const instances = () => [
      vectorInst('mc', 'movementCount'),
      pickInst('md', 'movementDuration', 'Blink'),
      pickInst('mt', 'movementTime', 'Saccade'),
    ]

    const batch = queryBatch(instances(), { engine: e1 as any, stimulusId: STIM, participantId: 0 })
    for (const inst of instances()) {
      const single = query(inst, { engine: e2 as any, stimulusId: STIM, participantId: 0 })
      expect(batch.get(inst.id), inst.baseId).toEqual(single)
    }
  })

  it('a category MERGE under an unchanged reader invalidates (cache token pin)', () => {
    // Folds edit metadata only — the reader (the cache's WeakMap key) and the
    // structural version both stay put, so freshness must come from the
    // category table riding in the cache KEY: the axis itself changes shape.
    const engine = createEngine()
    expect(vectorValues(engine, vectorInst('c', 'movementCount'))).toEqual([4, 2, 1])

    engine.metadata.categories.data[1] = ['Saccade', 'Blink', '#111111']
    expect(vectorValues(engine, vectorInst('c', 'movementCount'))).toEqual([4, 3])
  })

  it('the category-vector contract narrows the library; scalar plots get pick-category for free', () => {
    const vectorContract = {
      outputShape: 'category-vector',
      windowing: 'forbidden',
      crossParticipant: 'distribution',
    } as const satisfies PlotMetricContract
    const scalarContract = {
      outputShape: 'scalar',
      windowing: 'forbidden',
      crossParticipant: 'per-participant',
    } as const satisfies PlotMetricContract

    expect(metricIsCreatableInContract(getMetric('movementCount')!, vectorContract)).toBe(true)
    expect(metricIsCreatableInContract(getMetric('fixationCount')!, vectorContract)).toBe(false)
    // Metric Matrix / Correlation / Timeline consume one type via pick-category.
    expect(metricIsCreatableInContract(getMetric('movementTimeShare')!, scalarContract)).toBe(true)
  })
})

