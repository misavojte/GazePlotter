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

export const PLOT_HEADER_HEIGHT = 145
