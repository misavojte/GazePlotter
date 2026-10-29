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
  /** Lightness falls one way (L* 94, 70, 40) and the top stays visible on white:
      the fixation heatmap's overlay default. */
  YL_OR_RD: {
    name: 'Yellow to Red',
    colors: ['#ffeda0', '#fd8d3c', '#bd0026'],
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
 * Neutral grey scale (R = G = B) for everything drawn inside a plot. No hue tint,
 * so a grey never reads as a category colour or shifts the data colours next to
 * it. The app chrome keeps its Slate tokens in DesignTokens.svelte.
 *
 * Steps are 8 apart in CIE L* (97 at 50 down to 17 at 950), so equal step gaps
 * look like equal lightness gaps. Plots take greys through the roles in
 * {@link UI_COLORS} and {@link INACTIVE_COLOR}, never a step directly.
 */
export const PLOT_GREY = {
  50: '#f6f6f6',
  100: '#dfdfdf',
  200: '#c9c9c9',
  300: '#b3b3b3',
  400: '#9e9e9e',
  500: '#898989',
  600: '#747474',
  700: '#616161',
  800: '#4e4e4e',
  900: '#3b3b3b',
  950: '#2a2a2a',
} as const

/**
 * Inactive, empty, non-finite and out-of-range cells or areas, in every plot,
 * so "no value here" looks the same everywhere. Also the recurrence plot's
 * trivial main diagonal, which no measure counts.
 */
export const INACTIVE_COLOR = PLOT_GREY[100]

/**
 * Colour roles for plots. Text roles meet WCAG AA (4.5:1) on white.
 */
export const UI_COLORS = {
  /** Primary grid line color (slightly darker for contrast) */
  GRID_PRIMARY: PLOT_GREY[200],
  /** Secondary grid line color (light, for subtle subdivisions) */
  GRID_SECONDARY: PLOT_GREY[50],
  /** Primary text color for plot labels and axes (14:1 on white) */
  TEXT_PRIMARY: PLOT_GREY[950],
  /** Secondary text for less prominent labels and placeholders (6.2:1 on white,
      4.6:1 on INACTIVE_COLOR) */
  TEXT_SECONDARY: PLOT_GREY[700],
  /** Default background for panels and modals */
  BG_PRIMARY: '#ffffff',
  /** Borders and row dividers */
  BORDER_DEFAULT: PLOT_GREY[100],
  /** Faint fill behind header or label cells inside a plot */
  SURFACE_SUBTLE: PLOT_GREY[50],
  /** Data marks that carry no colour of their own (dots, summary markers) */
  INK: PLOT_GREY[950],
  /** Lines joining marks in sequence (scanpath saccades) */
  CONNECTOR: PLOT_GREY[700],
  /** De-emphasised marks: dimmed by a highlight, or background structure */
  MUTED_MARK: PLOT_GREY[400],
  /** Mark whose style is missing; should never show in a healthy plot */
  FALLBACK_MARK: PLOT_GREY[500],
  /** Error or alert color */
  DANGER: '#d62728',
  /** Dark outline color for event markers and legend icons */
  MARKER_OUTLINE: PLOT_GREY[900],
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
 * The gray swatch within {@link CATEGORICAL_PALETTE}. Excluded from the AOI
 * defaults because grayscale is reserved for eye-movement categories
 * ({@link DEFAULT_CATEGORY_COLORS}) and the "No AOI" treatment
 * ({@link DEFAULT_NO_AOI_COLOR}) — a gray AOI would read as a non-fixation.
 */
const RESERVED_CATEGORICAL_GRAY = '#7f7f7f'

/**
 * Default categorical colors for AOIs when none are specified.
 *
 * Derived from {@link CATEGORICAL_PALETTE} (minus the reserved gray) so the
 * colors auto-assigned to AOIs match the swatches the manual color picker
 * offers. Ten distinct hues — wide enough that AOIs in a typical study no
 * longer collide (the previous 5-color list made the 6th AOI identical to the
 * 1st, silently merging two regions in scarf / AOI-stream / recurrence views).
 */
export const DEFAULT_AOI_COLORS: readonly string[] = CATEGORICAL_PALETTE.filter(
  color => color !== RESERVED_CATEGORICAL_GRAY
)

/**
 * Grayscale base color palette for categories (e.g. Saccades, Blinks) if none are specified.
 * Every other step of {@link PLOT_GREY} (16 L* apart), leaving {@link DEFAULT_NO_AOI_COLOR}
 * on the step between the two lightest.
 */
export const DEFAULT_CATEGORY_COLORS = [
  PLOT_GREY[700],
  PLOT_GREY[500],
  PLOT_GREY[300],
  PLOT_GREY[100],
] as const

/**
 * Default color for "No AOI" treatment.
 */
export const DEFAULT_NO_AOI_COLOR = PLOT_GREY[200]
