/**
 * A Start-only time range (`timeEnd` 0 = open end) is a bounded scope: it
 * clips, gates by midpoint and measures its extent from Start, exactly like
 * the bounded range ending at the recording's end. Pinned on every scan that
 * builds a scope: the single and batch fixation scans, the category scan and
 * the event scan. Excluding the first second (central bias) is this case.
 */
import { describe, it, expect } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import { query, queryBatch, type MetricInstance, type Scope } from '../src/lib/metrics'
import { fillWindowFrame, type WindowFrame } from '../src/lib/metrics/core/dsl'
import type { DataEngine } from '../src/lib/data/engine/dataEngine.svelte'

const STIM = 1
const START = 150

// P0 fixations [0,100] AOI1, [100,200] AOI2, [200,300] AOI1; saccade [300,340];
// fixation [340,400]. Recording ends 400.
const SEGMENTS: number[][][] = [
  [
    [0, 100, 0, 1],
    [100, 200, 0, 2],
    [200, 300, 0, 1],
    [300, 340, 1],
    [340, 400, 0],
  ],
]
const RECORDING_END = 400

function engine(): DataEngine {
  return makeTestEngine([[], SEGMENTS], {
    categories: [
      ['Fixation', 'Fixation', '#000000'],
      ['Saccade', 'Saccade', '#111111'],
    ],
    eventData: [[], [['Music', 'Music', '#101010']]],
    eventOrderVector: [[], [0]],
    // Music [120, 220] straddles Start.
    events: [[], [[[120, 100]]]],
  })
}

const inst = (id: string, baseId: string, kind: string): MetricInstance =>
  ({ id, baseId, params: {}, label: '', projection: { kind } }) as MetricInstance

function valuesOf(e: DataEngine, i: MetricInstance, scope: Partial<Scope>): number[] {
  const r = query(i, { engine: e, stimulusId: STIM, participantId: 0, timeStart: 0, timeEnd: 0, ...scope })
  return (r as { values: number[] }).values
}

describe('fillWindowFrame: Start-only range', () => {
  const frame = {} as WindowFrame

  it('clips a fixation straddling Start and reports its midpoint membership', () => {
    expect(fillWindowFrame(frame, 100, 300, START, 0)).toBe(true)
    expect(frame).toMatchObject({ windowStart: START, windowEnd: Infinity, start: START, end: 300, duration: 150 })
    // Midpoint 140 precedes Start: clipped in, but not a member.
    expect(fillWindowFrame(frame, 100, 180, START, 0)).toBe(false)
    expect(frame.duration).toBe(30)
  })

  it('leaves an unbounded scope untouched', () => {
    expect(fillWindowFrame(frame, 100, 300, 0, 0)).toBe(true)
    expect(frame).toMatchObject({ windowStart: 0, windowEnd: Infinity, start: 100, end: 300, duration: 200 })
  })
})

describe('Start-only scope equals the bounded scope ending at the recording end', () => {
  const startOnly = { timeStart: START, timeEnd: 0 }
  const bounded = { timeStart: START, timeEnd: RECORDING_END }

  it('fixation scan: counts by midpoint, clips dwell', () => {
    const e = engine()
    expect(valuesOf(e, inst('fc', 'fixationCount', 'identity-aoi-vector'), startOnly).slice(0, 2)).toEqual([1, 1])
    expect(valuesOf(e, inst('at', 'absoluteTime', 'identity-aoi-vector'), startOnly).slice(0, 2)).toEqual([100, 50])
    for (const baseId of ['fixationCount', 'absoluteTime', 'relativeTime', 'visitCount']) {
      expect(valuesOf(e, inst(baseId, baseId, 'identity-aoi-vector'), startOnly), baseId).toEqual(
        valuesOf(engine(), inst(baseId, baseId, 'identity-aoi-vector'), bounded)
      )
    }
  })

  it('batch fixation scan matches the single scan', () => {
    const ids = ['fixationCount', 'absoluteTime', 'relativeTime']
    const batch = queryBatch(
      ids.map(id => inst(id, id, 'identity-aoi-vector')),
      { engine: engine(), stimulusId: STIM, participantId: 0, ...startOnly }
    )
    for (const id of ids) {
      const single = query(inst(id, id, 'identity-aoi-vector'), {
        engine: engine(),
        stimulusId: STIM,
        participantId: 0,
        ...startOnly,
      })
      expect(batch.get(id), id).toEqual(single)
    }
  })

  it('category scan: share of the range, not of the recording', () => {
    const share = valuesOf(engine(), inst('m', 'movementTimeShare', 'identity-category-vector'), startOnly)
    expect(share).toEqual(valuesOf(engine(), inst('m', 'movementTimeShare', 'identity-category-vector'), bounded))
    // Saccade [300,340] over the 250 ms range.
    expect(share[1]).toBeCloseTo(16, 10)
  })

  it('event scan: share of the range, clipped at Start', () => {
    const share = valuesOf(engine(), inst('ev', 'eventTimeShare', 'identity-event-vector'), startOnly)
    expect(share).toEqual(valuesOf(engine(), inst('ev', 'eventTimeShare', 'identity-event-vector'), bounded))
    // Music [150,220] of 250 ms.
    expect(share[0]).toBeCloseTo(28, 10)
  })
})

describe('zero-length segments on range edges', () => {
  const one = (segments: number[][]) =>
    makeTestEngine([[], [segments]], {
      categories: [
        ['Fixation', 'Fixation', '#000000'],
        ['Saccade', 'Saccade', '#111111'],
      ],
    })
  const count = (segs: number[][], baseId: string, kind: string, scope: Partial<Scope>) =>
    valuesOf(one(segs), inst(baseId, baseId, kind), scope)
  const scalarOf = (segs: number[][], baseId: string, scope: Partial<Scope>) =>
    (query(inst(baseId, baseId, 'identity-scalar'), { engine: one(segs), stimulusId: STIM, participantId: 0, ...scope }) as { value: number }).value
  const windowed = (segs: number[][], baseId: string, scope: Partial<Scope>): number[][] => {
    const i = {
      ...inst(baseId, baseId, 'windowed'),
      projection: { kind: 'windowed', window: { windowSize: 540, stepSize: 540 }, inner: { kind: 'identity-aoi-vector' } },
    } as MetricInstance
    const r = query(i, { engine: one(segs), stimulusId: STIM, participantId: 0, timeStart: 0, timeEnd: 0, ...scope })
    return (r as { vectors: number[][] }).vectors
  }

  it('an instant at the recording end belongs to a..R exactly like to a..0 (RQA)', () => {
    // Two fixations on AOI 1; the second is a zero-length one at the recording end 6827.
    const segs = [[6204, 6827, 0, 1], [6827, 6827, 0, 1]]
    for (const baseId of ['rqaDet', 'rqaLam']) {
      expect(scalarOf(segs, baseId, { timeStart: 6287, timeEnd: 0 }), baseId).toBe(0)
      expect(scalarOf(segs, baseId, { timeStart: 6287, timeEnd: 6827 }), baseId).toBe(0)
    }
  })

  it('a lone zero-length segment at 0 is counted by the whole-recording scope', () => {
    // Slots: AOI1, AOI2, noAoi, anyFixation; categories: Fixation, Saccade.
    expect(count([[0, 0, 0]], 'fixationCount', 'identity-aoi-vector', {})).toEqual([0, 0, 1, 1])
    expect(count([[0, 0, 0]], 'movementCount', 'identity-category-vector', {})).toEqual([1, 0])
    expect(count([[0, 0, 1]], 'movementCount', 'identity-category-vector', {})).toEqual([0, 1])
  })

  it('a one-instant recording is held by the range from its own start, wherever the clock starts', () => {
    // The same recording shifted to 5000: the range from its start still holds it.
    expect(count([[5000, 5000, 0]], 'fixationCount', 'identity-aoi-vector', { timeStart: 5000 })).toEqual([0, 0, 1, 1])
    expect(count([[5000, 5000, 0]], 'fixationCount', 'identity-aoi-vector', {})).toEqual([0, 0, 1, 1])
  })

  it('an instant on a cut is counted by exactly one half (window additivity)', () => {
    const fc = (segs: number[][], scope: Partial<Scope>) =>
      count(segs, 'fixationCount', 'identity-aoi-vector', scope).at(-1)
    const whole = { timeStart: 6287, timeEnd: 11955 }
    const left = { timeStart: 6287, timeEnd: 6827 }
    const right = { timeStart: 6827, timeEnd: 11955 }
    // At the recording end 6827 the instant goes to the half reaching it, not to the half starting there.
    const atEnd = [[6300, 6400, 0], [6827, 6827, 0]]
    expect([fc(atEnd, whole), fc(atEnd, left), fc(atEnd, right)]).toEqual([2, 2, 0])
    // Inside the recording it goes to the half starting on it, like a midpoint on the cut.
    const inside = [[6827, 6827, 0], [6900, 7000, 0]]
    expect([fc(inside, whole), fc(inside, left), fc(inside, right)]).toEqual([2, 0, 2])
    // The windowed drivers tile [6287, 6827), [6827, 7367), ... the same way.
    const noAoi = (segs: number[][], baseId: string) => windowed(segs, baseId, whole).slice(0, 2).map(v => v[2])
    expect(noAoi(atEnd, 'fixationCount')).toEqual([2, 0])
    expect(noAoi(inside, 'fixationCount')).toEqual([0, 2])
    expect(noAoi(atEnd, 'visitCount')).toEqual([1, 0])
    expect(noAoi(inside, 'visitCount')).toEqual([0, 1])
  })
})
