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
  strokeParallelLines,
} from '$lib/plots/shared/canvasUtils'
import { INACTIVE_COLOR } from '$lib/color/palettes'
import { AREA_DIVIDER, GRIDLINE_PRIMARY, FONT_PRIMARY } from './const'
import type { AdaptiveTimeline } from './timelineUtils'

/** Tick-mark length (px) outward from the border; an edge with mirrored ticks reserves it. */
export const TICK_LENGTH = 5
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
 * A row heatmap (AOI timeline, metric timeline): background, the cells each row
 * `put`s in `domain` units, then row dividers. Cell edges snap to whole pixels,
 * as a fractional shared edge anti-aliases on both sides and shows a seam.
 */
export function paintRowCells(
  ctx: CanvasRenderingContext2D,
  frame: { x: number; y: number; width: number; height: number },
  rowCount: number,
  domain: [number, number],
  cells: (row: number, put: (start: number, end: number, color: string) => void) => void
): void {
  fillPlotAreaBackground(ctx, frame.x, frame.y, frame.width, frame.height, INACTIVE_COLOR)
  const right = frame.x + frame.width
  const rowHeight = frame.height / rowCount
  const pxPerUnit = frame.width / (domain[1] - domain[0])
  let rowY = 0
  let last = ''
  const put = (start: number, end: number, color: string) => {
    const x0 = Math.round(Math.max(frame.x, frame.x + (start - domain[0]) * pxPerUnit))
    const x1 = Math.round(Math.min(right, frame.x + (end - domain[0]) * pxPerUnit))
    if (x1 <= x0) return
    // An unchanged colour skips the fillStyle parse.
    if (color !== last) ctx.fillStyle = last = color
    ctx.fillRect(x0, rowY, x1 - x0, rowHeight)
  }
  for (let r = 0; r < rowCount; r++) {
    rowY = frame.y + r * rowHeight
    cells(r, put)
  }
  ctx.save()
  ctx.strokeStyle = AREA_DIVIDER.COLOR
  ctx.lineWidth = AREA_DIVIDER.WIDTH
  strokeParallelLines(
    ctx, true, rowCount - 1,
    i => alignToPixelCenter(frame.y + (i + 1) * rowHeight),
    frame.x, right
  )
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
  strokeParallelLines(
    ctx, false, len,
    i => alignToPixelCenter(floorLeft + Math.round(positions[i] * floorWidth)),
    yLine, tickEnd
  )

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
  strokeParallelLines(
    ctx, true, len,
    i => alignToPixelCenter(floorTop + Math.round(positions[i] * floorHeight)),
    xLine, tickEnd
  )

  // Labels — right-aligned on the left edge, left-aligned on the right edge.
  if (!labels) return
  ctx.textAlign = isLeft ? 'right' : 'left'
  ctx.textBaseline = 'middle'
  // A label whose tick sits near an edge is held inside it, never spilling past the border.
  const half = FONT_PRIMARY.SIZE / 2
  for (let i = 0; i < len; i++) {
    const label = labels[i]
    if (!label) continue
    const y = alignToPixelCenter(floorTop + Math.round(positions[i] * floorHeight))
    ctx.fillText(label, labelX, Math.min(floorBottom - half, Math.max(floorTop + half, y)))
  }
}

/**
 * Converts an AdaptiveTimeline into PlotAreaTicks (filters to "nice" ticks).
 * Shared helper so every caller uses the same filter consistently.
 */
export function niceTimelineTicks(timeline: AdaptiveTimeline): PlotAreaTicks {
  const niceTicks = timeline.ticks.filter(t => t.isNice)
  return {
    positions: niceTicks.map(t => t.position),
    labels: niceTicks.map(t => t.label),
  }
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
  const invMax = axisMax > 0 ? 1 / axisMax : 0
  return {
    positions: values.map(v => 1 - v * invMax),
    labels: values.map(v => format(v)),
  }
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
