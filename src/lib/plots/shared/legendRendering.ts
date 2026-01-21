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
  /** Height of the icon (for lines) or the rect */
  height?: number
  /** Icon type: 'rect' for filled rectangles, 'line' for dashed lines */
  type: 'rect' | 'line'
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
  type: 'rect' | 'line'
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
  groupTitleSpacing: 5,
  fontFamily: FONT_PRIMARY.FAMILY,
  fontSize: FONT_PRIMARY.SIZE,
  fontColor: FONT_PRIMARY.COLOR,
  topPadding: 0,
  lineDash: [2, 2] as const,
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
  groupTitleSpacing: 5,
  fontFamily: FONT_PRIMARY.FAMILY,
  fontSize: FONT_PRIMARY.SIZE,
  fontColor: FONT_PRIMARY.COLOR,
  topPadding: 5,
  lineDash: [2, 2] as const,
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

  // If no item count provided, return max (capped at 5 for readability)
  if (!itemCount || itemCount <= 0) return Math.min(5, maxItemsPerRow)

  // Smart calculation: find optimal number of columns for balanced layout
  // Cap at 5 columns max for better readability
  const cappedMax = Math.min(5, maxItemsPerRow)

  // If items fit in one row with cap, use exact count
  if (itemCount <= cappedMax) return itemCount

  // Otherwise, find column count that minimizes wasted space
  // Try different column counts and pick the one with most balanced rows
  let bestCols = cappedMax
  let bestScore = Infinity

  for (let cols = cappedMax; cols >= Math.min(3, itemCount); cols--) {
    const rows = Math.ceil(itemCount / cols)
    const itemsInLastRow = itemCount % cols || cols

    // Score: prefer layouts where last row is >= 50% full
    // Prefer fewer columns (more compact, easier to scan)
    const fillRatio = itemsInLastRow / cols
    const rowPenalty = rows > 4 ? (rows - 4) * 0.5 : 0
    const columnPenalty = cols > 4 ? (cols - 4) * 0.2 : 0 // Slightly penalize too many columns
    const score = 1 - fillRatio + rowPenalty + columnPenalty

    if (score < bestScore) {
      bestScore = score
      bestCols = cols
    }
  }

  return bestCols
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

  // 3. Column-first ordering with UNIFORM left-aligned columns
  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    // Calculate column and row for column-first ordering
    const col = Math.floor(i / totalRows)
    const row = i % totalRows

    // Left-aligned fixed-width columns
    const x = startX + col * (uniformColumnWidth + itemSpacing)
    const y = legendY + row * (itemHeight + rowPadding)

    geometryItems[i] = {
      identifier: item.identifier,
      name: item.name,
      color: item.color,
      height: item.height ?? itemHeight,
      x,
      y,
      width: uniformColumnWidth,
      type: item.type,
    }
  }

  const totalHeight =
    totalRows > 0 ? topPadding + totalRows * (itemHeight + rowPadding) : 0

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
    const groupRows = Math.ceil(group.items.length / effectiveItemsPerRow)

    // 3. Column-first ordering with UNIFORM left-aligned columns
    for (let i = 0; i < group.items.length; i++) {
      const item = group.items[i]

      const col = Math.floor(i / groupRows)
      const row = i % groupRows

      const x = startX + col * (uniformColumnWidth + itemSpacing)
      const y = itemsStartY + row * (itemHeight + rowPadding)

      geometryItems.push({
        identifier: item.identifier,
        name: item.name,
        color: item.color,
        height: item.height ?? itemHeight,
        x,
        y,
        width: uniformColumnWidth,
        type: item.type,
        groupTitle: group.title,
      })
    }

    // Update currentY to account for this group
    currentY = itemsStartY + groupRows * (itemHeight + rowPadding)
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
  highlightedIds: ReadonlySet<string> | readonly string[] | null = null,
  dimmedOpacity: number = 0.15
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
    const opacity = isHighlightActive && !isHighlighted ? dimmedOpacity : 1.0

    ctx.globalAlpha = opacity

    if (item.type === 'rect') {
      ctx.fillStyle = item.color
      // Center the icon vertically in the item row
      const iconY = item.y + (itemHeight - item.height) / 2
      ctx.fillRect(item.x, iconY, iconWidth, item.height)
    } else {
      // Line icon
      ctx.strokeStyle = item.color
      ctx.lineWidth = item.height
      ctx.setLineDash([...lineDash])

      const lineY = item.y + itemHeight / 2
      ctx.beginPath()
      ctx.moveTo(item.x, lineY)
      ctx.lineTo(item.x + iconWidth, lineY)
      ctx.stroke()

      ctx.setLineDash([])
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
    const opacity = isHighlightActive && !isHighlighted ? dimmedOpacity : 1.0

    ctx.globalAlpha = opacity
    ctx.fillStyle = fontColor

    // Truncate text if needed
    const maxLabelWidth = item.width - iconWidth - textPadding
    const truncatedName = truncateTextToPixelWidth(
      item.name,
      maxLabelWidth,
      fontSize,
      fontFamily
    )

    const textX = item.x + iconWidth + textPadding
    const textY = item.y + itemHeight / 2

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
    ctx.fillText(group.title, group.x, group.y)
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
