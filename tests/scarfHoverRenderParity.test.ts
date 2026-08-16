import { describe, it, expect } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import { FIXATION_CATEGORY_ID } from '../src/lib/data/binary/schema'
import { getScarfData } from '../src/lib/plots/scarf/core/view'
import {
  compositeGazeBinaryAcc,
  type FusedWideRect,
} from '../src/lib/plots/scarf/core/renderer'
import { findGazeSegmentAt } from '../src/lib/plots/scarf/core/hitTest'
import { SCARF_LAYOUT } from '../src/lib/plots/scarf/const'
import type { ScarfPlotSettings } from '../src/lib/plots/scarf/types'

// Hover vs render parity for the KEEP IN SYNC trio (compositeGazeBinaryAcc,
// drawHighlightMarkersFromBinary, hitTest.findGazeSegmentAt): the same binary
// walk is implemented three times because sharing the loop measurably slowed
// the render. This pins the hover walk against the composite's output on a
// fixture covering every style-resolution branch, so a drift between the
// copies fails here instead of shipping as a hover/paint mismatch.

const SETTINGS: ScarfPlotSettings = {
  stimulusId: 1,
  groupId: -1,
  timeline: 'absolute',
  absoluteStimuliLimits: [],
  ordinalStimuliLimits: [],
  timelineStart: 0,
  timelineEnd: 0,
}

// One participant, every branch, all segments >=1px wide at pWidth 600 so the
// composite reports the FULL render through its `wide` capture (subPixel = 0).
function buildEngine() {
  const segs = [
    [0, 100, FIXATION_CATEGORY_ID, 1, 2, 3], // multi-AOI fixation (3 slices)
    [110, 210, 1], // saccade
    [220, 320, FIXATION_CATEGORY_ID], // no-AOI fixation
    [330, 430, FIXATION_CATEGORY_ID, 2], // 1-AOI fixation
    [440, 600, 2], // second non-fixation category
  ]
  const aoiData: (string[] | null)[] = [
    null,
    ['A1', 'A1', '#e41a1c'],
    ['A2', 'A2', '#377eb8'],
    ['A3', 'A3', '#4daf4a'],
  ]
  return {
    ...makeTestEngine([[], [segs]], {
      aoiData: [[], aoiData],
      aoiOrderVector: [[], [1, 2, 3]],
      categories: [
        ['Fixation', 'Fixation', '#000000'],
        ['Saccade', 'Saccade', '#cccccc'],
        ['Blink', 'Blink', '#999999'],
      ],
      aoiMapping: 'group',
    }),
    capabilities: { segmented: true, spatial: false, event: false },
    eventsPerStimulus: [],
  } as never
}

describe('scarf hover vs render parity', () => {
  it('hover finds exactly the rects the composite painted, with the topmost style', () => {
    const data = getScarfData(buildEngine(), SETTINGS)!
    const gs = data.gazeSource!
    expect(gs).toBeTruthy()

    const pWidth = 600
    const styleCount =
      data.stylingAndLegend.aoi.length + data.stylingAndLegend.category.length
    const wide: FusedWideRect[] = []
    const r = compositeGazeBinaryAcc(
      new Float32Array(pWidth * 4),
      new Float32Array(pWidth * 4),
      gs,
      new Float32Array(styleCount * 3),
      pWidth,
      1,
      1 / SCARF_LAYOUT.HEIGHT_BAR_DEFAULT,
      1,
      wide
    )
    expect(r.subPixelCount).toBe(0)
    expect(wide).toHaveLength(7) // 3 slices + no-AOI + 1-AOI + 2 non-fixations

    // Group painted rects by x: a multi-AOI fixation is ONE hover target.
    const groups = new Map<number, typeof wide>()
    for (const w of wide) {
      const g = groups.get(w.x0px) ?? []
      g.push(w)
      groups.set(w.x0px, g)
    }
    const ordered = [...groups.values()].sort((a, b) => a[0].x0px - b[0].x0px)
    expect(ordered).toHaveLength(5)

    // Painted -> hoverable: the center of each rect resolves to the same
    // geometry, the same per-participant segment, and the topmost painted style.
    ordered.forEach((g, orderId) => {
      const { x0px, wPx } = g[0]
      const hit = findGazeSegmentAt(gs, 0, (x0px + wPx / 2) / pWidth)
      expect(hit).not.toBeNull()
      expect(hit!.x * pWidth).toBeCloseTo(x0px, 3)
      expect(hit!.width * pWidth).toBeCloseTo(wPx, 3)
      expect(hit!.orderId).toBe(orderId)
      expect(hit!.styleIdx).toBe(g[g.length - 1].styleIdx) // topmost = last painted
    })

    // Not painted -> not hoverable: probe every inter-rect gap midpoint.
    for (let i = 0; i + 1 < ordered.length; i++) {
      const end = ordered[i][0].x0px + ordered[i][0].wPx
      const nextStart = ordered[i + 1][0].x0px
      expect(nextStart - end).toBeGreaterThan(1) // the fixture leaves real gaps
      expect(findGazeSegmentAt(gs, 0, (end + nextStart) / 2 / pWidth)).toBeNull()
    }

    // Out-of-row probes miss.
    expect(findGazeSegmentAt(gs, -1, 0.5)).toBeNull()
    expect(findGazeSegmentAt(gs, 1, 0.5)).toBeNull()
  })
})
