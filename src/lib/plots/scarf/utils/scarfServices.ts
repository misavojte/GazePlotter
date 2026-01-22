/**
 * Unified layout and rendering constants for the Scarf Plot.
 */
export const SCARF_LAYOUT = {
  // --- Basic Dimensions ---
  HEIGHT_OF_BAR: 15,
  NON_FIXATION_HEIGHT: 4,
  SPACE_ABOVE_RECT: 5,
  HEIGHT_OF_X_AXIS: 20,
  RIGHT_MARGIN: 8,
  HEADER_HEIGHT: 150,

  // --- Tooltips ---
  TOOLTIP_WIDTH: 150,
  TOOLTIP_HIDE_DELAY: 200,

  // --- Labels and Typography ---
  LEFT_LABEL_MAX_WIDTH: 125,
  AXIS_LABEL_HEIGHT: 40,
  LABEL_FONT_SIZE: 12,
  TICK_LENGTH: 5,

  // --- Styling ---
  GRID_COLOR: '#cbcbcb',
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
  COMPACT_MODE_THRESHOLD: 7, // Switch to compact below this height
} as const

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

/**
 * Creates a unified identifier mapping system for Scarf Plots.
 * This is used to map between identifier strings and their stable integer indices (style buckets).
 *
 * @param aoiCount Number of AOIs
 * @param categoryCount Number of categories (usually 2: Saccade and Other)
 * @param visibilityCount Number of visibility items (usually same as aoiCount or 0)
 * @param getIdentifier Callback to get the identifier string for a given type and index
 */
export function getScarfIdentifierSystem(
  aoiIdentifiers: string[],
  categoryIdentifiers: string[],
  visibilityIdentifiers: string[]
) {
  const idToIndex = new Map<string, number>()
  const indexToId = new Map<number, string>()
  const idToType = new Map<string, 'aoi' | 'category' | 'visibility'>()

  let idx = 0

  // Order: AOIs -> Categories -> Visibility
  for (const id of aoiIdentifiers) {
    indexToId.set(idx, id)
    idToIndex.set(id, idx++)
    idToType.set(id, 'aoi')
  }

  for (const id of categoryIdentifiers) {
    indexToId.set(idx, id)
    idToIndex.set(id, idx++)
    idToType.set(id, 'category')
  }

  for (const id of visibilityIdentifiers) {
    indexToId.set(idx, id)
    idToIndex.set(id, idx++)
    idToType.set(id, 'visibility')
  }

  return {
    idToIndex,
    indexToId,
    idToType,
    totalIdentifiers: idx,
    counts: {
      aoi: aoiIdentifiers.length,
      category: categoryIdentifiers.length,
      visibility: visibilityIdentifiers.length,
    },
  }
}
