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

/**
 * Common UI and Plot colors to ensure consistency across the application.
 */
export const UI_COLORS = {
  /** Primary grid line color (slightly darker for contrast) */
  GRID_PRIMARY: '#cbcbcb',
  /** Secondary grid line color (light, for subtle subdivisions) */
  GRID_SECONDARY: '#eee',
  /** Primary text color for plot labels and axes */
  TEXT_PRIMARY: '#222',
  /** Secondary text color for less prominent UI elements */
  TEXT_SECONDARY: '#666',
  /** Default background for panels and modals */
  BG_PRIMARY: '#ffffff',
  /** Standard border color for UI components */
  BORDER_DEFAULT: '#ddd',
  /** Error or alert color */
  DANGER: '#d62728',
  /** Dark outline color for event markers and legend icons */
  MARKER_OUTLINE: '#333333',
} as const

/**
 * Semantic fallback colors.
 */
export const COLOR_FALLBACKS = {
  BLACK: '#000000',
  WHITE: '#ffffff',
  TRANSPARENT: 'transparent',
} as const

/**
 * Default categorical colors for AOIs if none are specified.
 */
export const DEFAULT_AOI_COLORS = [
  '#66c5cc',
  '#f6cf71',
  '#f89c74',
  '#dcb0f2',
  '#87c55f',
] as const

/**
 * Grayscale base color palette for categories (e.g. Saccades, Blinks) if none are specified.
 */
export const DEFAULT_CATEGORY_COLORS = [
  '#4a4a4a', // Dark gray
  '#737373', // Medium dark gray
  '#9c9c9c', // Medium light gray
  '#c5c5c5', // Light gray
] as const

/**
 * Default color for "No AOI" treatment.
 */
export const DEFAULT_NO_AOI_COLOR = '#c0c0c0'
