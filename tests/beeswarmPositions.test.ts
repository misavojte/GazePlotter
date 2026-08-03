import { describe, it, expect } from 'vitest'
import {
  DOT_RADIUS,
  computeSlotDensity,
  computeSwarmPositions,
  figureDensityPeak,
  valueToPixel,
  type BeeswarmLayout,
  type CategorySlotLayout,
} from '$lib/plots/shared/distribution/beeswarm/renderers'
import { createAdaptiveTimeline } from '$lib/plots/shared'
import type { CategoryDistribution } from '$lib/plots/shared/distribution/types'

/**
 * The swarm places EVERY value. A cell along the value axis is one dot wide, and a
 * cell's half-extent is the smaller of the width its density earns against the
 * figure's reference peak and what its values need at one dot-pitch of spacing.
 * These pin that contract rather than any particular pixel.
 */

const CENTER = 100
const CATEGORY_WIDTH = 60
const SPREAD = CATEGORY_WIDTH / 2 - DOT_RADIUS
const DOT_PITCH = DOT_RADIUS * 2.2

function layoutOf(
  orientation: 'horizontal' | 'vertical' = 'horizontal'
): BeeswarmLayout {
  return {
    plotLeft: 0,
    plotTop: 0,
    plotWidth: 500,
    plotHeight: 500,
    orientation,
    timeline: createAdaptiveTimeline(0, 1000, 6),
    items: [],
  }
}
function slotOf(values: number[] | null, center = CENTER): CategorySlotLayout {
  return {
    categoryCenter: center,
    categoryWidth: CATEGORY_WIDTH,
    data: { individualValues: values } as unknown as CategoryDistribution,
  }
}
/** Positions for one slot, normalised to its own density peak unless told otherwise. */
function place(values: number[] | null, reference?: number, orientation?: 'horizontal' | 'vertical') {
  const layout = layoutOf(orientation)
  const slot = slotOf(values)
  const density = computeSlotDensity(layout, values ?? [])
  return computeSwarmPositions(layout, slot, density, reference ?? density.peak)
}

describe('the swarm places every value', () => {
  it('returns nothing for empty or missing values', () => {
    expect(place([])).toEqual([])
    expect(place(null)).toEqual([])
  })

  it('puts a lone value on the centre line', () => {
    const points = place([500])
    expect(points).toHaveLength(1)
    expect(points[0].categoryPos).toBe(CENTER)
  })

  it('covers every distinct value pixel that the data occupies', () => {
    const layout = layoutOf()
    const values = [10, 10, 250, 250, 250, 800]
    const drawn = new Set(place(values).map(p => p.valuePos))
    for (const v of values) {
      expect(drawn.has(valueToPixel(layout, v, true))).toBe(true)
    }
  })

  it('reaches both extremes, so the mark spans the observed range', () => {
    const layout = layoutOf()
    const values = Array.from({ length: 400 }, (_, i) => 5 + (i % 97) * 9)
    const points = place(values)
    const positions = points.map(p => p.valuePos)
    const sorted = [...values].sort((a, b) => a - b)
    expect(Math.min(...positions)).toBe(valueToPixel(layout, sorted[0], true))
    expect(Math.max(...positions)).toBe(valueToPixel(layout, sorted[sorted.length - 1], true))
  })

  it('drops only points that would land on an already-used pixel', () => {
    // Twenty copies of one value: they share a value pixel, so the distinct
    // positions are bounded by the slots available across the category axis.
    const points = place(Array<number>(20).fill(500))
    const keys = new Set(points.map(p => `${p.valuePos},${Math.round(p.categoryPos)}`))
    expect(keys.size).toBe(points.length)
  })
})

describe('every point stays inside its own row', () => {
  it('never exceeds the band, however crowded the slot', () => {
    for (const count of [2, 5, 20, 200, 5000]) {
      const points = place(Array<number>(count).fill(500))
      for (const p of points) {
        expect(Math.abs(p.categoryPos - CENTER)).toBeLessThanOrEqual(SPREAD + 0.001)
      }
    }
  })

  it('returns nothing when the row is too thin to hold a dot', () => {
    const layout = layoutOf()
    const thin = { ...slotOf([500]), categoryWidth: DOT_RADIUS }
    const density = computeSlotDensity(layout, [500])
    expect(computeSwarmPositions(layout, thin, density, density.peak)).toEqual([])
  })
})

describe('spacing', () => {
  it('separates a sparse cell by a full dot-pitch', () => {
    // Three copies of one value, normalised to their own peak, so the density
    // width is the whole band and the dot-pitch is what binds.
    const points = place(Array<number>(3).fill(500))
    const offsets = points.map(p => p.categoryPos - CENTER).sort((a, b) => a - b)
    expect(offsets).toHaveLength(3)
    expect(offsets[1] - offsets[0]).toBeCloseTo(DOT_PITCH, 5)
    expect(offsets[2] - offsets[1]).toBeCloseTo(DOT_PITCH, 5)
  })

  it('centres a cell on the slot, so the swarm is symmetric', () => {
    for (const count of [2, 3, 4, 9]) {
      const offsets = place(Array<number>(count).fill(500)).map(
        p => p.categoryPos - CENTER
      )
      const sum = offsets.reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(0, 5)
    }
  })

  it('compresses below a dot-pitch once a cell cannot fit at full spacing', () => {
    const offsets = place(Array<number>(40).fill(500))
      .map(p => p.categoryPos - CENTER)
      .sort((a, b) => a - b)
    const gaps: number[] = []
    for (let i = 1; i < offsets.length; i++) gaps.push(offsets[i] - offsets[i - 1])
    expect(Math.min(...gaps)).toBeLessThan(DOT_PITCH)
  })
})

describe('width follows the local density', () => {
  it('gives a denser cell a wider extent than a sparser one', () => {
    const layout = layoutOf()
    // One heavy cluster and one light one, far enough apart to be separate cells.
    const values = [...Array<number>(60).fill(200), ...Array<number>(6).fill(800)]
    const density = computeSlotDensity(layout, values)
    const points = computeSwarmPositions(layout, slotOf(values), density, density.peak)
    const heavyPx = valueToPixel(layout, 200, true)
    const lightPx = valueToPixel(layout, 800, true)
    const extentAt = (px: number) =>
      Math.max(
        ...points
          .filter(p => Math.abs(p.valuePos - px) <= DOT_PITCH)
          .map(p => Math.abs(p.categoryPos - CENTER))
      )
    expect(extentAt(heavyPx)).toBeGreaterThan(extentAt(lightPx))
  })

  it('narrows every row but the densest when the reference is shared', () => {
    const layout = layoutOf()
    const dense = Array<number>(200).fill(500)
    const sparse = Array<number>(8).fill(500)
    const densities = [dense, sparse].map(v => computeSlotDensity(layout, v))
    const reference = figureDensityPeak(densities)
    const widthOf = (values: number[], i: number) =>
      Math.max(
        ...computeSwarmPositions(layout, slotOf(values), densities[i], reference).map(
          p => Math.abs(p.categoryPos - CENTER)
        )
      )
    expect(widthOf(dense, 0)).toBeGreaterThan(widthOf(sparse, 1))
  })
})

describe('the slot inside a cell is decorrelated from the value order', () => {
  it('does not lay a crowded cell out as a diagonal sweep', () => {
    // Values spread across one cell: assigning slots in value order would make
    // the category position a near-perfect linear function of the value position,
    // which renders as diagonal streaks with white between them.
    const layout = layoutOf()
    const base = valueToPixel(layout, 500, true)
    const values: number[] = []
    for (let i = 0; i < 60; i++) values.push(500 + i * 0.05)
    const density = computeSlotDensity(layout, values)
    const points = computeSwarmPositions(layout, slotOf(values), density, density.peak)
    const inCell = points.filter(p => Math.abs(p.valuePos - base) <= DOT_PITCH)
    expect(inCell.length).toBeGreaterThan(6)
    const xs = inCell.map(p => p.valuePos)
    const ys = inCell.map(p => p.categoryPos)
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
    const mx = mean(xs)
    const my = mean(ys)
    let num = 0
    let dx = 0
    let dy = 0
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - mx) * (ys[i] - my)
      dx += (xs[i] - mx) ** 2
      dy += (ys[i] - my) ** 2
    }
    const r = dx && dy ? num / Math.sqrt(dx * dy) : 0
    expect(Math.abs(r)).toBeLessThan(0.5)
  })
})

describe('determinism', () => {
  it('gives the same layout for the same values', () => {
    const values = [10, 20, 10, 30, 20, 10, 30, 20]
    expect(place(values)).toEqual(place(values))
  })

  it('does not depend on the order the values arrive in', () => {
    const sort = (a: { valuePos: number; categoryPos: number }[]) =>
      [...a].sort((x, y) => x.valuePos - y.valuePos || x.categoryPos - y.categoryPos)
    expect(sort(place([10, 10, 20, 20, 30]))).toEqual(
      sort(place([20, 10, 30, 10, 20]))
    )
  })
})

describe('orientation', () => {
  it('spreads across the category axis in both orientations', () => {
    for (const orientation of ['horizontal', 'vertical'] as const) {
      const points = place(Array<number>(5).fill(500), undefined, orientation)
      const offsets = points.map(p => p.categoryPos - CENTER)
      expect(Math.max(...offsets)).toBeGreaterThan(0)
      expect(Math.min(...offsets)).toBeLessThan(0)
    }
  })

  it('maps the value axis to the correct edge per orientation', () => {
    const low = 10
    expect(valueToPixel(layoutOf('horizontal'), low, true)).toBeLessThan(250)
    // Vertical runs bottom-up, so a low value sits near the BOTTOM of the plot.
    expect(valueToPixel(layoutOf('vertical'), low, true)).toBeGreaterThan(250)
  })
})
