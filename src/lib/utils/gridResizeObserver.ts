/**
 * Grid Resize Utility
 *
 * Provides functions to calculate dimensions from grid settings
 */

// Constants from the workspace configuration
const CELL_SIZE = {
  width: 40,
  height: 40,
}
const GAP = 10
const PADDING = 20

/**
 * Calculate the inner width of a grid item based on grid width (w)
 *
 * @param gridWidth Number of grid cells in width (w property)
 * @param extraPadding Optional additional padding to subtract
 * @returns Inner width in pixels
 */
export function calculateInnerWidth(
  gridWidth: number,
  extraPadding = 0
): number {
  return (
    gridWidth * CELL_SIZE.width + (gridWidth - 1) * GAP - PADDING - extraPadding
  )
}

/**
 * Calculate the inner height of a grid item based on grid height (h)
 *
 * @param gridHeight Number of grid cells in height (h property)
 * @param headerHeight Optional header height to subtract
 * @param extraPadding Optional additional padding to subtract
 * @returns Inner height in pixels
 */
export function calculateInnerHeight(
  gridHeight: number,
  headerHeight = 0,
  extraPadding = 0
): number {
  return (
    gridHeight * CELL_SIZE.height +
    (gridHeight - 1) * GAP -
    PADDING -
    headerHeight -
    extraPadding
  )
}

/**
 * Calculate dimensions of a grid item
 *
 * @param w Grid width in cells
 * @param h Grid height in cells
 * @param headerHeight Optional header height in pixels
 * @returns Object with innerWidth and innerHeight in pixels
 */
export function calculateGridItemDimensions(
  w: number,
  h: number,
  headerHeight = 0
): { innerWidth: number; innerHeight: number } {
  return {
    innerWidth: calculateInnerWidth(w),
    innerHeight: calculateInnerHeight(h, headerHeight),
  }
}
