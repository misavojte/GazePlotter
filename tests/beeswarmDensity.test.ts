import { describe, it, expect } from 'vitest'
import {
  DOT_PITCH,
  DOT_RADIUS,
  computeSlotDensity,
  computeSwarmPositions,
  drawStatisticalOverlay,
  figureDensityPeak,
  type BeeswarmLayout,
} from '../src/lib/plots/shared/distribution/beeswarm/renderers'
import { createAdaptiveTimeline } from '../src/lib/plots/shared'
import type { CategoryDistribution } from '../src/lib/plots/shared/distribution/types'

/**
 * The density pass behind the swarm's width. Cells are one dot wide, counts are
 * smoothed over a cell either side, and ONE reference peak is shared by the whole
 * figure so rows stay comparable in amount as well as shape.
 *
 * Also the regression that motivated the previous implementation's rewrite: a
 * per-fixation metric can put hundreds of thousands of values in one AOI, and
 * reducing that with spread arguments (`Math.min(...positions)`) threw
 * "RangeError: Maximum call stack size exceeded", crashing both the draw and the
 * hover hit-test. Every reduction here stays loop- or Map-based.
 */

function layoutWith(valuesPerItem: (number[] | null)[]): BeeswarmLayout {
  return {
    plotLeft: 0,
    plotTop: 0,
    plotWidth: 500,
    plotHeight: 300,
    orientation: 'horizontal',
    timeline: createAdaptiveTimeline(0, 1000, 6),
    items: valuesPerItem.map((vals, i) => ({
      categoryCenter: 60 + i * 90,
      categoryWidth: 80,
      data: { individualValues: vals } as unknown as CategoryDistribution,
    })),
  }
}

describe('the dot size is a constant', () => {
  it('does not move with the data, because the cell width derives from it', () => {
    expect(DOT_RADIUS).toBe(2)
  })
})

describe('per-cell density', () => {
  it('counts nothing for an empty slot', () => {
    const d = computeSlotDensity(layoutWith([[]]), [])
    expect(d.counts.size).toBe(0)
    expect(d.peak).toBe(0)
  })

  it('bins values that share a pixel into one cell', () => {
    const d = computeSlotDensity(layoutWith([[]]), [500, 500, 500])
    expect(d.counts.size).toBe(1)
    expect([...d.counts.values()][0]).toBe(3)
  })

  it('keeps nearby values within a cell or two, since cell edges are fixed', () => {
    // The axis is 0..1000 over 500px, so a 4.4px cell spans about 9 value units.
    // Three values one unit apart therefore land in one cell, or in two when they
    // happen to straddle a boundary — never spread further than that.
    const d = computeSlotDensity(layoutWith([[]]), [500, 501, 502])
    expect(d.counts.size).toBeLessThanOrEqual(2)
    expect([...d.counts.values()].reduce((a, b) => a + b, 0)).toBe(3)
  })

  it('separates values more than a dot apart', () => {
    const d = computeSlotDensity(layoutWith([[]]), [100, 900])
    expect(d.counts.size).toBe(2)
  })

  it('smooths each cell with its neighbours', () => {
    const layout = layoutWith([[]])
    // One heavy cell with empty neighbours: the smoothed value is a third of it.
    const d = computeSlotDensity(layout, Array<number>(30).fill(500))
    const cell = [...d.counts.keys()][0]
    expect(d.counts.get(cell)).toBe(30)
    expect(d.smooth.get(cell)).toBeCloseTo(10, 5)
    expect(d.peak).toBeCloseTo(10, 5)
  })
})

describe('the reference peak is shared by the figure', () => {
  it('takes the largest peak across every slot', () => {
    const layout = layoutWith([[]])
    const a = computeSlotDensity(layout, Array<number>(30).fill(500))
    const b = computeSlotDensity(layout, Array<number>(6).fill(500))
    expect(figureDensityPeak([a, b])).toBeCloseTo(a.peak, 5)
    expect(figureDensityPeak([b, a])).toBeCloseTo(a.peak, 5)
  })

  it('is zero for a figure with no values at all', () => {
    const layout = layoutWith([[]])
    expect(figureDensityPeak([computeSlotDensity(layout, [])])).toBe(0)
    // And a zero reference must not produce a division by zero.
    const slot = layout.items[0]
    expect(() =>
      computeSwarmPositions(layout, slot, computeSlotDensity(layout, []), 0)
    ).not.toThrow()
  })
})

describe('hundreds of thousands of values in one slot', () => {
  it('does not overflow the stack', () => {
    const big = new Array<number>(500_000)
    for (let i = 0; i < big.length; i++) big[i] = (i * 37) % 1000
    const layout = layoutWith([big])
    let density!: ReturnType<typeof computeSlotDensity>
    expect(() => {
      density = computeSlotDensity(layout, big)
    }).not.toThrow()
    expect(density.peak).toBeGreaterThan(0)
    expect(() =>
      computeSwarmPositions(layout, layout.items[0], density, density.peak)
    ).not.toThrow()
  })

  it('handles the all-equal case, where every value lands in one cell', () => {
    const flat = new Array<number>(300_000).fill(500)
    const layout = layoutWith([flat])
    const density = computeSlotDensity(layout, flat)
    expect(density.counts.size).toBe(1)
    const points = computeSwarmPositions(layout, layout.items[0], density, density.peak)
    // Bounded by the pixels available across the band, not by the value count.
    expect(points.length).toBeLessThan(1000)
    for (const p of points) {
      expect(Math.abs(p.categoryPos - layout.items[0].categoryCenter)).toBeLessThanOrEqual(
        layout.items[0].categoryWidth / 2 - DOT_RADIUS + 0.001
      )
    }
  })

  it('handles mixed slot sizes including empty and null', () => {
    const layout = layoutWith([
      null,
      [],
      [100],
      Array.from({ length: 200_000 }, (_, i) => i % 1000),
    ])
    expect(() => {
      const densities = layout.items.map(item =>
        computeSlotDensity(layout, item.data.individualValues ?? [])
      )
      const reference = figureDensityPeak(densities)
      layout.items.forEach((item, i) =>
        computeSwarmPositions(layout, item, densities[i], reference)
      )
    }).not.toThrow()
  })
})

describe('marks outside the axis are omitted, not pinned to the border', () => {
  // A narrowed scale is the only way this arises: by default the axis is derived
  // from the data maximum, so every statistic is inside it.
  function narrowLayout(): BeeswarmLayout {
    const l = layoutWith([[100, 500, 900]])
    return { ...l, timeline: createAdaptiveTimeline(300, 600, 6) }
  }
  function recordOverlay(stats: Record<string, number>, overlay: 'boxplot' | 'meanSd') {
    const layout = narrowLayout()
    layout.items[0].data = {
      individualValues: [400, 450, 500],
      stats,
    } as unknown as CategoryDistribution
    const strokes: { lw: number }[] = []
    let lineWidth = 1
    const ctx = {
      get lineWidth() { return lineWidth },
      set lineWidth(v: number) { lineWidth = v },
      strokeStyle: '',
      beginPath() {},
      moveTo() {},
      lineTo() {},
      rect() {},
      stroke() { strokes.push({ lw: lineWidth }) },
    } as unknown as CanvasRenderingContext2D
    drawStatisticalOverlay(ctx, layout, overlay)
    return strokes
  }

  it('drops a whisker cap whose value lies past the axis', () => {
    const inside = recordOverlay(
      { count: 3, mean: 450, median: 450, q1: 400, q3: 500,
        sd: 40, sem: 10, whiskerLow: 350, whiskerHigh: 550 },
      'boxplot'
    )
    const outside = recordOverlay(
      { count: 3, mean: 450, median: 450, q1: 400, q3: 500,
        sd: 40, sem: 10, whiskerLow: 100, whiskerHigh: 900 },
      'boxplot'
    )
    // Same marks minus the two caps that fell outside.
    expect(outside.length).toBe(inside.length - 2)
  })

  it('drops an SD arm cap that runs past the axis but keeps the stem', () => {
    const inside = recordOverlay(
      { count: 3, mean: 450, median: 450, q1: 400, q3: 500,
        sd: 50, sem: 10, whiskerLow: 400, whiskerHigh: 500 },
      'meanSd'
    )
    const outside = recordOverlay(
      { count: 3, mean: 450, median: 450, q1: 400, q3: 500,
        sd: 400, sem: 10, whiskerLow: 400, whiskerHigh: 500 },
      'meanSd'
    )
    expect(outside.length).toBe(inside.length - 2)
    // The stem survives, so the part of the interval that is in view still shows.
    expect(outside.length).toBeGreaterThan(0)
  })

  it('drops the mean line when the mean itself is off the axis', () => {
    const on = recordOverlay(
      { count: 3, mean: 450, median: 450, q1: 400, q3: 500,
        sd: 0, sem: 0, whiskerLow: 450, whiskerHigh: 450 },
      'meanSd'
    )
    const off = recordOverlay(
      { count: 3, mean: 900, median: 900, q1: 400, q3: 500,
        sd: 0, sem: 0, whiskerLow: 900, whiskerHigh: 900 },
      'meanSd'
    )
    expect(on.some(s => s.lw === 3)).toBe(true)
    expect(off.some(s => s.lw === 3)).toBe(false)
  })
})

describe('the fit threshold is expressed in the mark unit', () => {
  it('a dot pitch is the dot diameter plus its gap', () => {
    expect(DOT_PITCH).toBeCloseTo(DOT_RADIUS * 2.2, 10)
  })

  it('a row thinner than a few dot widths cannot hold a swarm', () => {
    // Four pitches is the figure's threshold. At one pitch the band is thinner
    // than a single dot, so nothing can be placed off the centre line.
    const layout = layoutWith([Array<number>(40).fill(500)])
    const tooThin = { ...layout.items[0], categoryWidth: DOT_PITCH }
    const density = computeSlotDensity(layout, tooThin.data.individualValues ?? [])
    const points = computeSwarmPositions(layout, tooThin, density, density.peak)
    const offsets = new Set(points.map(p => Math.round(p.categoryPos - tooThin.categoryCenter)))
    expect(offsets.size).toBeLessThanOrEqual(2)
  })

  it('four dot widths is enough to spread', () => {
    const layout = layoutWith([Array<number>(40).fill(500)])
    const ok = { ...layout.items[0], categoryWidth: 4 * DOT_PITCH }
    const density = computeSlotDensity(layout, ok.data.individualValues ?? [])
    const points = computeSwarmPositions(layout, ok, density, density.peak)
    const spread = Math.max(...points.map(p => Math.abs(p.categoryPos - ok.categoryCenter)))
    expect(spread).toBeGreaterThan(DOT_PITCH)
  })
})
