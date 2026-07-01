import { describe, expect, test } from 'vitest'
import {
  calculateOverlayLayout,
  calculateOverlayMinRowPitch,
  SCARF_LAYOUT,
} from '$lib/plots/scarf'

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
