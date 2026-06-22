import { GRIDLINE_PRIMARY, GRIDLINE_SECONDARY, FONT_PRIMARY, PLOT_AXIS_TITLE_GAP, PLOT_TICK_LABEL_GAP } from './const'
import { wrapTextToWidth } from '$lib/shared/utils/textUtils'

/** Max wrapped lines for an axis title before it ellipsises (bounds the gutter). */
export const MAX_AXIS_TITLE_LINES = 2

const axisLineHeight = (fontSize: number) => Math.ceil(fontSize * 1.25)

/**
 * Reserved height (px) for an axis title wrapped to `maxExtent` — the plot WIDTH
 * for a horizontal (bottom/top) title, the plot HEIGHT for a rotated (left/right)
 * one. `0` for an empty title. Callers reserve this so a wrapped (≤2-line) title
 * never overflows its gutter.
 */
export function measureAxisTitleHeight(
  label: string,
  maxExtent: number,
  fontSize: number = FONT_PRIMARY.SIZE,
  fontFamily: string = FONT_PRIMARY.FAMILY
): number {
  if (!label) return 0
  const lines = wrapTextToWidth(label, maxExtent, fontSize, fontFamily, MAX_AXIS_TITLE_LINES)
  return lines.length * axisLineHeight(fontSize)
}

/**
 * Worst-case reserved height for a wrapped axis title (the full
 * {@link MAX_AXIS_TITLE_LINES}). Use when the plot extent the title would wrap to
 * isn't knowable without a layout cycle (plots whose gutters feed back into the
 * plot size); reserving the max is safe and never under-reserves.
 */
export function maxAxisTitleHeight(fontSize: number = FONT_PRIMARY.SIZE): number {
  return MAX_AXIS_TITLE_LINES * axisLineHeight(fontSize)
}

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
 * Draws the main X-axis label (axis title, below tick labels). Wraps to the plot
 * width (≤ {@link MAX_AXIS_TITLE_LINES} lines, ellipsis beyond) so a long
 * composed label never runs past the plot edge; extra lines stack downward.
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
  const labelX = (floorLeft + floorWidth / 2) | 0
  const labelY = plotBottom + offset

  const lines = wrapTextToWidth(label, floorWidth, config.fontSize, config.fontFamily, MAX_AXIS_TITLE_LINES)
  const lineHeight = axisLineHeight(config.fontSize)
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], labelX + 0.5, labelY + i * lineHeight)
  }
  ctx.restore()
}

/**
 * Draws the main Y-axis label (rotated 90°, outside the left edge of the plot).
 * Wraps to the plot height (≤ {@link MAX_AXIS_TITLE_LINES} lines); extra lines
 * stack outward (away from the plot) so they fall within the reserved gutter.
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

  // After the −90° rotation, local −y points away from the plot (leftward), so
  // each extra wrapped line sits further into the gutter at −i·lineHeight.
  const lines = wrapTextToWidth(label, Math.floor(plotAreaHeight), config.fontSize, config.fontFamily, MAX_AXIS_TITLE_LINES)
  const lineHeight = axisLineHeight(config.fontSize)
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, -i * lineHeight)
  }
  ctx.restore()
}

/**
 * Calculates the vertical offset from the bottom of the plot area to the top of the X-axis label.
 */
export function getXAxisLabelOffset(
  tickLabelHeight: number,
  tickLabelOffset: number = PLOT_TICK_LABEL_GAP
): number {
  return tickLabelOffset + tickLabelHeight + PLOT_AXIS_TITLE_GAP
}

/**
 * Calculates the total vertical height required for the X-axis layout elements.
 */
export function getXAxisHeight(
  tickLabelHeight: number,
  axisTitleHeight: number,
  tickLabelOffset: number = PLOT_TICK_LABEL_GAP
): number {
  return getXAxisLabelOffset(tickLabelHeight, tickLabelOffset) + axisTitleHeight
}

/**
 * Calculates the horizontal offset from the left of the plot area to the rotated baseline of the Y-axis label.
 */
export function getYAxisLabelOffset(
  tickLabelWidth: number,
  tickLabelOffset: number = PLOT_TICK_LABEL_GAP
): number {
  return tickLabelOffset + tickLabelWidth + PLOT_AXIS_TITLE_GAP
}
