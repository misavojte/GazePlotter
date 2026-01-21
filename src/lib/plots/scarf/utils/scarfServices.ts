import { getScarfParticipantBarHeight as getBarHeight } from '$lib/plots/scarf/utils/transformations'

// Constants duplicated from the canonical scarf transformations module for better independence
const HEIGHT_OF_X_AXIS = 20
const DEFAULT_BAR_HEIGHT = 15 // SHOULD BE 20 BUT THIS FIXES THE BUG OF MISALIGNMENT OF BAR HEIGHTS
const DEFAULT_NON_FIXATION_HEIGHT = 4
const DEFAULT_SPACE_ABOVE_RECT = 5
const DEFAULT_SPACE_ABOVE_LINE = 2

/**
 * Constants for ScarfPlot layout and rendering
 */
export const SCARF_LAYOUT = {
  // Core layout dimensions
  LEFT_LABEL_MAX_WIDTH: 125, // Width for participant labels
  AXIS_LABEL_HEIGHT: 40, // Height for the x-axis label
  LABEL_FONT_SIZE: 12, // Font size for labels
  PADDING: 0, // General padding
  RIGHT_MARGIN: 1, // Right margin to prevent tick cropping
  MIN_CHART_HEIGHT: 50, // Minimum chart height
  TICK_LENGTH: 5, // Length of axis ticks
  AXIS_OFFSET: 150, // Offset for axis labels
  GRID_COLOR: '#cbcbcb', // Color for grid lines
  GRID_STROKE_WIDTH: 1, // Stroke width for grid lines

  // Plot component dimensions
  HEADER_HEIGHT: 150,
  HORIZONTAL_PADDING: 40,
  CONTENT_PADDING: 5, // THIS IS FOR A VISUAL BALANCING OF THE PLOT
  LEFT_LABEL_WIDTH: 125,

  // Tooltip constants
  TOOLTIP_WIDTH: 150,
  TOOLTIP_OFFSET_Y: 8,
  TOOLTIP_HIDE_DELAY: 200,

  // Bar and height constants - MUST match the canonical scarf transformations
  HEIGHT_OF_BAR: DEFAULT_BAR_HEIGHT,
  HEIGHT_OF_LEGEND_BAR: 32,
  SPACE_ABOVE_RECT: DEFAULT_SPACE_ABOVE_RECT,
  LINE_WRAPPED_HEIGHT: DEFAULT_SPACE_ABOVE_LINE + DEFAULT_NON_FIXATION_HEIGHT,
  NON_FIXATION_HEIGHT: DEFAULT_NON_FIXATION_HEIGHT,
  HEIGHT_OF_X_AXIS: HEIGHT_OF_X_AXIS,

  // Legend constants
  LEGEND_ITEM_WIDTH: 100,
  LEGEND_ITEM_HEIGHT: 15,
  LEGEND_ITEMS_PER_ROW: 3,
  LEGEND_TITLE_HEIGHT: 18,
  LEGEND_ITEM_PADDING: 8,
  LEGEND_GROUP_SPACING: 10,
  LEGEND_GROUP_TITLE_SPACING: 5,
  LEGEND_ICON_WIDTH: 20,
  LEGEND_TEXT_PADDING: 8,
  LEGEND_ITEM_SPACING: 15,
  LEGEND_FONT_SIZE: 12,
  LEGEND_BG_HOVER_COLOR: 'rgba(0, 0, 0, 0.05)',
  LEGEND_RECT_HIGHLIGHT_STROKE: '#333333',
  LEGEND_RECT_HIGHLIGHT_STROKE_WIDTH: 1,
  LEGEND_LINE_HIGHLIGHT_STROKE_WIDTH: 3,
}

/**
 * Re-exports getScarfParticipantBarHeight from the canonical scarf transformations
 */
export const getScarfParticipantBarHeight = getBarHeight

/**
 * Helper function to calculate the height of the scarf grid based on the current data.
 * For the workspace component (grid view). Returns a fixed default height for Scarf Plots.
 * In the Viewport-Driven Architecture, the plot adapts to the provided grid height.
 * @returns the default height of the scarf grid in grid units
 */
export const getScarfGridHeightFromCurrentData = (): number => {
  return 12 // Default grid height units
}

/**
 * Helper function determining whether dynamic AOI is displayed in the current context.
 * @param timeline the timeline type
 * @param dynamicAOIAllowed is dynamic AOI allowed by the settings?
 * @param dynamicAOIInData is dynamic AOI present in the current data (stimulus)?
 * @returns a boolean indicating whether dynamic AOI is allowed in the current context
 */
export const getDynamicAoiBoolean = (
  timeline: 'ordinal' | 'absolute' | 'relative',
  dynamicAOIAllowed: boolean,
  dynamicAOIInData: boolean
): boolean => {
  if (timeline === 'ordinal') return false
  if (!dynamicAOIAllowed) return false
  return dynamicAOIInData
}

/**
 * Returns the timeline unit based on settings
 * @param settings The grid settings
 * @returns Unit string (%, ms, or empty for ordinal)
 */
export const getTimelineUnit = (
  timeline: 'absolute' | 'relative' | 'ordinal'
): string => {
  return timeline === 'relative' ? '%' : timeline === 'absolute' ? 'ms' : ''
}

/**
 * Returns the x-axis label based on settings
 * @param timeline The timeline type
 * @returns The formatted x-axis label
 */
export const getXAxisLabel = (
  timeline: 'absolute' | 'relative' | 'ordinal'
): string => {
  return timeline === 'ordinal'
    ? 'Order index'
    : `Elapsed time [${getTimelineUnit(timeline)}]`
}
