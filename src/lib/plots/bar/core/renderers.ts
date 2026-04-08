import {
  type AdaptiveTimeline,
  getTimelinePositionRatio,
} from '$lib/plots/shared'
import { alignToPixelCenter } from '$lib/plots/shared/canvasUtils'
import { GRIDLINE_PRIMARY } from '$lib/plots/shared/const'
import { hexToRgb } from '$lib/color/utility'
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
const DOT_ALPHA_MIN = 0.25
const DENSITY_BIN_SIZE = 20 // px — bin width for measuring local density along value axis

// Visual styling
const DELIMITER_COLOR = '#e0e0e0'
const BG_FILL_COLOR = '#f5f5f5'
const MARKER_COLOR = GRIDLINE_PRIMARY.COLOR
const MARKER_WIDTH_MEDIAN = 3
const MARKER_WIDTH_THIN = 1
const CAP_WIDTH_RATIO = 0.3 // whisker/error cap width as fraction of category width
const DIAMOND_SIZE = 4 // half-size of the mean diamond marker

// --- Helpers ---

function colorWithAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

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
 * Computes dot radius and alpha based on the densest cluster across all AOIs.
 * Shrinks dots when too many overlap in a small region; reduces alpha as last resort.
 */
export function computeDotStyle(layout: BarPlotLayout): { radius: number; alpha: number } {
  const categoryWidth = layout.items.length > 0 ? layout.items[0].categoryWidth : 100

  // Find the highest dot count within any single density bin across all AOIs
  let peakDensity = 0

  for (const item of layout.items) {
    const values = item.data.individualValues
    if (!values || values.length === 0) continue

    // Map values to pixel positions
    const positions = values.map(v => valueToPixel(layout, v, true))

    // Bin positions into windows to measure local density
    if (positions.length === 0) continue
    const minPos = Math.min(...positions)
    const maxPos = Math.max(...positions)
    const range = maxPos - minPos

    if (range < 1) {
      // All values at same position
      peakDensity = Math.max(peakDensity, positions.length)
      continue
    }

    const numBins = Math.max(1, Math.ceil(range / DENSITY_BIN_SIZE))
    const bins = new Array(numBins).fill(0)
    for (const p of positions) {
      const bin = Math.min(numBins - 1, Math.floor((p - minPos) / DENSITY_BIN_SIZE))
      bins[bin]++
    }
    peakDensity = Math.max(peakDensity, ...bins)
  }

  if (peakDensity === 0) return { radius: DOT_RADIUS_MAX, alpha: 1 }

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

  // Determine alpha — if even min radius can't fit, reduce opacity
  let alpha = 1.0
  const maxAcrossAtRadius = Math.floor(categoryWidth / (radius * 2.2))
  const rowsAtRadius = Math.max(1, Math.floor(DENSITY_BIN_SIZE / (radius * 2)))
  const capacityAtRadius = maxAcrossAtRadius * rowsAtRadius
  if (peakDensity > capacityAtRadius) {
    alpha = Math.max(DOT_ALPHA_MIN, capacityAtRadius / peakDensity)
  }

  return { radius, alpha }
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
      // meanCi95 / meanSd — fill from baseline to mean, with diamond cutout
      const meanPx = valueToPixel(layout, stats.mean)
      const top = Math.min(meanPx, basePx)
      const size = Math.abs(meanPx - basePx)
      const ds = DIAMOND_SIZE
      const c = alignToPixelCenter(center)
      const v = alignToPixelCenter(meanPx)

      // Fill the bar area, then cut out the diamond with compositing
      ctx.save()
      ctx.beginPath()
      if (isVertical) {
        // Clip to bar rect minus diamond
        ctx.rect(center - halfWidth, top, halfWidth * 2, size)
        // Subtract diamond region using even-odd rule
        ctx.moveTo(c, v + ds)
        ctx.lineTo(c - ds, v)
        ctx.lineTo(c, v - ds)
        ctx.lineTo(c + ds, v)
        ctx.closePath()
      } else {
        ctx.rect(top, center - halfWidth, size, halfWidth * 2)
        ctx.moveTo(v + ds, c)
        ctx.lineTo(v, c - ds)
        ctx.lineTo(v - ds, c)
        ctx.lineTo(v, c + ds)
        ctx.closePath()
      }
      ctx.clip('evenodd')
      if (isVertical) {
        ctx.fillRect(center - halfWidth, top, halfWidth * 2, size)
      } else {
        ctx.fillRect(top, center - halfWidth, size, halfWidth * 2)
      }
      ctx.restore()
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

// --- Beeswarm (primary layer) ---

export function drawBeeswarmPoints(
  ctx: CanvasRenderingContext2D,
  layout: BarPlotLayout
): void {
  const isVertical = layout.barPlottingType === 'vertical'
  const { radius, alpha } = computeDotStyle(layout)

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

    ctx.fillStyle = colorWithAlpha(item.data.color, alpha)

    for (const pos of positions) {
      ctx.beginPath()
      if (isVertical) {
        ctx.arc(pos.categoryPos, pos.valuePos, radius, 0, Math.PI * 2)
      } else {
        ctx.arc(pos.valuePos, pos.categoryPos, radius, 0, Math.PI * 2)
      }
      ctx.fill()
    }
  }
}

// --- Statistical overlays (drawn on top of beeswarm with multiply compositing) ---

export function drawStatisticalOverlay(
  ctx: CanvasRenderingContext2D,
  layout: BarPlotLayout,
  overlayType: StatisticalOverlayType
): void {
  if (overlayType === 'none') return

  ctx.globalCompositeOperation = 'multiply'

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

  ctx.globalCompositeOperation = 'source-over'
}

function drawIndicatorOverlay(
  ctx: CanvasRenderingContext2D,
  layout: BarPlotLayout,
  errorType: 'sd' | 'ci95'
): void {
  const isVertical = layout.barPlottingType === 'vertical'

  for (const item of layout.items) {
    const stats = item.data.stats
    if (!stats || stats.count === 0) continue

    const center = item.categoryCenter
    const halfWidth = item.categoryWidth / 2
    const capHalfWidth = halfWidth * CAP_WIDTH_RATIO
    const meanPx = valueToPixel(layout, stats.mean)

    ctx.strokeStyle = MARKER_COLOR
    ctx.lineWidth = MARKER_WIDTH_THIN

    const v = alignToPixelCenter(meanPx)
    const c = alignToPixelCenter(center)
    const ds = DIAMOND_SIZE

    const hasError = stats.count >= 2
    const error = hasError ? (errorType === 'sd' ? stats.sd : stats.sem * 1.96) : 0
    const lowPx = hasError ? alignToPixelCenter(valueToPixel(layout, stats.mean - error)) : v
    const highPx = hasError ? alignToPixelCenter(valueToPixel(layout, stats.mean + error)) : v

    // Single continuous path: caps + stems + mean line + diamond
    ctx.beginPath()
    if (isVertical) {
      // Bottom cap
      if (hasError) {
        ctx.moveTo(c - capHalfWidth, lowPx)
        ctx.lineTo(c + capHalfWidth, lowPx)
        // Stem up to diamond bottom
        ctx.moveTo(c, lowPx)
        ctx.lineTo(c, v + ds)
      }
      // Diamond
      ctx.moveTo(c, v + ds)
      ctx.lineTo(c - ds, v)
      ctx.lineTo(c, v - ds)
      ctx.lineTo(c + ds, v)
      ctx.lineTo(c, v + ds)
      // Stem from diamond top to top cap
      if (hasError) {
        ctx.moveTo(c, v - ds)
        ctx.lineTo(c, highPx)
        // Top cap
        ctx.moveTo(c - capHalfWidth, highPx)
        ctx.lineTo(c + capHalfWidth, highPx)
      }
      // Mean line: left edge to diamond left, diamond right to right edge
      ctx.moveTo(center - halfWidth, v)
      ctx.lineTo(c - ds, v)
      ctx.moveTo(c + ds, v)
      ctx.lineTo(center + halfWidth, v)
    } else {
      // Left cap
      if (hasError) {
        ctx.moveTo(lowPx, c - capHalfWidth)
        ctx.lineTo(lowPx, c + capHalfWidth)
        // Stem right to diamond left
        ctx.moveTo(lowPx, c)
        ctx.lineTo(v - ds, c)
      }
      // Diamond
      ctx.moveTo(v - ds, c)
      ctx.lineTo(v, c - ds)
      ctx.lineTo(v + ds, c)
      ctx.lineTo(v, c + ds)
      ctx.lineTo(v - ds, c)
      // Stem from diamond right to right cap
      if (hasError) {
        ctx.moveTo(v + ds, c)
        ctx.lineTo(highPx, c)
        // Right cap
        ctx.moveTo(highPx, c - capHalfWidth)
        ctx.lineTo(highPx, c + capHalfWidth)
      }
      // Mean line: top edge to diamond top, diamond bottom to bottom edge
      ctx.moveTo(v, center - halfWidth)
      ctx.lineTo(v, c - ds)
      ctx.moveTo(v, c + ds)
      ctx.lineTo(v, center + halfWidth)
    }
    ctx.stroke()
  }
}

function drawBoxplotOverlay(
  ctx: CanvasRenderingContext2D,
  layout: BarPlotLayout
): void {
  const isVertical = layout.barPlottingType === 'vertical'

  for (const item of layout.items) {
    const stats = item.data.stats
    if (!stats || stats.count === 0) continue

    const center = item.categoryCenter
    const halfWidth = item.categoryWidth / 2
    const capHalfWidth = halfWidth * CAP_WIDTH_RATIO

    ctx.strokeStyle = MARKER_COLOR

    if (stats.count === 1) {
      ctx.lineWidth = MARKER_WIDTH_MEDIAN
      drawCrossLine(ctx, isVertical, valueToPixel(layout, stats.median), center, halfWidth)
      continue
    }

    const medianPx = valueToPixel(layout, stats.median)
    const q1Px = valueToPixel(layout, stats.q1)
    const q3Px = valueToPixel(layout, stats.q3)
    const whiskerLowPx = valueToPixel(layout, stats.whiskerLow)
    const whiskerHighPx = valueToPixel(layout, stats.whiskerHigh)

    // Median — full width, 3px
    ctx.lineWidth = MARKER_WIDTH_MEDIAN
    drawCrossLine(ctx, isVertical, medianPx, center, halfWidth)

    // Q1, Q3 — full width, thin
    ctx.lineWidth = MARKER_WIDTH_THIN
    drawCrossLine(ctx, isVertical, q1Px, center, halfWidth)
    drawCrossLine(ctx, isVertical, q3Px, center, halfWidth)

    // Whisker stems — vertical from Q1→whiskerLow, Q3→whiskerHigh
    drawValueLine(ctx, isVertical, q1Px, whiskerLowPx, center)
    drawValueLine(ctx, isVertical, q3Px, whiskerHighPx, center)

    // Whisker caps — short horizontal
    drawCrossLine(ctx, isVertical, whiskerLowPx, center, capHalfWidth)
    drawCrossLine(ctx, isVertical, whiskerHighPx, center, capHalfWidth)
  }
}

// --- Beeswarm layout ---

/**
 * Computes deterministic beeswarm positions to avoid dot overlap.
 * For each dot (sorted by value), tries center first, then expands in
 * symmetric rings: +1×step, −1×step, +2×step, −2×step, ...
 * Clamps to maxCategorySpread so dots stay within the AOI strip.
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
  const placed: Array<{ valuePos: number; categoryPos: number }> = []

  // Sort by value for deterministic layout
  const indexed = workingValues.map((v, i) => ({ v, i }))
  indexed.sort((a, b) => a.v - b.v)

  for (const { v } of indexed) {
    const vp = valueFn(v)
    let bestCat = categoryCenter

    // Check for overlaps and shift outward in symmetric rings from center
    let ring = 0
    const step = minDist * 0.8
    const maxAttempts = 50

    while (ring < maxAttempts) {
      // Ring 0 = center, then alternate: +1×step, −1×step, +2×step, −2×step, ...
      const level = Math.ceil(ring / 2)
      const sign = ring % 2 === 1 ? 1 : -1
      const offset = ring === 0 ? 0 : level * step * sign
      const candidate = categoryCenter + offset
      let overlaps = false

      for (const p of placed) {
        const dv = vp - p.valuePos
        const dc = candidate - p.categoryPos
        const dist = Math.sqrt(dv * dv + dc * dc)
        if (dist < minDist) {
          overlaps = true
          break
        }
      }

      if (!overlaps) {
        bestCat = candidate
        break
      }

      ring++
    }

    // Clamp to max spread
    bestCat = Math.max(
      categoryCenter - maxCategorySpread,
      Math.min(categoryCenter + maxCategorySpread, bestCat)
    )

    placed.push({ valuePos: vp, categoryPos: bestCat })
  }

  return placed
}

// --- Drawing primitives ---

/** Draws a line perpendicular to the value axis (e.g., median line, cap) */
function drawCrossLine(
  ctx: CanvasRenderingContext2D,
  isVertical: boolean,
  valuePx: number,
  categoryCenter: number,
  halfExtent: number
): void {
  const v = alignToPixelCenter(valuePx)
  ctx.beginPath()
  if (isVertical) {
    ctx.moveTo(categoryCenter - halfExtent, v)
    ctx.lineTo(categoryCenter + halfExtent, v)
  } else {
    ctx.moveTo(v, categoryCenter - halfExtent)
    ctx.lineTo(v, categoryCenter + halfExtent)
  }
  ctx.stroke()
}

/** Draws a line along the value axis (e.g., whisker stem, error bar) */
function drawValueLine(
  ctx: CanvasRenderingContext2D,
  isVertical: boolean,
  fromPx: number,
  toPx: number,
  categoryCenter: number
): void {
  const c = alignToPixelCenter(categoryCenter)
  ctx.beginPath()
  if (isVertical) {
    ctx.moveTo(c, alignToPixelCenter(fromPx))
    ctx.lineTo(c, alignToPixelCenter(toPx))
  } else {
    ctx.moveTo(alignToPixelCenter(fromPx), c)
    ctx.lineTo(alignToPixelCenter(toPx), c)
  }
  ctx.stroke()
}
