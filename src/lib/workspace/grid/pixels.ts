import type { GridConfig } from './types'

/** All the grid-to-pixel maths reads: the cell geometry, nothing else. */
export type PixelConfig = Pick<GridConfig, 'cellSize' | 'gap'>

export function gridToPixelPosition(
  x: number,
  y: number,
  gridConfig: PixelConfig
): { left: number; top: number } {
  return {
    left: x * (gridConfig.cellSize.width + gridConfig.gap),
    top: y * (gridConfig.cellSize.height + gridConfig.gap),
  }
}

/**
 * The pixel box a set of grid items spans, or null for an empty set. One
 * plot and a whole selection are the same question asked of one or many.
 */
export function gridBoundsOf(
  items: { x: number; y: number; w: number; h: number }[],
  gridConfig: PixelConfig
): { left: number; top: number; right: number; bottom: number } | null {
  if (items.length === 0) return null

  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const item of items) {
    const position = gridToPixelPosition(item.x, item.y, gridConfig)
    const size = gridToPixelDimensions(item.w, item.h, gridConfig)
    left = Math.min(left, position.left)
    top = Math.min(top, position.top)
    right = Math.max(right, position.left + size.width)
    bottom = Math.max(bottom, position.top + size.height)
  }
  return { left, top, right, bottom }
}

export function gridToPixelDimensions(
  w: number,
  h: number,
  gridConfig: PixelConfig
): { width: number; height: number } {
  return {
    width: w * (gridConfig.cellSize.width + gridConfig.gap) - gridConfig.gap,
    height: h * (gridConfig.cellSize.height + gridConfig.gap) - gridConfig.gap,
  }
}
