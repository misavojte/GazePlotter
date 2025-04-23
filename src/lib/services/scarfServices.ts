import {
  getAois,
  getParticipants,
  hasStimulusAoiVisibility,
} from '$lib/stores/dataStore'
import { getScarfParticipantBarHeight as getBarHeight } from '$lib/utils/scarfPlotTransformations'

// Constants duplicated from scarfPlotTransformations.ts for better independence
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
  RIGHT_MARGIN: 15, // Right margin to prevent tick label cropping
  MIN_CHART_HEIGHT: 50, // Minimum chart height
  TICK_LENGTH: 5, // Length of axis ticks
  AXIS_OFFSET: 150, // Offset for axis labels
  GRID_COLOR: '#cbcbcb', // Color for grid lines
  GRID_STROKE_WIDTH: 1, // Stroke width for grid lines

  // Plot component dimensions
  HEADER_HEIGHT: 150,
  HORIZONTAL_PADDING: 50,
  CONTENT_PADDING: 20,
  LEFT_LABEL_WIDTH: 125,

  // Tooltip constants
  TOOLTIP_WIDTH: 155,
  TOOLTIP_OFFSET_Y: 8,
  TOOLTIP_HIDE_DELAY: 200,

  // Bar and height constants - MUST match scarfPlotTransformations.ts
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
 * Re-exports getScarfParticipantBarHeight from scarfPlotTransformations
 */
export const getScarfParticipantBarHeight = getBarHeight

/**
 * Unified approach to calculating all height-related values for a Scarf Plot
 * This centralizes all height calculations in one place with explicit components
 *
 * @param participantIds Array of participant IDs to display
 * @param aoiDataLength Number of AOIs in the data
 * @param isAoiVisible Whether AOI visibility is shown
 * @param chartWidth The available chart width (for legend calculations)
 * @returns An object with all height-related values
 */
export const calculateScarfHeights = (
  participantIds: number[],
  aoiDataLength: number,
  isAoiVisible: boolean,
  chartWidth: number = 800 // Default width if not provided
) => {
  // Get constants from layout
  const {
    HEIGHT_OF_BAR,
    SPACE_ABOVE_RECT,
    LINE_WRAPPED_HEIGHT,
    LEFT_LABEL_WIDTH,
    LEGEND_TITLE_HEIGHT,
    LEGEND_ITEM_HEIGHT,
    LEGEND_ITEM_PADDING,
    LEGEND_GROUP_SPACING,
    LEGEND_GROUP_TITLE_SPACING,
    PADDING,
    LEGEND_ICON_WIDTH,
    LEGEND_TEXT_PADDING,
    LEGEND_ITEM_SPACING,
    MIN_CHART_HEIGHT,
  } = SCARF_LAYOUT

  // Calculate the height needed for a single participant bar using the exact same function
  const participantBarHeight = getScarfParticipantBarHeight(
    HEIGHT_OF_BAR,
    SPACE_ABOVE_RECT,
    aoiDataLength,
    isAoiVisible,
    LINE_WRAPPED_HEIGHT
  )

  // Calculate height for participant bars only - no additional space
  const heightOfParticipantBars = participantBarHeight * participantIds.length

  // Chart height is exactly the participant bars height (or minimum)
  const chartHeight = Math.max(heightOfParticipantBars, MIN_CHART_HEIGHT)

  // Fixed spacing - these do NOT vary with participant count
  const fixedAxisOffset = 25 // Space between chart and axis labels
  const fixedLegendOffset = 40 // Space between chart and legend

  // Calculate legend heights using our comprehensive function
  const legendHeight = calculateLegendHeight({
    aoiItemsLength: aoiDataLength + 1, // +1 for the no AOI category fixation
    categoryItemsLength: 3, // For movement type legends (fixation, saccade, other)
    visibilityItemsLength: isAoiVisible ? aoiDataLength : 0,
    chartWidth,
    leftLabelWidth: LEFT_LABEL_WIDTH,
    titleHeight: LEGEND_TITLE_HEIGHT,
    itemHeight: LEGEND_ITEM_HEIGHT,
    itemPadding: LEGEND_ITEM_PADDING,
    groupSpacing: LEGEND_GROUP_SPACING,
    groupTitleSpacing: LEGEND_GROUP_TITLE_SPACING,
    padding: PADDING,
    iconWidth: LEGEND_ICON_WIDTH,
    textPadding: LEGEND_TEXT_PADDING,
    itemSpacing: LEGEND_ITEM_SPACING,
  })

  // Total height - EXACT sum of components
  const totalHeight = chartHeight + fixedLegendOffset + legendHeight

  return {
    participantBarHeight,
    heightOfParticipantBars,
    chartHeight,
    legendHeight,
    totalHeight,
    // Return exact pixel positions for axis elements
    axisLabelY: chartHeight + fixedAxisOffset,
    legendY: chartHeight + fixedLegendOffset,
  }
}

/**
 * Helper function to calculate the height of the scarf grid based on the current data in pixels.
 * @param participantIds array of participant IDs
 * @param isAoiVisible boolean indicating whether AOI is visible in the current context
 * @param aoiDataLength number of AOIs in the current data
 * @returns the height of the scarf based on the current data in pixels
 */
export const getScarfHeight = (
  participantIds: number[],
  isAoiVisible: boolean,
  aoiDataLength: number
) => {
  // Use our unified height calculation
  const heights = calculateScarfHeights(
    participantIds,
    aoiDataLength,
    isAoiVisible,
    800 // Default chart width estimate
  )

  // Add a safety buffer for the grid view only
  return heights.totalHeight + 180
}

/**
 * Helper function to calculate the height of the scarf grid based on the current data.
 * For the workspace component (grid view). Returns the height of the scarf grid in grid units.
 * It uses constant UNIT_OF_GRID_HEIGHT to convert the height in pixels to grid units.
 * @param stimulusId selected stimulus ID
 * @param dynamicAOI is dynamic AOI shown in the current data view?
 * @param groupId selected group ID
 * @returns the height of the scarf grid based on the current data in grid units
 */
export const getScarfGridHeightFromCurrentData = (
  stimulusId: number,
  dynamicAOI: boolean,
  groupId: number
): number => {
  const participants = getParticipants(groupId, stimulusId)
  const aois = getAois(stimulusId)
  const UNIT_OF_GRID_HEIGHT = 50

  return Math.ceil(
    getScarfHeight(
      participants.map(participant => participant.id),
      dynamicAOI,
      aois.length
    ) / UNIT_OF_GRID_HEIGHT
  )
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
 * Calculate legend items per row based on available width
 * @param options Configuration options
 * @returns Number of items that can fit per row
 */
export const getItemsPerRow = ({
  chartWidth,
  leftLabelWidth,
  padding,
  iconWidth,
  textPadding,
  itemSpacing,
  avgTextWidth = 90, // Default value for average text width
}: {
  chartWidth: number
  leftLabelWidth: number
  padding: number
  iconWidth: number
  textPadding: number
  itemSpacing: number
  avgTextWidth?: number
}): number => {
  if (!chartWidth || chartWidth <= 0) {
    return 3 // Default if no width provided
  }

  // Calculate how many items can fit in the available width with spacing
  const availableWidth = chartWidth - leftLabelWidth - padding * 2

  // Account for item width (icon + text + padding)
  const itemFullWidth = iconWidth + textPadding + avgTextWidth + itemSpacing

  const maxItems = Math.floor(availableWidth / itemFullWidth)

  // Return at least 1 item per row, or as many as will fit
  return Math.max(1, maxItems)
}

/**
 * Calculate legend height based on content
 * @param options Configuration options
 * @returns Total height of the legend
 */
export const calculateLegendHeight = ({
  aoiItemsLength,
  categoryItemsLength,
  visibilityItemsLength,
  chartWidth,
  leftLabelWidth,
  titleHeight,
  itemHeight,
  itemPadding,
  groupSpacing,
  groupTitleSpacing,
  padding,
  iconWidth,
  textPadding,
  itemSpacing,
}: {
  aoiItemsLength: number
  categoryItemsLength: number
  visibilityItemsLength: number
  chartWidth: number
  leftLabelWidth: number
  titleHeight: number
  itemHeight: number
  itemPadding: number
  groupSpacing: number
  groupTitleSpacing: number
  padding: number
  iconWidth: number
  textPadding: number
  itemSpacing: number
}): number => {
  const itemsPerRow = getItemsPerRow({
    chartWidth,
    leftLabelWidth,
    padding,
    iconWidth,
    textPadding,
    itemSpacing,
  })

  // Calculate row counts for each section
  const aoiRows = Math.ceil(aoiItemsLength / itemsPerRow)
  const categoryRows = Math.ceil(categoryItemsLength / itemsPerRow)
  const visibilityRows =
    visibilityItemsLength > 0
      ? Math.ceil(visibilityItemsLength / itemsPerRow)
      : 0

  // Calculate section heights
  const aoiSectionHeight =
    titleHeight + groupTitleSpacing + aoiRows * (itemHeight + itemPadding)
  const categorySectionHeight =
    titleHeight + groupTitleSpacing + categoryRows * (itemHeight + itemPadding)
  const visibilitySectionHeight =
    visibilityItemsLength > 0
      ? titleHeight +
        groupTitleSpacing +
        visibilityRows * (itemHeight + itemPadding)
      : 0

  return (
    padding + // Top padding
    aoiSectionHeight + // AOI section
    groupSpacing + // Spacing between AOI and Category
    categorySectionHeight + // Category section
    (visibilityItemsLength > 0 ? groupSpacing + visibilitySectionHeight : 0) + // Visibility section if exists
    padding // Bottom padding
  )
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
