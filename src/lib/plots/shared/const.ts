import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'

export const GRIDLINE_SECONDARY = {
  COLOR: '#eee',
  WIDTH: 1,
}

export const GRIDLINE_PRIMARY = {
  COLOR: '#cbcbcb',
  WIDTH: 1,
}

export const FONT_PRIMARY = {
  COLOR: '#222',
  SIZE: 12,
  FAMILY: SYSTEM_SANS_SERIF_STACK,
}

// Legend specific settings to be used across all charts
export const LEGEND_FONT = {
  FAMILY: FONT_PRIMARY.FAMILY,
  SIZE: FONT_PRIMARY.SIZE,
  COLOR: FONT_PRIMARY.COLOR,
}
