import { UI_COLORS } from '$lib/color'

/**
 * Unified constants and identifiers for the Scarf Plot.
 */

export const SCARF_IDENTIFIERS = {
  AOI: 'a', // Segment is an Area of Interest fixation
  CATEGORY: 'ac', // Segment is a category (e.g. Saccade)
  EVENT: 'e', // Visibility event marker
  NOT_DEFINED: 'N', // Fallback for null/empty categories or AOIs
} as const

export const SCARF_LAYOUT = {
  // --- Basic Dimensions ---
  HEIGHT_BAR_DEFAULT: 15,
  HEIGHT_NON_FIXATION_DEFAULT: 4,
  SPACE_ABOVE_RECT_DEFAULT: 5,
  HEIGHT_X_AXIS: 20,
  RIGHT_MARGIN: 8,
  HEADER_HEIGHT: 145,

  // --- Tooltips ---
  TOOLTIP_WIDTH: 150,
  TOOLTIP_HIDE_DELAY: 200,

  // --- Labels and Typography ---
  LEFT_LABEL_MAX_WIDTH: 125,
  AXIS_LABEL_HEIGHT: 40,
  LABEL_FONT_SIZE: 12,
  TICK_LENGTH: 5,

  // --- Styling ---
  GRID_COLOR: UI_COLORS.GRID_PRIMARY,
  GRID_STROKE_WIDTH: 1,

  // --- Legend Configuration ---
  LEGEND_ITEMS_PER_ROW: 3,
  LEGEND_TITLE_HEIGHT: 18,
  LEGEND_ITEM_PADDING: 8,
  LEGEND_GROUP_SPACING: 10,
  LEGEND_ITEM_SPACING: 15,

  // --- Dynamic Scaling & Compact Mode ---
  MAX_BAR_SCALE: 2.0,
  MIN_BAR_HEIGHT: 1,
  MIN_PLOT_HEIGHT_COMPACT: 100,
  COMPACT_MODE_THRESHOLD: 7,
} as const
