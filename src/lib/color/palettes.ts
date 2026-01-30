/**
 * Discrete categorical color palette optimized for accessibility.
 * Used for AOIs, participants, and general color coding.
 */
export const CATEGORICAL_PALETTE = [
  '#1f77b4', // Blue
  '#ff7f0e', // Orange
  '#2ca02c', // Green
  '#d62728', // Red
  '#9467bd', // Purple
  '#8c564b', // Brown
  '#e377c2', // Pink
  '#7f7f7f', // Gray
  '#bcbd22', // Olive
  '#17becf', // Cyan
  '#aec7e8', // Light blue
]

/**
 * Backward compatibility alias for CATEGORICAL_PALETTE.
 */
export const SCIENTIFIC_COLOR_PALETTE = CATEGORICAL_PALETTE

/**
 * Professional multi-stop gradient presets for heatmaps and intensity plots.
 */
export const PRESET_PALETTES = {
  VIRIDIS: {
    name: 'Viridis',
    colors: ['#440154', '#21918c', '#fde725'],
  },
  INFERNO: {
    name: 'Inferno',
    colors: ['#000004', '#bb3754', '#fcffa4'],
  },
  HEAT: {
    name: 'Heat',
    colors: ['#ffffff', '#fd8d3c', '#7f0000'],
  },
  BLUE: {
    name: 'Blue',
    colors: ['#f7fbff', '#4292c6', '#08306b'],
  },
  GREEN_TO_RED: {
    name: 'Green to Red',
    colors: ['#31a354', '#f7fcb9', '#a50f15'],
  },
} as const

/**
 * Color used for inactive/empty/out-of-bounds cells, matching Transition Matrix.
 */
export const INACTIVE_COLOR = '#e0e0e0'
