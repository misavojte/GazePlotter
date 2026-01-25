import {
  alignToPixelCenter,
  strokeCrispRect,
} from '$lib/shared/utils/canvasUtils'
import { GRIDLINE_PRIMARY, GRIDLINE_SECONDARY, FONT_PRIMARY } from './const'
import type { AdaptiveTimeline } from './timelineUtils'

export interface AxisConfig {
  tickLength: number
  fontSize: number
  fontFamily: string
  color: string
  gridColor: string
  baselineColor: string
  tickLabelOffset: number
  labelOffset: number
}

const DEFAULT_AXIS_CONFIG: AxisConfig = {
  tickLength: 5,
  fontSize: FONT_PRIMARY.SIZE,
  fontFamily: FONT_PRIMARY.FAMILY,
  color: FONT_PRIMARY.COLOR,
  gridColor: GRIDLINE_SECONDARY.COLOR,
  baselineColor: GRIDLINE_PRIMARY.COLOR,
  tickLabelOffset: 10,
  labelOffset: 24,
}

/**
 * Draws the labels for a timeline axis at the bottom of the plot.
 */
export function drawTimelineLabels(
  ctx: CanvasRenderingContext2D,
  timeline: AdaptiveTimeline,
  plotLeft: number,
  plotAreaWidth: number,
  plotBottom: number,
  config: AxisConfig = DEFAULT_AXIS_CONFIG
): void {
  const ticks = timeline.ticks
  const len = ticks.length
  if (len === 0) return

  ctx.save()
  ctx.font = `${config.fontSize}px ${config.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'hanging'
  ctx.fillStyle = config.color

  const floorLeft = Math.floor(plotLeft)
  const floorWidth = Math.floor(plotAreaWidth)
  const yPos = plotBottom + 10
  const rightBoundary = floorLeft + floorWidth
  const isSecondToLast = len - 2
  const isLast = len - 1

  for (let i = 0; i < len; i++) {
    const tick = ticks[i]
    if (!tick.isNice) continue

    const regularXPos = alignToPixelCenter(
      floorLeft + Math.round(tick.position * floorWidth)
    )

    if ((i === isSecondToLast || i === isLast) && tick.label) {
      const textWidth = ctx.measureText(tick.label).width
      const rightEdgeOfText = regularXPos + textWidth / 2

      if (rightEdgeOfText > rightBoundary + 0.5) {
        const xPos = regularXPos - (rightEdgeOfText - (rightBoundary + 0.5))
        ctx.fillText(tick.label, xPos, yPos)
      } else {
        ctx.fillText(tick.label, regularXPos, yPos)
      }
    } else {
      ctx.fillText(tick.label, regularXPos, yPos)
    }
  }
  ctx.restore()
}

/**
 * Draws the ticks and bottom border line for an X-axis.
 */
export function drawXAxisTicksAndBorder(
  ctx: CanvasRenderingContext2D,
  timeline: AdaptiveTimeline,
  plotLeft: number,
  plotAreaWidth: number,
  plotBottom: number,
  config: AxisConfig = DEFAULT_AXIS_CONFIG,
  drawBaseline: boolean = true
): void {
  ctx.save()
  ctx.strokeStyle = config.baselineColor
  ctx.lineWidth = 1

  const floorLeft = Math.floor(plotLeft)
  const floorWidth = Math.floor(plotAreaWidth)
  const yLine = alignToPixelCenter(plotBottom)
  const ticks = timeline.ticks
  const len = ticks.length

  for (let i = 0; i < len; i++) {
    const tick = ticks[i]
    if (!tick.isNice) continue

    // Use consistent rounding logic for tick positions
    const x = alignToPixelCenter(
      floorLeft + Math.round(tick.position * floorWidth)
    )
    const y1 = yLine
    const y2 = y1 + config.tickLength

    ctx.beginPath()
    ctx.moveTo(x, y1)
    ctx.lineTo(x, y2)
    ctx.stroke()
  }

  if (drawBaseline) {
    // Draw bottom border line using same floor/round logic as strokeCrispRect
    ctx.beginPath()
    ctx.moveTo(floorLeft + 0.5, yLine)
    ctx.lineTo(floorLeft + floorWidth + 0.5, yLine)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Draws the main X-axis label.
 */
export function drawXAxisLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  plotLeft: number,
  plotAreaWidth: number,
  plotBottom: number,
  offset: number = DEFAULT_AXIS_CONFIG.labelOffset,
  config: AxisConfig = DEFAULT_AXIS_CONFIG
): void {
  ctx.save()
  ctx.font = `${config.fontSize}px ${config.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = config.color

  const floorLeft = Math.floor(plotLeft)
  const floorWidth = Math.floor(plotAreaWidth)
  const labelX = alignToPixelCenter(floorLeft + floorWidth / 2)
  const labelY = plotBottom + offset

  ctx.fillText(label, labelX, labelY)
  ctx.restore()
}

/**
 * Draws the ticks and top border line for an X-axis.
 */
export function drawTopXAxisTicksAndBorder(
  ctx: CanvasRenderingContext2D,
  timeline: AdaptiveTimeline,
  plotLeft: number,
  plotAreaWidth: number,
  plotTop: number,
  config: AxisConfig = DEFAULT_AXIS_CONFIG,
  drawBaseline: boolean = true
): void {
  ctx.save()
  ctx.strokeStyle = config.baselineColor
  ctx.lineWidth = 1

  const floorLeft = Math.floor(plotLeft)
  const floorWidth = Math.floor(plotAreaWidth)
  const yLine = alignToPixelCenter(plotTop)
  const ticks = timeline.ticks
  const len = ticks.length

  for (let i = 0; i < len; i++) {
    const tick = ticks[i]
    if (!tick.isNice) continue

    const x = alignToPixelCenter(
      floorLeft + Math.round(tick.position * floorWidth)
    )
    const y1 = yLine
    const y2 = y1 - config.tickLength

    ctx.beginPath()
    ctx.moveTo(x, y1)
    ctx.lineTo(x, y2)
    ctx.stroke()
  }

  // Draw top border line
  if (drawBaseline) {
    ctx.beginPath()
    ctx.moveTo(floorLeft + 0.5, yLine)
    ctx.lineTo(floorLeft + floorWidth + 0.5, yLine)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Draws the main Y-axis label (vertical).
 */
export function drawYAxisMainLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  plotLeft: number,
  plotTop: number,
  plotAreaHeight: number,
  offset: number = 36,
  config: AxisConfig = DEFAULT_AXIS_CONFIG
): void {
  ctx.save()
  const labelX = plotLeft - offset
  const labelY = plotTop + plotAreaHeight / 2

  ctx.translate(labelX, labelY)
  ctx.rotate(-Math.PI / 2)
  ctx.font = `${config.fontSize}px ${config.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = config.color

  ctx.fillText(label, 0, 0)
  ctx.restore()
}

/**
 * Formats a numeric axis tick for display.
 */
/**
 * Formats a numeric axis tick for display.
 */
function formatAxisTick(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value)
  if (Math.abs(value - rounded) < 1e-6) return rounded.toString()
  return value.toFixed(1).replace(/\.0$/, '')
}

/**
 * Draws a Y-axis aligned to the bottom (typically for bar charts or frequency plots).
 */
export function drawBottomYAxis(
  ctx: CanvasRenderingContext2D,
  baselineY: number,
  fullHeight: number,
  axisMax: number,
  ticks: number[],
  plotLeft: number,
  config: AxisConfig = DEFAULT_AXIS_CONFIG
): void {
  ctx.save()
  const xLabel = plotLeft - config.tickLabelOffset
  const xTick = plotLeft - config.tickLength

  ctx.font = `${config.fontSize}px ${config.fontFamily}`
  ctx.strokeStyle = config.baselineColor
  ctx.lineWidth = 1
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = config.color

  for (let i = 0; i < ticks.length; i++) {
    const value = ticks[i]
    const offset = (value / axisMax) * fullHeight
    const y = alignToPixelCenter(baselineY - offset)

    // optimize label position to stay within bounds
    if (Math.abs(y - (baselineY - fullHeight)) < 1) {
      ctx.textBaseline = 'top'
    } else if (Math.abs(y - baselineY) < 1) {
      ctx.textBaseline = 'bottom'
    } else {
      ctx.textBaseline = 'middle'
    }

    ctx.beginPath()
    ctx.moveTo(xTick, y)
    ctx.lineTo(plotLeft, y)
    ctx.stroke()
    ctx.fillText(formatAxisTick(value), xLabel, y)
  }
  ctx.restore()
}

/**
 * Draws a Y-axis centered vertically (typically for diverging or symmetric plots).
 */
export function drawCenteredYAxis(
  ctx: CanvasRenderingContext2D,
  centerY: number,
  halfHeight: number,
  axisHalfRange: number,
  ticks: number[],
  plotLeft: number,
  config: AxisConfig = DEFAULT_AXIS_CONFIG
): void {
  ctx.save()
  const xLabel = plotLeft - config.tickLabelOffset
  const xTick = plotLeft - config.tickLength

  ctx.font = `${config.fontSize}px ${config.fontFamily}`
  ctx.strokeStyle = config.baselineColor
  ctx.lineWidth = 1
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = config.color

  for (let i = 0; i < ticks.length; i++) {
    const value = ticks[i]
    const offset = (value / axisHalfRange) * halfHeight
    const yUpper = alignToPixelCenter(centerY - offset)
    const yLower = alignToPixelCenter(centerY + offset)

    // Tick and label (common for all ticks)
    // Dynamic baseline for upper tick
    if (Math.abs(yUpper - (centerY - halfHeight)) < 1) {
      ctx.textBaseline = 'top'
    } else if (Math.abs(yUpper - (centerY + halfHeight)) < 1) {
      ctx.textBaseline = 'bottom'
    } else {
      ctx.textBaseline = 'middle'
    }

    ctx.beginPath()
    ctx.moveTo(xTick, yUpper)
    ctx.lineTo(plotLeft, yUpper)
    ctx.stroke()
    ctx.fillText(formatAxisTick(value), xLabel, yUpper)

    // Parallel mirrored tick/label for positive values
    if (value > 0) {
      // Dynamic baseline for lower tick
      if (Math.abs(yLower - (centerY - halfHeight)) < 1) {
        ctx.textBaseline = 'top'
      } else if (Math.abs(yLower - (centerY + halfHeight)) < 1) {
        ctx.textBaseline = 'bottom'
      } else {
        ctx.textBaseline = 'middle'
      }

      ctx.beginPath()
      ctx.moveTo(xTick, yLower)
      ctx.lineTo(plotLeft, yLower)
      ctx.stroke()
      ctx.fillText(`-${formatAxisTick(value)}`, xLabel, yLower)
    }
  }
  ctx.restore()
}

/**
 * Draws the outline of the plot area.
 */
export function drawPlotOutline(
  ctx: CanvasRenderingContext2D,
  plotLeft: number,
  plotTop: number,
  plotWidth: number,
  plotHeight: number,
  color: string = GRIDLINE_PRIMARY.COLOR,
  width: number = GRIDLINE_PRIMARY.WIDTH
): void {
  strokeCrispRect(ctx, plotLeft, plotTop, plotWidth, plotHeight, color, width)
}

/**
 * Draws Y-axis ticks on the right side (typically for stream plots).
 */
export function drawRightYAxisTicks(
  ctx: CanvasRenderingContext2D,
  baselineY: number,
  fullHeight: number,
  axisMax: number,
  ticks: number[],
  plotRight: number,
  config: AxisConfig = DEFAULT_AXIS_CONFIG
): void {
  ctx.save()
  const xTick = plotRight + config.tickLength

  ctx.strokeStyle = config.baselineColor
  ctx.lineWidth = 1

  for (let i = 0; i < ticks.length; i++) {
    const value = ticks[i]
    const offset = (value / axisMax) * fullHeight
    const y = alignToPixelCenter(baselineY - offset)

    ctx.beginPath()
    ctx.moveTo(plotRight, y)
    ctx.lineTo(xTick, y)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Draws centered Y-axis ticks on the right side.
 */
export function drawRightCenteredYAxisTicks(
  ctx: CanvasRenderingContext2D,
  centerY: number,
  halfHeight: number,
  axisHalfRange: number,
  ticks: number[],
  plotRight: number,
  config: AxisConfig = DEFAULT_AXIS_CONFIG
): void {
  ctx.save()
  const xTick = plotRight + config.tickLength

  ctx.strokeStyle = config.baselineColor
  ctx.lineWidth = 1

  for (let i = 0; i < ticks.length; i++) {
    const value = ticks[i]
    const offset = (value / axisHalfRange) * halfHeight
    const yUpper = alignToPixelCenter(centerY - offset)
    const yLower = alignToPixelCenter(centerY + offset)

    // Upper tick
    ctx.beginPath()
    ctx.moveTo(plotRight, yUpper)
    ctx.lineTo(xTick, yUpper)
    ctx.stroke()

    // Lower tick (if positive)
    if (value > 0) {
      ctx.beginPath()
      ctx.moveTo(plotRight, yLower)
      ctx.lineTo(xTick, yLower)
      ctx.stroke()
    }
  }
  ctx.restore()
}
