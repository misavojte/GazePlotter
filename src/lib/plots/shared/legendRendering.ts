/**
 * Legend Utilities - Functional approach for canvas-based legend rendering
 *
 * This module provides pure functions for computing legend geometry,
 * drawing legends to canvas, and hit testing for mouse interactions.
 *
 * Performance considerations:
 * - Geometry computation is designed to work with Svelte's $derived for memoization
 * - Draw functions batch operations (all icons first, then all text)
 * - Hit testing uses pre-computed bounds for O(n) lookup
 * - No object allocations in render path after geometry computation
 *
 * Usage with Svelte 5:
 *   const geometry = $derived.by(() =>
 *     computeFlatLegendGeometry(items, LEGEND_CONFIG, x, y, width)
 *   )
 */

import { FONT_PRIMARY } from './const'
import {
  truncateTextToPixelWidth,
  estimateTextWidth,
} from '$lib/shared/utils/textUtils'
import { alignToPixelCenter } from '$lib/shared/utils/canvasUtils'
import { desaturateToWhite } from '$lib/shared/utils/colorUtils'

// ============================================================================
// TYPES
// ============================================================================

/** A single legend item */
export interface LegendItem {
  /** Unique identifier for click handling and highlighting */
  identifier: string
  /** Display name shown next to the icon */
  name: string
  /** Color for the icon */
  color: string

  /** Icon type: 'fixation' for filled rectangles, 'nonFixation' for thin rectangles, 'eventPair' for start/end markers */
  type: 'fixation' | 'nonFixation' | 'eventPair'
}

/** A group of legend items with a title (for scarf-style grouped legends) */
export interface LegendGroup {
  /** Group title displayed above items */
  title: string
  /** Items in this group */
  items: LegendItem[]
}

/** Configuration options for the legend */
export interface LegendConfig {
  /** Height of each legend item row */
  itemHeight: number
  /** Width of the icon (rect or line) */
  iconWidth: number
  /** Padding between icon and text */
  textPadding: number
  /** Horizontal spacing between items */
  itemSpacing: number
  /** Vertical padding between rows */
  rowPadding: number
  /** Height of group titles (for grouped legends) */
  titleHeight: number
  /** Vertical spacing between groups (for grouped legends) */
  groupSpacing: number
  /** Spacing between title and first item (for grouped legends) */
  groupTitleSpacing: number
  /** Font family for text */
  fontFamily: string
  /** Font size in pixels */
  fontSize: number
  /** Font color */
  fontColor: string
  /** Top padding before first content */
  topPadding: number
  /** Line dash pattern for 'line' type icons */
  lineDash: readonly [number, number]
  /** Height of non-fixation items */
  nonFixationHeight: number
}

/** Pre-computed geometry for a single legend item */
export interface LegendItemGeometry {
  identifier: string
  name: string
  color: string
  height: number
  x: number
  y: number
  width: number
  type: 'fixation' | 'nonFixation' | 'eventPair'
  rowHeight: number
  groupTitle?: string
}

/** Pre-computed geometry for a group title */
export interface LegendGroupTitleGeometry {
  title: string
  x: number
  y: number
}

/** Complete computed geometry for the entire legend */
export interface LegendGeometry {
  items: LegendItemGeometry[]
  groupTitles: LegendGroupTitleGeometry[]
  totalHeight: number
  itemsPerRow: number
}

// ============================================================================
// DEFAULT CONFIGS
// ============================================================================

/** Default configuration matching existing scarf plot legend */
export const SCARF_LEGEND_CONFIG: LegendConfig = {
  itemHeight: 15,
  iconWidth: 20,
  textPadding: 8,
  itemSpacing: 15,
  rowPadding: 8,
  titleHeight: 18,
  groupSpacing: 10,
  groupTitleSpacing: 2,
  fontFamily: FONT_PRIMARY.FAMILY,
  fontSize: FONT_PRIMARY.SIZE,
  fontColor: FONT_PRIMARY.COLOR,
  topPadding: 0,
  lineDash: [2, 2] as const,
  nonFixationHeight: 4,
}

/** Default configuration matching existing stream plot legend */
export const STREAM_LEGEND_CONFIG: LegendConfig = {
  itemHeight: 15,
  iconWidth: 20,
  textPadding: 8,
  itemSpacing: 15,
  rowPadding: 8,
  titleHeight: 18,
  groupSpacing: 10,
  groupTitleSpacing: 2,
  fontFamily: FONT_PRIMARY.FAMILY,
  fontSize: FONT_PRIMARY.SIZE,
  fontColor: FONT_PRIMARY.COLOR,
  topPadding: 5,
  lineDash: [2, 2] as const,
  nonFixationHeight: 4,
}

// ============================================================================
// GEOMETRY COMPUTATION FUNCTIONS
// ============================================================================

/**
 * Calculate optimal items per row for visually pleasing layout.
 * Uses smart calculation based on item count to avoid awkward layouts.
 *
 * @param itemCount - Total number of items to layout
 * @param availableWidth - Available width in pixels
 * @param config - Legend configuration
 * @param avgTextWidth - Average text width estimate
 */
export function getLegendItemsPerRow(
  availableWidth: number,
  config: LegendConfig,
  avgTextWidth: number = 90,
  itemCount?: number
): number {
  if (availableWidth <= 0) return 1

  const { iconWidth, textPadding, itemSpacing } = config
  const itemFullWidth = iconWidth + textPadding + avgTextWidth + itemSpacing
  const maxItemsPerRow = Math.max(1, Math.floor(availableWidth / itemFullWidth))

  // If no item count provided, return max possible
  if (!itemCount || itemCount <= 0) return maxItemsPerRow

  // Simply return the maximum number of items that can fit, or the actual item count
  // whichever is smaller. This removes the preference for fewer columns/balancing.
  return Math.min(itemCount, maxItemsPerRow)
}

/**
 * Calculate total height for a flat legend (without computing full geometry).
 * Use this for layout calculations before actual rendering.
 */
export function calculateFlatLegendHeight(
  itemCount: number,
  availableWidth: number,
  config: LegendConfig,
  avgTextWidth: number = 90
): number {
  const { itemHeight, rowPadding, topPadding } = config
  const itemsPerRow = getLegendItemsPerRow(
    availableWidth,
    config,
    avgTextWidth,
    itemCount
  )
  const rows = Math.ceil(itemCount / itemsPerRow)
  return rows > 0 ? topPadding + rows * (itemHeight + rowPadding) : 0
}

/**
 * Calculate total height for a grouped legend (without computing full geometry).
 * Use this for layout calculations before actual rendering.
 */
export function calculateGroupedLegendHeight(
  groups: ReadonlyArray<{ itemCount: number }>,
  availableWidth: number,
  config: LegendConfig
): number {
  const {
    itemHeight,
    rowPadding,
    titleHeight,
    groupSpacing,
    groupTitleSpacing,
  } = config

  const maxItemsInGroup = groups.reduce(
    (max, g) => Math.max(max, g.itemCount),
    0
  )
  const itemsPerRow = getLegendItemsPerRow(
    availableWidth,
    config,
    90,
    maxItemsInGroup
  )
  let totalHeight = 0

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]
    if (group.itemCount === 0) continue

    // Add spacing before group (except first visible)
    if (totalHeight > 0) {
      totalHeight += groupSpacing
    }

    // Title + spacing + items
    const rows = Math.ceil(group.itemCount / itemsPerRow)
    totalHeight +=
      titleHeight + groupTitleSpacing + rows * (itemHeight + rowPadding)
  }

  return totalHeight
}

/**
 * Compute geometry for a flat (ungrouped) list of items.
 * This is optimized for AoiStreamPlot which has a simple list.
 *
 * Use with $derived.by() for memoization:
 *   const geometry = $derived.by(() =>
 *     computeFlatLegendGeometry(items, config, x, y, width)
 *   )
 */
export function computeFlatLegendGeometry(
  items: readonly LegendItem[],
  config: LegendConfig,
  startX: number,
  startY: number,
  availableWidth: number,
  itemsPerRowOverride?: number
): LegendGeometry {
  const {
    itemHeight,
    iconWidth,
    textPadding,
    itemSpacing,
    rowPadding,
    topPadding,
    fontSize,
    fontFamily,
  } = config

  // 1. Calculate max width needed by any item to ensure consistent column widths
  let maxTextWidth = 0
  for (let i = 0; i < items.length; i++) {
    const w = estimateTextWidth(items[i].name, fontSize, fontFamily)
    if (w > maxTextWidth) maxTextWidth = w
  }

  const uniformColumnWidth = Math.min(
    iconWidth + textPadding + maxTextWidth,
    250 // Cap width for readability
  )

  // 2. Determine items per row using the actual column width
  // We pass maxTextWidth as 'avgTextWidth' to ensure conservative fitting
  const effectiveItemsPerRow =
    itemsPerRowOverride ??
    getLegendItemsPerRow(availableWidth, config, maxTextWidth, items.length)

  const geometryItems: LegendItemGeometry[] = new Array(items.length)
  const legendY = startY + topPadding
  const totalRows = Math.ceil(items.length / effectiveItemsPerRow)

  // 3. Calculate dynamic row heights (Layout Pass 1)
  const rowHeights = new Float32Array(totalRows).fill(0)
  const itemIconHeights = new Float32Array(items.length)

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    // Determine icon height based on type
    let iconH = fontSize // Default fallback
    if (item.type === 'fixation' || item.type === 'eventPair') {
      iconH = itemHeight
    } else if (item.type === 'nonFixation') {
      iconH = config.nonFixationHeight
    }

    itemIconHeights[i] = iconH

    // Row height is max of icon and text height
    // Using fontSize as proxy for text height
    const effectiveH = Math.max(iconH, fontSize)

    // Determine row index (column-first filling)
    const row = i % totalRows
    if (effectiveH > rowHeights[row]) {
      rowHeights[row] = effectiveH
    }
  }

  // 4. Calculate Row Y positions (Layout Pass 2)
  const rowYPositions = new Float32Array(totalRows)
  let currentY = legendY
  for (let r = 0; r < totalRows; r++) {
    rowYPositions[r] = currentY
    currentY += rowHeights[r] + rowPadding
  }

  // 5. Place items (Layout Pass 3)
  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    // Calculate column and row for column-first ordering
    const col = Math.floor(i / totalRows)
    const row = i % totalRows

    // Left-aligned fixed-width columns
    const x = startX + col * (uniformColumnWidth + itemSpacing)
    const y = rowYPositions[row]

    geometryItems[i] = {
      identifier: item.identifier,
      name: item.name,
      color: item.color,
      height: itemIconHeights[i],
      x,
      y,
      width: uniformColumnWidth,
      type: item.type,
      rowHeight: rowHeights[row],
    }
  }

  const totalHeight = currentY - startY

  return {
    items: geometryItems,
    groupTitles: [],
    totalHeight,
    itemsPerRow: effectiveItemsPerRow,
  }
}

/**
 * Compute geometry for grouped legend items.
 * This is optimized for ScarfPlot which has multiple groups with titles.
 *
 * Use with $derived.by() for memoization:
 *   const geometry = $derived.by(() =>
 *     computeGroupedLegendGeometry(groups, config, x, y, width)
 *   )
 */
export function computeGroupedLegendGeometry(
  groups: readonly LegendGroup[],
  config: LegendConfig,
  startX: number,
  startY: number,
  availableWidth: number,
  itemsPerRowOverride?: number
): LegendGeometry {
  const {
    itemHeight,
    itemSpacing,
    rowPadding,
    titleHeight,
    groupSpacing,
    groupTitleSpacing,
    iconWidth,
    textPadding,
    fontSize,
    fontFamily,
  } = config

  // 1. Calculate max width needed by ANY item in ANY group
  let maxTextWidth = 0
  for (const group of groups) {
    for (const item of group.items) {
      const w = estimateTextWidth(item.name, fontSize, fontFamily)
      if (w > maxTextWidth) maxTextWidth = w
    }
  }

  const uniformColumnWidth = Math.min(
    iconWidth + textPadding + maxTextWidth,
    250 // Cap width
  )

  // 2. Determine items per row based on max items in any group AND actual width
  const maxItemsInGroup = groups.reduce(
    (max, g) => Math.max(max, g.items.length),
    0
  )
  const effectiveItemsPerRow =
    itemsPerRowOverride ??
    getLegendItemsPerRow(availableWidth, config, maxTextWidth, maxItemsInGroup)

  const geometryItems: LegendItemGeometry[] = []
  const groupTitles: LegendGroupTitleGeometry[] = []

  let currentY = startY

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]

    // Skip empty groups
    if (group.items.length === 0) continue

    // Add spacing before group (except first)
    if (g > 0 && groupTitles.length > 0) {
      currentY += groupSpacing
    }

    // Group title
    groupTitles.push({
      title: group.title,
      x: startX,
      y: currentY,
    })

    // Items start after title
    const itemsStartY = currentY + titleHeight + groupTitleSpacing

    // Calculate Rows
    const groupRows = Math.ceil(group.items.length / effectiveItemsPerRow)

    // 3. Calculate dynamic row heights (Layout Pass 1)
    const rowHeights = new Float32Array(groupRows).fill(0)
    // Store icon heights to avoid re-calculating in placement pass
    const groupItemIconHeights = new Float32Array(group.items.length)

    for (let i = 0; i < group.items.length; i++) {
      const item = group.items[i]

      // Determine icon height
      let iconH = fontSize // Default
      if (item.type === 'fixation' || item.type === 'eventPair') {
        iconH = itemHeight
      } else if (item.type === 'nonFixation') {
        iconH = config.nonFixationHeight
      }
      groupItemIconHeights[i] = iconH

      // Row height = max(icon, text)
      const effectiveH = Math.max(iconH, fontSize)

      const row = i % groupRows
      if (effectiveH > rowHeights[row]) {
        rowHeights[row] = effectiveH
      }
    }

    // 4. Calculate Row Y positions (Layout Pass 2)
    const rowYPositions = new Float32Array(groupRows)
    let groupY = itemsStartY
    for (let r = 0; r < groupRows; r++) {
      rowYPositions[r] = groupY
      groupY += rowHeights[r] + rowPadding
    }

    // 5. Place items (Layout Pass 3)
    for (let i = 0; i < group.items.length; i++) {
      const item = group.items[i]

      const col = Math.floor(i / groupRows)
      const row = i % groupRows

      const x = startX + col * (uniformColumnWidth + itemSpacing)
      const y = rowYPositions[row]

      geometryItems.push({
        identifier: item.identifier,
        name: item.name,
        color: item.color,
        height: groupItemIconHeights[i],
        x,
        y,
        width: uniformColumnWidth,
        type: item.type,
        groupTitle: group.title,
        rowHeight: rowHeights[row],
      })
    }

    // Update currentY to account for this group
    currentY = groupY
  }

  return {
    items: geometryItems,
    groupTitles,
    totalHeight: currentY - startY,
    itemsPerRow: effectiveItemsPerRow,
  }
}

// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================

/**
 * Draw legend icons and labels to a canvas context.
 *
 * @param ctx - Canvas 2D rendering context
 * @param geometry - Pre-computed geometry from computeFlatLegendGeometry or computeGroupedLegendGeometry
 * @param config - Legend configuration
 * @param highlightedIds - Set or array of identifiers that are highlighted (null = no highlighting)
 * @param dimmedOpacity - Opacity for non-highlighted items when highlighting is active (default: 0.15)
 */
export function drawLegend(
  ctx: CanvasRenderingContext2D,
  geometry: LegendGeometry,
  config: LegendConfig,
  highlightedIds: ReadonlySet<string> | readonly string[] | null = null
): void {
  const {
    itemHeight,
    iconWidth,
    textPadding,
    fontSize,
    fontFamily,
    fontColor,
    lineDash,
  } = config

  // Convert to Set for O(1) lookup if array provided
  const highlightSet =
    highlightedIds == null
      ? null
      : highlightedIds instanceof Set
        ? highlightedIds
        : new Set(highlightedIds)

  const isHighlightActive = highlightSet != null && highlightSet.size > 0

  // -------------------------------------------------------------------------
  // BATCH 1: Draw all icons
  // -------------------------------------------------------------------------
  for (let i = 0; i < geometry.items.length; i++) {
    const item = geometry.items[i]
    const isHighlighted = highlightSet?.has(item.identifier) ?? false
    // Opacity logic replaced by desaturation - always opaque
    const isDimmed = isHighlightActive && !isHighlighted

    if (item.type === 'fixation' || item.type === 'nonFixation') {
      const effectiveColor = isDimmed
        ? desaturateToWhite(item.color, 0.85)
        : item.color
      ctx.fillStyle = effectiveColor
      // Center the icon vertically in the item row
      const iconY = alignToPixelCenter(
        item.y + (item.rowHeight - item.height) / 2
      )
      ctx.fillRect(item.x, iconY, iconWidth, item.height)
    } else if (item.type === 'eventPair') {
      // Event pair icon (start and end markers side-by-side)
      // Radius ~4px to fit two 8px circles in 20px width
      const size = 9
      const radius = size / 2
      const innerRadius = 2
      const gap = 2

      const centerY = alignToPixelCenter(item.y + itemHeight / 2)
      // Center the pair in the iconWidth
      // Pair width = size * 2 + gap
      const pairWidth = size * 2 + gap
      const startX = item.x + (iconWidth - pairWidth) / 2 + radius
      const endX = startX + size + gap

      const OUTLINE_COLOR = '#333333'
      const OUTLINE_WIDTH = 1

      // Determine colors based on highlighting state
      // For events, we dehighlight by desaturating color to white (0.75) instead of using alpha
      // effectively keeping the marker opaque but pale.
      const isDimmed = isHighlightActive && !isHighlighted
      const effectiveColor = isDimmed
        ? desaturateToWhite(item.color, 0.85)
        : item.color
      const effectiveOutlineColor = isDimmed
        ? desaturateToWhite(OUTLINE_COLOR, 0.85)
        : OUTLINE_COLOR

      // 1. Start Marker (Left): Colored outer, white inner
      ctx.fillStyle = effectiveColor
      ctx.beginPath()
      ctx.arc(startX, centerY, radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(startX, centerY, innerRadius, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = effectiveOutlineColor
      ctx.lineWidth = OUTLINE_WIDTH
      ctx.beginPath()
      ctx.arc(startX, centerY, radius + 0.2, 0, Math.PI * 2)
      ctx.stroke()

      // 2. End Marker (Right): White outer, colored inner
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(endX, centerY, radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = effectiveColor
      ctx.beginPath()
      ctx.arc(endX, centerY, innerRadius, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = effectiveOutlineColor
      ctx.lineWidth = OUTLINE_WIDTH
      ctx.beginPath()
      ctx.arc(endX, centerY, radius + 0.2, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // -------------------------------------------------------------------------
  // BATCH 2: Draw all text labels
  // -------------------------------------------------------------------------
  ctx.font = `${fontSize}px ${fontFamily}`
  ctx.fillStyle = fontColor
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < geometry.items.length; i++) {
    const item = geometry.items[i]
    const isHighlighted = highlightSet?.has(item.identifier) ?? false
    // Opacity logic replaced by desaturation
    const isDimmed = isHighlightActive && !isHighlighted

    ctx.globalAlpha = 1.0

    const effectiveFontColor = isDimmed
      ? desaturateToWhite(fontColor, 0.85)
      : fontColor
    ctx.fillStyle = effectiveFontColor

    // Truncate text if needed
    const maxLabelWidth = item.width - iconWidth - textPadding
    const truncatedName = truncateTextToPixelWidth(
      item.name,
      maxLabelWidth,
      fontSize,
      fontFamily
    )

    const textX = item.x + iconWidth + textPadding
    const textY = alignToPixelCenter(item.y + item.rowHeight / 2)

    ctx.fillText(truncatedName, textX, textY)
  }

  // Reset alpha
  ctx.globalAlpha = 1.0
}

/**
 * Draw group titles (for grouped legends).
 *
 * @param ctx - Canvas 2D rendering context
 * @param geometry - Pre-computed geometry
 * @param config - Legend configuration
 */
export function drawLegendGroupTitles(
  ctx: CanvasRenderingContext2D,
  geometry: LegendGeometry,
  config: LegendConfig
): void {
  if (geometry.groupTitles.length === 0) return

  const { fontSize, fontFamily, fontColor } = config

  ctx.font = `600 ${fontSize}px ${fontFamily}` // Semi-bold
  ctx.fillStyle = fontColor
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  for (let i = 0; i < geometry.groupTitles.length; i++) {
    const group = geometry.groupTitles[i]
    ctx.fillText(group.title, group.x, alignToPixelCenter(group.y))
  }
}

// ============================================================================
// HIT TESTING FUNCTIONS
// ============================================================================

/**
 * Hit test to find which legend item is under the given coordinates.
 *
 * @param geometry - Pre-computed geometry
 * @param config - Legend configuration
 * @param mouseX - Mouse X coordinate (in canvas space)
 * @param mouseY - Mouse Y coordinate (in canvas space)
 * @param padding - Extra padding around items for easier clicking (default: 5)
 * @returns The legend item geometry under the cursor, or null if none
 */
export function hitTestLegend(
  geometry: LegendGeometry,
  config: LegendConfig,
  mouseX: number,
  mouseY: number,
  padding: number = 5
): LegendItemGeometry | null {
  const { itemHeight } = config

  for (let i = 0; i < geometry.items.length; i++) {
    const item = geometry.items[i]

    if (
      mouseX >= item.x - padding &&
      mouseX <= item.x + item.width + padding &&
      mouseY >= item.y - padding &&
      mouseY <= item.y + itemHeight + padding
    ) {
      return item
    }
  }

  return null
}

// ============================================================================
// TOOLTIP HELPERS
// ============================================================================

/**
 * Get tooltip position for a legend item.
 * Returns coordinates suitable for positioning a tooltip below the item.
 */
export function getLegendTooltipPosition(
  item: LegendItemGeometry,
  config: LegendConfig
): { x: number; y: number } {
  const { iconWidth, itemHeight } = config
  return {
    x: item.x + iconWidth * 1.5,
    y: item.y + itemHeight,
  }
}

/**
 * Generate tooltip content for hover state.
 */
export function getLegendTooltipContent(
  item: LegendItemGeometry,
  isHighlighted: boolean
): Array<{ key: string; value: string }> {
  return [
    {
      key: '',
      value: `${isHighlighted ? 'Dehighlight' : 'Highlight'} ${item.name}`,
    },
  ]
}
