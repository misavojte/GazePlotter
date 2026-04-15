import { GRIDLINE_PRIMARY, GRIDLINE_SECONDARY, FONT_PRIMARY } from './const'

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
 * Draws the main X-axis label (axis title, below tick labels).
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

  ctx.fillText(label, labelX + 0.5, labelY)
  ctx.restore()
}

/**
 * Draws the main Y-axis label (rotated 90°, outside the left edge of the plot).
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
