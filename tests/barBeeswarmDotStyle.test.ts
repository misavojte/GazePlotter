import { describe, it, expect } from 'vitest'
import { computeDotStyle, type BarPlotLayout } from '../src/lib/plots/bar/core/renderers'
import { createAdaptiveTimeline } from '../src/lib/plots/shared'
import type { BarPlotDataItem } from '../src/lib/plots/bar/types'

// Regression: computeDotStyle used `Math.min(...positions)` / `Math.max(..., ...bins)`.
// For a metric whose individuals are per-fixation (e.g. fixation duration), an AOI
// can carry hundreds of thousands of individual values, and spreading that many
// arguments threw "RangeError: Maximum call stack size exceeded" — crashing both
// the beeswarm draw and the hover hit-test. The reduction is now loop-based.

function layoutWith(valuesPerItem: (number[] | null)[]): BarPlotLayout {
  return {
    plotLeft: 0,
    plotTop: 0,
    plotWidth: 500,
    plotHeight: 300,
    barPlottingType: 'horizontal',
    timeline: createAdaptiveTimeline(0, 1000, 6),
    items: valuesPerItem.map((vals, i) => ({
      categoryCenter: 60 + i * 90,
      categoryWidth: 80,
      data: { individualValues: vals } as unknown as BarPlotDataItem,
    })),
  }
}

describe('computeDotStyle — large individualValues (fixation duration)', () => {
  it('does not overflow the stack on hundreds of thousands of values', () => {
    // 500k values spanning the value range — comfortably past the spread limit.
    const big = new Array<number>(500_000)
    for (let i = 0; i < big.length; i++) big[i] = (i * 37) % 1000
    const layout = layoutWith([big])

    let radius = 0
    expect(() => {
      radius = computeDotStyle(layout).radius
    }).not.toThrow()
    // Densest possible cloud collapses the dot to the minimum radius.
    expect(radius).toBeGreaterThan(0)
    expect(radius).toBeLessThanOrEqual(5)
  })

  it('handles the all-equal (range < 1) branch on a large array', () => {
    const flat = new Array<number>(300_000).fill(500)
    const layout = layoutWith([flat])
    expect(() => computeDotStyle(layout)).not.toThrow()
  })

  it('handles mixed item sizes incl. empty / null without throwing', () => {
    const layout = layoutWith([
      null,
      [],
      [100],
      Array.from({ length: 200_000 }, (_, i) => i % 1000),
    ])
    const { radius } = computeDotStyle(layout)
    expect(radius).toBeGreaterThan(0)
  })

  it('keeps a generous radius when the cloud is sparse', () => {
    // A handful of well-separated values should not shrink the dot to the floor.
    const layout = layoutWith([[0, 250, 500, 750, 1000]])
    expect(computeDotStyle(layout).radius).toBeGreaterThan(1.5)
  })
})
