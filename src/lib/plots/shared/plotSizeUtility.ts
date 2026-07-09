import { GRID_ITEM_BODY_PADDING } from '$lib/workspace/grid/const'
import { gridToPixelDimensions } from '$lib/workspace/grid/pixels'
import type { GridConfig } from '$lib/workspace/grid/types'
import type { PlotDimensions } from './types'

/**
 * Plot sizing utilities
 *
 * This module contains functions for calculating available plot sizes
 * based on grid dimensions and container requirements.
 */

/**
 * Calculates the available plot area dimensions in pixels
 *
 * @param gridWidth Grid width in cells
 * @param gridHeight Grid height in cells
 * @param gridConfig The grid configuration
 * @param horizontalPadding Total horizontal padding to subtract (left + right)
 * @param verticalPadding Total vertical padding to subtract (top + bottom)
 * @returns Available plot dimensions in pixels
 */
function calculatePlotDimensions(
  gridWidth: number,
  gridHeight: number,
  gridConfig: GridConfig,
  horizontalPadding: number = 0,
  verticalPadding: number = 0
): PlotDimensions {
  // Convert grid dimensions to total pixel dimensions
  const totalDimensions = gridToPixelDimensions(
    gridWidth,
    gridHeight,
    gridConfig
  )

  // Subtract padding to get available plot area
  return {
    width: Math.max(0, totalDimensions.width - horizontalPadding),
    height: Math.max(0, totalDimensions.height - verticalPadding),
  }
}

// Keep plot sizing aligned with the visual body padding inside GridItem.svelte.
const PLOT_CONTAINER_HORIZONTAL_PADDING = GRID_ITEM_BODY_PADDING * 2

/**
 * Calculates the available plot area dimensions with header adjustment
 *
 * @param gridWidth Grid width in cells
 * @param gridHeight Grid height in cells
 * @param gridConfig The grid configuration
 * @param headerHeight Height of the header in pixels
 * @returns Available plot dimensions in pixels
 */
export function calculatePlotDimensionsWithHeader(
  gridWidth: number,
  gridHeight: number,
  gridConfig: GridConfig,
  headerHeight: number
): PlotDimensions {
  // Use the base function with standard container padding and header height
  return calculatePlotDimensions(
    gridWidth,
    gridHeight,
    gridConfig,
    PLOT_CONTAINER_HORIZONTAL_PADDING,
    headerHeight
  )
}

/**
 * The drawable figure width in pixels for a plot spanning `gridWidth` grid units
 * — the same width `calculatePlotDimensionsWithHeader` yields (header only
 * affects height). This is the exact on-screen canvas width the plot renders
 * into: `gridToPixelDimensions().width` minus the grid-item body padding. Used
 * to size the display budget (windows worth evaluating ≈ one per pixel), so the
 * budget tracks the real available space instead of a hardcoded units→px factor.
 */
export function calculatePlotWidthPx(
  gridWidth: number,
  gridConfig: GridConfig
): number {
  const { width } = gridToPixelDimensions(gridWidth, 1, gridConfig)
  return Math.max(0, width - PLOT_CONTAINER_HORIZONTAL_PADDING)
}
