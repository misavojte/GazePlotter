import { describe, it, expect, vi } from 'vitest'
import {
  calculateFilledRidgelineStripHeight,
  calculateIdealStripHeight,
  calculateMaxReferenceHeight,
  computeMTop,
} from '$lib/plots/aoi-stream/core/ridgeline'
import { scanForDynamicRidgelineReferenceHeight } from '$lib/plots/aoi-stream/sync/ridgeline'
import {
  RIDGELINE_CONTENT_FILL,
  RIDGELINE_MIN_M_TOP,
  RIDGELINE_SCALE,
} from '$lib/plots/aoi-stream/const'
import type {
  AoiStreamPlotItem,
  AoiStreamPlotSettings,
} from '$lib/plots/aoi-stream/types'

// Mock dependencies
vi.mock('$lib/plots/shared', () => ({
  calculatePlotDimensionsWithHeader: () => ({ width: 800, height: 600 }),
  PLOT_HEADER_HEIGHT: 138,
}))

vi.mock('$lib/plots/shared/legendRendering', () => ({
  calculateFlatLegendHeight: () => 50,
  STREAM_LEGEND_CONFIG: { fontSize: 12, fontFamily: 'Arial' },
}))

vi.mock('$lib/shared/utils/textUtils', () => ({
  estimateTextWidth: () => 10,
  SYSTEM_SANS_SERIF_STACK: 'Arial',
}))

vi.mock('$lib/data/engine', () => ({
  getParticipants: () => [{ id: 1 }],
  getParticipantEndTime: () => 100,
}))

vi.mock('$lib/plots/aoi-stream/core/transformer', () => ({
  getAoiStreamPlotData: () => ({
    series: [
      {
        values: new Float32Array(10).fill(1),
        id: 1,
        label: 'AOI 1',
        color: 'red',
      },
    ],
    binCount: 10,
    windowSize: 100,
    stepSize: 100,
    participants: 1,
    maxValue: 1,
    timeline: { minValue: 0, maxValue: 100 },
    maxTime: 100,
    maxTotal: 1,
  }),
}))

vi.mock('$lib/plots/aoi-stream/sync/timeline', () => ({
  scanForSynchronizedTimelineMax: () => null,
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

// Closed-form expected values derived from the geometry formulas in
// `ridgeline.ts`. Tests assert against these so the suite documents the
// invariants rather than locking in coincidental numbers.
const expectedFilledStripHeight = (plotHeight: number, n: number, scale: number) =>
  (plotHeight * scale) / (n - 1 + scale)

const expectedIdealStripHeight = (plotHeight: number, n: number, scale: number, mTop: number) =>
  (plotHeight * scale) / (n - 1 + mTop * scale)

const expectedMTop = (topPeak: number, maxValue: number) =>
  (topPeak / maxValue) * RIDGELINE_CONTENT_FILL

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Ridgeline geometry invariants', () => {
  describe('calculateFilledRidgelineStripHeight', () => {
    it.each([
      { plotHeight: 100, n: 1, scale: 2.5 },
      { plotHeight: 100, n: 2, scale: 2.5 },
      { plotHeight: 100, n: 5, scale: 2.5 },
      { plotHeight: 600, n: 8, scale: 1 },
      { plotHeight: 240, n: 3, scale: 1.5 },
    ])(
      'matches closed-form: $plotHeight × $scale / ($n − 1 + $scale) [n=$n, plotHeight=$plotHeight, scale=$scale]',
      ({ plotHeight, n, scale }) => {
        const h = calculateFilledRidgelineStripHeight(plotHeight, n, scale)
        expect(h).toBeCloseTo(expectedFilledStripHeight(plotHeight, n, scale), 6)
      }
    )

    it('returns plotHeight when seriesCount <= 0 (degenerate fallback)', () => {
      expect(calculateFilledRidgelineStripHeight(100, 0, 2.5)).toBe(100)
    })
  })

  describe('computeMTop', () => {
    it('mTop scales as peak / maxValue × CONTENT_FILL', () => {
      const data = buildData({ seriesCount: 1, topPeak: 1, maxValue: 1 })
      expect(computeMTop(data)).toBeCloseTo(expectedMTop(1, 1), 6)
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
    it.each([
      // (n, plotHeight, scale, topPeak, maxValue, applyMinTopHeight)
      { n: 1, plotHeight: 100, scale: RIDGELINE_SCALE, topPeak: 1, maxValue: 1, applyMin: false },
      { n: 2, plotHeight: 100, scale: RIDGELINE_SCALE, topPeak: 0, maxValue: 1, applyMin: false },
      { n: 2, plotHeight: 100, scale: RIDGELINE_SCALE, topPeak: 0, maxValue: 1, applyMin: true },
      { n: 2, plotHeight: 100, scale: RIDGELINE_SCALE, topPeak: 1, maxValue: 1, applyMin: false },
      { n: 5, plotHeight: 600, scale: RIDGELINE_SCALE, topPeak: 0.4, maxValue: 1, applyMin: false },
    ])(
      'matches geometric identity h × ((N−1)/scale + mTop) = plotHeight  [n=$n, plotHeight=$plotHeight, scale=$scale, topPeak=$topPeak, maxValue=$maxValue, applyMin=$applyMin]',
      ({ n, plotHeight, scale, topPeak, maxValue, applyMin }) => {
        const data = buildData({ seriesCount: n, topPeak, maxValue })
        const h = calculateIdealStripHeight(data, plotHeight, applyMin, scale)
        const mTopRaw = expectedMTop(topPeak, maxValue)
        const mTop = applyMin ? Math.max(mTopRaw, RIDGELINE_MIN_M_TOP) : mTopRaw
        expect(h).toBeCloseTo(expectedIdealStripHeight(plotHeight, n, scale, mTop), 4)
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

  describe('scanForDynamicRidgelineReferenceHeight', () => {
    it('returns a finite mTop in (0, 1] for two matching ridgeline plots', () => {
      const engine = { metadata: {} } as any

      const createItem = (
        id: number,
        settings: Partial<AoiStreamPlotSettings>
      ): AoiStreamPlotItem => ({
        id,
        x: 0,
        y: 0,
        w: 12,
        h: 10,
        min: { w: 11, h: 10 },
        redrawTimestamp: 0,
        type: 'aoiStreamPlot',
        settings: {
          stimulusId: 0,
          groupId: -1,
          metricInstanceIds: ['absoluteTime-aoi-windowed-500'],
          absoluteStimuliLimits: [],
          ...settings,
        },
      })

      const items: AoiStreamPlotItem[] = [
        createItem(1, { alignment: 'ridgeline', ridgelineScale: 0.6 }),
        createItem(2, { alignment: 'ridgeline', ridgelineScale: 0.6 }),
      ]

      const currentStreamData = buildData({
        seriesCount: 1,
        topPeak: 1,
        maxValue: 1,
      })

      const result = scanForDynamicRidgelineReferenceHeight(
        engine,
        items,
        10,
        1,
        {
          plotId: 1,
          widthUnits: 12,
          heightUnits: 10,
          settings: items[0].settings,
          streamData: currentStreamData,
        }
      )

      // Both candidates render the same fixture → mTop = peakFraction × CONTENT_FILL.
      expect(result).not.toBeNull()
      expect(result!).toBeGreaterThan(0)
      expect(result!).toBeLessThanOrEqual(1)
      expect(result!).toBeCloseTo(expectedMTop(1, 1), 6)
    })
  })
})
