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
