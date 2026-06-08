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
import { alignToPixelCenter } from '$lib/plots/shared/canvasUtils'
import { desaturateToWhite } from '$lib/color'

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
  /** Gap between the inline title gutter and the item grid (grouped legends) */
  titleGutterGap: number
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
  titleGutterGap: 16,
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
  topPadding: 0,
  lineDash: [2, 2] as const,
  nonFixationHeight: 4,
  titleGutterGap: 16,
}

function drawDirectionalLegendCompositeMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  isStart: boolean,
  color: string | null
) {
  const r = radius * 0.85
  const offset = radius * 0.3
  const tipOffset = radius * 1.2

  ctx.beginPath()
  if (isStart) {
    const cx = x - offset
    const px = x + tipOffset

    ctx.arc(cx, y, r, Math.PI / 2, (3 * Math.PI) / 2, false)
    ctx.bezierCurveTo(cx + r * 0.8, y - r, px - r * 0.6, y - r * 0.15, px, y)
    ctx.bezierCurveTo(
      px - r * 0.6,
      y + r * 0.15,
      cx + r * 0.8,
      y + r,
      cx,
      y + r
    )
  } else {
    const cx = x + offset
    const px = x - tipOffset

    ctx.arc(cx, y, r, Math.PI / 2, -Math.PI / 2, true)
    ctx.bezierCurveTo(cx - r * 0.8, y - r, px + r * 0.6, y - r * 0.15, px, y)
    ctx.bezierCurveTo(
      px + r * 0.6,
      y + r * 0.15,
      cx - r * 0.8,
      y + r,
      cx,
      y + r
    )
  }
  ctx.closePath()

  if (color === null) {
    ctx.lineJoin = 'round'
    ctx.lineWidth = 5.5
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fill()
  } else {
    ctx.fillStyle = color
    ctx.fill()

    ctx.lineJoin = 'miter'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function getLegendEventOutlineColor(baseColor: string): string {
  return 'rgba(0, 0, 0, 0.4)'
}

// ============================================================================
// GEOMETRY COMPUTATION FUNCTIONS
// ============================================================================

/**
 * Max fraction of the legend width the inline title gutter may occupy before the
 * grouped legend falls back to the stacked (title-above) layout. Keeps the item
 * grid from being starved on narrow tiles.
 */
const MAX_GUTTER_FRACTION = 0.45

/**
 * Calculate optimal items per row for visually pleasing layout.
 * Uses smart calculation based on item count to avoid awkward layouts.
 *
 * @param itemCount - Total number of items to layout
 * @param availableWidth - Available width in pixels
 * @param config - Legend configuration
 * @param avgTextWidth - Average text width estimate
 */
function getLegendItemsPerRow(
  availableWidth: number,
  config: LegendConfig,
  avgTextWidth: number = 90,
  itemCount?: number
): number {
  if (availableWidth <= 0) return 1

  const { iconWidth, textPadding, itemSpacing } = config
  const itemFullWidth = iconWidth + textPadding + avgTextWidth + itemSpacing
  const maxItemsPerRow = Math.max(
    1,
    Math.floor((availableWidth + itemSpacing) / itemFullWidth)
  )

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
  return rows > 0 ? topPadding + rows * itemHeight + (rows - 1) * rowPadding : 0
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
  const maxTextWidth = items.reduce(
    (max, item) => Math.max(max, estimateTextWidth(item.name, fontSize, fontFamily)),
    0
  )

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

  const totalHeight = currentY - startY - (totalRows > 0 ? rowPadding : 0)

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
    titleGutterGap,
    fontSize,
    fontFamily,
  } = config

  // 1. Uniform item-column width = widest item label across ALL groups, so every
  //    column lines up into one regular grid (capped for readability).
  const maxTextWidth = groups.reduce(
    (max, g) =>
      Math.max(
        max,
        g.items.reduce(
          (m, item) => Math.max(m, estimateTextWidth(item.name, fontSize, fontFamily)),
          0
        )
      ),
    0
  )

  const uniformColumnWidth = Math.min(
    iconWidth + textPadding + maxTextWidth,
    250 // Cap width
  )

  // 2. Inline title gutter: group titles share a fixed-width left column (aligned in
  //    one vertical strip) and the item grid begins to their right, reclaiming the
  //    dedicated title lines of the stacked layout. Titles render at weight 600, so
  //    widen the measured width slightly. Falls back to the stacked title-above layout
  //    when the gutter would starve the item area on a narrow tile.
  const maxTitleWidth = groups.reduce(
    (max, g) =>
      g.items.length === 0
        ? max
        : Math.max(max, estimateTextWidth(g.title, fontSize, fontFamily)),
    0
  )
  const gutterWidth =
    maxTitleWidth > 0 ? Math.ceil(maxTitleWidth * 1.08) + titleGutterGap : 0
  const itemAreaWidth = availableWidth - gutterWidth
  const useInline =
    gutterWidth > 0 &&
    itemAreaWidth >= uniformColumnWidth &&
    gutterWidth <= availableWidth * MAX_GUTTER_FRACTION

  const itemsStartX = useInline ? startX + gutterWidth : startX
  const layoutWidth = useInline ? itemAreaWidth : availableWidth

  // 3. Column count: most items that fit the width, then (inline only) balanced to
  //    even out the rows of the largest group at that minimum row count — keeps the
  //    grid regular without adding height. One global count so columns align across
  //    groups.
  const maxItemsInGroup = groups.reduce(
    (max, g) => Math.max(max, g.items.length),
    0
  )
  const maxFit = getLegendItemsPerRow(
    layoutWidth,
    config,
    maxTextWidth,
    maxItemsInGroup
  )
  let effectiveItemsPerRow: number
  if (itemsPerRowOverride != null) {
    effectiveItemsPerRow = itemsPerRowOverride
  } else if (useInline && maxItemsInGroup > 0) {
    const rows = Math.ceil(maxItemsInGroup / maxFit)
    effectiveItemsPerRow = Math.max(1, Math.ceil(maxItemsInGroup / rows))
  } else {
    effectiveItemsPerRow = maxFit
  }

  const geometryItems: LegendItemGeometry[] = []
  const groupTitles: LegendGroupTitleGeometry[] = []

  let currentY = startY

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]

    // Skip empty groups
    if (group.items.length === 0) continue

    // Add spacing before group (except the first rendered one)
    if (groupTitles.length > 0) {
      currentY += groupSpacing
    }

    // Inline: items begin at the band top, the title is centered on the first row.
    // Stacked: the title takes its own line and items begin below it.
    const itemsStartY = useInline
      ? currentY
      : currentY + titleHeight + groupTitleSpacing

    // Calculate Rows
    const groupRows = Math.ceil(group.items.length / effectiveItemsPerRow)

    // Dynamic row heights (Layout Pass 1)
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

    // Row Y positions (Layout Pass 2)
    const rowYPositions = new Float32Array(groupRows)
    let groupY = itemsStartY
    for (let r = 0; r < groupRows; r++) {
      rowYPositions[r] = groupY
      groupY += rowHeights[r] + rowPadding
    }

    // Group title geometry
    if (useInline) {
      // Vertically center the title on the first item row (drawn with baseline 'top').
      groupTitles.push({
        title: group.title,
        x: startX,
        y: rowYPositions[0] + (rowHeights[0] - fontSize) / 2,
      })
    } else {
      groupTitles.push({
        title: group.title,
        x: startX,
        y: currentY,
      })
    }

    // Place items (Layout Pass 3)
    for (let i = 0; i < group.items.length; i++) {
      const item = group.items[i]

      const col = Math.floor(i / groupRows)
      const row = i % groupRows

      const x = itemsStartX + col * (uniformColumnWidth + itemSpacing)
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
    totalHeight: currentY - startY - (groups.length > 0 ? rowPadding : 0),
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
      // Simple circle for events
      const radius = 5
      const centerY = alignToPixelCenter(item.y + itemHeight / 2)
      const centerX = alignToPixelCenter(item.x + iconWidth / 2)

      const isDimmed = isHighlightActive && !isHighlighted
      const effectiveColor = isDimmed
        ? desaturateToWhite(item.color, 0.85)
        : item.color

      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
      ctx.closePath()
      ctx.fillStyle = effectiveColor
      ctx.fill()
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

  for (let i = 0; i < geometry.groupTitles.length; i++) {
    const group = geometry.groupTitles[i]
    const labelY = alignToPixelCenter(group.y)

    if (group.title === 'Events') {
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'

      const baseX = group.x

      // Main "Events" text
      ctx.font = `600 ${fontSize}px ${fontFamily}`
      ctx.fillStyle = fontColor
      ctx.fillText('Events', baseX, labelY)
      let currentX = baseX + ctx.measureText('Events').width + 6

      // Secondary styling
      ctx.font = `400 ${fontSize - 1}px ${fontFamily}`
      ctx.fillStyle = fontColor
      ctx.textBaseline = 'middle'
      const midY = labelY + fontSize / 2

      ctx.fillText('(', currentX, midY)
      currentX += ctx.measureText('(').width + 4

      // Start Marker
      drawDirectionalLegendCompositeMarker(
        ctx,
        currentX + 4.5,
        midY,
        4.5,
        true,
        '#aaa'
      )
      currentX += 9 + 4
      ctx.fillText('start /', currentX, midY)
      currentX += ctx.measureText('start /').width + 6

      // End Marker
      drawDirectionalLegendCompositeMarker(
        ctx,
        currentX + 4.5,
        midY,
        4.5,
        false,
        '#aaa'
      )
      currentX += 9 + 4
      ctx.fillText('end /', currentX, midY)
      currentX += ctx.measureText('end /').width + 6

      // Circle Marker
      ctx.beginPath()
      ctx.arc(currentX + 4, midY, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#aaa'
      ctx.fill()
      ctx.strokeStyle = '#666'
      ctx.lineWidth = 1
      ctx.stroke()
      currentX += 8 + 4

      ctx.fillText('generalised )', currentX, midY)
    } else {
      ctx.font = `600 ${fontSize}px ${fontFamily}` // Semi-bold
      ctx.fillStyle = fontColor
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(group.title, group.x, labelY)
    }
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
