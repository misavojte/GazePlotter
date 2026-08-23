/**
 * Formula-level verification for the binary `fixated` metric (AOI hit / noticed
 * rate). Per participant it is 0/1 presence on each AOI; aggregated across
 * participants as `proportion` it is the per-AOI fraction of participants who
 * fixated it.
 *
 * The load-bearing invariant: a participant who never fixated an AOI must emit a
 * finite 0, so it stays in the proportion's denominator — otherwise the rate
 * collapses toward 1.0. The 2-of-4 → 0.5 test is the guard for that.
 *
 * Slot layout (2 AOIs): 0=AOI1, 1=AOI2, 2=noAoi, 3=anyFixation.
 */
import { describe, it, expect } from 'vitest'
import {
  makeTestEngine,
  makeSingleParticipantEngine,
  makeMultiParticipantEngine,
  makeScope,
} from './helpers/testEngine'
import {
  query,
  queryGroup,
  type MetricInstance,
  type Scope,
  type GroupScope,
} from '../src/lib/metrics'

const STIM = 1
const PID = 0

function inst(params: Record<string, unknown> = {}): MetricInstance {
  return { id: 't1', baseId: 'fixated', params, label: '', projection: { kind: 'identity-aoi-vector' } }
}

function vals(result: ReturnType<typeof query>): number[] {
  if (result.shape === 'aoi-vector') return result.values
  throw new Error(`expected aoi-vector, got ${result.shape}`)
}

describe('fixated — binary AOI presence', () => {
  it('marks a fixated AOI 1 and an un-fixated AOI a finite 0', () => {
    // Participant fixates AOI1 only.
    const engine = makeSingleParticipantEngine([[0, 100, 0, 1]])
    const r = vals(query(inst(), makeScope(engine)))
    expect(r[0]).toBe(100) // AOI1 fixated (percent — matches the % unit)
    expect(r[1]).toBe(0) // AOI2 never fixated → finite 0, not NaN
    expect(Number.isFinite(r[1])).toBe(true)
  })

  it('is binarised: five fixations on an AOI still contribute 1, not 5', () => {
    const engine = makeSingleParticipantEngine([
      [0, 100, 0, 1], [100, 200, 0, 1], [200, 300, 0, 1], [300, 400, 0, 1], [400, 500, 0, 1],
    ])
    const r = vals(query(inst(), makeScope(engine)))
    expect(r[0]).toBe(100)
  })
})

describe('fixated — proportion across participants (noticed rate)', () => {
  it('2 of 4 participants fixating an AOI gives 50% (non-fixators stay in the denominator)', () => {
    const engine = makeMultiParticipantEngine([
      [[0, 100, 0, 1]], // P0: AOI1
      [[0, 100, 0, 1]], // P1: AOI1
      [[0, 100, 0, 2]], // P2: AOI2 only — a 0 for AOI1
      [[0, 100, 0, 2]], // P3: AOI2 only — a 0 for AOI1
    ])
    const groupScope: GroupScope = { engine: engine, stimulusId: STIM, participantIds: [0, 1, 2, 3] }
    const result = queryGroup(inst(), groupScope)
    expect(result.shape).toBe('aoi-vector')
    if (result.shape !== 'aoi-vector') throw new Error('expected aoi-vector')
    expect(result.values[0]).toBeCloseTo(50, 9) // AOI1: 2/4 = 50% — NOT 2/2
    expect(result.values[1]).toBeCloseTo(50, 9) // AOI2: 2/4 = 50%
  })

  it('all participants fixating gives 100%; none gives 0%', () => {
    const all = makeMultiParticipantEngine([[[0, 100, 0, 1]], [[0, 100, 0, 1]]])
    const none = makeMultiParticipantEngine([[[0, 100, 0, 2]], [[0, 100, 0, 2]]])
    const gs = (e: any): GroupScope => ({ engine: e, stimulusId: STIM, participantIds: [0, 1] })
    const a = queryGroup(inst(), gs(all))
    const z = queryGroup(inst(), gs(none))
    if (a.shape !== 'aoi-vector' || z.shape !== 'aoi-vector') throw new Error('expected aoi-vector')
    expect(a.values[0]).toBeCloseTo(100, 9)
    expect(z.values[0]).toBeCloseTo(0, 9)
  })
})

describe('fixated — thresholds (params)', () => {
  it('minFixationCount: one fixation is below a threshold of 2', () => {
    const one = makeSingleParticipantEngine([[0, 100, 0, 1]])
    const two = makeSingleParticipantEngine([[0, 100, 0, 1], [100, 200, 0, 1]])
    expect(vals(query(inst({ minFixationCount: 2 }), makeScope(one)))[0]).toBe(0)
    expect(vals(query(inst({ minFixationCount: 2 }), makeScope(two)))[0]).toBe(100)
  })

  it('minDwellMs: total dwell below the threshold does not count as fixated', () => {
    const short = makeSingleParticipantEngine([[0, 100, 0, 1]])            // 100 ms dwell
    const long = makeSingleParticipantEngine([[0, 100, 0, 1], [100, 200, 0, 1]]) // 200 ms dwell
    expect(vals(query(inst({ minDwellMs: 150 }), makeScope(short)))[0]).toBe(0)
    expect(vals(query(inst({ minDwellMs: 150 }), makeScope(long)))[0]).toBe(100)
  })
})
