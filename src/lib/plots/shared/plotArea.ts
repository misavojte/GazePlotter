/**
 * Plot area primitive — one function owns the "bordered rectangle with ticks"
 * chrome used by every plot in src/lib/plots/.
 *
 * `drawPlotArea` draws chrome only: tick marks + tick labels on any edge,
 * then the 1px border. It is called LAST in a plot's render so the chrome
 * sits cleanly on top of the data.
 *
 * For plots that need a background colour underneath their data, call
 * `fillPlotAreaBackground` FIRST (before the data is drawn).
 *
 * Styling is intentionally fixed — no per-call customisation knobs. Axis
 * titles (e.g. "Time [ms]", rotated Y label) are plot-level chrome and live
 * outside the plot-area rect; they stay in axisUtils.ts.
 */
import {
  alignToPixelCenter,
  strokeCrispRect,
} from '$lib/plots/shared/canvasUtils'
import { GRIDLINE_PRIMARY, FONT_PRIMARY } from './const'
import type { AdaptiveTimeline } from './timelineUtils'

const TICK_LENGTH = 5
const TICK_LABEL_GAP = 10 // gap from the edge baseline to the label

export interface PlotAreaTicks {
  /** Normalised positions along the edge (0 = left/top, 1 = right/bottom). */
  positions: number[]
  /** Optional labels aligned with `positions`. Omit for tick marks only. */
  labels?: string[]
}

export interface PlotAreaSpec {
  x: number
  y: number
  width: number
  height: number
  ticks?: {
    bottom?: PlotAreaTicks
    top?: PlotAreaTicks
    left?: PlotAreaTicks
    right?: PlotAreaTicks
  }
}

/**
 * Fills the plot-area rect with a solid color. Call BEFORE rendering data
 * when the plot needs its chrome (border/ticks) drawn later on top of the
 * data — e.g. clipped plots like the heatmap or bar plot.
 *
 * For simple plots that draw everything in a single pass, just pass
 * `background` to `drawPlotArea` instead.
 */
export function fillPlotAreaBackground(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): void {
  const floorLeft = Math.floor(x)
  const floorTop = Math.floor(y)
  const floorWidth = Math.floor(width)
  const floorHeight = Math.floor(height)
  ctx.save()
  ctx.fillStyle = color
  ctx.fillRect(floorLeft, floorTop, floorWidth, floorHeight)
  ctx.restore()
}

/**
 * Paints tick marks + tick labels on any edge, and a crisp 1px border — all
 * ON TOP of the already-drawn data. Call LAST in the plot's render pass.
 * For background fills, call `fillPlotAreaBackground` FIRST instead.
 */
export function drawPlotArea(
  ctx: CanvasRenderingContext2D,
  spec: PlotAreaSpec
): void {
  const floorLeft = Math.floor(spec.x)
  const floorTop = Math.floor(spec.y)
  const floorWidth = Math.floor(spec.width)
  const floorHeight = Math.floor(spec.height)
  const floorRight = floorLeft + floorWidth
  const floorBottom = floorTop + floorHeight

  ctx.save()

  // --- 1. Ticks + labels ---
  ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
  ctx.lineWidth = 1
  ctx.font = `${FONT_PRIMARY.SIZE}px ${FONT_PRIMARY.FAMILY}`
  ctx.fillStyle = FONT_PRIMARY.COLOR

  if (spec.ticks?.bottom) {
    drawHorizontalEdge(
      ctx,
      spec.ticks.bottom,
      floorLeft,
      floorRight,
      floorWidth,
      floorBottom,
      true
    )
  }
  if (spec.ticks?.top) {
    drawHorizontalEdge(
      ctx,
      spec.ticks.top,
      floorLeft,
      floorRight,
      floorWidth,
      floorTop,
      false
    )
  }
  if (spec.ticks?.left) {
    drawVerticalEdge(
      ctx,
      spec.ticks.left,
      floorTop,
      floorBottom,
      floorHeight,
      floorLeft,
      true
    )
  }
  if (spec.ticks?.right) {
    drawVerticalEdge(
      ctx,
      spec.ticks.right,
      floorTop,
      floorBottom,
      floorHeight,
      floorRight,
      false
    )
  }

  // --- 2. Border (last — covers any overlapping tick baselines) ---
  strokeCrispRect(
    ctx,
    floorLeft,
    floorTop,
    floorWidth,
    floorHeight,
    GRIDLINE_PRIMARY.COLOR,
    1
  )

  ctx.restore()
}

/** Draw a bottom or top edge's tick marks + labels. */
function drawHorizontalEdge(
  ctx: CanvasRenderingContext2D,
  ticks: PlotAreaTicks,
  floorLeft: number,
  floorRight: number,
  floorWidth: number,
  edgeY: number,
  isBottom: boolean
): void {
  const yLine = alignToPixelCenter(edgeY)
  const tickEnd = isBottom ? yLine + TICK_LENGTH : yLine - TICK_LENGTH
  const labelY = isBottom ? edgeY + TICK_LABEL_GAP : edgeY - TICK_LABEL_GAP
  const positions = ticks.positions
  const labels = ticks.labels
  const len = positions.length

  // Tick marks
  for (let i = 0; i < len; i++) {
    const x = alignToPixelCenter(floorLeft + Math.round(positions[i] * floorWidth))
    ctx.beginPath()
    ctx.moveTo(x, yLine)
    ctx.lineTo(x, tickEnd)
    ctx.stroke()
  }

  // Labels (with right-edge clamp so the last label never extends past the border)
  if (!labels) return
  ctx.textAlign = 'center'
  ctx.textBaseline = isBottom ? 'hanging' : 'alphabetic'
  const rightBoundary = floorRight + 0.5
  for (let i = 0; i < len; i++) {
    const label = labels[i]
    if (!label) continue
    const xRaw = floorLeft + Math.round(positions[i] * floorWidth)
    const x = alignToPixelCenter(xRaw)
    const textWidth = ctx.measureText(label).width
    const rightEdgeOfText = x + textWidth / 2
    const shift =
      rightEdgeOfText > rightBoundary ? rightEdgeOfText - rightBoundary : 0
    ctx.fillText(label, x - shift, labelY)
  }
}

/** Draw a left or right edge's tick marks + labels. */
function drawVerticalEdge(
  ctx: CanvasRenderingContext2D,
  ticks: PlotAreaTicks,
  floorTop: number,
  floorBottom: number,
  floorHeight: number,
  edgeX: number,
  isLeft: boolean
): void {
  const xLine = alignToPixelCenter(edgeX)
  const tickEnd = isLeft ? xLine - TICK_LENGTH : xLine + TICK_LENGTH
  const labelX = isLeft ? edgeX - TICK_LABEL_GAP : edgeX + TICK_LABEL_GAP
  const positions = ticks.positions
  const labels = ticks.labels
  const len = positions.length

  // Tick marks — position 0 is top, 1 is bottom (standard y-down canvas).
  for (let i = 0; i < len; i++) {
    const y = alignToPixelCenter(floorTop + Math.round(positions[i] * floorHeight))
    ctx.beginPath()
    ctx.moveTo(xLine, y)
    ctx.lineTo(tickEnd, y)
    ctx.stroke()
  }

  // Labels — right-aligned on the left edge, left-aligned on the right edge.
  if (!labels) return
  ctx.textAlign = isLeft ? 'right' : 'left'
  for (let i = 0; i < len; i++) {
    const label = labels[i]
    if (!label) continue
    const y = alignToPixelCenter(floorTop + Math.round(positions[i] * floorHeight))

    // Clamp baseline near the edges so text doesn't spill over the border.
    if (Math.abs(y - alignToPixelCenter(floorTop)) < 1) {
      ctx.textBaseline = 'top'
    } else if (Math.abs(y - alignToPixelCenter(floorBottom)) < 1) {
      ctx.textBaseline = 'bottom'
    } else {
      ctx.textBaseline = 'middle'
    }
    ctx.fillText(label, labelX, y)
  }
}

/**
 * Converts an AdaptiveTimeline into PlotAreaTicks (filters to "nice" ticks).
 * Shared helper so every caller uses the same filter consistently.
 */
export function niceTimelineTicks(timeline: AdaptiveTimeline): PlotAreaTicks {
  const positions: number[] = []
  const labels: string[] = []
  const src = timeline.ticks
  for (let i = 0; i < src.length; i++) {
    const t = src[i]
    if (!t.isNice) continue
    positions.push(t.position)
    labels.push(t.label)
  }
  return { positions, labels }
}

/**
 * Builds PlotAreaTicks from numeric tick values against a max (e.g. Y-axis
 * bottom-origin: baseline at bottom, tick values mapped to `value / axisMax`).
 * Position 0 = top, 1 = bottom (canvas y-down), so we invert.
 */
export function bottomOriginYTicks(
  values: number[],
  axisMax: number,
  format: (v: number) => string = String
): PlotAreaTicks {
  const positions: number[] = new Array(values.length)
  const labels: string[] = new Array(values.length)
  const invMax = axisMax > 0 ? 1 / axisMax : 0
  for (let i = 0; i < values.length; i++) {
    positions[i] = 1 - values[i] * invMax
    labels[i] = format(values[i])
  }
  return { positions, labels }
}

/**
 * Builds PlotAreaTicks from numeric tick values around a vertical centre
 * (e.g. diverging/centered Y-axis). Each positive value emits two ticks
 * (`+v` above centre, `-v` below). Use `labeled: false` for a tick-only edge.
 */
export function centeredYTicks(
  values: number[],
  axisHalfRange: number,
  format: (v: number) => string = String,
  labeled: boolean = true
): PlotAreaTicks {
  const positions: number[] = []
  const labels: string[] = []
  const invRange = axisHalfRange > 0 ? 1 / axisHalfRange : 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    const offset = v * invRange * 0.5 // half-height in normalised space
    positions.push(0.5 - offset)
    if (labeled) labels.push(format(v))
    if (v > 0) {
      positions.push(0.5 + offset)
      if (labeled) labels.push(`-${format(v)}`)
    }
  }
  return labeled ? { positions, labels } : { positions }
}
