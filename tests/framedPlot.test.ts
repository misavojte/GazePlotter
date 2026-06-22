import { describe, it, expect } from 'vitest'
import {
  valueAxisTicks,
  categoryTicks,
} from '../src/lib/plots/shared/ticks'
import {
  resolveFrameLayout,
  type FrameGutters,
} from '../src/lib/plots/shared/usePlot.svelte'
import type { AdaptiveTimeline } from '../src/lib/plots/shared/timelineUtils'

// A minimal AdaptiveTimeline stub: two nice ticks at the ends, one non-nice.
const timeline = {
  minValue: 0,
  maxValue: 100,
  maxLabelWidth: 0,
  ticks: [
    { value: 0, position: 0, label: '0', isNice: true },
    { value: 50, position: 0.5, label: '50', isNice: false },
    { value: 100, position: 1, label: '100', isNice: true },
  ],
} as unknown as AdaptiveTimeline

describe('valueAxisTicks', () => {
  it('keeps only nice ticks with labels', () => {
    const t = valueAxisTicks(timeline)
    expect(t.positions).toEqual([0, 1])
    expect(t.labels).toEqual(['0', '100'])
  })

  it('inverts positions for a bottom-origin Y axis', () => {
    const t = valueAxisTicks(timeline, { invert: true })
    expect(t.positions).toEqual([1, 0])
    expect(t.labels).toEqual(['0', '100'])
  })

  it('drops labels for a mirrored tick-only edge', () => {
    const t = valueAxisTicks(timeline, { ticksOnly: true })
    expect(t.positions).toEqual([0, 1])
    expect(t.labels).toBeUndefined()
  })
})

describe('categoryTicks', () => {
  it('centres every category and labels them 1-based by default', () => {
    const t = categoryTicks(4)
    expect(t.positions).toEqual([0.125, 0.375, 0.625, 0.875])
    expect(t.labels).toEqual(['1', '2', '3', '4'])
  })

  it('honours step but always keeps first/last with edgesAlways', () => {
    // count 10, step 3 → 0-based shown where (i+1)%3===0: i=2,5,8; plus edges 0,9
    const t = categoryTicks(10, { step: 3, edgesAlways: true })
    expect(t.labels).toEqual(['1', '3', '6', '9', '10'])
  })

  it('inverts positions for a bottom-origin row axis', () => {
    const t = categoryTicks(2, { invert: true })
    // centred 0.25, 0.75 → inverted 0.75, 0.25
    expect(t.positions).toEqual([0.75, 0.25])
  })
})

describe('resolveFrameLayout', () => {
  const bounds = { left: 0, top: 0, right: 400, bottom: 300 }

  it('returns the full content rect when no gutters are declared', () => {
    const { rect } = resolveFrameLayout({}, bounds)
    expect(rect).toMatchObject({ x: 0, y: 0, width: 400, height: 300 })
    expect(rect.right).toBe(400)
    expect(rect.bottom).toBe(300)
    expect(rect.legendY).toBe(300)
  })

  it('adds explicit pad insets per edge', () => {
    const g: FrameGutters = { pad: { left: 50, right: 20, top: 10, bottom: 30 } }
    const { rect } = resolveFrameLayout(g, bounds)
    expect(rect).toMatchObject({ x: 50, y: 10, width: 330, height: 260 })
  })

  it('reserves a legend block at the bottom', () => {
    const { rect } = resolveFrameLayout({ legendHeight: 40 }, bounds)
    expect(rect.height).toBe(260)
    expect(rect.legendY).toBe(260)
  })

  it('centres a square data rect within the available area', () => {
    // wide bounds → square uses the smaller (height) and centres horizontally
    const { rect } = resolveFrameLayout({ square: true }, bounds)
    expect(rect.width).toBe(300)
    expect(rect.height).toBe(300)
    expect(rect.x).toBe(50) // (400 − 300) / 2
    expect(rect.y).toBe(0)
  })

  it('measures tick labels + title to size the bottom gutter', () => {
    const withAxis = resolveFrameLayout(
      { bottom: { tickLabels: ['0', '100'], title: 'Time [ms]' } },
      bounds
    )
    const bare = resolveFrameLayout({}, bounds)
    // an axis with labels + title must reserve real vertical space
    expect(withAxis.rect.height).toBeLessThan(bare.rect.height)
    expect(withAxis.bottomTitleOffset).toBeGreaterThan(0)
  })

  it('never produces negative dimensions when gutters exceed the bounds', () => {
    const { rect } = resolveFrameLayout({ pad: { left: 500 } }, bounds)
    expect(rect.width).toBe(0)
    expect(rect.height).toBeGreaterThanOrEqual(0)
  })
})
