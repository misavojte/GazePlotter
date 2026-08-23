import { describe, it, expect } from 'vitest'
import {
  getOuterCrosshairSegments,
  alignToPixelCenter,
  type HighlightRect,
} from '$lib/plots/shared/canvasUtils'

// Anchor for the +0.5 crisp-stroke offset. The crosshair expectations below
// are BUILT with alignToPixelCenter, so without this pin a regression to
// identity would shift both sides together and pass.
describe('alignToPixelCenter', () => {
  it('truncates to the integer grid and offsets to the pixel center', () => {
    expect(alignToPixelCenter(100)).toBe(100.5)
    expect(alignToPixelCenter(100.9)).toBe(100.5)
    expect(alignToPixelCenter(0)).toBe(0.5)
  })
})

describe('getOuterCrosshairSegments', () => {
  it('returns outer dashed segments with zero inner lines at matrix crosshair crossings', () => {
    // Row strip: y in [100, 140], x in [0, 500]
    const rowStrip: HighlightRect = {
      x: 0,
      y: 100,
      width: 500,
      height: 40,
      along: 'x',
    }
    // Col strip: x in [200, 240], y in [0, 300]
    const colStrip: HighlightRect = {
      x: 200,
      y: 0,
      width: 40,
      height: 300,
      along: 'y',
    }

    const segments = getOuterCrosshairSegments([rowStrip, colStrip])

    const cyTop = alignToPixelCenter(100)
    const cyBottom = alignToPixelCenter(140)
    const cxLeft = alignToPixelCenter(200)
    const cxRight = alignToPixelCenter(240)

    const expected = [
      0, cyTop, 200, cyTop,
      240, cyTop, 500, cyTop,
      0, cyBottom, 200, cyBottom,
      240, cyBottom, 500, cyBottom,
      cxLeft, 0, cxLeft, 100,
      cxLeft, 140, cxLeft, 300,
      cxRight, 0, cxRight, 100,
      cxRight, 140, cxRight, 300,
    ]

    expect(Array.from(segments)).toEqual(expected)

    // Verify NO line segment is strictly inside the crossing cell [200, 240] x [100, 140]
    for (let i = 0; i < segments.length; i += 4) {
      const x1 = segments[i]
      const y1 = segments[i + 1]
      const x2 = segments[i + 2]
      const y2 = segments[i + 3]

      if (y1 === y2) {
        const minX = Math.min(x1, x2)
        const maxX = Math.max(x1, x2)
        expect(minX >= 240 || maxX <= 200).toBe(true)
      }

      if (x1 === x2) {
        const minY = Math.min(y1, y2)
        const maxY = Math.max(y1, y2)
        expect(minY >= 140 || maxY <= 100).toBe(true)
      }
    }
  })

  it('omits shared internal boundary lines between abutting highlight rows', () => {
    const row1: HighlightRect = {
      x: 0,
      y: 100,
      width: 500,
      height: 40,
      along: 'x',
    }
    const row2: HighlightRect = {
      x: 0,
      y: 140,
      width: 500,
      height: 40,
      along: 'x',
    }

    const segments = getOuterCrosshairSegments([row1, row2])

    const cyTop = alignToPixelCenter(100)
    const cyMiddle = alignToPixelCenter(140)
    const cyBottom = alignToPixelCenter(180)

    const yCoordinates = new Set<number>()
    for (let i = 1; i < segments.length; i += 4) {
      yCoordinates.add(segments[i])
    }

    expect(yCoordinates.has(cyTop)).toBe(true)
    expect(yCoordinates.has(cyBottom)).toBe(true)
    expect(yCoordinates.has(cyMiddle)).toBe(false)
  })

  it('returns standard 4 outer edges for a single bounded rectangle', () => {
    const rect: HighlightRect = {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      along: 'both',
    }

    const segments = getOuterCrosshairSegments([rect])

    const cx1 = alignToPixelCenter(10)
    const cx2 = alignToPixelCenter(110)
    const cy1 = alignToPixelCenter(20)
    const cy2 = alignToPixelCenter(70)

    expect(Array.from(segments)).toEqual([
      10, cy1, 110, cy1,
      10, cy2, 110, cy2,
      cx1, 20, cx1, 70,
      cx2, 20, cx2, 70,
    ])
  })
})
