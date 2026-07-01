import { describe, it, expect } from 'vitest'
import {
  drawScarfHighlightMarkers,
  drawScarfBands,
  type ScarfLayoutContext,
} from '../src/lib/plots/scarf/core/renderer'
import { RECT_STRIDE, SCARF_LAYOUT } from '../src/lib/plots/scarf/const'

const T = SCARF_LAYOUT.HIGHLIGHT_VISIBLE_COVERAGE

// `drawScarfHighlightMarkers` rings highlighted gaze segments that the (never
// altered) blend renders too faintly to see. Visibility is judged against the
// blend itself: a pixel counts as legible only once the highlighted
// identifier's accumulated column alpha (Σ coverage × bar-height share) clears
// HIGHLIGHT_VISIBLE_COVERAGE. These tests pin that rule — including the case the
// old width-based test got wrong, where many thin segments look "wide enough
// together" yet stay diluted below the floor and so still need a ring.

interface RecordedArc {
  cx: number
  cy: number
  r: number
}

/** Minimal 2D-context stand-in that records the circle centres/radii passed to
 *  `arc()` — enough to observe where rings land without a real canvas. */
function mockCtx(): {
  ctx: CanvasRenderingContext2D
  arcs: RecordedArc[]
  rects: { x: number; y: number; w: number; h: number }[]
} {
  const arcs: RecordedArc[] = []
  const rects: { x: number; y: number; w: number; h: number }[] = []
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    stroke() {},
    clip() {},
    lineTo() {},
    closePath() {},
    rect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h })
    },
    arc(cx: number, cy: number, r: number) {
      arcs.push({ cx, cy, r })
    },
    strokeStyle: '',
    lineWidth: 0,
  } as unknown as CanvasRenderingContext2D
  return { ctx, arcs, rects }
}

/** Distinct ring centres — each ring emits two arcs (white halo + colour). */
function ringCentres(arcs: RecordedArc[]): RecordedArc[] {
  const seen = new Map<string, RecordedArc>()
  for (const a of arcs) seen.set(`${a.cx},${a.cy},${a.r}`, a)
  return [...seen.values()]
}

/** A gaze rect bucket of fixations (full bar height) on row 0, from [xNorm, wNorm]. */
function rectBucket(segs: { x: number; w: number }[]): Float32Array {
  const buf = new Float32Array(segs.length * RECT_STRIDE)
  for (let i = 0; i < segs.length; i++) {
    const idx = i * RECT_STRIDE
    buf[idx] = segs[i].x // xNorm
    buf[idx + 1] = 0 // participant row
    buf[idx + 2] = segs[i].w // wNorm
    buf[idx + 3] = SCARF_LAYOUT.HEIGHT_BAR_DEFAULT // fixation height
    buf[idx + 5] = SCARF_LAYOUT.SPACE_ABOVE_RECT_DEFAULT // internalY
  }
  return buf
}

const SPACE_ABOVE = 5
const BAR_H = 15
const PLOT_W = 1000
const layout = {
  spaceAboveRect: SPACE_ABOVE,
  heightOfBar: BAR_H,
  nonFixationHeight: 4,
  scaleFactor: 1,
  heightOfBarWrap: 32,
  effectiveMarginTop: 0,
  leftLabelWidth: 0,
  marginLeft: 0,
  plotAreaWidth: PLOT_W,
  isOverlay: false,
} as unknown as ScarfLayoutContext

function run(buckets: Float32Array[], fill = '#ff0000'): RecordedArc[] {
  const { ctx, arcs } = mockCtx()
  drawScarfHighlightMarkers(
    ctx,
    { visualRectBuckets: buckets, participants: [{ label: 'p' }] } as never,
    layout,
    {
      rectStyleArray: [{ normal: { fill } }] as never,
      highlightMask: new Uint8Array([1]),
    }
  )
  return arcs
}

/** A pixel's coverage = wNorm * PLOT_W (full-height fixation -> hFrac 1). */
const pxWidth = (coverage: number) => coverage / PLOT_W

describe('drawScarfHighlightMarkers', () => {
  it('centres the ring on the gaze bar, not the row middle', () => {
    const rings = ringCentres(run([rectBucket([{ x: 0.1, w: pxWidth(0.3) }])]))
    expect(rings.length).toBe(1)
    const gazeBandCentre = SPACE_ABOVE + BAR_H / 2 // 12.5
    const rowMiddle = layout.heightOfBarWrap / 2 // 16
    expect(rings[0].cy).toBeCloseTo(gazeBandCentre, 5)
    expect(rings[0].cy).not.toBeCloseTo(rowMiddle, 1)
  })

  it('rings a faint sub-pixel fixation', () => {
    // One small fixation well under the floor -> invisible -> ring.
    const rings = ringCentres(run([rectBucket([{ x: 0.5, w: pxWidth(T - 0.3) }])]))
    expect(rings.length).toBe(1)
    expect(rings[0].cx).toBeGreaterThan(499)
    expect(rings[0].cx).toBeLessThan(502)
  })

  it('does NOT ring a visually dominant fixation but rings a smaller one', () => {
    // A 15px-wide fixation (>= 8px threshold) -> dominant -> no ring.
    const dominantRings = ringCentres(run([rectBucket([{ x: 0.5, w: pxWidth(15) }])]))
    expect(dominantRings.length).toBe(0)

    // A 2px-wide fixation (< 8px threshold) -> relatively rare -> ring.
    const rareRings = ringCentres(run([rectBucket([{ x: 0.5, w: pxWidth(2) }])]))
    expect(rareRings.length).toBe(1)
  })

  it('rings thin segments that pile up but stay below the dominance threshold', () => {
    // Several thin fixations summing to 3px (threshold for each is 8 - 0.75 = 7.25px) -> rare -> ring.
    const each = 3 / 4
    const segs = Array.from({ length: 4 }, () => ({ x: 0.2, w: pxWidth(each) }))
    const rings = ringCentres(run([rectBucket(segs)]))
    expect(rings.length).toBe(1)
    expect(rings[0].cx).toBeGreaterThan(199)
    expect(rings[0].cx).toBeLessThan(202)
  })

  it('does NOT ring thin segments that together cross the dominance threshold', () => {
    // Enough thin fixations to sum to 12px (>= 8px threshold) -> dominant -> no ring.
    const each = 12 / 8
    const segs = Array.from({ length: 8 }, () => ({ x: 0.2, w: pxWidth(each) }))
    const rings = ringCentres(run([rectBucket(segs)]))
    expect(rings.length).toBe(0)
  })

  it('rings sparse occurrences separately but collapses a faint burst to one', () => {
    // Two faint fixations far apart (> one ring diameter) -> two rings.
    const far = ringCentres(
      run([rectBucket([{ x: 0.2, w: pxWidth(T - 0.3) }, { x: 0.8, w: pxWidth(T - 0.3) }])])
    )
    expect(far.length).toBe(2)
  })

  it('keeps the ring verdict stable as a faint fixation straddles pixel boundaries', () => {
    // A clearly-faint fixation must ring at EVERY sub-pixel offset — never flicker.
    const counts = new Set<number>()
    for (let f = 0; f < 10; f++) {
      const x = (300 + f / 10) / PLOT_W
      counts.add(ringCentres(run([rectBucket([{ x, w: pxWidth(T - 0.3) }])])).length)
    }
    expect([...counts]).toEqual([1])
  })

  it('keeps the ring verdict stable for a borderline fixation (no pan flicker)', () => {
    // Under the new 30px local window check, a borderline/thin segment remains rare (1 ring)
    // at all offsets — never flickering between 0 and 1 rings.
    const counts = new Set<number>()
    for (let f = 0; f < 10; f++) {
      const x = (300 + f / 10) / PLOT_W
      counts.add(ringCentres(run([rectBucket([{ x, w: pxWidth(T + 0.1) }])])).length)
    }
    expect([...counts]).toEqual([1])
  })

  it('draws a capsule instead of overlapping circles for colliding segments', () => {
    // Two faint segments close to each other -> one capsule.
    // The capsule starts at the first segment's centre and ends at the second segment's centre.
    const { ctx, arcs } = mockCtx()
    drawScarfHighlightMarkers(
      ctx,
      {
        visualRectBuckets: [
          rectBucket([
            { x: 0.2, w: pxWidth(T - 0.3) },
            { x: 0.2 + pxWidth(1), w: pxWidth(T - 0.3) },
          ]),
        ],
        participants: [{ label: 'p' }],
      } as never,
      layout,
      {
        rectStyleArray: [{ normal: { fill: '#ff0000' } }] as never,
        highlightMask: new Uint8Array([1]),
      }
    )

    const rings = ringCentres(arcs)
    // We expect two unique arc centers: one for the start of the capsule, one for the end of the capsule.
    expect(rings.length).toBe(2)
  })

  it('does NOT ring a faint segment if it touches the viewport boundary (clipped at edge)', () => {
    // A faint segment (0.2px) at x=0 (the left boundary of the viewport).
    // It should not get a ring because it touches the boundary.
    const rings = ringCentres(
      run([rectBucket([{ x: 0, w: pxWidth(T - 0.3) }])])
    )
    expect(rings.length).toBe(0)
  })

  it('does NOT ring a faint segment adjacent to a visible segment of the same category', () => {
    // A visible segment of 20px at x = 100px (range [100, 120])
    // A faint segment of 0.2px at x = 125px (so it is within 15px of the visible segment)
    // The faint segment should NOT get a ring because the visible segment is nearby/adjacent.
    const rings = ringCentres(
      run([rectBucket([{ x: 100 / PLOT_W, w: pxWidth(20) }, { x: 125 / PLOT_W, w: pxWidth(T - 0.3) }])])
    )
    expect(rings.length).toBe(0)
  })

  it('DOES ring an isolated faint segment (rare glance) even when a visible segment exists elsewhere in the row', () => {
    // A visible segment of 20px at x = 100px (range [100, 120])
    // A faint segment of 0.2px at x = 300px (well outside the 15px window of the visible segment)
    // The faint segment SHOULD get a ring because it is isolated.
    const rings = ringCentres(
      run([rectBucket([{ x: 100 / PLOT_W, w: pxWidth(20) }, { x: 300 / PLOT_W, w: pxWidth(T - 0.3) }])])
    )
    expect(rings.length).toBe(1)
  })

  it('does NOT ring a faint segment if a clearly visible segment (>= 4px) of the same category is nearby', () => {
    // A visible segment of 5px at x = 100px (range [100, 105])
    // A faint segment of 0.2px at x = 110px (so it is within the 15px window)
    // The faint segment should NOT get a ring because the 5px segment is clearly visible (>= 4px)
    const rings = ringCentres(
      run([rectBucket([{ x: 100 / PLOT_W, w: pxWidth(5) }, { x: 110 / PLOT_W, w: pxWidth(T - 0.3) }])])
    )
    expect(rings.length).toBe(0)
  })
})

// --- Vertical band snapping (paintGazeRects) -----------------------------------
// The composite/gaze band must land on whole logical pixels so it can't bleed
// ~0.5px past the bar into the seam via anti-aliasing.

function bandMock(): { ctx: CanvasRenderingContext2D; rects: { y: number; h: number }[] } {
  const rects: { y: number; h: number }[] = []
  const ctx = {
    fillStyle: '',
    fillRect(_x: number, y: number, _w: number, h: number) {
      rects.push({ y, h })
    },
  } as unknown as CanvasRenderingContext2D
  return { ctx, rects }
}

function fracLayout(deviceScale: number): ScarfLayoutContext {
  return {
    spaceAboveRect: 5,
    heightOfBar: 15.6,
    nonFixationHeight: 4,
    scaleFactor: 1,
    heightOfBarWrap: 30.6,
    effectiveMarginTop: 0,
    leftLabelWidth: 0,
    marginLeft: 0,
    plotAreaWidth: PLOT_W,
    isOverlay: false,
    eventLaneHeight: 0,
    deviceScale,
  } as unknown as ScarfLayoutContext
}

/** Two rows, one WIDE (>=1px) fixation each -> the exact pass (pass 3), which
 *  draws straight to the passed ctx and so is observable without a real canvas
 *  (the composite blit no-ops in node). Returns the emitted rects. */
function exactRects(layout: ScarfLayoutContext): { y: number; h: number }[] {
  const bucket = new Float32Array(2 * RECT_STRIDE)
  for (let r = 0; r < 2; r++) {
    const idx = r * RECT_STRIDE
    bucket[idx] = 0.5
    bucket[idx + 1] = r
    bucket[idx + 2] = pxWidth(3) // wide -> drawn exactly in pass 3
    bucket[idx + 3] = SCARF_LAYOUT.HEIGHT_BAR_DEFAULT
    bucket[idx + 5] = SCARF_LAYOUT.SPACE_ABOVE_RECT_DEFAULT
  }
  const { ctx, rects } = bandMock()
  drawScarfBands(
    ctx,
    { visualRectBuckets: [bucket], visualEventBuckets: [], participants: [{}, {}] } as never,
    layout,
    [{ normal: { fill: '#ff0000' } }] as never,
    [] as never,
    null
  )
  return rects
}

describe('paintGazeRects vertical snapping', () => {
  it('emits gaze rects on integer y/height at dpr 1 (no sub-pixel bleed)', () => {
    const rects = exactRects(fracLayout(1))
    expect(rects.length).toBeGreaterThan(0)
    for (const rect of rects) {
      expect(Number.isInteger(rect.y)).toBe(true)
      expect(Number.isInteger(rect.h)).toBe(true)
    }
  })

  it('lands gaze-rect edges on whole DEVICE pixels at fractional dpr', () => {
    const dpr = 1.5 // Windows 150% scaling
    const rects = exactRects(fracLayout(dpr))
    expect(rects.length).toBeGreaterThan(0)
    for (const rect of rects) {
      // both edges sit on device-pixel boundaries -> no anti-aliased bleed
      expect(Math.abs(rect.y * dpr - Math.round(rect.y * dpr))).toBeLessThan(1e-9)
      expect(Math.abs((rect.y + rect.h) * dpr - Math.round((rect.y + rect.h) * dpr))).toBeLessThan(
        1e-9
      )
    }
  })
})
