import { describe, expect, it } from 'vitest'
import {
  calculateGridHeight,
  calculateGridWidth,
  calculateViewportGridColumns,
} from '$lib/workspace/grid'
import {
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
    expect(
      calculateGridHeight([{ y: 3, h: 2 }], false, false, gridConfig)
    ).toBe(350)
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
