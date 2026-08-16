/**
 * Event metrics: the event-vector shape (`scanSource: 'events'`).
 *
 * The channel axis is a SHAPE, never a parameter: recipes produce one value
 * per displayed-name MERGE of the scope stimulus's channel table (canonical
 * `eventGroups` order = orderVector order) and a single channel is extracted
 * via the `pick-event` PROJECTION — the exact category-vector / pick-category
 * pattern, with the axis per stimulus like AOIs. Load-bearing pins: the order
 * contract + orderVector permutation, MERGE-fold slot folding, windowed
 * behavior (counts by presence in every window the occurrence is active in,
 * time by clip with sums equal to totals, instants in exactly one
 * window), the scopeDurationMs share denominator (overlap can push a share
 * past 100), both halves of the cache token (channel table and eventVersion),
 * latency edges, per-stimulus pick-event resolution, and batch==single via
 * the scanner's per-instance delegation.
 */
import { describe, it, expect } from 'vitest'
import { ALL_CAPS, makeTestEngine, type TestEngineOptions } from './helpers/testEngine'
import {
  getMetric,
  instanceMatchesContract,
  metricIsCreatableInContract,
  query,
  queryBatch,
  queryIndividualsAllSlots,
  type MetricInstance,
  type PlotMetricContract,
  type Scope,
} from '../src/lib/metrics'
import { defineMetric, getRecipe } from '../src/lib/metrics/core/defineMetric'
import { recipeSupports } from '../src/lib/metrics/core/validation'
import type { DataCapabilities } from '../src/lib/data/types'

const STIM = 1

// P0 recording ends 400; P1 ends 200 and has no event occurrences.
const SEGMENTS: number[][][] = [
  [
    [0, 100, 0, 1],
    [130, 200, 0, 2],
    [220, 400, 0],
  ],
  [[0, 200, 0]],
]

// Stimulus 1 channels (axis slots 0=Music, 1=Marker, 2=Task):
// Music intervals [50,150] and [300,350]; Marker instants at 100 and 250;
// Task overlapping intervals [0,300] and [200,400] (500 ms total on a 400 ms
// recording — the documented past-100-percent share case).
const EVENT_DEFS: string[][][] = [
  [],
  [
    ['Music', 'Music', '#101010'],
    ['Marker', 'Marker', '#202020'],
    ['Task', 'Task', '#303030'],
  ],
]
const EVENTS: number[][][][] = [
  [],
  [
    [[50, 100, 300, 50], []],
    [[100, 0, 250, 0], []],
    [[0, 300, 200, 200], []],
  ],
]

function createEngine(overrides: Partial<TestEngineOptions> = {}) {
  // Deep-clone the defs: the cache pins mutate their engine's table in place.
  return makeTestEngine([[], SEGMENTS], {
    eventData: EVENT_DEFS.map(stim => stim.map(row => [...row])),
    eventOrderVector: [[], [0, 1, 2]],
    events: EVENTS,
    ...overrides,
  })
}

function vectorInst(id: string, baseId: string): MetricInstance {
  return { id, baseId, params: {}, label: '', projection: { kind: 'identity-event-vector' } }
}

function pickInst(id: string, baseId: string, eventName: string): MetricInstance {
  return { id, baseId, params: {}, label: '', projection: { kind: 'pick-event', eventName } }
}

function summaryPickInst(id: string, baseId: string, eventName: string, statistic: 'mean' | 'median' | 'max' | 'min'): MetricInstance {
  return { id, baseId, params: {}, label: '', projection: { kind: 'pick-event', eventName, statistic } }
}

function windowedPickInst(id: string, baseId: string, eventName: string): MetricInstance {
  return {
    id,
    baseId,
    params: {},
    label: '',
    projection: {
      kind: 'windowed',
      window: { windowSize: 100, stepSize: 100 },
      inner: { kind: 'pick-event', eventName },
    },
  }
}

function vectorValues(engine: unknown, inst: MetricInstance, scope: Partial<Scope> = {}): number[] {
  const r = query(inst, { engine: engine as any, stimulusId: STIM, participantId: 0, ...scope })
  if (r.shape !== 'event-vector') throw new Error(`unexpected shape ${r.shape}`)
  return r.values
}

function scalarValue(engine: unknown, inst: MetricInstance, scope: Partial<Scope> = {}): number {
  const r = query(inst, { engine: engine as any, stimulusId: STIM, participantId: 0, ...scope })
  if (r.shape !== 'scalar') throw new Error(`unexpected shape ${r.shape}`)
  return r.value
}

describe('event-vector metrics (scanSource: events)', () => {
  it('vectors follow the canonical axis order with hand-computed literals', () => {
    const engine = createEngine()
    expect(vectorValues(engine, vectorInst('c', 'eventCount'))).toEqual([2, 2, 2])
    expect(vectorValues(engine, vectorInst('t', 'eventTime'))).toEqual([150, 0, 500])
    expect(vectorValues(engine, vectorInst('d', 'eventDuration'))).toEqual([75, 0, 250])
    expect(vectorValues(engine, vectorInst('l', 'eventLatency'))).toEqual([50, 100, 0])
  })

  it('a reordered orderVector permutes the axis (order contract pin)', () => {
    const engine = createEngine({ eventOrderVector: [[], [2, 0, 1]] })
    // [Task, Music, Marker]
    expect(vectorValues(engine, vectorInst('t', 'eventTime'))).toEqual([500, 150, 0])
    // pick-event resolves by name, so the permutation never moves a pick.
    expect(scalarValue(engine, pickInst('p', 'eventTime', 'Music'))).toBe(150)
  })

  it('pick-event extracts one channel by displayed name; unknown names are NaN', () => {
    const engine = createEngine()
    expect(scalarValue(engine, pickInst('p1', 'eventCount', 'Marker'))).toBe(2)
    // Trimmed matching — the canonical displayed-name rule.
    expect(scalarValue(engine, pickInst('p2', 'eventTime', ' Task '))).toBe(500)
    const missing = query(pickInst('p3', 'eventTime', 'Speech'), {
      engine: engine as any, stimulusId: STIM, participantId: 0,
    })
    if (missing.shape !== 'scalar') throw new Error('unexpected shape')
    expect(missing.value).toBeNaN()
    expect(missing.provenance.refMissing).toBe(true)
  })

  it('MERGE fold: two channels displayed under one name share a slot', () => {
    const engine = createEngine()
    engine.metadata.eventData.data[1][1][1] = 'Music'
    // Axis folds to [Music, Task]; Marker's instants join the Music slot.
    expect(vectorValues(engine, vectorInst('c', 'eventCount'))).toEqual([4, 2])
    expect(vectorValues(engine, vectorInst('t', 'eventTime'))).toEqual([150, 500])
    // Earliest onset across the folded members: Music 50 beats Marker 100.
    expect(scalarValue(engine, pickInst('l', 'eventLatency', 'Music'))).toBe(50)
  })

  it('instants: counted, zero time, genuine 0 duration samples', () => {
    const engine = createEngine()
    expect(scalarValue(engine, pickInst('c', 'eventCount', 'Marker'))).toBe(2)
    expect(scalarValue(engine, pickInst('t', 'eventTime', 'Marker'))).toBe(0)
    expect(scalarValue(engine, pickInst('s', 'eventTimeShare', 'Marker'))).toBe(0)
    const perSlot = queryIndividualsAllSlots(
      vectorInst('d', 'eventDuration'),
      { engine: engine as any, stimulusId: STIM, participantId: 0 },
    )
    expect(perSlot).toEqual([[100, 50], [0, 0], [300, 200]])
  })

  it('time-bounded scope: counts by presence (overlap), time by clip', () => {
    const engine = createEngine()
    const bounded = { timeStart: 0, timeEnd: 320 }
    // All six occurrences overlap [0, 320): a bound never drops an
    // occurrence that reaches into it.
    expect(vectorValues(engine, vectorInst('c', 'eventCount'), bounded)).toEqual([2, 2, 2])
    // [260, 320): Music [300,350) reaches in; both Task intervals are still
    // active; the Marker instants (100, 250) lie before it.
    expect(
      vectorValues(engine, vectorInst('c2', 'eventCount'), { timeStart: 260, timeEnd: 320 })
    ).toEqual([1, 0, 2])
    // Clipped overlap: Music 100+20, Marker 0, Task 300+120.
    expect(vectorValues(engine, vectorInst('t', 'eventTime'), bounded)).toEqual([120, 0, 420])
  })

  it('eventTimeShare: of the recording, of a bounded range, per window; overlap exceeds 100', () => {
    const engine = createEngine()
    // Of the 400 ms recording: Music 150, Marker 0, Task 500 (the pin > 100).
    expect(vectorValues(engine, vectorInst('s', 'eventTimeShare'))).toEqual([37.5, 0, 125])
    // Bounded [0, 320): clipped 120/0/420 of 320.
    expect(
      vectorValues(engine, vectorInst('s2', 'eventTimeShare'), { timeStart: 0, timeEnd: 320 })
    ).toEqual([37.5, 0, 131.25])
    // Windowed pick-event: each window's share is of the WINDOW size.
    const windowed = query(windowedPickInst('ws', 'eventTimeShare', 'Music'), {
      engine: engine as any, stimulusId: STIM, participantId: 0, timeStart: 0, timeEnd: 400,
    })
    if (windowed.shape !== 'scalar-timeseries') throw new Error('unexpected shape')
    expect(windowed.values).toEqual([50, 50, 0, 50])
  })

  it('windowed behavior: counts by presence in every active window, time by clip', () => {
    const engine = createEngine()
    const scope = { engine: createEngine() as any, stimulusId: STIM, participantId: 0, timeStart: 0, timeEnd: 400 }
    // Music [50,150) is active in the first two windows and counts in BOTH:
    // per-window counts are concurrency readings and deliberately do not
    // tile to the unwindowed total (2).
    const wc = query(windowedPickInst('wc', 'eventCount', 'Music'), scope)
    if (wc.shape !== 'scalar-timeseries') throw new Error('unexpected shape')
    expect(wc.values).toEqual([1, 1, 0, 1])
    // Time DOES tile: contributions clip to the window.
    const wt = query(windowedPickInst('wt', 'eventTime', 'Music'), scope)
    if (wt.shape !== 'scalar-timeseries') throw new Error('unexpected shape')
    expect(wt.values).toEqual([50, 50, 0, 50])
    expect(wt.values.reduce((a, b) => a + b, 0)).toBe(
      scalarValue(engine, pickInst('t', 'eventTime', 'Music'))
    )
  })

  it('a boundary instant lands in exactly one window of a tiling', () => {
    const wc = query(windowedPickInst('wm', 'eventCount', 'Marker'), {
      engine: createEngine() as any, stimulusId: STIM, participantId: 0, timeStart: 0, timeEnd: 400,
    })
    if (wc.shape !== 'scalar-timeseries') throw new Error('unexpected shape')
    // Instants at 100 and 250: window [100,200) owns the first, [200,300)
    // the second — never both neighbours, never neither.
    expect(wc.values).toEqual([0, 1, 1, 0])
  })

  it('a long occurrence counts in every window it is active in (the timeline reading)', () => {
    // The Metric Timeline report: a visibility interval [2000, 12000) on a
    // scope ending at 7050. Any single-anchor rule paints one lonely 1 (or,
    // for a midpoint past the last full window, none at all) under a strip
    // that is visibly active the whole time. Presence counting reads 1 in
    // every window the occurrence covers and 0 before it starts.
    const engine = createEngine({
      events: [[], [[[2000, 10000], []], [[], []], [[], []]]],
    })
    const scope = { engine: engine as any, stimulusId: STIM, participantId: 0, timeStart: 0, timeEnd: 7050 }
    const wc = query(windowedPickInst('wl', 'eventCount', 'Music'), scope)
    if (wc.shape !== 'scalar-timeseries') throw new Error('unexpected shape')
    expect(wc.values.length).toBe(70)
    expect(wc.values.slice(0, 20).every(v => v === 0)).toBe(true)
    expect(wc.values.slice(20).every(v => v === 1)).toBe(true)
    // The bounded total counts occurrences overlapping the range, once each.
    expect(
      scalarValue(engine, pickInst('lt', 'eventCount', 'Music'), { timeStart: 0, timeEnd: 7050 })
    ).toBe(1)
  })

  it('the summary statistic rides the pick projection, never the vector or a param', () => {
    const engine = createEngine()
    expect(scalarValue(engine, summaryPickInst('m1', 'eventDuration', 'Task', 'max'))).toBe(300)
    expect(scalarValue(engine, summaryPickInst('m2', 'eventDuration', 'Task', 'min'))).toBe(200)
    // No statistic → mean, identical to the vector's slot.
    expect(scalarValue(engine, pickInst('m3', 'eventDuration', 'Task'))).toBe(250)
    expect(
      recipeSupports(getRecipe('eventDuration')!, { kind: 'pick-event', eventName: 'Task', statistic: 'median' })
    ).toBe(true)
    expect(
      recipeSupports(getRecipe('eventCount')!, { kind: 'pick-event', eventName: 'Task', statistic: 'median' })
    ).toContain('no per-event sample')
  })

  it('eventLatency: earliest onset from deliberately unsorted buffers (sort pin)', () => {
    const engine = createEngine({
      events: [[], [[[300, 50, 50, 100], []], [[100, 0, 250, 0], []], [[0, 300, 200, 200], []]]],
    })
    expect(scalarValue(engine, pickInst('l', 'eventLatency', 'Music'))).toBe(50)
  })

  it('eventLatency edges: instant at 0, negative onset in-band, true onset under a bound', () => {
    const engine = createEngine({
      events: [[], [[[-5, 10], []], [[0, 0], []], [[0, 300, 200, 200], []]]],
    })
    expect(scalarValue(engine, pickInst('l1', 'eventLatency', 'Music'))).toBe(-5)
    expect(scalarValue(engine, pickInst('l2', 'eventLatency', 'Marker'))).toBe(0)
    // Bounded [110, 400): overlapping occurrences report their actual onset,
    // never the clip; the out-of-range Marker instant drops to NaN.
    const bounded = createEngine()
    expect(
      vectorValues(bounded, vectorInst('l3', 'eventLatency'), { timeStart: 110, timeEnd: 400 })
    ).toEqual([50, 250, 0])
  })

  it('a participant with no occurrences: 0 counts and times, NaN latency and duration', () => {
    const engine = createEngine()
    const p1 = { participantId: 1 }
    expect(vectorValues(engine, vectorInst('c', 'eventCount'), p1)).toEqual([0, 0, 0])
    expect(vectorValues(engine, vectorInst('t', 'eventTime'), p1)).toEqual([0, 0, 0])
    expect(vectorValues(engine, vectorInst('s', 'eventTimeShare'), p1)).toEqual([0, 0, 0])
    expect(vectorValues(engine, vectorInst('l', 'eventLatency'), p1)).toEqual([NaN, NaN, NaN])
    expect(vectorValues(engine, vectorInst('d', 'eventDuration'), p1)).toEqual([NaN, NaN, NaN])
  })

  it('per-stimulus axis: a stimulus without channels has an empty vector; picks miss', () => {
    const engine = createEngine()
    const identity = query(vectorInst('c', 'eventCount'), {
      engine: engine as any, stimulusId: 0, participantId: 0,
    })
    if (identity.shape !== 'event-vector') throw new Error('unexpected shape')
    expect(identity.values).toEqual([])
    const pick = query(pickInst('p', 'eventTime', 'Music'), {
      engine: engine as any, stimulusId: 0, participantId: 0,
    })
    if (pick.shape !== 'scalar') throw new Error('unexpected shape')
    expect(pick.value).toBeNaN()
    expect(pick.provenance.refMissing).toBe(true)
  })

  it('a channel rename under an unchanged reader invalidates (table half of the token)', () => {
    const engine = createEngine()
    expect(vectorValues(engine, vectorInst('t', 'eventTime'))).toEqual([150, 0, 500])
    engine.metadata.eventData.data[1][1][1] = 'Music'
    expect(vectorValues(engine, vectorInst('t', 'eventTime'))).toEqual([150, 500])
  })

  it('an occurrence reload with unchanged defs invalidates (eventVersion half of the token)', () => {
    const engine = createEngine()
    expect(vectorValues(engine, vectorInst('t', 'eventTime'))).toEqual([150, 0, 500])
    // Append an occurrence to an existing channel: defs byte-identical, only
    // the buffers change — exactly the mid-session upload path.
    engine.getEventReader().load([[], [[[50, 100, 300, 50, 360, 20], []], [[100, 0, 250, 0], []], [[0, 300, 200, 200], []]]])
    engine.eventVersion++
    expect(vectorValues(engine, vectorInst('t', 'eventTime'))).toEqual([170, 0, 500])
  })

  it('queryBatch equals per-instance query for event-vector recipes (delegation pin)', () => {
    // Fresh engines per path so neither can serve the other's cache entries.
    const e1 = createEngine()
    const e2 = createEngine()
    const instances = () => [
      vectorInst('ec', 'eventCount'),
      pickInst('et', 'eventTime', 'Music'),
      pickInst('ed', 'eventDuration', 'Task'),
    ]
    const batch = queryBatch(instances(), { engine: e1 as any, stimulusId: STIM, participantId: 0 })
    for (const inst of instances()) {
      const single = query(inst, { engine: e2 as any, stimulusId: STIM, participantId: 0 })
      expect(batch.get(inst.id), inst.baseId).toEqual(single)
    }
  })

  it('the identity vector cannot be windowed; eventLatency vetoes windowing entirely', () => {
    expect(typeof recipeSupports(getRecipe('eventCount')!, {
      kind: 'windowed',
      window: { windowSize: 100, stepSize: 100 },
      inner: { kind: 'identity-event-vector' },
    })).toBe('string')
    expect(typeof recipeSupports(getRecipe('eventLatency')!, {
      kind: 'windowed',
      window: { windowSize: 100, stepSize: 100 },
      inner: { kind: 'pick-event', eventName: 'Music' },
    })).toBe('string')
    expect(
      metricIsCreatableInContract(getMetric('eventLatency')!, {
        outputShape: 'scalar',
        windowing: 'required',
        crossParticipant: 'per-participant',
      }, ALL_CAPS)
    ).toBe(false)
  })

  it('the event-vector contract narrows the library; scalar plots get pick-event for free', () => {
    const vectorContract = {
      outputShape: 'event-vector',
      windowing: 'forbidden',
      crossParticipant: 'distribution',
    } as const satisfies PlotMetricContract
    const scalarContract = {
      outputShape: 'scalar',
      windowing: 'forbidden',
      crossParticipant: 'per-participant',
    } as const satisfies PlotMetricContract

    expect(metricIsCreatableInContract(getMetric('eventCount')!, vectorContract, ALL_CAPS)).toBe(true)
    expect(metricIsCreatableInContract(getMetric('movementCount')!, vectorContract, ALL_CAPS)).toBe(false)
    expect(metricIsCreatableInContract(getMetric('fixationCount')!, vectorContract, ALL_CAPS)).toBe(false)
    // Metric Matrix / Correlation / Timeline consume one channel via pick-event.
    expect(metricIsCreatableInContract(getMetric('eventTimeShare')!, scalarContract, ALL_CAPS)).toBe(true)
  })

  it('capabilities gate the library both ways: no events hides event metrics, no segments hides gaze metrics', () => {
    const scalarContract = {
      outputShape: 'scalar',
      windowing: 'forbidden',
      crossParticipant: 'per-participant',
    } as const satisfies PlotMetricContract
    const noEvents: DataCapabilities = { segmented: true, spatial: false, event: false }
    const eventOnly: DataCapabilities = { segmented: false, spatial: false, event: true }

    // Gaze-only dataset: pick-event metrics vanish, gaze metrics stay.
    expect(metricIsCreatableInContract(getMetric('eventCount')!, scalarContract, noEvents)).toBe(false)
    expect(metricIsCreatableInContract(getMetric('fixationCount')!, scalarContract, noEvents)).toBe(true)
    // Event-only dataset: the mirror image.
    expect(metricIsCreatableInContract(getMetric('eventCount')!, scalarContract, eventOnly)).toBe(true)
    expect(metricIsCreatableInContract(getMetric('fixationCount')!, scalarContract, eventOnly)).toBe(false)
    expect(metricIsCreatableInContract(getMetric('movementCount')!, {
      outputShape: 'category-vector',
      windowing: 'forbidden',
      crossParticipant: 'distribution',
    }, eventOnly)).toBe(false)

    // Saved INSTANCES take the same gate: the seeded event starters vanish
    // from every list (and every plot resolution) the moment events do.
    const vectorContract = {
      outputShape: 'event-vector',
      windowing: 'forbidden',
      crossParticipant: 'distribution',
    } as const satisfies PlotMetricContract
    const eventStarter: MetricInstance = {
      id: 'eventCount', baseId: 'eventCount', params: {}, label: '',
      projection: { kind: 'identity-event-vector' },
    }
    expect(instanceMatchesContract(eventStarter, vectorContract, eventOnly)).toBe(true)
    expect(instanceMatchesContract(eventStarter, vectorContract, noEvents)).toBe(false)
  })

  it('registration refuses inconsistent event-axis declarations', () => {
    const trio = {
      init: () => new Float64Array(0),
      onFixation: () => {},
      finalize: () => [] as number[],
    }
    const base = {
      label: '', unit: '', description: '', category: 'events',
      windowUnit: 'ms', measurementClass: 'intensive', params: [] as const,
      ...trio,
    } as const
    expect(() =>
      defineMetric({ ...base, id: 'brokenEventShape', rawShape: 'scalar', scanSource: 'events', accumulation: 'stateful' } as never)
    ).toThrow(/event-vector/)
    expect(() =>
      defineMetric({ ...base, id: 'brokenEventSource', rawShape: 'event-vector', accumulation: 'stateful' } as never)
    ).toThrow(/scanSource: 'events'/)
    expect(() =>
      defineMetric({ ...base, id: 'brokenEventAccumulation', rawShape: 'event-vector', scanSource: 'events', accumulation: 'clippedDuration' } as never)
    ).toThrow(/stateful/)
  })
})
