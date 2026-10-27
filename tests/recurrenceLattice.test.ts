/**
 * The recurrence plot's fixation lattice: fixation k is a POSITION (fixation 1
 * on the axis line, fixation N on the opposite border), its axes carry nice
 * whole-number ticks starting at 1, and hover snaps to the nearest pair.
 */
import { describe, expect, it } from 'vitest'
import { indexTicks } from '$lib/plots/shared/ticks'
import {
  buildRecurrenceTooltipContent,
  latticeOffset,
  latticeStep,
  nearestFixation,
} from '$lib/plots/recurrence/core'
import type { RecurrenceData } from '$lib/plots/recurrence/types'

describe('indexTicks', () => {
  it('labels 1 at the origin, then multiples of a nice step', () => {
    expect(indexTicks(47, 5).labels).toEqual(['1', '10', '20', '30', '40'])
  })

  it('puts item 1 at 0 and item N at 1', () => {
    const { positions, labels } = indexTicks(11, 5)
    expect(positions[0]).toBe(0)
    expect(labels?.at(-1)).toBe('10')
    expect(positions.at(-1)).toBeCloseTo(0.9)
  })

  it('labels every item on short axes', () => {
    expect(indexTicks(2, 5).labels).toEqual(['1', '2'])
    expect(indexTicks(5, 5).labels).toEqual(['1', '2', '3', '4', '5'])
  })

  it('never uses a fractional step', () => {
    for (let n = 2; n <= 400; n++) {
      for (const label of indexTicks(n, 5).labels!) {
        expect(Number.isInteger(Number(label))).toBe(true)
      }
    }
  })

  it('can tick item 1 without labelling it, for a shared origin', () => {
    const { positions, labels } = indexTicks(47, 5, { labelFirst: false })
    expect(positions[0]).toBe(0)
    expect(labels).toEqual(['', '10', '20', '30', '40'])
  })

  it('inverts for a bottom-origin axis', () => {
    const { positions } = indexTicks(11, 5, { invert: true })
    expect(positions[0]).toBe(1)
    expect(positions.at(-1)).toBeCloseTo(0.1)
  })
})

describe('fixation lattice', () => {
  it('spans N - 1 steps edge to edge', () => {
    expect(latticeStep(5, 400)).toBe(100)
    expect(latticeOffset(5, 400, 0)).toBe(0)
    expect(latticeOffset(5, 400, 4)).toBe(400)
  })

  it('snaps to the nearest fixation', () => {
    expect(nearestFixation(5, 400, 0, 0)).toBe(0)
    expect(nearestFixation(5, 400, 49, 0)).toBe(0)
    expect(nearestFixation(5, 400, 51, 0)).toBe(1)
    expect(nearestFixation(5, 400, 400, 0)).toBe(4)
  })

  it('refuses beyond the slop past either end', () => {
    expect(nearestFixation(5, 400, -3, 0)).toBe(-1)
    expect(nearestFixation(5, 400, -3, 4)).toBe(0)
    expect(nearestFixation(5, 400, 403, 4)).toBe(4)
    expect(nearestFixation(5, 400, 405, 4)).toBe(-1)
  })

  it('has no lattice below two fixations', () => {
    expect(latticeStep(1, 400)).toBe(0)
    expect(nearestFixation(1, 400, 0, 0)).toBe(-1)
  })
})

describe('buildRecurrenceTooltipContent', () => {
  const data = (durations: boolean): RecurrenceData => ({
    matrix: Uint8Array.from([1, 1, 1, 0]),
    durationMatrix: durations ? Float32Array.from([200, 350, 350, 0]) : null,
    fixationCount: 2,
    fixationAoiColors: [null, null],
    fixationStarts: Float64Array.from([0, 300]),
    fixationEnds: Float64Array.from([100, 450]),
  })

  it('names the pair 1-based and whether it recurs', () => {
    expect(buildRecurrenceTooltipContent(data(false), 1, 0)).toEqual([
      { key: 'Fixation j', value: '1' },
      { key: 'Fixation i', value: '2' },
      { key: 'Recurrent', value: 'Yes' },
    ])
    expect(buildRecurrenceTooltipContent(data(true), 1, 1).at(-1)).toEqual({
      key: 'Recurrent',
      value: 'No',
    })
  })

  it('adds the duration sum as a raw number', () => {
    expect(buildRecurrenceTooltipContent(data(true), 0, 1).at(-1)).toEqual({
      key: 'Duration sum',
      value: '350.0',
    })
  })
})
