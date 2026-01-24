/**
 * Gradient Legend Utilities - Functional approach for canvas-based gradient legend rendering
 *
 * This module provides pure functions for computing gradient legend geometry and drawing it.
 * Designed to be plot-agnostic.
 */

import { strokeCrispRect } from '$lib/shared/utils/canvasUtils'

// ============================================================================
// TYPES
// ============================================================================

import { GRIDLINE_PRIMARY, LEGEND_FONT } from './const'

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

  // Layout components
  title?: { text: string; x: number; y: number }
  gradientRect: { x: number; y: number; width: number; height: number }
  labels?: {
    min: { text: string; x: number; y: number }
    max: { text: string; x: number; y: number }
  }

  // Interaction zones for click/hover logic
  zones: GradientLegendInteractionZones
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
  const fontSize = LEGEND_FONT.SIZE
  const fontFamily = LEGEND_FONT.FAMILY

  // Constants
  const MININALIST_THRESHOLD = 30
  const GRADIENT_HEIGHT = 12
  const MINIMALIST_HEIGHT = 8
  const MAX_WIDTH = 300
  const PADDING = 10 // general padding

  const isMinimalist = availableHeight < MININALIST_THRESHOLD

  // Layout Width
  const legendWidth = Math.min(MAX_WIDTH, availableWidth * 0.8)
  const legendX = x + ((availableWidth - legendWidth) >> 1)

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
        width: legendWidth + 20,
        height: MINIMALIST_HEIGHT + 10,
        radius: 4,
      },
    }

    // Centered title helper
    const titleObj =
      barY - y > 15
        ? {
            text: title,
            x: x + (availableWidth >> 1),
            y: barY - 2,
          }
        : undefined

    return {
      isMinimalist: true,
      totalHeight: MINIMALIST_HEIGHT + 10, // approximate
      width: legendWidth,
      x: legendX,
      y,
      gradientRect: {
        x: legendX,
        y: barY,
        width: legendWidth,
        height: MINIMALIST_HEIGHT,
      },
      title: titleObj,
      zones,
    }
  }

  // Full Mode
  // Fixed vertical layout
  // Title -> 3px gap -> Gradient (12px) -> 4px gap -> Labels

  const showTitle = availableHeight >= 30
  const titleHeight = showTitle ? 15 : 0 // approximate height for 12px font

  // Use fixed spacing
  const TITLE_GAP = 3
  const LABEL_GAP = 4
  const BAR_HEIGHT = 12

  // Center the whole block vertically in the available space?
  // Or just top-align as requested "within fixed distance"?
  // Let's top-align relative to y, or center if there's excess space to avoid it floating too high?
  // User said "height of the legendGradient should be fixed", implying the *internal* height.
  // We'll calculate the required height and center that block in availableHeight.

  const requiredHeight =
    titleHeight + (showTitle ? TITLE_GAP : 0) + BAR_HEIGHT + LABEL_GAP + 12 // 12 for label text height

  // Center vertically
  const startY = y + Math.max(0, (availableHeight - requiredHeight) / 2)

  const titleY = startY
  const gradientY = showTitle ? titleY + titleHeight + TITLE_GAP : startY
  const valuesY = gradientY + BAR_HEIGHT + LABEL_GAP

  // Title
  const titleObj = showTitle
    ? {
        text: title,
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
            x: legendX,
            y: valuesY,
          },
          max: {
            text: effectiveMaxValue.toString(),
            x: legendX + legendWidth,
            y: valuesY,
          },
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
      width: legendWidth + 20,
      height: BAR_HEIGHT + 20,
      radius: 15,
    },
  }

  return {
    isMinimalist: false,
    totalHeight: requiredHeight,
    width: legendWidth,
    x: legendX,
    y: startY,
    title: titleObj,
    gradientRect: {
      x: legendX,
      y: gradientY,
      width: legendWidth,
      height: BAR_HEIGHT,
    },
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
  const { title, gradientRect, labels, zones } = geometry
  const { colorScale } = config
  const { FAMILY: fontFamily, SIZE: fontSize, COLOR: fontColor } = LEGEND_FONT

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

  // 2. Draw Title
  if (title) {
    // Minimalist uses bottom align, Full uses top align?
    // Let's standardise based on geometry config
    ctx.font = geometry.isMinimalist
      ? `10px ${fontFamily}`
      : `12px ${fontFamily}`
    ctx.fillStyle = fontColor
    ctx.textAlign = 'center'
    ctx.textBaseline = geometry.isMinimalist ? 'bottom' : 'top'
    ctx.fillText(title.text, title.x, title.y)
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
    gradient.addColorStop(0, colorScale[0] || '#fff')
    gradient.addColorStop(1, colorScale[1] || '#000')
  }

  ctx.fillStyle = gradient
  ctx.fillRect(gx, gy, gw, gh)

  // Border
  // strokeCrispRect handles the +0.5 offset internally using (val | 0)
  strokeCrispRect(ctx, gx, gy, gw, gh, GRIDLINE_PRIMARY.COLOR, 1)

  // 4. Draw Layout Labels (Min/Max)
  if (labels) {
    ctx.font = `12px ${fontFamily}`
    ctx.fillStyle = fontColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    ctx.fillText(labels.min.text, labels.min.x, labels.min.y)
    ctx.fillText(labels.max.text, labels.max.x, labels.max.y)
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

/**
 * Hit test helper for legend interaction.
 */
export function hitTestGradientLegend(
  mouseX: number,
  mouseY: number,
  zones: GradientLegendInteractionZones
): 'none' | 'gradient' | 'minValue' | 'maxValue' {
  if (zones.minValueZone) {
    const dx = mouseX - zones.minValueZone.x
    const dy = mouseY - zones.minValueZone.y
    if (
      dx * dx + dy * dy <=
      zones.minValueZone.radius * zones.minValueZone.radius
    ) {
      return 'minValue'
    }
  }

  if (zones.maxValueZone) {
    const dx = mouseX - zones.maxValueZone.x
    const dy = mouseY - zones.maxValueZone.y
    if (
      dx * dx + dy * dy <=
      zones.maxValueZone.radius * zones.maxValueZone.radius
    ) {
      return 'maxValue'
    }
  }

  if (zones.gradientZone) {
    if (
      mouseX >= zones.gradientZone.x &&
      mouseX <= zones.gradientZone.x + zones.gradientZone.width &&
      mouseY >= zones.gradientZone.y &&
      mouseY <= zones.gradientZone.y + zones.gradientZone.height
    ) {
      return 'gradient'
    }
  }

  return 'none'
}
