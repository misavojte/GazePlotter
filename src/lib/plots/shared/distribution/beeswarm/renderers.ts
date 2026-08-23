import {
  type AdaptiveTimeline,
  getTimelinePositionRatio,
} from '$lib/plots/shared'
import { alignToPixelCenter, strokeParallelLines } from '$lib/plots/shared/canvasUtils'
import type { CategoryDistribution, StatisticalOverlayType } from '../types'

// --- Layout types (this figure's resolved geometry) ---

export interface BeeswarmLayout {
  plotLeft: number
  plotTop: number
  plotWidth: number
  plotHeight: number
  orientation: 'horizontal' | 'vertical'
  timeline: AdaptiveTimeline
  items: CategorySlotLayout[]
}

export interface CategorySlotLayout {
  categoryCenter: number
  categoryWidth: number
  data: CategoryDistribution
}

// --- Constants ---

/**
 * ONE constant, and the rest follows from it. Every dot is this radius, for every
 * dataset and every row: the cell width below is derived from it, so a
 * data-dependent radius would make the density resolution move with the data and
 * the same AOI would be binned differently in two figures.
 *
 * 2px is the largest uniform size the thinnest row survives — at twelve rows in a
 * short tile the band holds 1.9 dot-widths at r=2 and only 1.4 at r=2.5.
 */
export const DOT_RADIUS = 2
/**
 * Minimum centre-to-centre distance between two dots. Exported so the figure's
 * fit guard can ask for its threshold in the mark's own units rather than in
 * magic pixels that drift away from it.
 */
export const DOT_PITCH = DOT_RADIUS * 2.2
/**
 * Cells along the value axis are one dot-width, so two values share a cell
 * exactly when their dots would otherwise overlap, which is the only reason to
 * stack them. It also settles the sparse case without a special rule: at fifteen
 * values a row's points sit far further apart than a dot, nothing collides, and
 * the honest rendering is a strip of dots at their own positions.
 */
const CELL_WIDTH = DOT_PITCH
/** Half-width of the boxcar used to smooth the per-cell counts, in cells. */
const DENSITY_SMOOTHING_CELLS = 1

// Visual styling
const DELIMITER_COLOR = '#e0e0e0'
/**
 * The summary is the same size in every row, clamped only where a row is too
 * short to hold it. Spanning the row instead made its weight, and how much of the
 * swarm it covered, track the layout rather than the data.
 */
const MARKER_HALF_EXTENT = 8
const MARKER_CAP_RATIO = 0.45
const MARKER_COLOR = '#1a1a1a'
const MARKER_WIDTH_MEDIAN = 3 // median (boxplot) and mean (meanCi / meanSd)
const MARKER_WIDTH_THIN = 1
/**
 * The dots draw at FULL opacity, and the marker gets no casing either. Both of
 * those were tried and both cost more than they bought.
 *
 * A white casing under each marker line separated it, but against half the palette
 * the rim out-contrasted the line it was serving, by up to 1.9x on violet, and a
 * rim louder than its own line reads as a sticker.
 *
 * Muting the dots instead lifted the marker to 4.37:1 at 80% opacity, but it also
 * shrank the dots: the soft edge ring of an anti-aliased circle sits near 30%
 * coverage, so any alpha below 1 pushes it under the visibility threshold and a
 * 2px-radius dot reads 3px wide instead of 5px. That is a cliff, not a dial.
 *
 * So the dots keep their true weight and the marker stands on its own contrast:
 * near-black measures 3.05:1 against the worst palette colour, which clears the
 * 3:1 that applies to a graphical object such as a line. If it needs more, the
 * next lever is the marker's SHAPE — a compact glyph reads over texture far better
 * than a hairline does — not the dots.
 */

// --- Helpers ---

export function valueToPixel(
  layout: BeeswarmLayout,
  value: number,
  clamp = true
): number {
  const ratio = getTimelinePositionRatio(layout.timeline, value, clamp)
  return layout.orientation === 'vertical'
    ? Math.floor(layout.plotTop + layout.plotHeight - ratio * layout.plotHeight)
    : Math.floor(layout.plotLeft + ratio * layout.plotWidth)
}

/**
 * Whether a value is inside the axis at all. `valueToPixel` CLAMPS, so anything
 * outside would otherwise be drawn hard against the border: a whisker cap pinned
 * there reads as "the interval ends exactly at the limit" rather than "it runs
 * past the view", and a mean line pinned there states a value the data does not
 * have. Stems are still drawn and simply cut by the clip, which correctly shows
 * the part that is in range.
 *
 * With the default scale this never fires, since the axis is derived from the data
 * maximum. It exists for a narrowed `scaleRange` or a synced axis.
 */
function isWithinAxis(layout: BeeswarmLayout, value: number): boolean {
  return value >= layout.timeline.minValue && value <= layout.timeline.maxValue
}

/** Where the value axis starts, in pixels. */
function valueAxisOrigin(layout: BeeswarmLayout): number {
  return layout.orientation === 'vertical' ? layout.plotTop : layout.plotLeft
}

// --- Density along the value axis ---

/**
 * Per-cell counts for one slot, plus the same counts smoothed over a cell either
 * side. The smoothing window is in SCREEN units, a display-resolution choice
 * rather than a bandwidth chosen from the data.
 */
export interface SlotDensity {
  counts: Map<number, number>
  smooth: Map<number, number>
  /** Largest smoothed cell count in this slot. */
  peak: number
}

function cellOf(layout: BeeswarmLayout, valuePx: number): number {
  return Math.floor((valuePx - valueAxisOrigin(layout)) / CELL_WIDTH)
}

export function computeSlotDensity(
  layout: BeeswarmLayout,
  values: readonly number[]
): SlotDensity {
  const counts = new Map<number, number>()
  for (let i = 0; i < values.length; i++) {
    const cell = cellOf(layout, valueToPixel(layout, values[i], true))
    counts.set(cell, (counts.get(cell) ?? 0) + 1)
  }
  const smooth = new Map<number, number>()
  let peak = 0
  counts.forEach((_, cell) => {
    let sum = 0
    let width = 0
    for (let d = -DENSITY_SMOOTHING_CELLS; d <= DENSITY_SMOOTHING_CELLS; d++) {
      sum += counts.get(cell + d) ?? 0
      width++
    }
    const mean = sum / width
    smooth.set(cell, mean)
    if (mean > peak) peak = mean
  })
  return { counts, smooth, peak }
}

/**
 * ONE reference for the whole figure, so rows are comparable in amount as well as
 * shape. Normalising each row to its own peak would let every row fill its band
 * and hide how much data each of them has, and this plot exists to compare rows.
 */
export function figureDensityPeak(densities: readonly SlotDensity[]): number {
  let peak = 0
  for (const d of densities) if (d.peak > peak) peak = d.peak
  return peak
}

/**
 * The slot a value takes inside its cell. NOT its rank along the value axis:
 * assigning slots in that order makes every cell a diagonal sweep, so a single
 * pixel column holds only a slice of the band and the rest stays white in
 * repeating streaks. A stride near the golden ratio, forced coprime with the
 * count so it still visits every slot exactly once, decorrelates the two.
 */
function slotStride(count: number): number | null {
  if (count < 3) return null
  let stride = Math.max(1, Math.round(count * 0.618_033_988_7))
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  while (gcd(stride, count) !== 1) stride++
  return stride % count || 1
}

export interface SwarmPoint {
  valuePos: number
  categoryPos: number
}

/**
 * EVERY value is placed. A cell's half-extent is the smaller of two things: the
 * width its density earns against the figure's reference peak, and what its
 * values need at one dot-pitch of spacing. So a sparse cell is a separated
 * beeswarm and a crowded one compresses to fill its density width, with no
 * threshold between the two.
 *
 * Points landing on an already-used pixel are dropped, which leaves the rendered
 * image identical: at half a million values in a row under 2% of them are at
 * distinct pixels, so honouring all of them costs nothing.
 */
export function computeSwarmPositions(
  layout: BeeswarmLayout,
  slot: CategorySlotLayout,
  density: SlotDensity,
  referencePeak: number
): SwarmPoint[] {
  const values = slot.data.individualValues
  if (!values || values.length === 0) return []

  const spread = slot.categoryWidth / 2 - DOT_RADIUS
  if (spread <= 0) return []

  // Group by cell, keeping every value's own position along the axis.
  const cells = new Map<number, number[]>()
  for (let i = 0; i < values.length; i++) {
    const px = valueToPixel(layout, values[i], true)
    const cell = cellOf(layout, px)
    const bucket = cells.get(cell)
    if (bucket) bucket.push(px)
    else cells.set(cell, [px])
  }

  const out: SwarmPoint[] = []
  const seen = new Set<number>()
  cells.forEach((positions, cell) => {
    positions.sort((a, b) => a - b)
    const count = positions.length
    const earned =
      spread * Math.min(1, (density.smooth.get(cell) ?? 0) / (referencePeak || 1))
    const spacing = count > 1 ? Math.min(DOT_PITCH, (2 * earned) / (count - 1)) : 0
    const extent = (spacing * (count - 1)) / 2
    const stride = slotStride(count)
    for (let k = 0; k < count; k++) {
      const index = stride === null ? k : (k * stride) % count
      const offset = count > 1 ? -extent + index * spacing : 0
      const categoryPos = slot.categoryCenter + offset
      // Cheap positional key: both coordinates are pixel-quantised already.
      const key = positions[k] * 8192 + Math.round(categoryPos)
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ valuePos: positions[k], categoryPos })
    }
  })
  return out
}

// --- Category delimiters (drawn before data) ---

export function drawCategoryDelimiters(
  ctx: CanvasRenderingContext2D,
  layout: BeeswarmLayout
): void {
  if (layout.items.length < 2) return

  const isVertical = layout.orientation === 'vertical'
  ctx.strokeStyle = DELIMITER_COLOR
  ctx.lineWidth = 1

  strokeParallelLines(
    ctx, !isVertical, layout.items.length - 1,
    i => {
      const current = layout.items[i]
      const next = layout.items[i + 1]
      return alignToPixelCenter((current.categoryCenter + current.categoryWidth / 2 +
        next.categoryCenter - next.categoryWidth / 2) / 2)
    },
    isVertical ? layout.plotTop : layout.plotLeft,
    isVertical ? layout.plotTop + layout.plotHeight : layout.plotLeft + layout.plotWidth
  )
}

// --- Proportional bars (primary layer for proportion metrics) ---

/**
 * Draws a filled bar from the value baseline to each slot's value. Used instead of
 * the swarm for proportion metrics (e.g. the noticed-rate `fixated`), where a
 * 0/1 dot cloud is meaningless. Values are already scaled to percent by the
 * transformer.
 *
 * Deliberately plain — NO error band. The per-slot value is a descriptive proportion
 * over the participant group (every bar shares the same n, so the bars are directly
 * comparable), and a confidence interval would import a sampling + homogeneous-exposure
 * assumption the data model does not guarantee (a participant never exposed to an ad is
 * still counted as a 0). If noticed-rate is later computed conditional on exposure and a
 * sampling inference is intended, a Wilson band can be reintroduced as a deliberate choice.
 */
export function drawProportionalBars(
  ctx: CanvasRenderingContext2D,
  layout: BeeswarmLayout
): void {
  const isVertical = layout.orientation === 'vertical'
  const basePx = valueToPixel(layout, 0)

  for (const item of layout.items) {
    const center = item.categoryCenter
    const halfWidth = item.categoryWidth / 2
    const valuePx = valueToPixel(layout, item.data.value)

    ctx.fillStyle = item.data.color
    if (isVertical) {
      const top = Math.min(valuePx, basePx)
      ctx.fillRect(center - halfWidth, top, halfWidth * 2, Math.abs(valuePx - basePx))
    } else {
      const left = Math.min(valuePx, basePx)
      ctx.fillRect(left, center - halfWidth, Math.abs(valuePx - basePx), halfWidth * 2)
    }
  }
}

// --- The swarm ---

/**
 * Every value in every slot, as one path per slot and one fill. The density pass
 * runs first for the whole figure so all rows share one reference peak.
 */
export function drawSwarmPoints(
  ctx: CanvasRenderingContext2D,
  layout: BeeswarmLayout
): void {
  const densities = layout.items.map(item =>
    computeSlotDensity(layout, item.data.individualValues ?? [])
  )
  const reference = figureDensityPeak(densities)
  const isVertical = layout.orientation === 'vertical'
  const TWO_PI = Math.PI * 2

  for (let i = 0; i < layout.items.length; i++) {
    const item = layout.items[i]
    const points = computeSwarmPositions(layout, item, densities[i], reference)
    if (points.length === 0) continue

    ctx.fillStyle = item.data.color
    // One path and one fill per slot: all the dots share a colour, and the
    // moveTo before each arc keeps a connecting chord from being drawn.
    ctx.beginPath()
    for (const point of points) {
      const cx = (isVertical ? point.categoryPos : point.valuePos) + 0.5
      const cy = (isVertical ? point.valuePos : point.categoryPos) + 0.5
      ctx.moveTo(cx + DOT_RADIUS, cy)
      ctx.arc(cx, cy, DOT_RADIUS, 0, TWO_PI)
    }
    ctx.fill()
  }
}

// --- Statistical overlays ---

/** One stroke, near-black. The dots are muted so it needs nothing under it. */
function inked(
  ctx: CanvasRenderingContext2D,
  lineWidth: number,
  path: () => void
): void {
  ctx.lineWidth = lineWidth
  ctx.strokeStyle = MARKER_COLOR
  ctx.beginPath()
  path()
  ctx.stroke()
}

/** A line across the category direction, at one position on the value axis. */
function crossLine(
  ctx: CanvasRenderingContext2D,
  layout: BeeswarmLayout,
  valuePx: number,
  center: number,
  halfExtent: number,
  lineWidth: number
): void {
  const v = alignToPixelCenter(valuePx)
  const lo = alignToPixelCenter(center - halfExtent)
  const hi = alignToPixelCenter(center + halfExtent)
  inked(ctx, lineWidth, () => {
    if (layout.orientation === 'vertical') {
      ctx.moveTo(lo, v)
      ctx.lineTo(hi, v)
    } else {
      ctx.moveTo(v, lo)
      ctx.lineTo(v, hi)
    }
  })
}

/** A line along the value axis, at the slot's centre. */
function valueLine(
  ctx: CanvasRenderingContext2D,
  layout: BeeswarmLayout,
  fromPx: number,
  toPx: number,
  center: number
): void {
  const c = alignToPixelCenter(center)
  const from = alignToPixelCenter(fromPx)
  const to = alignToPixelCenter(toPx)
  inked(ctx, MARKER_WIDTH_THIN, () => {
    if (layout.orientation === 'vertical') {
      ctx.moveTo(c, from)
      ctx.lineTo(c, to)
    } else {
      ctx.moveTo(from, c)
      ctx.lineTo(to, c)
    }
  })
}

/** The boxplot's box: closed, and unfilled so the dots inside stay visible. */
function boxOutline(
  ctx: CanvasRenderingContext2D,
  layout: BeeswarmLayout,
  fromPx: number,
  toPx: number,
  center: number,
  halfExtent: number
): void {
  const a = alignToPixelCenter(Math.min(fromPx, toPx))
  const b = alignToPixelCenter(Math.max(fromPx, toPx))
  const lo = alignToPixelCenter(center - halfExtent)
  const hi = alignToPixelCenter(center + halfExtent)
  const span = Math.max(1, b - a)
  inked(ctx, MARKER_WIDTH_THIN, () => {
    if (layout.orientation === 'vertical') {
      ctx.rect(lo, a, hi - lo, span)
    } else {
      ctx.rect(a, lo, span, hi - lo)
    }
  })
}

export function drawStatisticalOverlay(
  ctx: CanvasRenderingContext2D,
  layout: BeeswarmLayout,
  overlayType: StatisticalOverlayType
): void {
  if (overlayType === 'none') return

  for (const item of layout.items) {
    const stats = item.data.stats
    if (!stats || stats.count === 0) continue

    const center = item.categoryCenter
    const half = Math.min(MARKER_HALF_EXTENT, item.categoryWidth / 2)
    const capHalf = half * MARKER_CAP_RATIO

    if (overlayType === 'boxplot') {
      const medianPx = valueToPixel(layout, stats.median)
      if (stats.count === 1) {
        crossLine(ctx, layout, medianPx, center, half, MARKER_WIDTH_MEDIAN)
        continue
      }
      const q1 = valueToPixel(layout, stats.q1)
      const q3 = valueToPixel(layout, stats.q3)
      const whiskerLow = valueToPixel(layout, stats.whiskerLow)
      const whiskerHigh = valueToPixel(layout, stats.whiskerHigh)
      // Whiskers first, so the box sits over where they meet it.
      valueLine(ctx, layout, q1, whiskerLow, center)
      valueLine(ctx, layout, q3, whiskerHigh, center)
      if (isWithinAxis(layout, stats.whiskerLow)) {
        crossLine(ctx, layout, whiskerLow, center, capHalf, MARKER_WIDTH_THIN)
      }
      if (isWithinAxis(layout, stats.whiskerHigh)) {
        crossLine(ctx, layout, whiskerHigh, center, capHalf, MARKER_WIDTH_THIN)
      }
      boxOutline(ctx, layout, q1, q3, center, half)
      if (isWithinAxis(layout, stats.median)) {
        crossLine(ctx, layout, medianPx, center, half, MARKER_WIDTH_MEDIAN)
      }
    } else {
      const meanPx = valueToPixel(layout, stats.mean)
      const hasError = stats.count >= 2
      const error = hasError
        ? overlayType === 'meanSd'
          ? stats.sd
          : stats.sem * 1.96
        : 0
      if (hasError) {
        const lowPx = valueToPixel(layout, stats.mean - error)
        const highPx = valueToPixel(layout, stats.mean + error)
        valueLine(ctx, layout, lowPx, highPx, center)
        if (isWithinAxis(layout, stats.mean - error)) {
          crossLine(ctx, layout, lowPx, center, capHalf, MARKER_WIDTH_THIN)
        }
        if (isWithinAxis(layout, stats.mean + error)) {
          crossLine(ctx, layout, highPx, center, capHalf, MARKER_WIDTH_THIN)
        }
      }
      if (isWithinAxis(layout, stats.mean)) {
        crossLine(ctx, layout, meanPx, center, half, MARKER_WIDTH_MEDIAN)
      }
    }
  }
}
