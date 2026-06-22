import {
  type AdaptiveTimeline,
  getTimelinePositionRatio,
} from '$lib/plots/shared'
import { alignToPixelCenter } from '$lib/plots/shared/canvasUtils'
import type { BarPlotDataItem, StatisticalOverlayType } from '../types'

// --- Shared layout types ---

export interface BarPlotLayout {
  plotLeft: number
  plotTop: number
  plotWidth: number
  plotHeight: number
  barPlottingType: 'horizontal' | 'vertical'
  timeline: AdaptiveTimeline
  items: BarLayoutItem[]
}

export interface BarLayoutItem {
  categoryCenter: number
  categoryWidth: number
  data: BarPlotDataItem
}

// --- Constants ---

// Beeswarm dot sizing
const DOT_RADIUS_MAX = 5
const DOT_RADIUS_MIN = 1.5
const DENSITY_BIN_SIZE = 20 // px — bin width for measuring local density along value axis

// Visual styling
const DELIMITER_COLOR = '#e0e0e0'
const BG_FILL_COLOR = '#f5f5f5'
const BG_OUTER_COLOR = '#ffffff' // plot-area background outside any stat fill
const MARKER_WIDTH_MEDIAN = 3 // used for median (boxplot) and mean (meanCi/meanSd)
const MARKER_WIDTH_THIN = 1
const CAP_WIDTH_RATIO = 0.3 // whisker/error cap width as fraction of category width

// Overlay marker color — shades of gray lerped by category width.
// Narrow categories leave cross-lines short and the markers harder to pick out
// against the dots, so we darken them adaptively. Base (wide) is a small step
// darker than GRIDLINE_PRIMARY; narrow taps out near mid-gray.
const MARKER_COLOR_WIDE = 0xa0 // bars ≥ MARKER_WIDTH_WIDE px wide → #a0a0a0
const MARKER_COLOR_NARROW = 0x55 // bars ≤ MARKER_WIDTH_NARROW px wide → #555555
const MARKER_WIDTH_NARROW = 20
const MARKER_WIDTH_WIDE = 80

// --- Helpers ---

export function valueToPixel(
  layout: BarPlotLayout,
  value: number,
  clamp = true
): number {
  const ratio = getTimelinePositionRatio(layout.timeline, value, clamp)
  return layout.barPlottingType === 'vertical'
    ? Math.floor(layout.plotTop + layout.plotHeight - ratio * layout.plotHeight)
    : Math.floor(layout.plotLeft + ratio * layout.plotWidth)
}

// --- Adaptive dot sizing ---

/**
 * Computes dot radius based on the densest cluster across all AOIs.
 * Shrinks dots when too many overlap in a small region. Dots are always
 * drawn at full opacity — overlap is accepted as a visual tradeoff.
 */
export function computeDotStyle(layout: BarPlotLayout): { radius: number } {
  const categoryWidth = layout.items.length > 0 ? layout.items[0].categoryWidth : 100

  // Find the highest dot count within any single density bin across all AOIs
  let peakDensity = 0

  for (const item of layout.items) {
    const values = item.data.individualValues
    if (!values || values.length === 0) continue

    // Map values to pixel positions
    const positions = values.map(v => valueToPixel(layout, v, true))

    // Bin positions into windows to measure local density. Reduce in explicit
    // loops, never `Math.min(...positions)` / `Math.max(peakDensity, ...bins)`:
    // a metric whose individuals are per-fixation (e.g. fixation duration) can
    // produce hundreds of thousands of values, and spreading that many
    // arguments overflows the call stack ("Maximum call stack size exceeded").
    if (positions.length === 0) continue
    let minPos = positions[0]
    let maxPos = positions[0]
    for (let i = 1; i < positions.length; i++) {
      const p = positions[i]
      if (p < minPos) minPos = p
      else if (p > maxPos) maxPos = p
    }
    const range = maxPos - minPos

    if (range < 1) {
      // All values at same position
      if (positions.length > peakDensity) peakDensity = positions.length
      continue
    }

    const numBins = Math.max(1, Math.ceil(range / DENSITY_BIN_SIZE))
    const bins = new Array(numBins).fill(0)
    for (const p of positions) {
      const bin = Math.min(numBins - 1, Math.floor((p - minPos) / DENSITY_BIN_SIZE))
      bins[bin]++
    }
    for (let b = 0; b < numBins; b++) {
      if (bins[b] > peakDensity) peakDensity = bins[b]
    }
  }

  if (peakDensity === 0) return { radius: DOT_RADIUS_MAX }

  // Determine largest radius where dots fit in the densest region
  // maxAcross = how many dots fit side-by-side in the category width
  // rowsPerBin = how many value-axis rows fit in one density bin
  let radius = DOT_RADIUS_MAX
  while (radius > DOT_RADIUS_MIN) {
    const maxAcross = Math.floor(categoryWidth / (radius * 2.2))
    const rowsPerBin = Math.max(1, Math.floor(DENSITY_BIN_SIZE / (radius * 2)))
    const capacity = maxAcross * rowsPerBin
    if (peakDensity <= capacity) break
    radius -= 0.5
  }
  radius = Math.max(DOT_RADIUS_MIN, radius)

  return { radius }
}

// --- Overlay backgrounds (light fill behind data to show stat region extent) ---

export function drawOverlayBackgrounds(
  ctx: CanvasRenderingContext2D,
  layout: BarPlotLayout,
  overlayType: StatisticalOverlayType
): void {
  if (overlayType === 'none') return

  const isVertical = layout.barPlottingType === 'vertical'
  const basePx = valueToPixel(layout, 0)
  ctx.fillStyle = BG_FILL_COLOR

  for (const item of layout.items) {
    const stats = item.data.stats
    if (!stats || stats.count === 0) continue

    const center = item.categoryCenter
    const halfWidth = item.categoryWidth / 2

    if (overlayType === 'boxplot') {
      if (stats.count < 2) continue
      const q1Px = valueToPixel(layout, stats.q1)
      const q3Px = valueToPixel(layout, stats.q3)
      const top = Math.min(q1Px, q3Px)
      const boxSize = Math.abs(q3Px - q1Px)

      if (isVertical) {
        ctx.fillRect(center - halfWidth, top, halfWidth * 2, boxSize)
      } else {
        ctx.fillRect(top, center - halfWidth, boxSize, halfWidth * 2)
      }
    } else {
      // meanCi95 / meanSd — fill from baseline to mean
      const meanPx = valueToPixel(layout, stats.mean)
      const top = Math.min(meanPx, basePx)
      const size = Math.abs(meanPx - basePx)

      if (isVertical) {
        ctx.fillRect(center - halfWidth, top, halfWidth * 2, size)
      } else {
        ctx.fillRect(top, center - halfWidth, size, halfWidth * 2)
      }
    }
  }
}

// --- Category delimiters (drawn before data) ---

export function drawCategoryDelimiters(
  ctx: CanvasRenderingContext2D,
  layout: BarPlotLayout
): void {
  if (layout.items.length < 2) return

  const isVertical = layout.barPlottingType === 'vertical'
  ctx.strokeStyle = DELIMITER_COLOR
  ctx.lineWidth = 1

  for (let i = 0; i < layout.items.length - 1; i++) {
    const current = layout.items[i]
    const next = layout.items[i + 1]
    const boundary = (current.categoryCenter + current.categoryWidth / 2 +
      next.categoryCenter - next.categoryWidth / 2) / 2
    const pos = alignToPixelCenter(boundary)

    ctx.beginPath()
    if (isVertical) {
      ctx.moveTo(pos, layout.plotTop)
      ctx.lineTo(pos, layout.plotTop + layout.plotHeight)
    } else {
      ctx.moveTo(layout.plotLeft, pos)
      ctx.lineTo(layout.plotLeft + layout.plotWidth, pos)
    }
    ctx.stroke()
  }
}

// --- Proportional bars (primary layer for proportion metrics) ---

/**
 * Draws a filled bar from the value baseline to each AOI's value. Used instead of
 * the beeswarm for proportion metrics (e.g. the noticed-rate `fixated`), where a
 * 0/1 dot cloud is meaningless. Values are already scaled to percent by the
 * transformer.
 *
 * Deliberately plain — NO error band. The per-AOI value is a descriptive proportion
 * over the participant group (every bar shares the same n, so the bars are directly
 * comparable), and a confidence interval would import a sampling + homogeneous-exposure
 * assumption the data model does not guarantee (a participant never exposed to an ad is
 * still counted as a 0). If noticed-rate is later computed conditional on exposure and a
 * sampling inference is intended, a Wilson band can be reintroduced as a deliberate choice.
 */
export function drawProportionalBars(
  ctx: CanvasRenderingContext2D,
  layout: BarPlotLayout
): void {
  const isVertical = layout.barPlottingType === 'vertical'
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

// --- Beeswarm (primary layer) ---

export function drawBeeswarmPoints(
  ctx: CanvasRenderingContext2D,
  layout: BarPlotLayout
): void {
  const isVertical = layout.barPlottingType === 'vertical'
  const { radius } = computeDotStyle(layout)

  for (const item of layout.items) {
    const values = item.data.individualValues
    if (!values || values.length === 0) continue

    const positions = computeBeeswarmPositions(
      values,
      v => valueToPixel(layout, v, true),
      item.categoryCenter,
      item.categoryWidth / 2 - radius,
      radius
    )

    ctx.fillStyle = item.data.color

    // Arc centers are shifted by +0.5 so each dot sits on the center of its
    // value pixel rather than on the pixel corner. This keeps the beeswarm
    // optically aligned with the overlay markers, which use alignToPixelCenter
    // (integer + 0.5) so their strokes land crisply on the same pixel row.
    for (const pos of positions) {
      ctx.beginPath()
      if (isVertical) {
        ctx.arc(pos.categoryPos + 0.5, pos.valuePos + 0.5, radius, 0, Math.PI * 2)
      } else {
        ctx.arc(pos.valuePos + 0.5, pos.categoryPos + 0.5, radius, 0, Math.PI * 2)
      }
      ctx.fill()
    }
  }
}

// --- Statistical overlays ---
// Drawn over the beeswarm. Each marker line gets 1px background "halos" on
// each side to isolate it from the dots behind — gray on the side that lies
// inside a stat fill region, white on the side that lies outside. This gives
// the overlay the appearance of sitting in a clean background strip while the
// rest of the dots remain fully opaque.

export function drawStatisticalOverlay(
  ctx: CanvasRenderingContext2D,
  layout: BarPlotLayout,
  overlayType: StatisticalOverlayType
): void {
  if (overlayType === 'none') return

  switch (overlayType) {
    case 'meanCi95':
      drawIndicatorOverlay(ctx, layout, 'ci95')
      break
    case 'meanSd':
      drawIndicatorOverlay(ctx, layout, 'sd')
      break
    case 'boxplot':
      drawBoxplotOverlay(ctx, layout)
      break
  }
}

function drawIndicatorOverlay(
  ctx: CanvasRenderingContext2D,
  layout: BarPlotLayout,
  errorType: 'sd' | 'ci95'
): void {
  const isVertical = layout.barPlottingType === 'vertical'
  const basePx = valueToPixel(layout, 0)
  const markerColor = computeMarkerColor(layout)

  for (const item of layout.items) {
    const stats = item.data.stats
    if (!stats || stats.count === 0) continue

    const center = item.categoryCenter
    const halfWidth = item.categoryWidth / 2
    const capHalfWidth = halfWidth * CAP_WIDTH_RATIO
    const meanPx = valueToPixel(layout, stats.mean)

    const hasError = stats.count >= 2
    const error = hasError ? (errorType === 'sd' ? stats.sd : stats.sem * 1.96) : 0
    const lowPx = hasError ? valueToPixel(layout, stats.mean - error) : meanPx
    const highPx = hasError ? valueToPixel(layout, stats.mean + error) : meanPx

    // Fill region is the shaded stripe from baseline to mean.
    const fillRange = fillRangeFromBounds(meanPx, basePx)

    // Error bar (caps + continuous stem through mean), drawn first so the
    // mean line can sit on top of the stem.
    if (hasError) {
      drawCrossLineWithHalo(ctx, isVertical, lowPx, center, capHalfWidth, MARKER_WIDTH_THIN, fillRange, markerColor)
      drawCrossLineWithHalo(ctx, isVertical, highPx, center, capHalfWidth, MARKER_WIDTH_THIN, fillRange, markerColor)
      drawValueLineWithHalo(ctx, isVertical, lowPx, highPx, center, fillRange, markerColor)
    }

    // Mean line — 3px across the full category, matching the visual weight
    // of the median line in the boxplot overlay.
    drawCrossLineWithHalo(ctx, isVertical, meanPx, center, halfWidth, MARKER_WIDTH_MEDIAN, fillRange, markerColor)
  }
}

function drawBoxplotOverlay(
  ctx: CanvasRenderingContext2D,
  layout: BarPlotLayout
): void {
  const isVertical = layout.barPlottingType === 'vertical'
  const markerColor = computeMarkerColor(layout)

  for (const item of layout.items) {
    const stats = item.data.stats
    if (!stats || stats.count === 0) continue

    const center = item.categoryCenter
    const halfWidth = item.categoryWidth / 2
    const capHalfWidth = halfWidth * CAP_WIDTH_RATIO

    if (stats.count === 1) {
      drawCrossLineWithHalo(
        ctx, isVertical, valueToPixel(layout, stats.median),
        center, halfWidth, MARKER_WIDTH_MEDIAN, null, markerColor
      )
      continue
    }

    const medianPx = valueToPixel(layout, stats.median)
    const q1Px = valueToPixel(layout, stats.q1)
    const q3Px = valueToPixel(layout, stats.q3)
    const whiskerLowPx = valueToPixel(layout, stats.whiskerLow)
    const whiskerHighPx = valueToPixel(layout, stats.whiskerHigh)

    const fillRange = fillRangeFromBounds(q1Px, q3Px)

    // Q1, Q3 edges of the box — at the fill boundary (gray inside, white outside)
    drawCrossLineWithHalo(ctx, isVertical, q1Px, center, halfWidth, MARKER_WIDTH_THIN, fillRange, markerColor)
    drawCrossLineWithHalo(ctx, isVertical, q3Px, center, halfWidth, MARKER_WIDTH_THIN, fillRange, markerColor)

    // Whisker stems — outside the box
    drawValueLineWithHalo(ctx, isVertical, q1Px, whiskerLowPx, center, fillRange, markerColor)
    drawValueLineWithHalo(ctx, isVertical, q3Px, whiskerHighPx, center, fillRange, markerColor)

    // Whisker caps — outside the box
    drawCrossLineWithHalo(ctx, isVertical, whiskerLowPx, center, capHalfWidth, MARKER_WIDTH_THIN, fillRange, markerColor)
    drawCrossLineWithHalo(ctx, isVertical, whiskerHighPx, center, capHalfWidth, MARKER_WIDTH_THIN, fillRange, markerColor)

    // Median — inside the box, drawn last so it sits on top
    drawCrossLineWithHalo(ctx, isVertical, medianPx, center, halfWidth, MARKER_WIDTH_MEDIAN, fillRange, markerColor)
  }
}

// --- Beeswarm layout ---

/**
 * Computes deterministic beeswarm positions to avoid dot overlap.
 * Dots are binned by value position (bin width = minimum inter-dot
 * distance); each bin is laid out as a single row centered on the category
 * axis (offset = (i − (n−1)/2) × spacing). Spacing tightens when a bin's row
 * would exceed maxCategorySpread, and positions are clamped to it so dots stay
 * within the AOI strip. Caps at 200 sampled points per AOI for performance.
 */
export function computeBeeswarmPositions(
  values: number[],
  valueFn: (v: number) => number,
  categoryCenter: number,
  maxCategorySpread: number,
  dotRadius: number
): Array<{ valuePos: number; categoryPos: number }> {
  if (values.length === 0) return []

  // Cap at 200 points per AOI to maintain performance
  const MAX_POINTS = 200
  let workingValues = values
  if (values.length > MAX_POINTS) {
    const step = values.length / MAX_POINTS
    workingValues = []
    for (let i = 0; i < MAX_POINTS; i++) {
      workingValues.push(values[Math.floor(i * step)])
    }
  }

  const minDist = dotRadius * 2.2
  const loBound = categoryCenter - maxCategorySpread
  const hiBound = categoryCenter + maxCategorySpread
  const available = hiBound - loBound

  // Map values to pixel positions
  const vps = workingValues.map(v => valueFn(v))

  // Bin dots by value position (bin width = minDist).
  // Dots sharing a bin get a centered row; dots in different bins are
  // far enough apart in value to safely share category positions.
  const bins = new Map<number, number[]>()
  for (let i = 0; i < vps.length; i++) {
    const key = Math.floor(vps[i] / minDist)
    if (!bins.has(key)) bins.set(key, [])
    bins.get(key)!.push(i)
  }

  // Place each bin as a centered row: center + (i − (n−1)/2) × spacing
  const result: Array<{ valuePos: number; categoryPos: number }> = new Array(vps.length)

  for (const indices of bins.values()) {
    indices.sort((a, b) => vps[a] - vps[b])
    const n = indices.length
    const spacing = n > 1 && (n - 1) * minDist > available
      ? available / (n - 1)
      : minDist

    for (let i = 0; i < n; i++) {
      const offset = (i - (n - 1) / 2) * spacing
      const idx = indices[i]
      result[idx] = {
        valuePos: vps[idx],
        categoryPos: Math.max(loBound, Math.min(hiBound, categoryCenter + offset)),
      }
    }
  }

  return result
}

// --- Drawing primitives (halo-aware) ---

type FillRange = { lo: number; hi: number } | null

/** Builds a fill pixel range from two bounding pixels; null when bounds coincide. */
function fillRangeFromBounds(a: number, b: number): FillRange {
  if (a === b) return null
  return { lo: Math.min(a, b), hi: Math.max(a, b) }
}

/** Halo color for a given pixel position — gray inside fill, white outside. */
function haloColorAt(pxPos: number, fillRange: FillRange): string {
  return fillRange && pxPos >= fillRange.lo && pxPos <= fillRange.hi
    ? BG_FILL_COLOR
    : BG_OUTER_COLOR
}

/**
 * Picks an overlay marker gray by category width: darker when bars are narrow
 * (short cross-lines need more contrast to read) and lighter when bars are
 * wide (long lines read fine even in light gray).
 */
function computeMarkerColor(layout: BarPlotLayout): string {
  const categoryWidth = layout.items.length > 0 ? layout.items[0].categoryWidth : MARKER_WIDTH_WIDE
  const t = Math.max(0, Math.min(1,
    (categoryWidth - MARKER_WIDTH_NARROW) / (MARKER_WIDTH_WIDE - MARKER_WIDTH_NARROW)
  ))
  const L = Math.round(MARKER_COLOR_NARROW + t * (MARKER_COLOR_WIDE - MARKER_COLOR_NARROW))
  const hex = L.toString(16).padStart(2, '0')
  return `#${hex}${hex}${hex}`
}

/** Strokes a cross-line (perpendicular to value axis) at an already-aligned pixel position. */
function strokeCrossAt(
  ctx: CanvasRenderingContext2D,
  isVertical: boolean,
  vAligned: number,
  categoryCenter: number,
  halfExtent: number
): void {
  ctx.beginPath()
  if (isVertical) {
    ctx.moveTo(categoryCenter - halfExtent, vAligned)
    ctx.lineTo(categoryCenter + halfExtent, vAligned)
  } else {
    ctx.moveTo(vAligned, categoryCenter - halfExtent)
    ctx.lineTo(vAligned, categoryCenter + halfExtent)
  }
  ctx.stroke()
}

/** Strokes a value-line (along value axis) at an already-aligned category position. */
function strokeValueAt(
  ctx: CanvasRenderingContext2D,
  isVertical: boolean,
  fromAligned: number,
  toAligned: number,
  categoryAligned: number
): void {
  ctx.beginPath()
  if (isVertical) {
    ctx.moveTo(categoryAligned, fromAligned)
    ctx.lineTo(categoryAligned, toAligned)
  } else {
    ctx.moveTo(fromAligned, categoryAligned)
    ctx.lineTo(toAligned, categoryAligned)
  }
  ctx.stroke()
}

/**
 * Draws a cross-line with 1px halos on each side. Halo colors are picked per
 * side by sampling the fill range at the halo pixel position.
 */
function drawCrossLineWithHalo(
  ctx: CanvasRenderingContext2D,
  isVertical: boolean,
  valuePx: number,
  categoryCenter: number,
  halfExtent: number,
  lineWidth: number,
  fillRange: FillRange,
  markerColor: string
): void {
  const v = alignToPixelCenter(valuePx)
  // Halo offset is integer (preserves .5 pixel-center alignment for 1px & 3px lines).
  const haloOffset = (lineWidth + 1) / 2
  const loPx = v - haloOffset
  const hiPx = v + haloOffset

  ctx.lineWidth = 1
  ctx.strokeStyle = haloColorAt(loPx, fillRange)
  strokeCrossAt(ctx, isVertical, loPx, categoryCenter, halfExtent)
  ctx.strokeStyle = haloColorAt(hiPx, fillRange)
  strokeCrossAt(ctx, isVertical, hiPx, categoryCenter, halfExtent)

  ctx.lineWidth = lineWidth
  ctx.strokeStyle = markerColor
  strokeCrossAt(ctx, isVertical, v, categoryCenter, halfExtent)
}

/**
 * Draws a 1px value-line (stem) with 1px halos on each side in the category
 * direction. Halo color is chosen by the stem midpoint's fill membership —
 * stems that straddle the fill boundary get a single color by midpoint rule
 * (good enough for the typical cases: whiskers and error bars outside fill,
 * or fully inside when error < mean).
 */
function drawValueLineWithHalo(
  ctx: CanvasRenderingContext2D,
  isVertical: boolean,
  fromPx: number,
  toPx: number,
  categoryCenter: number,
  fillRange: FillRange,
  markerColor: string
): void {
  const c = alignToPixelCenter(categoryCenter)
  const from = alignToPixelCenter(fromPx)
  const to = alignToPixelCenter(toPx)
  const haloColor = haloColorAt((from + to) / 2, fillRange)

  ctx.lineWidth = 1
  ctx.strokeStyle = haloColor
  strokeValueAt(ctx, isVertical, from, to, c - 1)
  strokeValueAt(ctx, isVertical, from, to, c + 1)

  ctx.strokeStyle = markerColor
  strokeValueAt(ctx, isVertical, from, to, c)
}
