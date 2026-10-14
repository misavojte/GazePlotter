import { describe, expect, it } from 'vitest'
import {
  calculateGridHeight,
  calculateGridWidth,
  calculateViewportGridColumns,
} from '$lib/workspace/grid'
import {
  gridBoundsOf,
  gridToPixelDimensions,
  gridToPixelPosition,
} from '$lib/workspace/grid'

const gridConfig = {
  cellSize: { width: 40, height: 40 },
  gap: 10,
  minWidth: 3,
  minHeight: 3,
}

describe('gridSizing', () => {
  it('uses deterministic viewport width to compute available columns', () => {
    expect(calculateViewportGridColumns(gridConfig, 499)).toBe(9)
  })

  it('calculates grid size from item positions', () => {
    // Bottom edge (3+2) * (40+10) + trailing gap 10 = 260, plus the 90px
    // workspace bottom padding = 350. The two flags are isEmpty / isLoading.
    expect(
      calculateGridHeight([{ y: 3, h: 2 }], false, false, gridConfig)
    ).toBe(350)
    // Right edge (4+3) * (40+10) = 350 stays under DEFAULT_WORKSPACE_WIDTH
    // (1000), which therefore wins as the floor.
    expect(calculateGridWidth([{ x: 4, w: 3 }], gridConfig)).toBe(1000)
  })

  it('converts grid coordinates and dimensions into pixels', () => {
    expect(gridToPixelPosition(2, 3, gridConfig)).toEqual({
      left: 100,
      top: 150,
    })
    expect(gridToPixelDimensions(3, 2, gridConfig)).toEqual({
      width: 140,
      height: 90,
    })
  })
})

describe('gridBoundsOf', () => {
  it('has no box without items', () => {
    expect(gridBoundsOf([], gridConfig)).toBeNull()
  })

  it('spans every item it is given, whatever their order', () => {
    const items = [
      { x: 4, y: 0, w: 2, h: 2 },
      { x: 0, y: 3, w: 1, h: 1 },
    ]

    expect(gridBoundsOf(items, gridConfig)).toEqual({
      left: gridToPixelPosition(0, 3, gridConfig).left,
      top: gridToPixelPosition(4, 0, gridConfig).top,
      right:
        gridToPixelPosition(4, 0, gridConfig).left +
        gridToPixelDimensions(2, 2, gridConfig).width,
      bottom:
        gridToPixelPosition(0, 3, gridConfig).top +
        gridToPixelDimensions(1, 1, gridConfig).height,
    })
  })

  it("is the plot's own box for a set of one", () => {
    const position = gridToPixelPosition(2, 3, gridConfig)
    const size = gridToPixelDimensions(3, 2, gridConfig)

    expect(gridBoundsOf([{ x: 2, y: 3, w: 3, h: 2 }], gridConfig)).toEqual({
      left: position.left,
      top: position.top,
      right: position.left + size.width,
      bottom: position.top + size.height,
    })
  })
})
