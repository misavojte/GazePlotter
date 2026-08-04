/**
 * Resolving the PLOT CURSOR's instant to a fixation. The load-bearing property is
 * the REFUSAL: between fixations this participant was fixating nothing, and
 * snapping to the nearest one would invent a position they never held.
 */
import { describe, expect, it } from 'vitest'
import { fixationAt, fixationMidpoint } from '$lib/plots/recurrence/core'
import type { RecurrenceData } from '$lib/plots/recurrence/types'

/** Three fixations with saccade gaps: [100,200) [300,450) [600,700). */
function data(
  spans: [number, number][] = [
    [100, 200],
    [300, 450],
    [600, 700],
  ]
): RecurrenceData {
  return {
    matrix: new Uint8Array(spans.length * spans.length),
    durationMatrix: null,
    fixationCount: spans.length,
    fixationAoiColors: spans.map(() => null),
    fixationStarts: Float64Array.from(spans.map(s => s[0])),
    fixationEnds: Float64Array.from(spans.map(s => s[1])),
  }
}

describe('fixationAt', () => {
  it('finds the fixation holding that instant', () => {
    expect(fixationAt(data(), 150)).toBe(0)
    expect(fixationAt(data(), 400)).toBe(1)
    expect(fixationAt(data(), 650)).toBe(2)
  })

  it('includes the onset and excludes the end, so spans never double-claim', () => {
    expect(fixationAt(data(), 100)).toBe(0)
    expect(fixationAt(data(), 200)).toBe(-1)
    expect(fixationAt(data(), 300)).toBe(1)
  })

  it('refuses during a saccade rather than snapping to a neighbour', () => {
    expect(fixationAt(data(), 250)).toBe(-1)
    expect(fixationAt(data(), 500)).toBe(-1)
  })

  it('refuses outside the recording', () => {
    expect(fixationAt(data(), 0)).toBe(-1)
    expect(fixationAt(data(), 99)).toBe(-1)
    expect(fixationAt(data(), 5000)).toBe(-1)
  })

  it('handles one fixation and none at all', () => {
    expect(fixationAt(data([[10, 20]]), 15)).toBe(0)
    expect(fixationAt(data([[10, 20]]), 25)).toBe(-1)
    expect(fixationAt(data([]), 15)).toBe(-1)
  })
})

describe('fixationMidpoint', () => {
  it('anchors a fixation at its middle, not its onset', () => {
    // A span's onset sits on the boundary with the preceding saccade; its middle is
    // where it is anchored (cf. EvolvingMetricsWindow.centerMs).
    expect(fixationMidpoint(data(), 0)).toBe(150)
    expect(fixationMidpoint(data(), 1)).toBe(375)
  })

  it('is NaN out of range, so a shrunk recording publishes nothing', () => {
    expect(fixationMidpoint(data(), 3)).toBeNaN()
    expect(fixationMidpoint(data(), -1)).toBeNaN()
  })

  it('round-trips with the midpoint it publishes', () => {
    // The pair the two directions form: a cell publishes a fixation's MIDPOINT, and
    // any plot reading that instant back must land on the same fixation.
    const d = data()
    for (let i = 0; i < d.fixationCount; i++) {
      expect(fixationAt(d, fixationMidpoint(d, i))).toBe(i)
    }
  })

  it('searches, so a long recording resolves without scanning', () => {
    // 1000 back-to-back 10ms fixations: a binary search must land exactly.
    const spans: [number, number][] = Array.from({ length: 1000 }, (_, i) => [
      i * 10,
      i * 10 + 10,
    ])
    const d = data(spans)
    expect(fixationAt(d, 0)).toBe(0)
    expect(fixationAt(d, 4995)).toBe(499)
    expect(fixationAt(d, 9999)).toBe(999)
  })
})
