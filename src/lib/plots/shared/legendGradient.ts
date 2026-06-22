/**
 * Gradient Legend Utilities - Functional approach for canvas-based gradient legend rendering
 *
 * This module provides pure functions for computing gradient legend geometry and drawing it.
 * Designed to be plot-agnostic.
 */

import { strokeCrispRect } from '$lib/plots/shared/canvasUtils'

// ============================================================================
// TYPES
// ============================================================================

import { GRIDLINE_PRIMARY, LEGEND_FONT } from './const'
import { COLOR_FALLBACKS } from '$lib/color'
import { wrapTextToWidth } from '$lib/shared/utils/textUtils'

/** Max wrapped lines for the colorbar title before it ellipsises (bounds the
 *  reserved legend height so the layout never has to grow unpredictably). */
const MAX_LEGEND_TITLE_LINES = 2

export interface GradientLegendConfig {
  /** Top X coordinate */
  x: number
  /** Top Y coordinate (or base Y from where we stack upwards if simpler, but standard is top-down logic) */
  y: number
  /** Total available width for legend to center itself in */
  availableWidth: number
  /** Total available height (determines minimalist vs full mode) */
  availableHeight: number
  /** Gradient colors */
  colorScale: string[]
  /** [min, max] values */
  valueRange: [number, number]
  /** Effective max value (e.g. calculated auto-max) */
  effectiveMaxValue: number
  /** Legend Title */
  title: string
  /** Optional color for values below minimum (e.g. for "no data" or "zero") */
  belowMinColor?: string | null
}

export interface GradientLegendInteractionZones {
  minValueZone: { x: number; y: number; radius: number } | null
  maxValueZone: { x: number; y: number; radius: number } | null
  gradientZone: {
    x: number
    y: number
    width: number
    height: number
    radius: number
  } | null
}

export interface GradientLegendGeometry {
  isMinimalist: boolean
  totalHeight: number
  width: number
  x: number
  y: number

  // Layout components. `title.lines` is the (1–2) wrapped title lines, drawn
  // stacked from `title.y`.
  title?: { lines: string[]; x: number; y: number }
  gradientRect: { x: number; y: number; width: number; height: number }
  labels?: {
    min?: { text: string; x: number; y: number }
    max?: { text: string; x: number; y: number }
    belowMin?: { text: string; x: number; y: number }
  }

  // Interaction zones for click/hover logic
  zones: GradientLegendInteractionZones

  // Optional below-min segment rect
  belowMinRect?: { x: number; y: number; width: number; height: number }
}

// ============================================================================
// VERTICAL SIZING CONSTANTS
// ============================================================================

/** Gap between the title baseline and the top of the gradient bar. */
const GRADIENT_LEGEND_TITLE_GAP = 3

/** Height of the gradient colour bar itself. */
const GRADIENT_LEGEND_BAR_HEIGHT = 12

/** Gap between the bottom of the gradient bar and the value labels. */
const GRADIENT_LEGEND_LABEL_GAP = 10

/** Minimum available height before the legend switches to minimalist mode. */
const GRADIENT_LEGEND_MINIMALIST_THRESHOLD = 30

/**
 * Compute the total vertical height the gradient legend needs in full mode
 * (title + bar + value labels).  The result is font-size–aware so the
 * layout stays correct even when the system font metrics differ.
 *
 * @param fontSize  The label / title font size in px (default: `LEGEND_FONT.SIZE`).
 */
export function getGradientLegendRequiredHeight(
  fontSize: number = LEGEND_FONT.SIZE
): number {
  // Title line height is ~1.25× the font size, approximated to the
  // nearest integer so canvas pixel math stays sharp.
  const titleLineHeight = Math.ceil(fontSize * 1.25)
  return (
    MAX_LEGEND_TITLE_LINES * titleLineHeight + // reserve for a wrapped (≤2-line) title
    GRADIENT_LEGEND_TITLE_GAP +
    GRADIENT_LEGEND_BAR_HEIGHT +
    GRADIENT_LEGEND_LABEL_GAP +
    fontSize                       // value-label text height
  )
}

// ============================================================================
// GEOMETRY COMPUTATION
// ============================================================================

/**
 * Compute the layout geometry for a gradient legend based on available space.
 * Switch between minimalist (bar only) and full (title + bar + labels) automatically.
 */
export function computeGradientLegendGeometry(
  config: GradientLegendConfig
): GradientLegendGeometry {
  const {
    x,
    y,
    availableWidth,
    availableHeight,
    valueRange,
    effectiveMaxValue,
    title,
  } = config

  // Constants
  const MINIMALIST_HEIGHT = 8
  const MAX_WIDTH = 300

  const isMinimalist = availableHeight < GRADIENT_LEGEND_MINIMALIST_THRESHOLD

  // Layout Width
  const hasBelowMin = !!config.belowMinColor
  const belowMinWidth = 15
  const belowMinGap = 0
  const totalBarWidth = hasBelowMin
    ? belowMinWidth + belowMinGap + Math.min(MAX_WIDTH, availableWidth * 0.8)
    : Math.min(MAX_WIDTH, availableWidth * 0.8)

  const legendWidth = hasBelowMin
    ? totalBarWidth - belowMinWidth - belowMinGap
    : totalBarWidth

  const legendX = x + ((availableWidth - totalBarWidth) >> 1)
  const belowMinX = legendX
  const gradientX = hasBelowMin
    ? belowMinX + belowMinWidth + belowMinGap
    : legendX

  if (isMinimalist) {
    // Minimalist: Gradient Bar Only (maybe small title)
    // Position mostly at bottom-ish of available area or just fixed Y
    // The calling code passed Y as the top of where we should draw.

    // Check if we have room for a tiny title above?
    // Let's assume strict minimalist logic from original component: bar + border + maybe title
    const barY = y + 5

    // Interaction data
    const zones: GradientLegendInteractionZones = {
      minValueZone: null,
      maxValueZone: null,
      gradientZone: {
        x: legendX - 10,
        y: barY - 5,
        width: totalBarWidth + 20,
        height: MINIMALIST_HEIGHT + 10,
        radius: 4,
      },
    }

    // Centered title helper (minimalist stays a single, truncated line)
    const titleObj =
      barY - y > 15
        ? {
            lines: wrapTextToWidth(title, availableWidth, 10, LEGEND_FONT.FAMILY, 1),
            x: x + (availableWidth >> 1),
            y: barY - 2,
          }
        : undefined

    return {
      isMinimalist: true,
      totalHeight: MINIMALIST_HEIGHT + 10, // approximate
      width: totalBarWidth,
      x: legendX,
      y,
      gradientRect: {
        x: gradientX,
        y: barY,
        width: legendWidth,
        height: MINIMALIST_HEIGHT,
      },
      belowMinRect: hasBelowMin
        ? {
            x: belowMinX,
            y: barY,
            width: belowMinWidth,
            height: MINIMALIST_HEIGHT,
          }
        : undefined,
      title: titleObj,
      zones,
    }
  }

  // Full Mode
  // Fixed vertical layout:
  //   Title -> TITLE_GAP -> Gradient bar -> LABEL_GAP -> Value labels

  const { SIZE: legendFontSize } = LEGEND_FONT
  const showTitle = availableHeight >= GRADIENT_LEGEND_MINIMALIST_THRESHOLD
  const titleLineHeight = Math.ceil(legendFontSize * 1.25)
  // Wrap the title to the legend's width (≤2 lines); height grows with the
  // line count, and the matrix/heatmap layouts already reserve room for 2.
  const titleLines = showTitle
    ? wrapTextToWidth(title, availableWidth, legendFontSize, LEGEND_FONT.FAMILY, MAX_LEGEND_TITLE_LINES)
    : []
  const titleHeight = titleLines.length * titleLineHeight

  const TITLE_GAP = GRADIENT_LEGEND_TITLE_GAP
  const LABEL_GAP = GRADIENT_LEGEND_LABEL_GAP
  const BAR_HEIGHT = GRADIENT_LEGEND_BAR_HEIGHT

  // Total height the legend block occupies, derived from font size.
  const requiredHeight =
    titleHeight + (titleLines.length ? TITLE_GAP : 0) + BAR_HEIGHT + LABEL_GAP + legendFontSize

  // Center vertically
  const startY = y + Math.max(0, (availableHeight - requiredHeight) / 2)

  const titleY = startY
  const gradientY = titleLines.length ? titleY + titleHeight + TITLE_GAP : startY
  const valuesY = gradientY + BAR_HEIGHT + LABEL_GAP

  // Title
  const titleObj = titleLines.length
    ? {
        lines: titleLines,
        x: x + (availableWidth >> 1),
        y: titleY,
      }
    : undefined

  // Label text configuration
  const labelsObj =
    availableHeight > 35
      ? {
          min: {
            text: valueRange[0].toString(),
            x: gradientX,
            y: valuesY,
          },
          max: {
            text: effectiveMaxValue.toString(),
            x: gradientX + legendWidth,
            y: valuesY,
          },
          belowMin: undefined,
        }
      : undefined

  // Interaction Zones
  const valueRadius = Math.max(15, BAR_HEIGHT * 1.5)
  const zones: GradientLegendInteractionZones = {
    minValueZone: {
      x: legendX,
      y: valuesY + 6,
      radius: valueRadius,
    },
    maxValueZone: {
      x: legendX + legendWidth,
      y: valuesY + 6,
      radius: valueRadius,
    },
    gradientZone: {
      x: legendX - 10,
      y: gradientY - 10,
      width: totalBarWidth + 20,
      height: BAR_HEIGHT + 20,
      radius: 15,
    },
  }

  return {
    isMinimalist: false,
    totalHeight: requiredHeight,
    width: totalBarWidth,
    x: legendX,
    y: startY,
    title: titleObj,
    gradientRect: {
      x: gradientX,
      y: gradientY,
      width: legendWidth,
      height: BAR_HEIGHT,
    },
    belowMinRect: hasBelowMin
      ? {
          x: belowMinX,
          y: gradientY,
          width: belowMinWidth,
          height: BAR_HEIGHT,
        }
      : undefined,
    labels: labelsObj,
    zones,
  }
}

// ============================================================================
// DRAWING
// ============================================================================

/**
 * Draw the gradient legend based on computed geometry.
 */
export function drawGradientLegend(
  ctx: CanvasRenderingContext2D,
  geometry: GradientLegendGeometry,
  config: GradientLegendConfig,
  highlightState?: 'none' | 'gradient' | 'minValue' | 'maxValue'
): void {
  const { title, gradientRect, belowMinRect, labels, zones } = geometry
  const { colorScale } = config
  const { FAMILY: fontFamily, COLOR: fontColor } = LEGEND_FONT

  // 1. Draw Hover Effects
  if (highlightState && highlightState !== 'none') {
    const alpha = 0.2
    ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`

    if (highlightState === 'minValue' && zones.minValueZone) {
      ctx.beginPath()
      ctx.arc(
        zones.minValueZone.x,
        zones.minValueZone.y,
        zones.minValueZone.radius,
        0,
        Math.PI * 2
      )
      ctx.fill()
    } else if (highlightState === 'maxValue' && zones.maxValueZone) {
      ctx.beginPath()
      ctx.arc(
        zones.maxValueZone.x,
        zones.maxValueZone.y,
        zones.maxValueZone.radius,
        0,
        Math.PI * 2
      )
      ctx.fill()
    } else if (highlightState === 'gradient' && zones.gradientZone) {
      drawRoundedRect(
        ctx,
        zones.gradientZone.x,
        zones.gradientZone.y,
        zones.gradientZone.width,
        zones.gradientZone.height,
        zones.gradientZone.radius
      )
      ctx.fill()
    }
  }

  // 2. Draw Title (1–2 wrapped lines, stacked from title.y)
  if (title && title.lines.length > 0) {
    const titleFontSize = geometry.isMinimalist ? 10 : 12
    ctx.font = `${titleFontSize}px ${fontFamily}`
    ctx.fillStyle = fontColor
    ctx.textAlign = 'center'
    ctx.textBaseline = geometry.isMinimalist ? 'bottom' : 'top'
    const lineHeight = Math.ceil(titleFontSize * 1.25)
    for (let i = 0; i < title.lines.length; i++) {
      ctx.fillText(title.lines[i], title.x, title.y + i * lineHeight)
    }
  }

  // 3. Draw Gradient Bar
  // Quantize coordinates to integers to avoid subpixel rendering artifacts
  // and ensure the fill perfectly matches the strokeCrispRect behavior.
  const gx = gradientRect.x | 0
  const gy = gradientRect.y | 0
  const gw = gradientRect.width | 0
  const gh = gradientRect.height | 0

  const gradient = ctx.createLinearGradient(gx, 0, gx + gw, 0)

  if (colorScale.length === 3) {
    gradient.addColorStop(0, colorScale[0])
    gradient.addColorStop(0.5, colorScale[1])
    gradient.addColorStop(1, colorScale[2])
  } else {
    gradient.addColorStop(0, colorScale[0] || COLOR_FALLBACKS.WHITE)
    gradient.addColorStop(1, colorScale[1] || COLOR_FALLBACKS.BLACK)
  }

  ctx.fillStyle = gradient
  ctx.fillRect(gx, gy, gw, gh)

  // Border
  // strokeCrispRect handles the +0.5 offset internally using (val | 0)
  strokeCrispRect(ctx, gx, gy, gw, gh, GRIDLINE_PRIMARY.COLOR, 1)

  // 3b. Draw "Below Min" Segment
  if (belowMinRect && config.belowMinColor) {
    const bx = belowMinRect.x | 0
    const by = belowMinRect.y | 0
    const bw = belowMinRect.width | 0
    const bh = belowMinRect.height | 0

    ctx.fillStyle = config.belowMinColor
    ctx.fillRect(bx, by, bw, bh)
    strokeCrispRect(ctx, bx, by, bw, bh, GRIDLINE_PRIMARY.COLOR, 1)
  }

  // 4. Draw Layout Labels (Min/Max/BelowMin)
  if (labels) {
    ctx.font = `12px ${fontFamily}`
    ctx.fillStyle = fontColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    if (labels.min) {
      ctx.fillText(labels.min.text, labels.min.x, labels.min.y)
    }
    if (labels.max) {
      ctx.fillText(labels.max.text, labels.max.x, labels.max.y)
    }

    if (labels.belowMin) {
      ctx.fillText(labels.belowMin.text, labels.belowMin.x, labels.belowMin.y)
    }

    // 5. Draw down-ticks at interval edges
    const tickLen = 5
    const tickY1 = (gradientRect.y + gradientRect.height) | 0
    const tickY2 = tickY1 + tickLen
    ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
    ctx.lineWidth = 1

    // Always draw tick at the start of the gradient bar
    const startX = gradientRect.x | 0
    ctx.beginPath()
    ctx.moveTo(startX + 0.5, tickY1)
    ctx.lineTo(startX + 0.5, tickY2)
    ctx.stroke()

    // Draw tick at the end of the gradient bar
    const endX = (gradientRect.x + gradientRect.width) | 0
    ctx.beginPath()
    ctx.moveTo(endX + 0.5, tickY1)
    ctx.lineTo(endX + 0.5, tickY2)
    ctx.stroke()
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}


