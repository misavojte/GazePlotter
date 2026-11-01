/**
 * The plot frame: the data rect carved out of the canvas by measured axis
 * gutters, the hover/pointer payload types and the pure gutter resolver. Plain
 * TS (no runes) so kits can import it; `usePlot` wraps the resolver in a
 * `$derived`.
 */
import type { PlotAreaTicks } from './plotArea'
import {
  getXAxisLabelOffset,
  getXAxisHeight,
  getYAxisLabelOffset,
  measureAxisTitleHeight,
} from './axisUtils'
import { getGradientLegendRequiredHeight, type GradientLegendConfig } from './legendGradient'
import { FONT_PRIMARY, PLOT_AXIS_TITLE_GAP, PLOT_LEGEND_GAP, PLOT_TICK_LABEL_GAP } from './const'
import { measureTextHeight, calculateTextMetrics } from '$lib/shared/textMeasure'

// ── Frame spec types ──

/** The fixed part of the frame; the axis gutters are measured from `axes`. */
export interface FrameGutters {
  /** Extra fixed inset per edge, ADDED on top of the measured gutter (px). */
  pad?: { top?: number; right?: number; bottom?: number; left?: number }
  /** Height reserved for a legend block at the bottom of the canvas (px). */
  legendHeight?: number
  /** Cap the data rect height (px): a taller carve shrinks to the cap and the
   *  rect centres vertically; the axis chrome and the legend block follow it,
   *  so the whole plot centres as one (row plots whose row stack stops growing
   *  at its max scale). */
  maxHeight?: number
  /** Force a centred data rect of this width/height ratio (1 = square: recurrence; an image's ratio: heatmap). */
  aspect?: number
}

/** One edge's axis chrome; its labels and title size the gutter. Titles draw on the bottom and left only. */
export interface FrameAxis {
  ticks?: PlotAreaTicks
  title?: string
  /** Labels the figure draws itself on this edge (row labels, an extra origin): measured, never drawn. */
  reserve?: string[]
}

export interface FrameAxes {
  bottom?: FrameAxis
  top?: FrameAxis
  left?: FrameAxis
  right?: FrameAxis
}

/** Resolved plot geometry handed to drawData / drawOverlay / hitTest. */
/** The hover dedup key of "pointer over nothing"; equal to no figure's key. */
const NO_HIT = Symbol('no hit')

/**
 * Whether a hover move should fire the figure's `onHover` side effect: only
 * when the dedup key changes. "No hit" has its own key, because a figure's
 * key may itself be null (scanpath's bare-panel hover is `fixationIndex:
 * null`); sharing it would dedup the LEAVE away, and `onHover(null)` would
 * never retract the plot cursor from the other plots.
 */
export function hoverKeyChanged<THit>(
  prev: THit | null,
  next: THit | null,
  hoverKey?: (data: THit) => unknown
): boolean {
  const keyOf = (d: THit | null) =>
    d === null ? NO_HIT : hoverKey ? hoverKey(d) : d
  return !Object.is(keyOf(prev), keyOf(next))
}

export interface PlotFrame {
  /** Data rectangle in absolute canvas px — floored, export-margin aware. */
  x: number
  y: number
  width: number
  height: number
  right: number
  bottom: number
  /** Top of the legend block (canvas px): directly below the bottom-edge
   *  gutter, so it follows the rect when a cap shrinks + centres it. */
  legendY: number
  /** Offset (px) from the left edge to the rotated left-axis title's baseline,
   *  past the reserved tick labels. Pass straight to `drawYAxisMainLabel` so a
   *  self-drawn title clears the tick labels the gutter measured. */
  leftTitleOffset: number
  /** Offset (px) from the plot bottom to the bottom-axis title, past the tick
   *  labels. Pass straight to `drawXAxisLabel`. */
  bottomTitleOffset: number
}

/**
 * A hover result; the composable turns it into a tooltip + cursor + redraw.
 * `THit` is the figure's own payload type (see `data`); it defaults to `unknown`
 * for figures that don't carry hover state.
 */
export interface FrameHit<THit = unknown> {
  content: Array<{ key: string; value: string }>
  /** Logical anchor for the tooltip (canvas px). */
  anchorX: number
  anchorY: number
  offset?: { x: number; y: number }
  tooltipWidth?: number
  delay?: number
  /** Cursor while this hit is active. Default 'crosshair'. */
  cursor?: string
  /**
   * Typed payload the figure attaches in `hitTest` (e.g. the resolved cell)
   * and reads back in `onHoverChange` — so overlay-state updates never have to
   * recompute the hit geometry. The composable never inspects it.
   */
  data?: THit
}

/** A track-only hit: hover state and cursor, no tooltip. */
export const trackOnlyHit = <THit>(data?: THit, cursor?: string): FrameHit<THit> => ({
  content: [],
  anchorX: 0,
  anchorY: 0,
  cursor,
  data,
})

export interface FramePointer {
  x: number
  y: number
  isOver: boolean
  buttons: number
}

export interface FrameDrag extends FramePointer {
  startX: number
  startY: number
  /** Incremental delta (px) since the previous drag event. */
  dx: number
  /** Incremental delta (px) since the previous drag event. */
  dy: number
  /** Total cumulative delta (px) since drag start. */
  totalDx: number
  /** Total cumulative delta (px) since drag start. */
  totalDy: number
}

export interface FramePointerHandlers {
  onDown?: (p: FramePointer) => void
  onMove?: (p: FramePointer) => void
  onUp?: (p: FramePointer & { dragged: boolean }) => void
  /** Fires after movement passes `dragThreshold` (default 5px) while pressed. */
  onDrag?: (d: FrameDrag) => void
  /** Where a press's drag belongs to the plot; elsewhere the workspace pans. */
  ownsDragAt?: (x: number, y: number) => boolean
  dragThreshold?: number
}

/** A bottom-band colorbar: the harness reserves, places and draws it. */
export type GradientLegendSlot = Omit<
  GradientLegendConfig,
  'x' | 'y' | 'availableWidth' | 'availableHeight'
>

// ── Pure gutter resolver ──

interface EdgeMetrics {
  /** Total space reserved on the edge (px). */
  space: number
  /** Offset passed to the axis-title draw so the title clears the tick labels. */
  titleOffset: number
}

/** Every label the edge must fit: its tick labels plus what the figure draws itself. */
function edgeLabels(edge: FrameAxis): string[] {
  const ticks = edge.ticks?.labels ?? []
  return edge.reserve ? [...ticks, ...edge.reserve] : ticks
}

function maxLabelHeight(labels: string[]): number {
  let h = 0
  for (const l of labels) {
    const m = measureTextHeight(l, FONT_PRIMARY.SIZE, FONT_PRIMARY.FAMILY)
    if (m > h) h = m
  }
  return h
}

/** Reserve a horizontal (top/bottom) edge: tick labels stack + optional title.
 *  `wrapWidth` is the plot width the title wraps to (`Infinity` for a 1-line pass). */
function resolveHorizontalEdge(edge: FrameAxis | undefined, wrapWidth: number): EdgeMetrics {
  if (!edge) return { space: 0, titleOffset: 0 }
  const labels = edgeLabels(edge)
  const tickH = labels.length ? maxLabelHeight(labels) : 0
  const titleH = edge.title ? measureAxisTitleHeight(edge.title, wrapWidth) : 0
  const titleOffset = tickH ? getXAxisLabelOffset(tickH) : PLOT_AXIS_TITLE_GAP
  let space = 0
  if (tickH && titleH) space = getXAxisHeight(tickH, titleH)
  else if (tickH) space = PLOT_TICK_LABEL_GAP + tickH
  else if (titleH) space = PLOT_AXIS_TITLE_GAP + titleH
  return { space, titleOffset }
}

/** Reserve a vertical (left/right) edge: tick label width + rotated title.
 *  `wrapHeight` is the plot height the rotated title wraps to. */
function resolveVerticalEdge(edge: FrameAxis | undefined, wrapHeight: number): EdgeMetrics {
  if (!edge) return { space: 0, titleOffset: 0 }
  const labels = edgeLabels(edge)
  const tickW = labels.length ? calculateTextMetrics(labels, FONT_PRIMARY.SIZE, FONT_PRIMARY.FAMILY).maxWidth : 0
  const titleH = edge.title ? measureAxisTitleHeight(edge.title, wrapHeight) : 0
  const titleOffset = tickW ? getYAxisLabelOffset(tickW) : PLOT_AXIS_TITLE_GAP
  // Same carve as the horizontal edge: the title gap only exists between two things.
  let space = 0
  if (titleH) space = titleOffset + titleH
  else if (tickW) space = PLOT_TICK_LABEL_GAP + tickW
  return { space, titleOffset }
}

/** Content bounds (canvas px, net of export margins) the data rect is carved from. */
export interface FrameContentBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface ResolvedFrameLayout {
  rect: {
    x: number
    y: number
    width: number
    height: number
    right: number
    bottom: number
    legendY: number
  }
  /** Offset for the left (rotated) axis title so it clears the tick labels. */
  leftTitleOffset: number
  /** Offset for the bottom axis title so it clears the tick labels. */
  bottomTitleOffset: number
}

/**
 * Pure gutter resolver: carves the data rect out of the content bounds by
 * measuring each axis's labels and title, reserving the legend block and
 * optionally centring a rect of a fixed aspect. `usePlot` wraps it in a `$derived`.
 */
export function resolveFrameLayout(
  gutters: FrameGutters,
  bounds: FrameContentBounds,
  axes: FrameAxes = {}
): ResolvedFrameLayout {
  const pad = gutters.pad ?? {}
  // top/right reserve gutter from their tick labels (mirrored matrix edges);
  // axis *titles* are only drawn on the bottom + left, so only those offsets
  // are returned.
  const legendHeight = gutters.legendHeight ?? 0
  const frameW = bounds.right - bounds.left
  const frameH = bounds.bottom - bounds.top

  // Two-pass title reservation: pass 1 sizes the gutters with single-line titles
  // (wrap to ∞) to learn the plot extent; pass 2 re-wraps each title to that
  // extent (bottom/top → width, left/right → height) so a long title reserves its
  // real (≤2-line) gutter — no overflow, and no wasted whitespace for short ones.
  const reserve = (wrapW: number, wrapH: number) => {
    const left = resolveVerticalEdge(axes.left, wrapH)
    const right = resolveVerticalEdge(axes.right, wrapH)
    const top = resolveHorizontalEdge(axes.top, wrapW)
    const bottom = resolveHorizontalEdge(axes.bottom, wrapW)
    return {
      left,
      bottom,
      insetLeft: left.space + (pad.left ?? 0),
      insetRight: right.space + (pad.right ?? 0),
      insetTop: top.space + (pad.top ?? 0),
      insetBottom: bottom.space + (pad.bottom ?? 0),
    }
  }
  const p1 = reserve(Infinity, Infinity)
  const plotW = Math.max(0, frameW - p1.insetLeft - p1.insetRight)
  const plotH = Math.max(0, frameH - p1.insetTop - p1.insetBottom - legendHeight)
  const { left, bottom, insetLeft, insetRight, insetTop, insetBottom } = reserve(plotW, plotH)

  let x0 = bounds.left + insetLeft
  let y0 = bounds.top + insetTop
  const x1 = bounds.right - insetRight
  const y1 = bounds.bottom - insetBottom - legendHeight
  let w = Math.max(0, x1 - x0)
  let h = Math.max(0, y1 - y0)

  if (gutters.maxHeight !== undefined && h > gutters.maxHeight) {
    y0 += (h - gutters.maxHeight) / 2
    h = gutters.maxHeight
  }

  if (gutters.aspect) {
    const aw = Math.min(w, h * gutters.aspect)
    const ah = aw / gutters.aspect
    x0 += (w - aw) / 2
    y0 += (h - ah) / 2
    w = aw
    h = ah
  }

  const x = Math.floor(x0)
  const y = Math.floor(y0)
  const fw = Math.floor(w)
  const fh = Math.floor(h)

  return {
    rect: {
      x,
      y,
      width: fw,
      height: fh,
      right: x + fw,
      bottom: y + fh,
      // Directly below the bottom-edge gutter, so the legend follows the rect
      // when maxHeight or aspect shrinks and centres it.
      legendY: y + fh + insetBottom,
    },
    leftTitleOffset: left.titleOffset,
    bottomTitleOffset: bottom.titleOffset,
  }
}

/** A canvas: its TOTAL width and height, and the export margin carved out of them. */
export interface CanvasSize {
  width: number
  height: number
  margin: number
}

/** The height a bottom colorbar's band needs on this canvas (its title's real line count); 0 without one. */
export function gradientBandHeight(slot: GradientLegendSlot | null, size: CanvasSize): number {
  return slot
    ? getGradientLegendRequiredHeight(slot.title, Math.max(1, size.width - size.margin * 2))
    : 0
}

/**
 * The frame a canvas draws in: the canvas less its export margin, carved by the
 * measured axes and the gutters, with the colorbar band (`gradientBandHeight`)
 * reserved under the x-axis. `usePlot` derives exactly this; a stimulus-space
 * chrome calls it to settle ticks that size their own gutters.
 */
export function resolveCanvasFrame(
  size: CanvasSize,
  gutters: FrameGutters,
  axes: FrameAxes,
  gradientHeight: number
): ResolvedFrameLayout {
  const band = gradientHeight > 0 ? PLOT_LEGEND_GAP + gradientHeight : 0
  return resolveFrameLayout(
    { ...gutters, legendHeight: (gutters.legendHeight ?? 0) + band },
    {
      left: size.margin,
      top: size.margin,
      right: size.width - size.margin,
      bottom: size.height - size.margin,
    },
    axes
  )
}
