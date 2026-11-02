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

import { FONT_PRIMARY, GRIDLINE_PRIMARY } from './const'
import {
  truncateTextToPixelWidth,
  estimateTextWidth,
} from '$lib/shared/textMeasure'
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

  /** 'fixation' a filled block, 'nonFixation' a centred thin bar, 'event' a thin bar under an outlined bar, as in the Scarf */
  type: 'fixation' | 'nonFixation' | 'event'
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
  type: LegendItem['type']
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

/** Shared legend configuration (scarf and aoi-stream draw the same key) */
export const LEGEND_CONFIG: LegendConfig = {
  // A swatch about the label's cap height reads as one unit with it: rows every 20 px.
  itemHeight: 12,
  iconWidth: 20,
  textPadding: 8,
  itemSpacing: 15,
  rowPadding: 8,
  // Proximity ladder: a title sits closer to its first row (16 px, top to top) than rows
  // to each other (20 px), and bands sit apart by twice the row gap (groupSpacing).
  titleHeight: 13,
  groupSpacing: 16,
  groupTitleSpacing: 3,
  fontFamily: FONT_PRIMARY.FAMILY,
  fontSize: FONT_PRIMARY.SIZE,
  fontColor: FONT_PRIMARY.COLOR,
  topPadding: 0,
  lineDash: [2, 2] as const,
  nonFixationHeight: 4,
}

// ============================================================================
// GEOMETRY COMPUTATION FUNCTIONS
// ============================================================================

/** A column starting this close to a swatch or label line above reads as nearly aligned. */
const ALMOST_ALIGNED_PX = 12

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
  items: readonly LegendItem[],
  availableWidth: number,
  config: LegendConfig
): number {
  const { itemHeight, rowPadding, topPadding } = config
  const itemsPerRow = getLegendItemsPerRow(
    availableWidth,
    config,
    maxLegendTextWidth(items, config),
    items.length
  )
  const rows = Math.ceil(items.length / itemsPerRow)
  return rows > 0 ? topPadding + rows * itemHeight + (rows - 1) * rowPadding : 0
}

/** Widest label across items, for the uniform column width */
function maxLegendTextWidth(
  items: readonly LegendItem[],
  config: LegendConfig
): number {
  return items.reduce(
    (max, item) =>
      Math.max(
        max,
        estimateTextWidth(item.name, config.fontSize, config.fontFamily)
      ),
    0
  )
}

/** Fixed column width shared by every item (capped for readability) */
function uniformLegendColumnWidth(
  maxTextWidth: number,
  config: LegendConfig
): number {
  return Math.ceil(Math.min(config.iconWidth + config.textPadding + maxTextWidth, 250))
}

/** Column lengths for `n` items in `columns` columns, column-major: differing by at most one, longer first. */
function balancedColumnCounts(n: number, columns: number): number[] {
  const base = Math.floor(n / columns)
  const extra = n % columns
  return Array.from({ length: columns }, (_, c) => base + (c < extra ? 1 : 0))
}

/**
 * Place items column-major into the given columns: the core shared by the flat
 * and grouped legends. Every row is max(icon, text) tall, so grids side by side
 * share baselines. `endY` includes the trailing rowPadding.
 */
function layoutLegendBlock(
  items: readonly LegendItem[],
  config: LegendConfig,
  columns: readonly { x: number; width: number; count: number }[],
  startY: number,
  groupTitle?: string
): { items: LegendItemGeometry[]; endY: number } {
  const { itemHeight, rowPadding, fontSize, nonFixationHeight } = config
  const rowHeight = Math.max(itemHeight, fontSize)
  const placed: LegendItemGeometry[] = []
  let i = 0
  for (const column of columns) {
    for (let row = 0; row < column.count; row++, i++) {
      const item = items[i]
      placed.push({
        identifier: item.identifier,
        name: item.name,
        color: item.color,
        height: item.type === 'fixation' ? itemHeight : nonFixationHeight,
        x: column.x,
        y: startY + row * (rowHeight + rowPadding),
        width: column.width,
        type: item.type,
        groupTitle,
        rowHeight,
      })
    }
  }
  const rows = Math.max(0, ...columns.map(c => c.count))
  return { items: placed, endY: startY + rows * (rowHeight + rowPadding) }
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
  const maxTextWidth = maxLegendTextWidth(items, config)
  const effectiveItemsPerRow =
    itemsPerRowOverride ??
    getLegendItemsPerRow(availableWidth, config, maxTextWidth, items.length)

  const rows = Math.max(1, Math.ceil(items.length / effectiveItemsPerRow))
  const width = uniformLegendColumnWidth(maxTextWidth, config)
  const columns = balancedColumnCounts(items.length, Math.ceil(items.length / rows)).map((count, c) => ({
    x: startX + c * (width + config.itemSpacing),
    width,
    count,
  }))
  const block = layoutLegendBlock(items, config, columns, startY + config.topPadding)

  return {
    items: block.items,
    groupTitles: [],
    totalHeight:
      block.endY - startY - (items.length > 0 ? config.rowPadding : 0),
    itemsPerRow: effectiveItemsPerRow,
  }
}

/**
 * Grouped legend (the Scarf's AOIs, categories, events), after Qin & Li (2014)
 * and Vega's "each" grid alignment. Each group is a titled block of balanced
 * column-major columns, each as wide as its widest label. Blocks sit side by
 * side and wrap into bands; every split is tried and `better` ranks them. A band
 * under another sits wholly on the column lines above or packs clear of them:
 * alignment is all or nothing.
 */
export function computeGroupedLegendGeometry(
  groups: readonly LegendGroup[],
  config: LegendConfig,
  startX: number,
  startY: number,
  availableWidth: number
): LegendGeometry {
  const { itemHeight, rowPadding, titleHeight, groupSpacing, groupTitleSpacing, itemSpacing, fontSize, fontFamily } = config
  const present = groups.filter(g => g.items.length > 0)
  if (present.length === 0) return { items: [], groupTitles: [], totalHeight: 0, itemsPerRow: 0 }

  // Whole pixels throughout, so swatch edges stay crisp.
  const x0 = Math.round(startX)
  const y0 = Math.round(startY)
  const limit = x0 + availableWidth
  const titleBand = titleHeight + groupTitleSpacing
  const rowStep = Math.max(itemHeight, fontSize) + rowPadding
  const groupGap = 2 * itemSpacing
  // A band may tighten its group gaps this far (still well over the column gap) rather than add a row.
  const minGroupGap = Math.round(1.6 * itemSpacing)
  // Titles render semi-bold: widen the regular-weight estimate a little.
  const titleWidth = (g: LegendGroup) => Math.ceil(estimateTextWidth(g.title, fontSize, fontFamily) * 1.08)

  type Column = { x: number; width: number; count: number }
  type Block = { group: LegendGroup; columns: Column[]; x: number; end: number }

  /** A group column-major in at most `rows` rows: balanced column lengths, each column its own width. */
  const shapeOf = (group: LegendGroup, rows: number) => {
    const counts = balancedColumnCounts(group.items.length, Math.ceil(group.items.length / rows))
    let first = 0
    const widths = counts.map(count =>
      uniformLegendColumnWidth(maxLegendTextWidth(group.items.slice(first, (first += count)), config), config)
    )
    return { counts, widths }
  }
  const blockOf = (group: LegendGroup, columns: Column[]): Block => {
    const last = columns[columns.length - 1]
    return { group, columns, x: columns[0].x, end: Math.max(last.x + last.width, columns[0].x + titleWidth(group)) }
  }
  /** Blocks left to right, a group gap apart (they may overflow; `fitted` settles that). */
  const packed = (band: readonly LegendGroup[], rows: number): Block[] => {
    const blocks: Block[] = []
    let x = x0
    for (const group of band) {
      const { counts, widths } = shapeOf(group, rows)
      let cx = blocks.length ? x + groupGap : x0
      const columns = counts.map((count, c) => {
        const column = { x: cx, width: widths[c], count }
        cx += widths[c] + itemSpacing
        return column
      })
      const block = blockOf(group, columns)
      blocks.push(block)
      x = block.end
    }
    return blocks
  }
  /** Every column on the next column line above, labels clear of the following line; null when impossible. */
  const onGrid = (band: readonly LegendGroup[], rows: number, lines: readonly number[]): Block[] | null => {
    const blocks: Block[] = []
    let next = 0
    for (const group of band) {
      const { counts, widths } = shapeOf(group, rows)
      const from = blocks.length ? blocks[blocks.length - 1].end + groupGap : x0
      while (next < lines.length && lines[next] < from) next++
      if (lines[next] !== from && !blocks.length) return null
      const columns: Column[] = []
      for (const [c, count] of counts.entries()) {
        const x = lines[next++]
        if (x === undefined) return null
        const following = lines[next]
        if (c < counts.length - 1 && following !== undefined && following < x + widths[c] + itemSpacing) return null
        columns.push({ x, width: widths[c], count })
      }
      blocks.push(blockOf(group, columns))
    }
    if (blocks[blocks.length - 1].end > limit) return null
    // Proximity before alignment: no gap inside a group stretched past 1.5 column gaps, and
    // none wider than a gap between groups, or the stretched group reads as two.
    const inner = Math.max(0, ...blocks.flatMap(b => b.columns.slice(1).map((c, i) => c.x - b.columns[i].x - b.columns[i].width)))
    if (inner > 1.5 * itemSpacing) return null
    return blocks.every((b, i) => i === 0 || b.x - blocks[i - 1].end >= inner) ? blocks : null
  }
  const shifted = (block: Block, by: number): Block => ({
    ...block,
    x: block.x + by,
    end: block.end + by,
    columns: block.columns.map(c => ({ ...c, x: c.x + by })),
  })
  /** Group gaps flex evenly: widen to end flush when less than a gap short, tighten to minGroupGap rather than overflow. */
  const fitted = (blocks: Block[]): Block[] | null => {
    const slack = limit - blocks[blocks.length - 1].end
    if (slack >= groupGap || (slack >= 0 && blocks.length < 2)) return blocks
    if (blocks.length < 2 || slack < -(groupGap - minGroupGap) * (blocks.length - 1)) return null
    return blocks.map((block, i) => shifted(block, Math.round((slack * i) / (blocks.length - 1))))
  }
  /** Column starts nearly on a swatch or label line above snap onto it or clear of it; later columns follow. */
  const settledOn = (blocks: Block[], lines: readonly number[]): Block[] | null => {
    const targets = [...new Set(lines.flatMap(l => [l, l + config.iconWidth + config.textPadding]))].sort((p, q) => p - q)
    // Onto a line just ahead, back onto one just behind when allowed (`earliest`), else clear of it.
    const settle = (x: number, earliest = x) => {
      const ahead = targets.find(t => t >= x)
      if (ahead !== undefined && ahead - x < ALMOST_ALIGNED_PX) return ahead
      const behind = targets.filter(t => t < x).pop()
      if (behind === undefined || x - behind >= ALMOST_ALIGNED_PX) return x
      return behind >= earliest ? behind : behind + ALMOST_ALIGNED_PX
    }
    const out: Block[] = []
    let end = x0
    for (const [i, block] of blocks.entries()) {
      const columns: Column[] = []
      // A group keeps its gap to the (possibly moved) group before it, then settles; it may step
      // back onto a line as long as its gap stays at least minGroupGap.
      let x = i === 0 ? x0 : settle(block.x + end - blocks[i - 1].end, end + minGroupGap)
      for (const [c, column] of block.columns.entries()) {
        if (c > 0) x = settle(x)
        columns.push({ ...column, x })
        x += column.width + itemSpacing
      }
      const settled = blockOf(block.group, columns)
      out.push(settled)
      end = settled.end
    }
    return end <= limit ? out : null
  }
  const rowsOf = (blocks: Block[]) => Math.max(...blocks.flatMap(b => b.columns.map(c => c.count)))

  /** Cells left empty in a band's rectangle: holes in short columns and the rows under shorter blocks. */
  const emptyOf = (blocks: Block[]) =>
    blocks.reduce((sum, b) => sum + b.columns.length * rowsOf(blocks) - b.group.items.length, 0)
  /** `clean`: no column nearly meets a line above anywhere in the plan. */
  type Plan = { height: number; empty: number; clean: boolean; bands: Block[][] }
  /** Clean first; heights within a row gap tie and fewer empty cells win; then lower, then fewer bands. */
  const better = (a: Plan, b: Plan) => {
    if (a.clean !== b.clean) return a.clean
    if (Math.abs(a.height - b.height) > rowPadding) return a.height < b.height
    if (a.empty !== b.empty) return a.empty < b.empty
    if (a.height !== b.height) return a.height < b.height
    return a.bands.length < b.bands.length
  }
  /** The best plan for the groups from `next` on, under the column lines `lines` of the bands above. */
  const plan = (next: number, lines: readonly number[]): Plan | null => {
    if (next === present.length) return { height: 0, empty: 0, clean: true, bands: [] }
    let best: Plan | null = null
    for (let k = present.length - next; k >= 1; k--) {
      const band = present.slice(next, next + k)
      const maxRows = Math.max(...band.map(g => g.items.length))
      let chosen: Block[] | null = null
      let clean = true
      // All on the grid above, or packed (justified when nearly full) with every column exactly on
      // a line above or clear of it. Only when no row count manages that does plain packing stand.
      for (const strict of lines.length ? [true, false] : [false]) {
        for (let rows = 1; rows <= maxRows && !chosen; rows++) {
          const grid = lines.length ? onGrid(band, rows, lines) : null
          const loose = grid ? null : fitted(packed(band, rows))
          const blocks = grid ?? (loose && (strict ? settledOn(loose, lines) : loose))
          if (blocks) chosen = blocks
        }
        if (chosen) break
        clean = false
      }
      if (!chosen) continue
      const below = [...new Set([...lines, ...chosen.flatMap(b => b.columns.map(c => c.x))])].sort((p, q) => p - q)
      const rest = plan(next + k, below)
      if (!rest) continue
      const candidate = {
        height: titleBand + rowsOf(chosen) * rowStep - rowPadding + (rest.bands.length ? groupSpacing + rest.height : 0),
        empty: emptyOf(chosen) + rest.empty,
        clean: clean && rest.clean,
        bands: [chosen, ...rest.bands],
      }
      if (!best || better(candidate, best)) best = candidate
    }
    return best
  }

  // A first group too wide for even one column still lays out, clipped.
  const head = present[0]
  const bands = plan(0, [])?.bands ?? [
    [blockOf(head, [{ x: x0, width: availableWidth, count: head.items.length }])],
  ]

  const items: LegendItemGeometry[] = []
  const groupTitles: LegendGroupTitleGeometry[] = []
  let y = y0
  for (const blocks of bands) {
    const itemsY = y + titleBand
    for (const b of blocks) {
      groupTitles.push({ title: b.group.title, x: b.x, y })
      items.push(...layoutLegendBlock(b.group.items, config, b.columns, itemsY, b.group.title).items)
    }
    y = itemsY + rowsOf(blocks) * rowStep - rowPadding + groupSpacing
  }

  return {
    items,
    groupTitles,
    totalHeight: y - groupSpacing - y0,
    itemsPerRow: bands[0][0].columns.length,
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
    iconWidth,
    itemHeight,
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

    const effectiveColor = isDimmed
      ? desaturateToWhite(item.color, 0.85)
      : item.color
    ctx.fillStyle = effectiveColor
    // Whole pixels: a filled swatch on a half pixel blurs its edges. Centred in the row.
    const x = Math.round(item.x)
    if (item.type === 'event') {
      // The strip hangs under a hairline of the bar it belongs to, as in the Scarf.
      const boxTop = Math.round(item.y + (item.rowHeight - itemHeight) / 2)
      const barHeight = itemHeight - item.height - 1
      ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, boxTop + 0.5, iconWidth - 1, barHeight - 1)
      ctx.fillRect(x, boxTop + barHeight + 1, iconWidth, item.height)
    } else {
      ctx.fillRect(x, Math.round(item.y + (item.rowHeight - item.height) / 2), iconWidth, item.height)
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

    ctx.font = `600 ${fontSize}px ${fontFamily}` // Semi-bold
    ctx.fillStyle = fontColor
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(group.title, group.x, labelY)
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
