import { describe, expect, test } from 'vitest'
import {
  calculateLeftLabelWidth,
  calculateOverlayLayout,
  calculateOverlayMinRowPitch,
  scarfFrameGutters,
  SCARF_LAYOUT,
} from '$lib/plots/scarf'
import { resolveFrameLayout } from '$lib/plots/shared/usePlot.svelte'
import {
  axisTitleLineHeight,
  participantIndexAxisWidth,
  PLOT_LEGEND_GAP,
} from '$lib/plots/shared'

describe('calculateOverlayLayout (combined mode: AOI top-anchored, events hang below)', () => {
  test('event band hangs below the seam across a whitespace gap', () => {
    const l = calculateOverlayLayout(10, 2, 500)
    const seam = l.spaceAboveRect + l.heightOfBar
    // a hue-independent gap separates the gaze baseline from the band
    expect(l.eventBandTop).toBeGreaterThan(seam)
    expect(l.eventBandTop - seam).toBeGreaterThanOrEqual(2)
    expect(l.eventZoneHeight).toBeCloseTo(2 * l.eventLaneHeight)
  })

  test('always leaves at least MIN_ROW_GAP whitespace between rows', () => {
    for (const [count, C, h] of [
      [10, 2, 500],
      [50, 3, 950],
      [9, 1, 320],
      [30, 4, 4000], // generous height (scale up)
    ] as const) {
      const l = calculateOverlayLayout(count, C, h)
      const gap = l.heightOfBarWrap - l.eventBandTop - l.eventZoneHeight
      expect(gap).toBeGreaterThanOrEqual(SCARF_LAYOUT.MIN_ROW_GAP - 1e-6)
    }
  })

  test('keeps every concurrent lane separate even when cramped (never overlaps)', () => {
    const tight = calculateOverlayLayout(80, 3, 500) // very cramped
    // All 3 lanes survive as separate strips at >= the legibility floor; the
    // band is lanes x laneHeight (never collapsed into one occluding strip).
    expect(tight.eventLaneHeight).toBeGreaterThanOrEqual(
      SCARF_LAYOUT.MIN_EVENT_LANE_H
    )
    expect(tight.eventZoneHeight).toBeCloseTo(3 * tight.eventLaneHeight)
    // The gaze bar is never thinner than a single event lane, even when cramped.
    expect(tight.heightOfBar).toBeGreaterThanOrEqual(tight.eventLaneHeight - 1e-6)
  })

  test('zero concurrency → no band (degenerates to a plain bar row)', () => {
    const l = calculateOverlayLayout(10, 0, 400)
    expect(l.eventZoneHeight).toBe(0)
    expect(l.eventLaneHeight).toBe(0)
  })
})

/**
 * The scarf takes x/width from the harness frame but keeps its own vertical
 * placement, so it measures its row band by resolving its OWN declaration with
 * the left inset pinned at its cap. These pin that seam: the probe must never
 * hand back more height than the frame the figure actually draws in, or the rows
 * would overrun the axis they are centred above.
 */
describe('scarf row band vs the resolved frame', () => {
  const H = 400
  const W = 900
  const bounds = { left: 0, top: 0, right: W, bottom: H }

  const resolveWith = (leftLabelWidth: number, title: string, legendSpace: number) =>
    resolveFrameLayout(
      scarfFrameGutters({
        tickLabels: ['0', '2500', '5000'],
        axisTitle: title,
        leftLabelWidth,
        legendSpace,
      }),
      bounds
    )

  /** What the figure computes as `rowBandHeight`. */
  const rowBand = (title: string, legendSpace: number) =>
    resolveWith(SCARF_LAYOUT.LEFT_LABEL_MAX_WIDTH, title, legendSpace).rect.height

  const TITLES = {
    short: 'Elapsed time / ms',
    long: 'Elapsed time / % · [t = 1200 ms … 8400 ms]',
    none: '',
  }
  /** Every label column the scarf can ask for: compact, a measured name, the cap. */
  const LEFT_WIDTHS = [
    participantIndexAxisWidth(),
    calculateLeftLabelWidth(false, ['P1', 'P2']),
    SCARF_LAYOUT.LEFT_LABEL_MAX_WIDTH,
  ]

  for (const [name, title] of Object.entries(TITLES)) {
    for (const legendSpace of [0, PLOT_LEGEND_GAP + 64]) {
      test(`band fits every label column (${name} title, legend ${legendSpace})`, () => {
        const band = rowBand(title, legendSpace)
        for (const left of LEFT_WIDTHS) {
          const { rect } = resolveWith(left, title, legendSpace)
          expect(band).toBeLessThanOrEqual(rect.height)
          // The only way the real frame can be taller is the title wrapping to
          // fewer lines in a wider plot, which is bounded by one line.
          expect(rect.height - band).toBeLessThanOrEqual(axisTitleLineHeight())
        }
      })
    }
  }

  test('the plot columns are the frame rect (label column + right margin are pad)', () => {
    // A measured label column is fractional; the frame floors to whole pixels.
    const left = calculateLeftLabelWidth(false, ['P1', 'P2'])
    const { rect } = resolveWith(left, TITLES.short, 0)
    expect(rect.x).toBe(Math.floor(left))
    expect(rect.width).toBe(Math.floor(W - left - SCARF_LAYOUT.RIGHT_MARGIN))
  })

  test('legendY − bottom IS the axis carve, with or without a legend block', () => {
    const bare = resolveWith(90, TITLES.short, 0)
    const withLegend = resolveWith(90, TITLES.short, PLOT_LEGEND_GAP + 64)
    const axisCarve = bare.rect.legendY - bare.rect.bottom
    expect(axisCarve).toBeGreaterThan(0)
    // The scarf reads this gap to place its legend under the centred content, so
    // the legend block must not change it.
    expect(withLegend.rect.legendY - withLegend.rect.bottom).toBe(axisCarve)
  })
})

describe('calculateOverlayMinRowPitch', () => {
  test('floor = bar + seam gap + band + row gap', () => {
    expect(calculateOverlayMinRowPitch(0)).toBe(
      SCARF_LAYOUT.MIN_BAR_HEIGHT + SCARF_LAYOUT.MIN_ROW_GAP
    )
    // With events, the gaze-bar floor is one event lane (never thinner than a
    // single event strip), so the bar term is MIN_EVENT_LANE_H, not MIN_BAR_HEIGHT.
    expect(calculateOverlayMinRowPitch(3)).toBe(
      SCARF_LAYOUT.MIN_EVENT_LANE_H +
        2 +
        3 * SCARF_LAYOUT.MIN_EVENT_LANE_H +
        SCARF_LAYOUT.MIN_ROW_GAP
    )
  })

  test('a real layout never packs rows tighter than the min pitch', () => {
    const C = 3
    const l = calculateOverlayLayout(50, C, 950)
    expect(l.heightOfBarWrap).toBeGreaterThanOrEqual(calculateOverlayMinRowPitch(C))
  })
})
