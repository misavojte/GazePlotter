import { describe, expect, it } from 'vitest'
import {
  cleanFloat,
  collectFixationPoints,
  densityAlpha,
  densityGrid,
  moveRect,
  niceTicks,
  zoomView,
  coverBounds,
  snapStepForSize,
  fitView,
  hitTest,
  pointsBounds,
  resizeRect,
  snapRect,
  snapStep,
  snapValue,
  toView,
  toWorld,
  unionRect,
  type FixationPointSource,
} from '../src/lib/data/media/mediaAlignment'
import { FIXATION_CATEGORY_ID } from '../src/lib/data/binary/schema'

/** Segments per (stimulus, participant): [category, x, y]. */
function stubReader(
  table: Record<string, [number, number, number][]>,
  hasSpatialData = true
): FixationPointSource {
  const segments: [number, number, number][] = []
  const ranges = new Map<string, { startIndex: number; endIndex: number }>()
  for (const [key, rows] of Object.entries(table)) {
    ranges.set(key, { startIndex: segments.length, endIndex: segments.length + rows.length })
    segments.push(...rows)
  }
  return {
    hasSpatialData,
    getSegmentRange: (s, p) => ranges.get(`${s}:${p}`) ?? { startIndex: 0, endIndex: 0 },
    getSegmentCategory: i => segments[i][0],
    getSegmentSpatial: i =>
      Number.isNaN(segments[i][1]) ? null : { x: segments[i][1], y: segments[i][2] },
  }
}

const FIX = FIXATION_CATEGORY_ID
const SACCADE = FIX + 1

describe('collectFixationPoints', () => {
  it('keeps fixations of the listed participants on the stimulus only', () => {
    const reader = stubReader({
      '0:0': [
        [FIX, 10, 20],
        [SACCADE, 99, 99],
        [FIX, NaN, NaN],
      ],
      '0:1': [[FIX, 30, 40]],
      '0:2': [[FIX, 50, 60]],
      '1:0': [[FIX, 70, 80]],
    })
    expect([...collectFixationPoints(reader, 0, [0, 1])]).toEqual([10, 20, 30, 40])
  })

  it('returns nothing without spatial data', () => {
    const reader = stubReader({ '0:0': [[FIX, 1, 2]] }, false)
    expect(collectFixationPoints(reader, 0, [0]).length).toBe(0)
  })
})

describe('bounds and views', () => {
  it('bounds flat points and unions with a rect', () => {
    const b = pointsBounds(Float64Array.from([5, 10, 15, -2]))
    expect(b).toEqual({ x: 5, y: -2, width: 10, height: 12 })
    expect(pointsBounds(new Float64Array(0))).toBeNull()
    expect(unionRect({ x: 0, y: 0, width: 10, height: 10 }, b)).toEqual({
      x: 0,
      y: -2,
      width: 15,
      height: 12,
    })
  })

  it('fits with a uniform scale, centred, and round-trips', () => {
    const view = fitView({ x: 0, y: 0, width: 1920, height: 1080 }, 600, 400, {
      top: 20,
      right: 20,
      bottom: 20,
      left: 20,
    })
    expect(view.scale).toBeCloseTo(560 / 1920)
    const centre = toView(view, 960, 540)
    expect(centre.x).toBeCloseTo(300)
    expect(centre.y).toBeCloseTo(200)
    const back = toWorld(view, centre.x, centre.y)
    expect(back.x).toBeCloseTo(960)
    expect(back.y).toBeCloseTo(540)
  })
})

describe('snapping', () => {
  it('snaps pixel data to whole numbers and normalized data to decimals', () => {
    expect(snapStep({ scale: 0.3, offsetX: 0, offsetY: 0 })).toBe(1)
    expect(snapStep({ scale: 600, offsetX: 0, offsetY: 0 })).toBe(0.001)
    expect(snapValue(0.1 + 0.2, 0.001)).toBe(0.3)
    expect(snapRect({ x: 359.6, y: 140.2, width: 0.2, height: 800.4 }, 1)).toEqual({
      x: 360,
      y: 140,
      width: 1,
      height: 800,
    })
  })
})

describe('hitTest', () => {
  const view = { scale: 1, offsetX: 0, offsetY: 0 }
  const rect = { x: 100, y: 100, width: 200, height: 100 }
  it('prefers corners over the body, and misses outside', () => {
    expect(hitTest(view, rect, 302, 198, 6)).toEqual({ kind: 'corner', corner: 'se' })
    expect(hitTest(view, rect, 99, 101, 6)).toEqual({ kind: 'corner', corner: 'nw' })
    expect(hitTest(view, rect, 200, 150, 6)).toEqual({ kind: 'body' })
    expect(hitTest(view, rect, 50, 50, 6)).toBeNull()
  })
})

describe('resizeRect', () => {
  const start = { x: 100, y: 100, width: 200, height: 100 }

  it('anchors the opposite corner and keeps the aspect ratio', () => {
    expect(resizeRect(start, 'se', 500, 210, true, 1)).toEqual({
      x: 100,
      y: 100,
      width: 400,
      height: 200,
    })
    // Anchor = se corner (300, 200); the taller pull (2x) wins over the wider (0.5x).
    expect(resizeRect(start, 'nw', 200, 0, true, 1)).toEqual({
      x: -100,
      y: 0,
      width: 400,
      height: 200,
    })
  })

  it('frees the aspect ratio on request and never goes below the minimum', () => {
    expect(resizeRect(start, 'ne', 400, 50, false, 1)).toEqual({
      x: 100,
      y: 50,
      width: 300,
      height: 150,
    })
    const tiny = resizeRect(start, 'se', 0, 0, false, 5)
    expect(tiny.width).toBe(5)
    expect(tiny.height).toBe(5)
  })
})

describe('coverBounds and snapStepForSize', () => {
  it('covers the bounds at the media aspect, centred on them', () => {
    // 2:1 media over a 1 x 1 fixation spread: width wins at 2, centred.
    expect(coverBounds({ x: 0, y: 0, width: 1, height: 1 }, 2)).toEqual({
      x: -0.5,
      y: 0,
      width: 2,
      height: 1,
    })
    // Wide spread: height follows from width.
    expect(coverBounds({ x: 0, y: 0, width: 400, height: 100 }, 2)).toEqual({
      x: 0,
      y: -50,
      width: 400,
      height: 200,
    })
  })

  it('uses whole units for pixel data and fine steps for small units', () => {
    expect(snapStepForSize(1920)).toBe(1)
    expect(snapStepForSize(539)).toBe(1)
    expect(snapStepForSize(1)).toBe(0.001)
  })
})

describe('precision', () => {
  it('moves by the delta and keeps the typed fraction', () => {
    expect(moveRect({ x: 360.25, y: 140.5, width: 800, height: 600 }, 10, -1)).toEqual({
      x: 370.25,
      y: 139.5,
      width: 800,
      height: 600,
    })
    expect(moveRect({ x: 0.1, y: 0, width: 1, height: 1 }, 0.001, 0).x).toBe(0.101)
    expect(cleanFloat(0.1 + 0.2)).toBe(0.3)
  })

  it('keeps the exact aspect ratio when rounding a locked resize', () => {
    // 1200 x 800 (3:2), dragged so the width rounds to 901.
    const r = resizeRect({ x: 0, y: 0, width: 1200, height: 800 }, 'se', 900.6, 0, true, 1, 1)
    expect(r.width).toBe(901)
    expect(r.width / r.height).toBeCloseTo(1.5, 12)
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
  })

  it('keeps the anchored corner exact', () => {
    const start = { x: 10.25, y: 20.75, width: 100, height: 50 }
    const r = resizeRect(start, 'nw', 0, 0, false, 1, 1)
    expect(r.x + r.width).toBe(110.25)
    expect(r.y + r.height).toBe(70.75)
  })
})

describe('view helpers', () => {
  it('zooms around the pointer', () => {
    const v = zoomView({ scale: 1, offsetX: 0, offsetY: 0 }, 2, 100, 50)
    expect(toWorld(v, 100, 50)).toEqual({ x: 100, y: 50 })
    expect(v.scale).toBe(2)
  })

  it('makes round ticks', () => {
    expect(niceTicks(0, 1920, 5)).toEqual([0, 500, 1000, 1500])
    expect(niceTicks(0.1, 0.5, 4)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5])
    expect(niceTicks(5, 5, 4)).toEqual([])
  })
})

describe('density raster', () => {
  it('counts points per screen cell and drops points off the canvas', () => {
    const view = { scale: 1, offsetX: 0, offsetY: 0 }
    const pts = Float64Array.from([1, 1, 2, 2, 5, 1, 50, 50, -1, 0])
    const g = densityGrid(pts, view, 9, 6, 1, 3)
    expect(g.cols).toBe(3)
    expect(g.rows).toBe(2)
    expect([...g.counts]).toEqual([2, 1, 0, 0, 0, 0])
    expect(g.max).toBe(2)
  })

  it('scales by the device pixel ratio', () => {
    const g = densityGrid(Float64Array.from([2, 0]), { scale: 1, offsetX: 0, offsetY: 0 }, 12, 3, 2, 3)
    // x = 2 css px = 4 device px, in the second 3 px cell.
    expect([...g.counts]).toEqual([0, 1, 0, 0])
  })

  it('gives lone fixations a visible floor and caps the cores', () => {
    expect(densityAlpha(0, 10)).toBe(0)
    expect(densityAlpha(1, 1)).toBeCloseTo(0.35)
    expect(densityAlpha(1, 1000)).toBeCloseTo(0.35)
    expect(densityAlpha(1000, 1000)).toBeCloseTo(0.8)
    expect(densityAlpha(31, 1000)).toBeGreaterThan(densityAlpha(10, 1000))
  })
})
