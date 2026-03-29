import type { GridConfig } from './types'

export function gridToPixelPosition(
  x: number,
  y: number,
  gridConfig: GridConfig
): { left: number; top: number } {
  return {
    left: x * (gridConfig.cellSize.width + gridConfig.gap),
    top: y * (gridConfig.cellSize.height + gridConfig.gap),
  }
}

export function gridToPixelDimensions(
  w: number,
  h: number,
  gridConfig: GridConfig
): { width: number; height: number } {
  return {
    width: w * (gridConfig.cellSize.width + gridConfig.gap) - gridConfig.gap,
    height: h * (gridConfig.cellSize.height + gridConfig.gap) - gridConfig.gap,
  }
}
