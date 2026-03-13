import type { GridConfig } from './types'
import {
  DEFAULT_WORKSPACE_WIDTH,
  WORKSPACE_RIGHT_PADDING,
} from './const'

export function calculateBottomEdgePosition(
  y: number,
  h: number,
  gridConfig: GridConfig
): number {
  return (
    (y + h) * (gridConfig.cellSize.height + gridConfig.gap) + gridConfig.gap
  )
}

export function calculateRightEdgePosition(
  x: number,
  w: number,
  gridConfig: GridConfig
): number {
  return (x + w) * (gridConfig.cellSize.width + gridConfig.gap)
}

export function calculateRequiredWorkspaceHeight(
  positions: { y: number; h: number }[],
  gridConfig: GridConfig,
  minHeight: number = 300,
  padding: number = 90
): number {
  if (positions.length === 0) return minHeight

  let maxBottom = 0
  for (let i = 0; i < positions.length; i++) {
    const edge = calculateBottomEdgePosition(
      positions[i].y,
      positions[i].h,
      gridConfig
    )
    if (edge > maxBottom) maxBottom = edge
  }

  return Math.max(minHeight, maxBottom + padding)
}

export function calculateGridHeight(
  positions: { y: number; h: number }[],
  isEmpty: boolean,
  isLoading: boolean,
  gridConfig: GridConfig
): number {
  if (isEmpty || isLoading) {
    return 500
  }

  return calculateRequiredWorkspaceHeight(positions, gridConfig)
}

export function calculateRequiredWorkspaceWidth(
  positions: { x: number; w: number }[],
  gridConfig: GridConfig
): number {
  if (positions.length === 0) return DEFAULT_WORKSPACE_WIDTH

  let maxRightEdge = 0
  for (let i = 0; i < positions.length; i++) {
    const edge = calculateRightEdgePosition(
      positions[i].x,
      positions[i].w,
      gridConfig
    )
    if (edge > maxRightEdge) maxRightEdge = edge
  }

  return Math.max(
    DEFAULT_WORKSPACE_WIDTH,
    maxRightEdge + WORKSPACE_RIGHT_PADDING
  )
}

export function calculateGridWidth(
  positions: { x: number; w: number }[],
  gridConfig: GridConfig
): number {
  if (positions.length === 0) return 0

  return calculateRequiredWorkspaceWidth(positions, gridConfig)
}

export function calculateViewportGridColumns(
  gridConfig: GridConfig,
  viewportWidth: number = typeof window !== 'undefined' ? window.innerWidth : 1920
): number {
  return Math.max(
    1,
    Math.floor(viewportWidth / (gridConfig.cellSize.width + gridConfig.gap))
  )
}
