import { describe, it, expect } from 'vitest'
import {
  drawScarfHighlightMarkers,
  drawScarfBands,
  type ScarfLayoutContext,
} from '../src/lib/plots/scarf/core/renderer'
import { SCARF_LAYOUT } from '../src/lib/plots/scarf/const'
import { SEGMENT_STRIDE, SegmentField, FIXATION_CATEGORY_ID } from '../src/lib/data/binary/schema'
import type { ScarfGazeSource } from '../src/lib/plots/scarf/types'

const T = SCARF_LAYOUT.HIGHLIGHT_VISIBLE_COVERAGE

// `drawScarfHighlightMarkers` rings highlighted gaze segments that the (never
// altered) blend renders too faintly to see. Visibility is judged against the
// blend itself: a pixel counts as legible only once the highlighted identifier's
// accumulated column alpha (Σ coverage × bar-height share) clears
// HIGHLIGHT_VISIBLE_COVERAGE. These tests pin that rule via the single-pass gaze
// path (composited straight from the binary segment store).

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

const PLOT_W = 1000

/**
 * A fake `gazeSource` over crafted segments (per participant row), full-bar
 * fixations of the single highlighted AOI (styleIdx 0). Identity projection
 * (clipMin 0, scale 1) so a segment's raw [x, x+w] maps straight to the
 * normalized [0,1] x-axis — i.e. `w` here is a fraction of the plot width, and the
 * old `pxWidth(coverage)` helper still yields a segment of `coverage` pixels.
 */
function gazeSource(perP: { x: number; w: number }[][]): ScarfGazeSource {
  const flat = perP.flat()
  const buf = new Float32Array(flat.length * SEGMENT_STRIDE)
  const ranges: { startIndex: number; endIndex: number }[] = []
  let cursor = 0
  for (const segs of perP) {
    const start = cursor
    for (const s of segs) {
      const b = cursor * SEGMENT_STRIDE
      buf[b + SegmentField.START_TIME] = s.x
      buf[b + SegmentField.END_TIME] = s.x + s.w
      buf[b + SegmentField.CATEGORY_ID] = FIXATION_CATEGORY_ID
      buf[b + SegmentField.AOI_COUNT] = 1
      buf[b + SegmentField.AOI_POINTER] = cursor
      buf[b + SegmentField.SEGMENT_ID] = cursor - start
      cursor++
    }
    ranges.push({ startIndex: start, endIndex: cursor })
  }
  const n = perP.length
  const aoiOrderMap = new Int16Array(4).fill(-1)
  aoiOrderMap[1] = 0 // raw AOI id 1 → styleIdx 0 (the highlighted style)
  return {
    reader: {
      segmentBufferRaw: buf,
      getSegmentRange: (_s: number, pid: number) => ranges[pid],
    },
    aoiGroupReader: {
      getSegmentAoisUniqueDirect: (_i: number, _s: number, out: Uint16Array | Uint32Array) => {
        out[0] = 1
        return 1
      },
    },
    participantIds: perP.map((_, i) => i),
    stimulusId: 1,
    isOrdinal: false,
    projClipMin: new Float32Array(n), // all 0
    projClipMax: new Float32Array(n).fill(1),
    projScale: new Float32Array(n).fill(1),
    aoiOrderMap,
    categoryStyleIdxMap: new Int16Array(2).fill(-1),
    noAoiStyleIdx: 99,
    hideNonFixations: false,
    hiddenCategoryIds: new Set<number>(),
  }
}

const SPACE_ABOVE = 5
const BAR_H = 15
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

/** Run the highlight markers over ONE row of crafted segments; return the arcs. */
function run(segs: { x: number; w: number }[], fill = '#ff0000'): RecordedArc[] {
  const { ctx, arcs } = mockCtx()
  drawScarfHighlightMarkers(
    ctx,
    { gazeSource: gazeSource([segs]), participants: [{ label: 'p' }] } as never,
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
    const rings = ringCentres(run([{ x: 0.1, w: pxWidth(0.3) }]))
    expect(rings.length).toBe(1)
    const gazeBandCentre = SPACE_ABOVE + BAR_H / 2 // 12.5
    const rowMiddle = layout.heightOfBarWrap / 2 // 16
    expect(rings[0].cy).toBeCloseTo(gazeBandCentre, 5)
    expect(rings[0].cy).not.toBeCloseTo(rowMiddle, 1)
  })

  it('rings a faint sub-pixel fixation', () => {
    const rings = ringCentres(run([{ x: 0.5, w: pxWidth(T - 0.3) }]))
    expect(rings.length).toBe(1)
    expect(rings[0].cx).toBeGreaterThan(499)
    expect(rings[0].cx).toBeLessThan(502)
  })

  it('does NOT ring a visually dominant fixation but rings a smaller one', () => {
    // A 15px-wide fixation (>= 8px threshold) -> dominant -> no ring.
    const dominantRings = ringCentres(run([{ x: 0.5, w: pxWidth(15) }]))
    expect(dominantRings.length).toBe(0)
    // A 2px-wide fixation (< 8px threshold) -> relatively rare -> ring.
    const rareRings = ringCentres(run([{ x: 0.5, w: pxWidth(2) }]))
    expect(rareRings.length).toBe(1)
  })

  it('rings thin segments that pile up but stay below the dominance threshold', () => {
    // Several thin fixations summing to 3px (threshold each is 8 - 0.75 = 7.25px) -> rare -> ring.
    const each = 3 / 4
    const segs = Array.from({ length: 4 }, () => ({ x: 0.2, w: pxWidth(each) }))
    const rings = ringCentres(run(segs))
    expect(rings.length).toBe(1)
    expect(rings[0].cx).toBeGreaterThan(199)
    expect(rings[0].cx).toBeLessThan(202)
  })

  it('does NOT ring thin segments that together cross the dominance threshold', () => {
    // Enough thin fixations to sum to 12px (>= 8px threshold) -> dominant -> no ring.
    const each = 12 / 8
    const segs = Array.from({ length: 8 }, () => ({ x: 0.2, w: pxWidth(each) }))
    const rings = ringCentres(run(segs))
    expect(rings.length).toBe(0)
  })

  it('rings sparse occurrences separately but collapses a faint burst to one', () => {
    const far = ringCentres(
      run([{ x: 0.2, w: pxWidth(T - 0.3) }, { x: 0.8, w: pxWidth(T - 0.3) }])
    )
    expect(far.length).toBe(2)
  })

  it('keeps the ring verdict stable as a faint fixation straddles pixel boundaries', () => {
    const counts = new Set<number>()
    for (let f = 0; f < 10; f++) {
      const x = (300 + f / 10) / PLOT_W
      counts.add(ringCentres(run([{ x, w: pxWidth(T - 0.3) }])).length)
    }
    expect([...counts]).toEqual([1])
  })

  it('keeps the ring verdict stable for a borderline fixation (no pan flicker)', () => {
    const counts = new Set<number>()
    for (let f = 0; f < 10; f++) {
      const x = (300 + f / 10) / PLOT_W
      counts.add(ringCentres(run([{ x, w: pxWidth(T + 0.1) }])).length)
    }
    expect([...counts]).toEqual([1])
  })

  it('draws a capsule instead of overlapping circles for colliding segments', () => {
    const arcs = run([
      { x: 0.2, w: pxWidth(T - 0.3) },
      { x: 0.2 + pxWidth(1), w: pxWidth(T - 0.3) },
    ])
    // Two unique arc centres: capsule start + capsule end.
    expect(ringCentres(arcs).length).toBe(2)
  })

  it('does NOT ring a faint segment if it touches the viewport boundary (clipped at edge)', () => {
    const rings = ringCentres(run([{ x: 0, w: pxWidth(T - 0.3) }]))
    expect(rings.length).toBe(0)
  })

  it('does NOT ring a faint segment adjacent to a visible segment of the same category', () => {
    // Visible 20px at 100px; faint 0.2px at 125px (within the 15px window) -> suppressed.
    const rings = ringCentres(
      run([{ x: 100 / PLOT_W, w: pxWidth(20) }, { x: 125 / PLOT_W, w: pxWidth(T - 0.3) }])
    )
    expect(rings.length).toBe(0)
  })

  it('DOES ring an isolated faint segment even when a visible segment exists elsewhere in the row', () => {
    // Visible 20px at 100px; faint 0.2px at 300px (outside the window) -> isolated -> ring.
    const rings = ringCentres(
      run([{ x: 100 / PLOT_W, w: pxWidth(20) }, { x: 300 / PLOT_W, w: pxWidth(T - 0.3) }])
    )
    expect(rings.length).toBe(1)
  })

  it('does NOT ring a faint segment if a clearly visible segment (>= 4px) of the same category is nearby', () => {
    const rings = ringCentres(
      run([{ x: 100 / PLOT_W, w: pxWidth(5) }, { x: 110 / PLOT_W, w: pxWidth(T - 0.3) }])
    )
    expect(rings.length).toBe(0)
  })
})

// --- Vertical band snapping (paintGazeRects wide/exact pass) --------------------
// The gaze band must land on whole logical pixels so it can't bleed ~0.5px past
// the bar into the seam via anti-aliasing.

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

/** Two rows, one WIDE (>=1px) fixation each -> the exact pass (drawWideRects),
 *  which draws straight to the passed ctx and so is observable without a real
 *  canvas (the composite blit no-ops in node). Returns the emitted rects. */
function exactRects(layout: ScarfLayoutContext): { y: number; h: number }[] {
  const { ctx, rects } = bandMock()
  drawScarfBands(
    ctx,
    {
      gazeSource: gazeSource([[{ x: 0.5, w: pxWidth(3) }], [{ x: 0.5, w: pxWidth(3) }]]),
      visualEventBuckets: [],
      participants: [{}, {}],
    } as never,
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
      expect(Math.abs(rect.y * dpr - Math.round(rect.y * dpr))).toBeLessThan(1e-9)
      expect(Math.abs((rect.y + rect.h) * dpr - Math.round((rect.y + rect.h) * dpr))).toBeLessThan(
        1e-9
      )
    }
  })
})
