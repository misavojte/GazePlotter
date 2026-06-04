import type { Action } from 'svelte/action'
import {
  usePlot,
  type UsePlotHandle,
} from './usePlot.svelte'
import type { CanvasPlotMargins } from './useCanvasPlot.svelte'
import {
  beginCanvasDrawing,
  finishCanvasDrawing,
  getScaledMousePosition,
} from './canvasUtils'
import {
  drawPlotArea,
  type PlotAreaTicks,
} from './plotArea'
import {
  drawXAxisLabel,
  drawYAxisMainLabel,
  getXAxisLabelOffset,
  getXAxisHeight,
  getYAxisLabelOffset,
} from './axisUtils'
import { drawCanvasPlaceholder } from './drawCanvasPlaceholder'
import type { BlockedRegion } from './canvasBlockSelectAction'
import { FONT_PRIMARY, PLOT_AXIS_TITLE_GAP, PLOT_TICK_LABEL_GAP } from './const'
import { measureTextHeight, calculateLabelOffset } from '$lib/shared/utils/textUtils'

const browser = typeof document !== 'undefined'
const FONT = FONT_PRIMARY.SIZE

/**
 * `useFramedPlot` — a declarative "plotting library" layer over `usePlot`.
 *
 * `usePlot` owns the canvas (lifecycle, DPI, export, tooltip plumbing). The
 * *frame* owns everything every figure used to copy-paste around it: the
 * begin/placeholder/clip/finish render scaffold, measurement-driven chrome
 * gutters, the `drawPlotArea` + axis-title chrome, legend-height reservation,
 * the mouse-move → hit-test → tooltip/cursor plumbing, a generic pointer/drag
 * lifecycle, and the default blocked region.
 *
 * A figure then DECLARES its plot — `placeholder`, `gutters`, `drawData`,
 * `axes`, optional `legend`/`drawOverlay`/`hitTest`/`pointer` — and writes only
 * the genuinely plot-specific marks, hit-test geometry and tooltip content.
 */

/** Per-edge gutter declaration: what to measure to reserve space on that edge. */
export interface FrameGutterEdge {
  /**
   * The tick labels that WILL be drawn on this edge. The frame measures them
   * (height on top/bottom, width on left/right) to reserve the gutter. Pass the
   * same array you feed the edge's `axes.ticks.labels` so the two never drift.
   */
  tickLabels?: string[]
  /** Axis title text on this edge. Its measured size reserves extra gutter. */
  title?: string
}

export interface FrameGutters {
  bottom?: FrameGutterEdge
  top?: FrameGutterEdge
  left?: FrameGutterEdge
  right?: FrameGutterEdge
  /** Extra fixed inset per edge, ADDED on top of the measured gutter (px). */
  pad?: { top?: number; right?: number; bottom?: number; left?: number }
  /** Height reserved for a legend block at the bottom of the canvas (px). */
  legendHeight?: number
  /** Force a centred square data rect (recurrence, square matrices). */
  square?: boolean
}

/** Axis chrome declaration. The frame maps this onto `drawPlotArea` + titles. */
export interface FrameAxis {
  ticks?: PlotAreaTicks
  title?: string
}

export interface FrameAxes {
  bottom?: FrameAxis
  top?: FrameAxis
  left?: FrameAxis
  right?: FrameAxis
}

/** Resolved plot geometry handed to drawData / drawOverlay / hitTest. */
export interface PlotFrame {
  /** Data rectangle in absolute canvas px — floored, export-margin aware. */
  x: number
  y: number
  width: number
  height: number
  right: number
  bottom: number
  /** Top of the reserved legend block (canvas px); `bottom`-aligned if none. */
  legendY: number
  /** Reactive mouse position from usePlot (null off-canvas). */
  mouseX: number | null
  mouseY: number | null
}

/** A hover result; the frame turns it into a tooltip + cursor + redraw. */
export interface FrameHit {
  tooltipId: string
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
   * Opaque payload the figure attaches in `hitTest` (e.g. the resolved cell)
   * and reads back in `onHoverChange` — so overlay-state updates never have to
   * recompute the hit geometry. The frame never inspects it.
   */
  data?: unknown
}

export interface FramePointer {
  x: number
  y: number
  isOver: boolean
  buttons: number
}

export interface FrameDrag extends FramePointer {
  startX: number
  startY: number
  dx: number
  dy: number
}

export interface FramePointerHandlers {
  onDown?: (p: FramePointer) => void
  onMove?: (p: FramePointer) => void
  onUp?: (p: FramePointer & { dragged: boolean }) => void
  /** Fires after movement passes `dragThreshold` (default 5px) while pressed. */
  onDrag?: (d: FrameDrag) => void
  dragThreshold?: number
}

export interface UseFramedPlotOptions {
  // ---- sizing (forwarded to usePlot) ----
  width: () => number
  height: () => number
  margins: () => CanvasPlotMargins
  dpiOverride?: () => number | null
  deps: () => unknown

  // ---- empty state: frame draws the placeholder and skips everything else ----
  placeholder?: () => string | null

  // ---- chrome gutters → data rect + legend reservation ----
  gutters: () => FrameGutters

  // ---- marks only (frame has begun + optionally clipped to the data rect) ----
  drawData: (ctx: CanvasRenderingContext2D, frame: PlotFrame) => void
  /** Clip drawData to the data rect. Default true; set false for matrices that
   * draw their own labels outside the cell grid. */
  clipData?: boolean

  // ---- axis chrome (frame calls drawPlotArea + axis titles) ----
  axes?: () => FrameAxes

  // ---- hover overlay, drawn unclipped on top of the chrome ----
  drawOverlay?: (ctx: CanvasRenderingContext2D, frame: PlotFrame) => void

  // ---- legend hit-test routing; the figure draws the legend inside drawData ----
  legend?: {
    hitTest?: (x: number, y: number, legendY: number) => FrameHit | null
  }

  // ---- interaction ----
  hitTest?: (x: number, y: number, frame: PlotFrame) => FrameHit | null
  /**
   * Apply hover STATE the figure keeps for its overlay (e.g. `hoveredCell`).
   * Return true when the state changed so the frame schedules a redraw. The
   * frame owns the tooltip/cursor; this is only for overlay-affecting state.
   */
  onHoverChange?: (hit: FrameHit | null, x: number | null, y: number | null) => boolean
  /** Generic pointer/drag lifecycle (panning, brushing, selection). */
  pointer?: FramePointerHandlers

  /** Override blocked regions. Default: the data rect. */
  blockedRegions?: (frame: PlotFrame) => BlockedRegion[]
}

export interface UseFramedPlotHandle {
  readonly plotAction: Action<HTMLCanvasElement>
  readonly blockedRegions: BlockedRegion[]
  /** Resolved frame geometry (reactive). */
  readonly frame: PlotFrame
  /** Escape hatch: the underlying usePlot handle. */
  readonly plot: UsePlotHandle
  readonly scheduleRender: () => void
}

interface EdgeMetrics {
  /** Total space reserved on the edge (px). */
  space: number
  /** Offset passed to the axis-title draw so the title clears the tick labels. */
  titleOffset: number
}

function maxLabelHeight(labels: string[]): number {
  let h = 0
  for (const l of labels) {
    const m = measureTextHeight(l, FONT)
    if (m > h) h = m
  }
  return h
}

/** Reserve a horizontal (top/bottom) edge: tick labels stack + optional title. */
function resolveHorizontalEdge(edge: FrameGutterEdge | undefined): EdgeMetrics {
  if (!edge) return { space: 0, titleOffset: 0 }
  const tickH = edge.tickLabels?.length ? maxLabelHeight(edge.tickLabels) : 0
  const titleH = edge.title ? measureTextHeight(edge.title, FONT) : 0
  const titleOffset = tickH ? getXAxisLabelOffset(tickH) : PLOT_AXIS_TITLE_GAP
  let space = 0
  if (tickH && titleH) space = getXAxisHeight(tickH, titleH)
  else if (tickH) space = PLOT_TICK_LABEL_GAP + tickH
  else if (titleH) space = PLOT_AXIS_TITLE_GAP + titleH
  return { space, titleOffset }
}

/** Reserve a vertical (left/right) edge: tick label width + rotated title. */
function resolveVerticalEdge(edge: FrameGutterEdge | undefined): EdgeMetrics {
  if (!edge) return { space: 0, titleOffset: 0 }
  const tickW = edge.tickLabels?.length ? calculateLabelOffset(edge.tickLabels, FONT) : 0
  const titleH = edge.title ? measureTextHeight(edge.title, FONT) : 0
  const titleOffset = tickW ? getYAxisLabelOffset(tickW) : PLOT_AXIS_TITLE_GAP
  let space = 0
  if (tickW) space += getYAxisLabelOffset(tickW)
  if (titleH) space += titleH + PLOT_AXIS_TITLE_GAP
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
 * Pure gutter resolver — carves the data rect out of the content bounds by
 * measuring the declared tick labels + titles per edge, then reserving the
 * legend block and (optionally) centring a square. Exported for unit testing;
 * the reactive `$derived` inside `useFramedPlot` is a thin wrapper over it.
 */
export function resolveFrameLayout(
  gutters: FrameGutters,
  bounds: FrameContentBounds
): ResolvedFrameLayout {
  const pad = gutters.pad ?? {}
  // top/right reserve gutter from their tick labels (mirrored matrix edges);
  // axis *titles* are only drawn on the bottom + left, so only those offsets
  // are returned.
  const left = resolveVerticalEdge(gutters.left)
  const right = resolveVerticalEdge(gutters.right)
  const top = resolveHorizontalEdge(gutters.top)
  const bottom = resolveHorizontalEdge(gutters.bottom)
  const legendHeight = gutters.legendHeight ?? 0

  const insetLeft = left.space + (pad.left ?? 0)
  const insetRight = right.space + (pad.right ?? 0)
  const insetTop = top.space + (pad.top ?? 0)
  const insetBottom = bottom.space + (pad.bottom ?? 0)

  let x0 = bounds.left + insetLeft
  let y0 = bounds.top + insetTop
  const x1 = bounds.right - insetRight
  const y1 = bounds.bottom - insetBottom - legendHeight
  let w = Math.max(0, x1 - x0)
  let h = Math.max(0, y1 - y0)

  if (gutters.square) {
    const s = Math.min(w, h)
    x0 += (w - s) / 2
    y0 += (h - s) / 2
    w = s
    h = s
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
      legendY: bounds.bottom - legendHeight,
    },
    leftTitleOffset: left.titleOffset,
    bottomTitleOffset: bottom.titleOffset,
  }
}

export function useFramedPlot(
  options: UseFramedPlotOptions
): UseFramedPlotHandle {
  // ---- resolve gutters → data rect (reactive) ----
  const resolved = $derived.by(() =>
    resolveFrameLayout(options.gutters(), {
      left: plot.plotLeft,
      top: plot.plotTop,
      right: plot.plotRight,
      bottom: plot.plotBottom,
    })
  )

  const frame = $derived.by<PlotFrame>(() => ({
    ...resolved.rect,
    mouseX: plot.mouseX,
    mouseY: plot.mouseY,
  }))

  // ---- render: the step-4 sequence, once ----
  function render() {
    beginCanvasDrawing(plot.canvasState, true)
    const ctx = plot.canvasState.context
    if (!ctx) return

    const msg = options.placeholder?.()
    if (msg) {
      drawCanvasPlaceholder(ctx, options.width(), options.height(), msg)
      finishCanvasDrawing(plot.canvasState)
      return
    }

    const r = resolved.rect
    const f = frame

    // 1. data marks (optionally clipped to the data rect)
    if (options.clipData !== false) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(r.x, r.y, r.width, r.height)
      ctx.clip()
      options.drawData(ctx, f)
      ctx.restore()
    } else {
      options.drawData(ctx, f)
    }

    // 2. axis chrome
    const axes = options.axes?.()
    if (axes) {
      drawPlotArea(ctx, {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        ticks: {
          bottom: axes.bottom?.ticks,
          top: axes.top?.ticks,
          left: axes.left?.ticks,
          right: axes.right?.ticks,
        },
      })
      if (axes.bottom?.title)
        drawXAxisLabel(ctx, axes.bottom.title, r.x, r.width, r.bottom, resolved.bottomTitleOffset)
      if (axes.left?.title)
        drawYAxisMainLabel(ctx, axes.left.title, r.x, r.y, r.height, resolved.leftTitleOffset)
    }

    // 3. hover overlay (unclipped, above chrome) — figures also draw their
    // legend here or inside drawData; the frame only routes legend hit-tests.
    options.drawOverlay?.(ctx, f)

    finishCanvasDrawing(plot.canvasState)
  }

  const hasHitLogic = !!(options.hitTest || options.legend?.hitTest)

  // ---- mouse-move: the step-5 sequence, once ----
  function handleMouseMove(x: number | null, y: number | null, isOver: boolean) {
    if (x === null || y === null) {
      // Hit-based figures: the frame clears tooltip/cursor. Pointer-only figures
      // (e.g. scarf) own that in onMove, so the frame stays hands-off.
      if (hasHitLogic) {
        const changed = options.onHoverChange?.(null, null, null) ?? false
        plot.setCursor('default')
        plot.hideTooltip(0)
        if (changed) plot.scheduleRender()
      }
      options.pointer?.onMove?.({ x: 0, y: 0, isOver: false, buttons: 0 })
      return
    }

    if (hasHitLogic) {
      const r = resolved.rect
      let hit = options.legend?.hitTest?.(x, y, r.legendY) ?? null
      if (!hit) {
        const inRect = x >= r.x && x <= r.right && y >= r.y && y <= r.bottom
        if (inRect) hit = options.hitTest?.(x, y, frame) ?? null
      }

      const changed = options.onHoverChange?.(hit, x, y) ?? false
      if (hit) {
        plot.setCursor(hit.cursor ?? 'crosshair')
        // An empty-content hit is "track-only" — it updates hover state (e.g. a
        // crosshair position) via onHoverChange but shows no tooltip.
        if (hit.content.length > 0) {
          plot.showTooltip(
            hit.tooltipId,
            hit.content,
            hit.anchorX,
            hit.anchorY,
            hit.offset,
            hit.tooltipWidth,
            hit.delay
          )
        } else {
          plot.hideTooltip(0)
        }
      } else {
        plot.setCursor('default')
        plot.hideTooltip(0)
      }
      if (changed) plot.scheduleRender()
    }

    options.pointer?.onMove?.({ x, y, isOver, buttons: 0 })
  }

  const wantsHover = hasHitLogic || !!options.pointer?.onMove

  // `render`/`handleMouseMove`/the `$derived` closures above all reference
  // `plot` before this line. That is safe by design: usePlot never invokes
  // `render` synchronously during construction (it runs via the rAF scheduler /
  // mount effect), and the deriveds are lazy — so `plot` is always initialised
  // before any closure fires. Do NOT add a synchronous render to usePlot's ctor.
  const plot = usePlot({
    render,
    width: options.width,
    height: options.height,
    margins: options.margins,
    dpiOverride: options.dpiOverride,
    deps: options.deps,
    onMouseMove: wantsHover ? handleMouseMove : undefined,
  })

  // ---- composed action: usePlot lifecycle + generic pointer/drag ----
  const scaled = (e: MouseEvent) => getScaledMousePosition(plot.canvasState, e)

  const plotAction: Action<HTMLCanvasElement> = (node) => {
    const base = plot.plotAction(node)
    const pointer = options.pointer
    let winMove: ((e: MouseEvent) => void) | null = null
    let winUp: ((e: MouseEvent) => void) | null = null

    function teardownDrag() {
      if (winMove) window.removeEventListener('mousemove', winMove)
      if (winUp) window.removeEventListener('mouseup', winUp)
      winMove = null
      winUp = null
    }

    function onDown(e: MouseEvent) {
      if (!pointer || e.button !== 0) return
      // Tear down any prior drag first — a missed mouseup (release outside the
      // window, multi-button press) must not orphan a window-listener pair.
      teardownDrag()
      const start = scaled(e)
      let started = false
      const threshold = pointer.dragThreshold ?? 5
      pointer.onDown?.({ x: start.x, y: start.y, isOver: true, buttons: e.buttons })

      winMove = (ev: MouseEvent) => {
        const p = scaled(ev)
        const dx = p.x - start.x
        const dy = p.y - start.y
        if (!started && Math.hypot(dx, dy) >= threshold) started = true
        if (started)
          pointer.onDrag?.({
            x: p.x,
            y: p.y,
            startX: start.x,
            startY: start.y,
            dx,
            dy,
            isOver: true,
            buttons: ev.buttons,
          })
      }
      winUp = (ev: MouseEvent) => {
        const p = scaled(ev)
        pointer.onUp?.({ x: p.x, y: p.y, isOver: true, buttons: ev.buttons, dragged: started })
        teardownDrag()
      }
      window.addEventListener('mousemove', winMove)
      window.addEventListener('mouseup', winUp)
    }

    if (pointer && browser) node.addEventListener('mousedown', onDown)

    return {
      update() {
        base?.update?.(undefined)
      },
      destroy() {
        if (pointer && browser) node.removeEventListener('mousedown', onDown)
        teardownDrag()
        base?.destroy?.()
      },
    }
  }

  const blockedRegions = $derived.by<BlockedRegion[]>(() => {
    if (options.blockedRegions) return options.blockedRegions(frame)
    const r = resolved.rect
    return [{ x: r.x, y: r.y, w: r.width, h: r.height }]
  })

  return {
    plotAction,
    get blockedRegions() {
      return blockedRegions
    },
    get frame() {
      return frame
    },
    get plot() {
      return plot
    },
    scheduleRender: () => plot.scheduleRender(),
  }
}
