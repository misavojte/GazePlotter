/**
 * The reactive/plain boundary for plot data derivation (`usePlotData`).
 *
 * The rune wiring is thin ($derived + untrack); the logic that carries the
 * contract lives in the snapshot gate and is tested here directly:
 *  - transforms receive a PLAIN, deeply-frozen clone, never the live object
 *  - deep-equal noise keeps a STABLE reference (no downstream re-derivation)
 *  - `viewOnly` keys are stripped and never invalidate
 *  - a real content change produces a fresh frozen snapshot
 */
import { describe, expect, it } from 'vitest'
import {
  createSettingsGate,
  deepEqual,
  snapshotSettings,
} from '$lib/plots/shared/plotData.svelte'

type Settings = {
  stimulusId: number
  timeline: string
  limits: Record<number, [number, number]>
  metricInstanceIds: string[]
  highlights?: string[]
}

const base = (): Settings => ({
  stimulusId: 0,
  timeline: 'absolute',
  limits: { 0: [0, 100] },
  metricInstanceIds: ['m1'],
  highlights: [],
})

describe('createSettingsGate', () => {
  it('returns a plain deep clone, not the input object', () => {
    const gate = createSettingsGate<Settings>()
    const input = base()
    const snap = gate(input)
    expect(snap).not.toBe(input)
    expect(snap.limits).not.toBe(input.limits)
    expect(snap).toEqual(input)
  })

  it('freezes the snapshot deeply (transforms cannot mutate their input)', () => {
    const gate = createSettingsGate<Settings>()
    const snap = gate(base())
    expect(Object.isFrozen(snap)).toBe(true)
    expect(Object.isFrozen(snap.limits)).toBe(true)
    expect(Object.isFrozen(snap.limits[0])).toBe(true)
    expect(Object.isFrozen(snap.metricInstanceIds)).toBe(true)
    expect(() => {
      ;(snap as { stimulusId: number }).stimulusId = 1
    }).toThrow()
    expect(() => {
      snap.metricInstanceIds.push('m2')
    }).toThrow()
  })

  it('keeps a stable reference when a rebuilt object is deep-equal (spread noise)', () => {
    const gate = createSettingsGate<Settings>()
    const first = gate(base())
    const second = gate({ ...base(), limits: { 0: [0, 100] } })
    expect(second).toBe(first)
  })

  it('returns a fresh snapshot when content actually changes', () => {
    const gate = createSettingsGate<Settings>()
    const first = gate(base())
    const second = gate({ ...base(), stimulusId: 2 })
    expect(second).not.toBe(first)
    expect(second.stimulusId).toBe(2)
    // and the change survives a further noise read
    const third = gate({ ...base(), stimulusId: 2 })
    expect(third).toBe(second)
  })

  it('detects nested changes (record values, array elements)', () => {
    const gate = createSettingsGate<Settings>()
    const first = gate(base())
    const changed = base()
    changed.limits[0] = [0, 250]
    expect(gate(changed)).not.toBe(first)
    const arrChanged = base()
    arrChanged.limits[0] = [0, 250]
    arrChanged.metricInstanceIds = ['m1', 'm2']
    expect(gate(arrChanged)).not.toBe(gate(changed))
  })

  it('strips viewOnly keys and never invalidates on their changes', () => {
    const gate = createSettingsGate<Settings>(['highlights'])
    const first = gate(base())
    expect('highlights' in first).toBe(false)
    const highlightClick = { ...base(), highlights: ['aoi-3'] }
    expect(gate(highlightClick)).toBe(first)
    const anotherClick = { ...base(), highlights: ['aoi-3', 'aoi-7'] }
    expect(gate(anotherClick)).toBe(first)
    // a real key change still invalidates
    expect(gate({ ...base(), timeline: 'ordinal' })).not.toBe(first)
  })
})

describe('snapshotSettings', () => {
  it('returns a frozen plain clone for boundary call sites (export deriveView)', () => {
    const input = base()
    const snap = snapshotSettings(input)
    expect(snap).not.toBe(input)
    expect(snap).toEqual(input)
    expect(Object.isFrozen(snap)).toBe(true)
    expect(Object.isFrozen(snap.limits)).toBe(true)
  })
})

describe('deepEqual', () => {
  it('primitives and NaN', () => {
    expect(deepEqual(1, 1)).toBe(true)
    expect(deepEqual(NaN, NaN)).toBe(true)
    expect(deepEqual(0, -0)).toBe(true)
    expect(deepEqual(1, '1')).toBe(false)
    expect(deepEqual(null, undefined)).toBe(false)
    expect(deepEqual(undefined, undefined)).toBe(true)
  })

  it('arrays', () => {
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true)
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false)
  })

  it('objects, including missing-vs-undefined keys', () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true)
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(deepEqual({ a: undefined }, { b: undefined })).toBe(false)
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
  })
})
