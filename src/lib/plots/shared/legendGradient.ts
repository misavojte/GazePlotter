/**
 * Gradient Legend Utilities - Functional approach for canvas-based gradient legend rendering
 *
 * This module provides pure functions for computing gradient legend geometry and drawing it.
 * Designed to be plot-agnostic.
 */

import { strokeCrispRect, strokeParallelLines } from '$lib/plots/shared/canvasUtils'

// ============================================================================
// TYPES
// ============================================================================

import { GRIDLINE_PRIMARY, LEGEND_FONT, PLOT_LEGEND_GAP } from './const'
import { COLOR_FALLBACKS } from '$lib/color'
import { estimateTextWidth, wrapTextToWidth } from '$lib/shared/textMeasure'

/** Max wrapped lines for the colorbar title before it ellipsises (bounds the
 *  reserved legend height so the layout never has to grow unpredictably). */
const MAX_LEGEND_TITLE_LINES = 2

/**
 * Formats a value for legend text rendering.
 * Rounds to a maximum of 3 decimal places and strips trailing zeros.
 */
function formatLegendValue(val: number): string {
  return Number(val.toFixed(3)).toString()
}

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
  /** Optional color for values above the range maximum. Its cap is drawn only
   *  while `valueRange[1]` is explicit (non-zero): at auto nothing can exceed
   *  the data max, so there is nothing to cap. */
  aboveMaxColor?: string | null
  /**
   * Pin the bar to a stable max length (no grid-proportional `* 0.8`
   * shortening). For plots whose grid width varies with the data (the metric
   * matrix: participants × stimuli), so the legend stays ONE fixed length
   * instead of shrinking with a narrow grid. Pass `availableWidth` as the
   * figure width in that case so the fixed bar centers under the whole plot.
   */
  fixedWidth?: boolean
}

export interface LegendRect {
  x: number
  y: number
  width: number
  height: number
}

export interface GradientLegendGeometry {
  isMinimalist: boolean
  totalHeight: number
  width: number
  x: number
  y: number

  // Paint inputs carried from the config so drawing needs only the geometry.
  colorScale: string[]
  belowMinColor?: string | null
  aboveMaxColor?: string | null

  // Layout components. `title.lines` is the (1–2) wrapped title lines, drawn
  // stacked from `title.y`.
  title?: { lines: string[]; x: number; y: number }
  gradientRect: LegendRect
  labels?: {
    min?: { text: string; x: number; y: number }
    max?: { text: string; x: number; y: number }
  }

  // Optional out-of-bounds end caps flanking the gradient bar
  belowMinRect?: LegendRect
  aboveMaxRect?: LegendRect
}

// ============================================================================
// VERTICAL SIZING CONSTANTS
// ============================================================================

/** Gap between the title baseline and the top of the gradient bar. */
const GRADIENT_LEGEND_TITLE_GAP = 3

/** Height of the gradient colour bar itself. */
const GRADIENT_LEGEND_BAR_HEIGHT = 12

/** Width of an out-of-bounds end cap flanking the gradient bar. */
const GRADIENT_LEGEND_CAP_WIDTH = 15

/** Gap between the bottom of the gradient bar and the value labels. */
const GRADIENT_LEGEND_LABEL_GAP = 10

/** Minimum available height before the legend switches to minimalist mode. */
const GRADIENT_LEGEND_MINIMALIST_THRESHOLD = 30

/** Minimum available height for the min/max value labels under the bar. */
const GRADIENT_LEGEND_LABELS_MIN_HEIGHT = 35

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

/**
 * Gradient legend laid in the harness's bottom legend band: anchored at
 * `frame.legendY + PLOT_LEGEND_GAP`, spanning the plot area width. One owner
 * for that positioning; a matrix figure places its legend from its own layout
 * and calls {@link computeGradientLegendGeometry} directly.
 */
export function bottomGradientLegendGeometry(
  plot: { frame: { legendY: number }; plotAreaWidth: number },
  margin: number,
  legendHeight: number,
  config: Omit<
    GradientLegendConfig,
    'x' | 'y' | 'availableWidth' | 'availableHeight'
  >
): GradientLegendGeometry {
  return computeGradientLegendGeometry({
    x: margin,
    y: plot.frame.legendY + PLOT_LEGEND_GAP,
    availableWidth: plot.plotAreaWidth,
    availableHeight: legendHeight,
    ...config,
  })
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

  // Layout Width. Out-of-bounds caps flank the bar; the above-max cap exists
  // only under an explicit maximum (auto IS the data max, nothing exceeds it).
  const hasBelowMin = !!config.belowMinColor
  const hasAboveMax = !!config.aboveMaxColor && valueRange[1] !== 0
  const capsWidth =
    (hasBelowMin ? GRADIENT_LEGEND_CAP_WIDTH : 0) +
    (hasAboveMax ? GRADIENT_LEGEND_CAP_WIDTH : 0)
  // `fixedWidth` keeps the bar at MAX_WIDTH (clamped only so bar + caps can't
  // exceed the space) — no `* 0.8` grid-proportional shortening; otherwise the
  // bar tracks the grid width as before.
  // The value labels centre on the bar's ends: past whatever cap flanks an end,
  // the rest of that half-label needs room inside the span or it leaves the canvas.
  const minText = formatLegendValue(valueRange[0])
  const maxText = formatLegendValue(effectiveMaxValue)
  const hasLabels = !isMinimalist && availableHeight > GRADIENT_LEGEND_LABELS_MIN_HEIGHT
  const overhang = (text: string, cap: number) =>
    hasLabels ? Math.max(0, estimateTextWidth(text, LEGEND_FONT.SIZE, LEGEND_FONT.FAMILY) / 2 - cap) : 0
  const overhangLeft = overhang(minText, hasBelowMin ? GRADIENT_LEGEND_CAP_WIDTH : 0)
  const overhangRight = overhang(maxText, hasAboveMax ? GRADIENT_LEGEND_CAP_WIDTH : 0)
  const maxBarWidth = Math.max(0, availableWidth - capsWidth - overhangLeft - overhangRight)
  const barWidth = Math.min(
    maxBarWidth,
    config.fixedWidth ? MAX_WIDTH : Math.min(MAX_WIDTH, availableWidth * 0.8)
  )
  const totalBarWidth = barWidth + capsWidth

  const legendX =
    x + ((availableWidth - totalBarWidth - overhangLeft - overhangRight) >> 1) + overhangLeft
  const gradientX = hasBelowMin ? legendX + GRADIENT_LEGEND_CAP_WIDTH : legendX
  const aboveMaxX = gradientX + barWidth
  const capRect = (cx: number, cy: number, height: number): LegendRect => ({
    x: cx,
    y: cy,
    width: GRADIENT_LEGEND_CAP_WIDTH,
    height,
  })

  if (isMinimalist) {
    // Minimalist: gradient bar only, no title — there is no vertical room for
    // one below the minimalist threshold.
    const barY = y + 5

    return {
      isMinimalist: true,
      totalHeight: MINIMALIST_HEIGHT + 10, // approximate
      width: totalBarWidth,
      x: legendX,
      y,
      colorScale: config.colorScale,
      belowMinColor: config.belowMinColor,
      aboveMaxColor: config.aboveMaxColor,
      gradientRect: {
        x: gradientX,
        y: barY,
        width: barWidth,
        height: MINIMALIST_HEIGHT,
      },
      belowMinRect: hasBelowMin ? capRect(legendX, barY, MINIMALIST_HEIGHT) : undefined,
      aboveMaxRect: hasAboveMax ? capRect(aboveMaxX, barY, MINIMALIST_HEIGHT) : undefined,
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
    hasLabels
      ? {
          min: {
            text: minText,
            x: gradientX,
            y: valuesY,
          },
          max: {
            text: maxText,
            x: gradientX + barWidth,
            y: valuesY,
          },
        }
      : undefined

  return {
    isMinimalist: false,
    totalHeight: requiredHeight,
    width: totalBarWidth,
    x: legendX,
    y: startY,
    colorScale: config.colorScale,
    belowMinColor: config.belowMinColor,
    aboveMaxColor: config.aboveMaxColor,
    title: titleObj,
    gradientRect: {
      x: gradientX,
      y: gradientY,
      width: barWidth,
      height: BAR_HEIGHT,
    },
    belowMinRect: hasBelowMin ? capRect(legendX, gradientY, BAR_HEIGHT) : undefined,
    aboveMaxRect: hasAboveMax ? capRect(aboveMaxX, gradientY, BAR_HEIGHT) : undefined,
    labels: labelsObj,
  }
}

// ============================================================================
// DRAWING
// ============================================================================

/** The bar or an out-of-bounds end cap: a fill with the crisp legend border. */
function fillCapRect(ctx: CanvasRenderingContext2D, rect: LegendRect, fill: string | CanvasGradient): void {
  // Quantize to integers so the fill matches the strokeCrispRect border exactly.
  const x = rect.x | 0
  const y = rect.y | 0
  const w = rect.width | 0
  const h = rect.height | 0
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
  strokeCrispRect(ctx, x, y, w, h, GRIDLINE_PRIMARY.COLOR, 1)
}

/** A bordered left-to-right gradient bar; evenly spaced stops (one colour: it to black). */
export function drawGradientBar(ctx: CanvasRenderingContext2D, rect: LegendRect, colors: readonly string[]): void {
  const x = rect.x | 0
  const gradient = ctx.createLinearGradient(x, 0, x + (rect.width | 0), 0)
  if (colors.length >= 2) {
    const last = colors.length - 1
    for (let i = 0; i <= last; i++) gradient.addColorStop(i / last, colors[i])
  } else {
    gradient.addColorStop(0, colors[0] || COLOR_FALLBACKS.WHITE)
    gradient.addColorStop(1, COLOR_FALLBACKS.BLACK)
  }
  fillCapRect(ctx, rect, gradient)
}

/**
 * Draw the gradient legend based on computed geometry.
 */
export function drawGradientLegend(
  ctx: CanvasRenderingContext2D,
  geometry: GradientLegendGeometry
): void {
  const { title, gradientRect, belowMinRect, aboveMaxRect, labels, colorScale } = geometry
  const { FAMILY: fontFamily, COLOR: fontColor } = LEGEND_FONT

  // 1. Draw Title (1–2 wrapped lines, stacked from title.y)
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

  // 2. Draw Gradient Bar (the 2/3-stop palettes, or a sampled ramp of any length)
  drawGradientBar(ctx, gradientRect, colorScale)

  // 2b. Out-of-bounds end caps
  if (belowMinRect && geometry.belowMinColor) fillCapRect(ctx, belowMinRect, geometry.belowMinColor)
  if (aboveMaxRect && geometry.aboveMaxColor) fillCapRect(ctx, aboveMaxRect, geometry.aboveMaxColor)

  // 3. Draw Layout Labels (Min/Max)
  if (labels) {
    ctx.font = `${LEGEND_FONT.SIZE}px ${fontFamily}`
    ctx.fillStyle = fontColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    if (labels.min) {
      ctx.fillText(labels.min.text, labels.min.x, labels.min.y)
    }
    if (labels.max) {
      ctx.fillText(labels.max.text, labels.max.x, labels.max.y)
    }

    // 4. Draw down-ticks at both ends of the gradient bar
    const tickY1 = (gradientRect.y + gradientRect.height) | 0
    const edges = [gradientRect.x | 0, (gradientRect.x + gradientRect.width) | 0]
    ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
    ctx.lineWidth = 1
    strokeParallelLines(ctx, false, 2, i => edges[i] + 0.5, tickY1, tickY1 + 5)
  }
}

