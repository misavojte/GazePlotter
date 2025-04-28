import type { GridConfig } from '$lib/stores/gridStore'
import { gridToPixelDimensions } from '$lib/shared/utils/gridSizingUtils'
import type { PlotDimensions } from '$lib/plots/shared/types'

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
export function calculatePlotDimensions(
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

/**
 * Calculates the available plot area dimensions with header adjustment
 *
 * @param gridWidth Grid width in cells
 * @param gridHeight Grid height in cells
 * @param gridConfig The grid configuration
 * @param headerHeight Height of the header in pixels
 * @param horizontalPadding Total horizontal padding to subtract (left + right)
 * @param contentPadding Additional padding around the content area
 * @returns Available plot dimensions in pixels
 */
export function calculatePlotDimensionsWithHeader(
  gridWidth: number,
  gridHeight: number,
  gridConfig: GridConfig,
  headerHeight: number,
  horizontalPadding: number = 0,
  contentPadding: number = 0
): PlotDimensions {
  // Calculate total vertical padding (header + content padding)
  const totalVerticalPadding = headerHeight + contentPadding

  // Calculate total horizontal padding
  const totalHorizontalPadding = horizontalPadding + contentPadding

  // Use the base function with the calculated paddings
  return calculatePlotDimensions(
    gridWidth,
    gridHeight,
    gridConfig,
    totalHorizontalPadding,
    totalVerticalPadding
  )
}
