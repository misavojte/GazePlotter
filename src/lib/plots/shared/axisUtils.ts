import { GRIDLINE_PRIMARY, GRIDLINE_SECONDARY, FONT_PRIMARY, PLOT_AXIS_TITLE_GAP, PLOT_TICK_LABEL_GAP } from './const'
import {
  estimateTextWidth,
  truncateTextToPixelWidth,
  wrapTextToWidth,
} from '$lib/shared/utils/textUtils'

/** Max wrapped lines for an axis title before it ellipsises (bounds the gutter). */
const MAX_AXIS_TITLE_LINES = 2

/**
 * Height (px) of ONE line of axis-title text. The single owner of that step:
 * title draws stack by it, gutter reservations are multiples of it, and callers
 * that need to reason about "one line more or less" (tests, probes) ask here
 * instead of restating the number.
 */
export const axisTitleLineHeight = (fontSize: number = FONT_PRIMARY.SIZE) =>
  Math.ceil(fontSize * 1.25)

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
  return wrapAxisTitle(label, maxExtent, fontSize, fontFamily).length * axisTitleLineHeight(fontSize)
}

/**
 * An axis title's wrapped lines (≤ {@link MAX_AXIS_TITLE_LINES}, ellipsis
 * beyond), empty for an empty title. The single wrap rule, so a layout that
 * reserves per-line space (matrixLayout) and the draw that stacks the lines
 * can never disagree on the count.
 */
export function wrapAxisTitle(
  label: string,
  maxExtent: number,
  fontSize: number = FONT_PRIMARY.SIZE,
  fontFamily: string = FONT_PRIMARY.FAMILY
): string[] {
  if (!label) return []
  return wrapTextToWidth(label, maxExtent, fontSize, fontFamily, MAX_AXIS_TITLE_LINES)
}

/**
 * Truncated row labels for a heatmap's left gutter. Caps the reserved width
 * (one long name must not eat the plot; capped against the CANVAS width too, or
 * long names on a narrow card reserve everything and the plot draws nothing)
 * and pre-truncates, so the gutter reserves exactly what the figure draws.
 */
export function truncatedRowLabels(
  labels: readonly string[],
  canvasWidth: number
): string[] {
  let max = 0
  for (const label of labels) {
    const w = estimateTextWidth(label, AXIS_CONFIG.fontSize, AXIS_CONFIG.fontFamily)
    if (w > max) max = w
  }
  const budget = Math.min(200, max + 20, canvasWidth * 0.4)
  return labels.map(label =>
    truncateTextToPixelWidth(label, budget - 15, AXIS_CONFIG.fontSize, AXIS_CONFIG.fontFamily, '…')
  )
}

/**
 * Worst-case reserved height for a wrapped axis title (the full
 * {@link MAX_AXIS_TITLE_LINES}). Use when the plot extent the title would wrap to
 * isn't knowable without a layout cycle (plots whose gutters feed back into the
 * plot size); reserving the max is safe and never under-reserves.
 */
export function maxAxisTitleHeight(fontSize: number = FONT_PRIMARY.SIZE): number {
  return MAX_AXIS_TITLE_LINES * axisTitleLineHeight(fontSize)
}

interface AxisConfig {
  tickLength: number
  fontSize: number
  fontFamily: string
  color: string
  gridColor: string
  baselineColor: string
  tickLabelOffset: number
  labelOffset: number
}

export const AXIS_CONFIG: AxisConfig = {
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
  offset: number = AXIS_CONFIG.labelOffset,
  config: AxisConfig = AXIS_CONFIG
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
  const lineHeight = axisTitleLineHeight(config.fontSize)
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
  config: AxisConfig = AXIS_CONFIG
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
  const lineHeight = axisTitleLineHeight(config.fontSize)
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, -i * lineHeight)
  }
  ctx.restore()
}

/** Smallest nice tick step that thins `count` index ticks down to ≤10. */
const NICE_STEPS = [5, 10, 20, 25, 50, 100, 200, 500, 1000]

export function calculateTickStep(count: number): number {
  return NICE_STEPS.find(step => count / step <= 10) ?? 1000
}

/**
 * Distance (px) from the plot's left edge to the rotated participant-index
 * title's baseline. It clears the index tick labels drawn at
 * {@link INDEX_AXIS_TICK_GAP} plus their own width.
 */
const INDEX_AXIS_TITLE_OFFSET = 40
/** Gap (px) from the plot's left edge to the right-aligned index tick labels. */
const INDEX_AXIS_TICK_GAP = 8

/**
 * Left gutter (px) that {@link drawParticipantIndexAxis} needs — the rotated
 * title's baseline plus the half-block its two lines straddle. Derived from what
 * the draw actually uses, so a figure reserving room for that axis never has to
 * guess a width (scarf's compact label column, evolving-metrics' compact
 * heatmap).
 */
export const participantIndexAxisWidth = (
  fontSize: number = FONT_PRIMARY.SIZE
): number => INDEX_AXIS_TITLE_OFFSET + Math.ceil(axisTitleLineHeight(fontSize) / 2)

/**
 * Rotated participant-index Y axis for compact participant-row plots (scarf,
 * evolving-metrics heatmap): a two-line "Participants / [order indices]" title
 * in the left gutter plus index labels every {@link calculateTickStep} rows,
 * with the last index always shown.
 */
export function drawParticipantIndexAxis(
  ctx: CanvasRenderingContext2D,
  count: number,
  plotLeft: number,
  plotTop: number,
  rowPitch: number,
  config: AxisConfig = AXIS_CONFIG
): void {
  ctx.save()
  ctx.font = `${config.fontSize}px ${config.fontFamily}`
  ctx.fillStyle = config.color
  ctx.textBaseline = 'middle'

  ctx.save()
  ctx.textAlign = 'center'
  ctx.translate(plotLeft - INDEX_AXIS_TITLE_OFFSET, plotTop + (count * rowPitch) / 2)
  ctx.rotate(-Math.PI / 2)
  const lineHeight = axisTitleLineHeight(config.fontSize)
  ctx.fillText('Participants', 0, -lineHeight / 2)
  ctx.fillText('[order indices]', 0, lineHeight / 2)
  ctx.restore()

  ctx.textAlign = 'right'
  const tickX = plotLeft - INDEX_AXIS_TICK_GAP
  const step = calculateTickStep(count)
  for (let i = 0; i < count; i += step) {
    ctx.fillText(String(i), tickX, plotTop + i * rowPitch + rowPitch / 2)
  }
  const lastIdx = count - 1
  if (lastIdx % step !== 0) {
    ctx.fillText(String(lastIdx), tickX, plotTop + lastIdx * rowPitch + rowPitch / 2)
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
