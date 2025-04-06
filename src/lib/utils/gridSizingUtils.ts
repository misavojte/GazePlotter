import type { GridConfig } from '$lib/stores/gridStore'

/**
 * Grid sizing and positioning utilities
 *
 * This module contains utilities for converting between grid coordinates
 * and pixel measurements, as well as calculating various grid dimensions.
 */

// Default grid configuration
export const DEFAULT_GRID_CONFIG: GridConfig = {
  cellSize: { width: 40, height: 40 },
  gap: 10,
  minWidth: 3,
  minHeight: 3,
}

/**
 * Calculates the bottom edge position in pixels for a grid item
 *
 * @param y The y-coordinate of the item
 * @param h The height of the item in grid cells
 * @param gridConfig The grid configuration
 * @returns The bottom edge position in pixels
 */
export function calculateBottomEdgePosition(
  y: number,
  h: number,
  gridConfig: GridConfig
): number {
  return (
    (y + h) * (gridConfig.cellSize.height + gridConfig.gap) + gridConfig.gap
  )
}

/**
 * Calculates the required workspace height based on grid items
 *
 * @param positions Array of grid item positions
 * @param gridConfig The grid configuration
 * @param minHeight Minimum height (default: 300)
 * @param padding Additional padding to add (default: 90)
 * @returns The required workspace height in pixels
 */
export function calculateRequiredWorkspaceHeight(
  positions: { y: number; h: number }[],
  gridConfig: GridConfig,
  minHeight: number = 300,
  padding: number = 90
): number {
  if (positions.length === 0) return minHeight

  // Calculate the bottom edge position of each item
  const bottomEdges = positions.map(item =>
    calculateBottomEdgePosition(item.y, item.h, gridConfig)
  )

  // Return the maximum bottom edge plus padding
  return Math.max(minHeight, Math.max(...bottomEdges) + padding)
}

/**
 * Calculates the grid height based on the current state
 *
 * @param positions Current grid positions
 * @param isEmpty Whether the grid is empty
 * @param isLoading Whether the grid is loading
 * @param temporaryDragHeight Temporary height during drag operations
 * @param requiredWorkspaceHeight Required workspace height
 * @returns The calculated grid height
 */
export function calculateGridHeight(
  positions: { y: number; h: number }[],
  isEmpty: boolean,
  isLoading: boolean,
  temporaryDragHeight: number | null,
  gridConfig: GridConfig
): number {
  // If empty or loading, use fixed height for better performance
  if (isEmpty || isLoading) {
    return 500 // Fixed height for empty/loading state
  }

  // Calculate the required height
  const requiredHeight = calculateRequiredWorkspaceHeight(positions, gridConfig)

  // During drag operations, use the temporary height but ensure it's not less than required
  if (temporaryDragHeight !== null) {
    return Math.max(temporaryDragHeight, requiredHeight)
  }

  // Use the calculated required height
  return requiredHeight
}

export function calculateGridWidth(
  positions: { x: number; w: number }[],
  temporaryDragWidth: number | null,
  gridConfig: GridConfig
): number {
  if (positions.length === 0) return 0

  const requiredWidth =
    Math.max(...positions.map(item => item.x + item.w)) *
      (gridConfig.cellSize.width + gridConfig.gap) -
    gridConfig.gap

  if (temporaryDragWidth !== null) {
    return Math.max(temporaryDragWidth, requiredWidth)
  }

  return requiredWidth
}

/**
 * Converts grid coordinates to pixel positions
 *
 * @param x Grid x coordinate
 * @param y Grid y coordinate
 * @param gridConfig Grid configuration
 * @returns Pixel coordinates {left, top}
 */
export function gridToPixelPosition(
  x: number,
  y: number,
  gridConfig: GridConfig
): { left: number; top: number } {
  return {
    left: x * (gridConfig.cellSize.width + gridConfig.gap) + gridConfig.gap,
    top: y * (gridConfig.cellSize.height + gridConfig.gap) + gridConfig.gap,
  }
}

/**
 * Converts grid dimensions to pixel dimensions
 *
 * @param w Grid width
 * @param h Grid height
 * @param gridConfig Grid configuration
 * @returns Pixel dimensions {width, height}
 */
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
