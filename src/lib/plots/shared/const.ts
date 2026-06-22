import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
import { UI_COLORS } from '$lib/color'

export const GRIDLINE_SECONDARY = {
  COLOR: UI_COLORS.GRID_SECONDARY,
  WIDTH: 1,
}

export const GRIDLINE_PRIMARY = {
  COLOR: UI_COLORS.GRID_PRIMARY,
  WIDTH: 1,
}

export const FONT_PRIMARY = {
  COLOR: UI_COLORS.TEXT_PRIMARY,
  SIZE: 12,
  FAMILY: SYSTEM_SANS_SERIF_STACK,
}

// Legend specific settings to be used across all charts
export const LEGEND_FONT = {
  FAMILY: FONT_PRIMARY.FAMILY,
  SIZE: FONT_PRIMARY.SIZE,
  COLOR: FONT_PRIMARY.COLOR,
}

/**
 * Chrome height that has to be reclaimed from the grid-item's pixel
 * dimensions before sizing the figure. Composition:
 *   47 — grid-item header (`min-height: 47px` in GridItem.svelte)
 *   50 — `.grid-item-body` padding top + bottom
 *        (GRID_ITEM_BODY_PADDING = 25 on each side)
 *    2 — `.grid-item-frame` border top + bottom (1px each; box-sizing
 *        is border-box so the border eats into the content area)
 */
export const PLOT_BASE_CHROME_HEIGHT = 99

/**
 * Gap in px between the plot-area border and adjacent per-row / per-category
 * text labels (participant names in scarf, AOI names in horizontal bar plot).
 * Keep in sync with plotArea's internal TICK_LABEL_GAP so row labels align
 * visually with tick labels on the same edge.
 */
export const ROW_LABEL_GAP = 10

/** Visual gap in px between tick labels and the axis title (X or Y). */
export const PLOT_AXIS_TITLE_GAP = 4

/** Visual gap in px between bottommost axis element and the top of the legend. */
export const PLOT_LEGEND_GAP = 14

/** Standard/default gap in px from the axis baseline to its tick labels. */
export const PLOT_TICK_LABEL_GAP = 10
