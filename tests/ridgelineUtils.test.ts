import { describe, it, expect, vi } from 'vitest'
import {
  calculateFilledRidgelineStripHeight,
  calculateIdealStripHeight,
  calculateMaxReferenceHeight,
  computeMTop,
} from '$lib/plots/aoi-stream/core/ridgeline'
import {
  RIDGELINE_CONTENT_FILL,
  RIDGELINE_MIN_M_TOP,
  RIDGELINE_SCALE,
} from '$lib/plots/aoi-stream/const'

// Mock dependencies
vi.mock('$lib/plots/shared', () => ({
  calculatePlotDimensionsWithHeader: () => ({ width: 800, height: 600 }),
}))

vi.mock('$lib/plots/shared/legendRendering', () => ({
  calculateFlatLegendHeight: () => 50,
  LEGEND_CONFIG: { fontSize: 12, fontFamily: 'Arial' },
}))

vi.mock('$lib/shared/textMeasure', () => ({
  estimateTextWidth: () => 10,
  SYSTEM_SANS_SERIF_STACK: 'Arial',
}))

// ─── Fixture builders ────────────────────────────────────────────────────────

/**
 * Build a minimal AoiStreamPlotResult-shaped fixture. `topPeak` becomes the
 * max value of the first series; `bottomPeak` of the last; `maxValue` is the
 * single-cell max the ridgeline math normalises against. Tests use these
 * fields directly rather than relying on coincidental fill-value × participants
 * arithmetic (the previous fixtures broke when participants changed).
 */
function buildData(opts: {
  seriesCount: number
  topPeak?: number
  bottomPeak?: number
  maxValue: number
}) {
  const { seriesCount, topPeak = 0, bottomPeak = 0, maxValue } = opts
  const series = Array.from({ length: seriesCount }, (_, i) => {
    const peak =
      i === 0 ? topPeak
        : i === seriesCount - 1 ? bottomPeak
          : 0
    return {
      values: new Float32Array(10).fill(peak),
      id: i + 1,
      label: `s${i + 1}`,
      color: 'red',
    }
  })
  return {
    series,
    binCount: 10,
    windowSize: 100,
    stepSize: 100,
    participants: 1,
    maxValue,
    timeline: { minValue: 0, maxValue: 100 },
    maxTime: 100,
    maxTotal: maxValue,
  } as any
}

// ─── Tests ───────────────────────────────────────────────────────────────────
// Expected values are HAND-DERIVED numbers (derivation in each comment), never
// a transcription of the production formula: a transcription moves in lockstep
// with the code and can only catch a one-sided edit.

describe('Ridgeline geometry invariants', () => {
  describe('calculateFilledRidgelineStripHeight', () => {
    it('a single series fills the whole plot at any scale', () => {
      // h * (1 - 1 + scale) / scale = plotHeight -> h = plotHeight
      expect(calculateFilledRidgelineStripHeight(100, 1, 2.5)).toBeCloseTo(100, 6)
    })

    it('scale 1 (no overlap) slices the plot into equal strips', () => {
      // 600 / 8
      expect(calculateFilledRidgelineStripHeight(600, 8, 1)).toBeCloseTo(75, 6)
    })

    it('overlap lets each strip exceed the equal-slice height', () => {
      // 100 * 2.5 / (2 - 1 + 2.5) = 250 / 3.5
      expect(calculateFilledRidgelineStripHeight(100, 2, 2.5)).toBeCloseTo(250 / 3.5, 6)
    })

    it('returns plotHeight when seriesCount <= 0 (degenerate fallback)', () => {
      expect(calculateFilledRidgelineStripHeight(100, 0, 2.5)).toBe(100)
    })
  })

  describe('computeMTop', () => {
    it('a full-height peak reserves exactly the content fill', () => {
      const data = buildData({ seriesCount: 1, topPeak: 1, maxValue: 1 })
      expect(computeMTop(data)).toBeCloseTo(RIDGELINE_CONTENT_FILL, 6)
    })

    it('a half-height peak reserves half the content fill', () => {
      // (0.5 / 1) * 0.9
      const data = buildData({ seriesCount: 1, topPeak: 0.5, maxValue: 1 })
      expect(computeMTop(data)).toBeCloseTo(0.45, 6)
    })

    it('doubling maxValue halves mTop when top peak is unchanged', () => {
      const before = computeMTop(buildData({ seriesCount: 1, topPeak: 1, maxValue: 1 }))
      const after = computeMTop(buildData({ seriesCount: 1, topPeak: 1, maxValue: 2 }))
      expect(after).toBeCloseTo(before / 2, 6)
    })

    it('halving the top peak halves mTop when maxValue is unchanged', () => {
      const before = computeMTop(buildData({ seriesCount: 1, topPeak: 1, maxValue: 1 }))
      const after = computeMTop(buildData({ seriesCount: 1, topPeak: 0.5, maxValue: 1 }))
      expect(after).toBeCloseTo(before / 2, 6)
    })

    it('returns 0 with zero peak and applyMinTopHeight=false', () => {
      expect(
        computeMTop(buildData({ seriesCount: 2, topPeak: 0, maxValue: 1 }))
      ).toBe(0)
    })

    it('returns RIDGELINE_MIN_M_TOP with zero peak and applyMinTopHeight=true', () => {
      const m = computeMTop(
        buildData({ seriesCount: 2, topPeak: 0, maxValue: 1 }),
        true
      )
      expect(m).toBe(RIDGELINE_MIN_M_TOP)
    })

    it('returns 0 / RIDGELINE_MIN_M_TOP when maxValue is non-positive (degenerate data)', () => {
      const data = buildData({ seriesCount: 1, topPeak: 1, maxValue: 0 })
      expect(computeMTop(data)).toBe(0)
      expect(computeMTop(data, true)).toBe(RIDGELINE_MIN_M_TOP)
    })
  })

  describe('calculateIdealStripHeight', () => {
    // Hand-derived from h = plotHeight * scale / (n - 1 + mTop * scale) with
    // scale = 2.5 and mTop = (topPeak / maxValue) * 0.9.
    it.each([
      // n=1, full peak: mTop 0.9 -> 250 / 2.25 (exceeds plotHeight: only the
      // top strip's own data bounds it)
      { n: 1, topPeak: 1, applyMin: false, expected: 250 / 2.25 },
      // n=2, zero peak, no floor: mTop 0 -> 250 / 1
      { n: 2, topPeak: 0, applyMin: false, expected: 250 },
      // n=2, zero peak, floored: mTop 0.2 -> 250 / 1.5
      { n: 2, topPeak: 0, applyMin: true, expected: 250 / 1.5 },
      // n=2, full peak: mTop 0.9 -> 250 / 3.25
      { n: 2, topPeak: 1, applyMin: false, expected: 250 / 3.25 },
    ])(
      'pins the ideal height [n=$n, topPeak=$topPeak, applyMin=$applyMin]',
      ({ n, topPeak, applyMin, expected }) => {
        const data = buildData({ seriesCount: n, topPeak, maxValue: 1 })
        const h = calculateIdealStripHeight(data, 100, applyMin, RIDGELINE_SCALE)
        expect(h).toBeCloseTo(expected, 4)
      }
    )

    it('returns plotHeight when no series (degenerate fallback)', () => {
      const empty = buildData({ seriesCount: 0, maxValue: 1 })
      expect(calculateIdealStripHeight(empty, 100)).toBe(100)
    })
  })

  describe('calculateMaxReferenceHeight', () => {
    it('with overlap allowed and scale > 1, fills the full plot height — peakFraction × CONTENT_FILL × ref = plotHeight', () => {
      // bottom-series peak fixed; vary maxValue to vary the peakFraction.
      const plotHeight = 100
      const scale = RIDGELINE_SCALE // > 1
      const data = buildData({
        seriesCount: 2,
        topPeak: 0,
        bottomPeak: 1,
        maxValue: 1, // peakFraction = 1.0
      })
      const ref = calculateMaxReferenceHeight(data, plotHeight, scale, true)
      const peakFraction = 1 / 1
      expect(ref * peakFraction * RIDGELINE_CONTENT_FILL).toBeCloseTo(plotHeight, 4)
    })

    it('halving the bottom peak doubles the reference height (less data → more empty space to absorb)', () => {
      const plotHeight = 100
      const scale = RIDGELINE_SCALE
      const tall = calculateMaxReferenceHeight(
        buildData({ seriesCount: 2, bottomPeak: 1, maxValue: 1 }),
        plotHeight,
        scale,
        true,
      )
      const taller = calculateMaxReferenceHeight(
        buildData({ seriesCount: 2, bottomPeak: 0.5, maxValue: 1 }),
        plotHeight,
        scale,
        true,
      )
      expect(taller).toBeCloseTo(tall * 2, 4)
    })

    it('with scale=1 (no cross-strip overlap), reference fills exactly the strip — ref × peakFraction × CONTENT_FILL = stripHeight', () => {
      const plotHeight = 100
      const scale = 1
      const n = 2
      const data = buildData({
        seriesCount: n,
        topPeak: 0,
        bottomPeak: 1,
        maxValue: 1,
      })
      const stripHeight = calculateFilledRidgelineStripHeight(plotHeight, n, scale)
      const ref = calculateMaxReferenceHeight(data, plotHeight, scale, true)
      const peakFraction = 1 / 1
      expect(ref * peakFraction * RIDGELINE_CONTENT_FILL).toBeCloseTo(stripHeight, 4)
    })

    it('falls back to filledStripHeight when bottom-series peak is zero (degenerate)', () => {
      const plotHeight = 100
      const scale = RIDGELINE_SCALE
      const n = 2
      const stripHeight = calculateFilledRidgelineStripHeight(plotHeight, n, scale)
      const data = buildData({
        seriesCount: n,
        topPeak: 1,
        bottomPeak: 0,
        maxValue: 1,
      })
      expect(calculateMaxReferenceHeight(data, plotHeight, scale, true)).toBe(stripHeight)
    })
  })

})

describe('AOI Timeline sync registries (push-based, replaces grid scanning)', () => {
  it('timeline: syncs the max across same-width participants only', async () => {
    const { AoiStreamTimelineSync } = await import(
      '$lib/plots/aoi-stream/core/sync.svelte'
    )
    const timelineSync = new AoiStreamTimelineSync()
    timelineSync.setEntry(1, { w: 6, dataMax: 100 })
    timelineSync.setEntry(2, { w: 6, dataMax: 250 })
    timelineSync.setEntry(3, { w: 8, dataMax: 900 })
    expect(timelineSync.getSyncedMax(6)).toBe(250)
    expect(timelineSync.getSyncedMax(8)).toBe(900)
    expect(timelineSync.getSyncedMax(12)).toBe(0)
    // Unregistering (opt-out / unmount) removes the contribution.
    timelineSync.clearEntry(2)
    expect(timelineSync.getSyncedMax(6)).toBe(100)
    timelineSync.clearEntry(1)
    timelineSync.clearEntry(3)
    // First dynamic import of the aoi-stream module graph — transform time
    // alone can exceed the default 5s budget on a cold cache.
  }, 20000)

  it('ridgeline: syncs mTop only across (h, scale, seriesCount) matches', async () => {
    const { AoiStreamRidgelineSync } = await import(
      '$lib/plots/aoi-stream/core/sync.svelte'
    )
    const ridgelineSync = new AoiStreamRidgelineSync()
    ridgelineSync.setEntry(1, { h: 10, scale: 0.6, seriesCount: 3, dataMax: 0.4 })
    ridgelineSync.setEntry(2, { h: 10, scale: 0.6, seriesCount: 3, dataMax: 0.7 })
    ridgelineSync.setEntry(3, { h: 10, scale: 0.6, seriesCount: 4, dataMax: 0.9 })
    ridgelineSync.setEntry(4, { h: 12, scale: 0.6, seriesCount: 3, dataMax: 0.95 })
    ridgelineSync.setEntry(5, { h: 10, scale: 1.2, seriesCount: 3, dataMax: 0.99 })

    // Same height + scale + series count → most constraining mTop.
    expect(ridgelineSync.getSyncedMTop(10, 0.6, 3)).toBeCloseTo(0.7, 6)
    // Scale matches within tolerance (1e-4), not exact equality.
    expect(ridgelineSync.getSyncedMTop(10, 0.60005, 3)).toBeCloseTo(0.7, 6)
    // Different series count / height / scale are separate sync groups.
    expect(ridgelineSync.getSyncedMTop(10, 0.6, 4)).toBeCloseTo(0.9, 6)
    expect(ridgelineSync.getSyncedMTop(12, 0.6, 3)).toBeCloseTo(0.95, 6)
    expect(ridgelineSync.getSyncedMTop(10, 1.2, 3)).toBeCloseTo(0.99, 6)
    // No match → 0; the container then keeps its local mTop (null override).
    expect(ridgelineSync.getSyncedMTop(20, 0.6, 3)).toBe(0)

    for (const id of [1, 2, 3, 4, 5]) ridgelineSync.clearEntry(id)
  })
})
