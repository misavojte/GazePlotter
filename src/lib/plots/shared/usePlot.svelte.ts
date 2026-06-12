import { getContext, untrack } from 'svelte'
import type { Action } from 'svelte/action'
import {
  createCanvasState,
  createRenderScheduler,
  refreshCanvasLifecycle,
  getScaledMousePosition,
  getTooltipPosition,
  canvasLifecycleAction,
  beginCanvasDrawing,
  finishCanvasDrawing,
  type CanvasState,
  type CanvasLifecycleActionOptions,
} from './canvasUtils'
import {
  EXPORT_SOURCE_CONTEXT,
  type ExportSourceRegistrar,
  registerCanvasExportSource,
} from '$lib/data/export'
import { updateTooltip } from '$lib/tooltip'
import { drawPlotArea, type PlotAreaTicks } from './plotArea'
import {
  drawXAxisLabel,
  drawYAxisMainLabel,
  getXAxisLabelOffset,
  getXAxisHeight,
  getYAxisLabelOffset,
} from './axisUtils'
import { drawCanvasPlaceholder } from './drawCanvasPlaceholder'
import type { BlockedRegion } from './canvasBlockSelect.action'
import { FONT_PRIMARY, PLOT_AXIS_TITLE_GAP, PLOT_TICK_LABEL_GAP } from './const'
import { measureTextHeight, calculateLabelOffset } from '$lib/shared/utils/textUtils'

const browser = typeof document !== 'undefined'
const FONT = FONT_PRIMARY.SIZE

/**
 * `usePlot` — the single composable behind every GazePlotter canvas plot.
 *
 * It owns the whole stack so a figure never reimplements it: the DPI-aware
 * canvas lifecycle + export registration, the measurement-driven chrome gutters
 * that carve a data rect out of the canvas, the begin/placeholder/clip/finish
 * render scaffold, the `drawPlotArea` + axis-title chrome, the mouse-move →
 * hit-test → tooltip/cursor plumbing, and a generic pointer/drag lifecycle.
 *
 * A figure DECLARES its plot — `placeholder`, `gutters`, `drawData`, `axes`,
 * optional `legend`/`drawOverlay`/`hitTest`/`pointer` — and writes only the
 * genuinely plot-specific marks, hit-test geometry and tooltip content. The
 * lower-level surface (`showTooltip`, `plotAreaWidth`, `canvasState`, …) is on
 * the same handle for the rare figure that needs it.
 */

/** Plot margins as a geometry rectangle. */
export interface CanvasPlotMargins {
  top: number
  right: number
  bottom: number
  left: number
}

/** Zero margins — the default for on-screen rendering (export padding only). */
export const NO_MARGINS: CanvasPlotMargins = { top: 0, right: 0, bottom: 0, left: 0 }

export interface PlotProjection {
  toPixels: (val: number, clamp?: boolean) => number
  toLogical: (px: number) => number
}

// ── Frame spec types ──

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
  /** Reactive mouse position (null off-canvas). */
  mouseX: number | null
  mouseY: number | null
}

/**
 * A hover result; the composable turns it into a tooltip + cursor + redraw.
 * `THit` is the figure's own payload type (see `data`); it defaults to `unknown`
 * for figures that don't carry hover state.
 */
export interface FrameHit<THit = unknown> {
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
   * Typed payload the figure attaches in `hitTest` (e.g. the resolved cell)
   * and reads back in `onHoverChange` — so overlay-state updates never have to
   * recompute the hit geometry. The composable never inspects it.
   */
  data?: THit
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

export interface UsePlotOptions<THit = unknown> {
  // ---- sizing ----
  width: () => number
  height: () => number
  margins: () => CanvasPlotMargins
  dpiOverride?: () => number | null
  /** Reactive dependency getter — a redraw is scheduled whenever it changes. */
  deps: () => unknown

  // ---- empty state: draws the placeholder and skips everything else ----
  placeholder?: () => string | null

  // ---- chrome gutters → data rect + legend reservation ----
  gutters: () => FrameGutters

  // ---- marks only (begun + optionally clipped to the data rect) ----
  drawData: (ctx: CanvasRenderingContext2D, frame: PlotFrame) => void
  /** Clip drawData to the data rect. Default true; set false for matrices that
   * draw their own labels outside the cell grid. */
  clipData?: boolean

  // ---- axis chrome (drawPlotArea + axis titles) ----
  axes?: () => FrameAxes

  // ---- hover overlay, drawn unclipped on top of the chrome ----
  drawOverlay?: (ctx: CanvasRenderingContext2D, frame: PlotFrame) => void

  // ---- legend hit-test routing; the figure draws the legend inside drawData ----
  legend?: {
    hitTest?: (x: number, y: number, legendY: number) => FrameHit<THit> | null
  }

  // ---- interaction ----
  hitTest?: (x: number, y: number, frame: PlotFrame) => FrameHit<THit> | null
  /**
   * Apply hover STATE the figure keeps for its overlay (e.g. `hoveredCell`).
   * Return true when the state changed so a redraw is scheduled. The composable
   * owns the tooltip/cursor; this is only for overlay-affecting state.
   */
  onHoverChange?: (hit: FrameHit<THit> | null, x: number | null, y: number | null) => boolean
  /** Generic pointer/drag lifecycle (panning, brushing, selection). */
  pointer?: FramePointerHandlers

  /** Override blocked regions. Default: the data rect. */
  blockedRegions?: (frame: PlotFrame) => BlockedRegion[]
}

export interface UsePlotHandle {
  /** Svelte action — wires canvas lifecycle, mouse listeners, pointer/drag. */
  readonly plotAction: Action<HTMLCanvasElement>
  /** Blocked-select regions for `use:canvasBlockSelect`. */
  readonly blockedRegions: BlockedRegion[]
  /** Resolved frame geometry (reactive). */
  readonly frame: PlotFrame
  /** Throttled rAF render scheduler. */
  readonly scheduleRender: () => void

  // Lower-level surface (for the rare figure that needs it directly)
  readonly canvasState: CanvasState
  readonly plotAreaWidth: number
  readonly plotAreaHeight: number
  readonly plotLeft: number
  readonly plotRight: number
  readonly plotTop: number
  readonly plotBottom: number
  readonly safeWidth: number
  readonly safeHeight: number
  readonly mouseX: number | null
  readonly mouseY: number | null
  readonly isOverPlotArea: boolean
  readonly setCursor: (cursor: string) => void
  createLinearProjection: (
    min: number,
    max: number,
    pixelStart: number,
    pixelEnd: number
  ) => PlotProjection
  showTooltip: (
    id: string,
    content: Array<{ key: string; value: string }>,
    logicalX: number,
    logicalY: number,
    offset?: { x: number; y: number },
    tooltipWidth?: number,
    delay?: number
  ) => void
  hideTooltip: (delay?: number) => void
}

// ── Pure gutter resolver ──

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
 * the reactive `$derived` inside `usePlot` is a thin wrapper over it.
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

// ── The composable ──

export function usePlot<THit = unknown>(options: UsePlotOptions<THit>): UsePlotHandle {
  // ---- canvas state + DPI-aware lifecycle ----
  let canvasState = $state<CanvasState>(createCanvasState())
  const exportRegistrar = getContext<ExportSourceRegistrar | undefined>(EXPORT_SOURCE_CONTEXT)

  const getDpiOverride = () => (options.dpiOverride ? options.dpiOverride() : null)
  const getDimensions = () => ({
    width: Math.max(1, options.width()),
    height: Math.max(1, options.height()),
  })
  const getState = () => canvasState
  const setState = (next: CanvasState) => {
    canvasState = next
  }

  // Wrapped in untrack: the render runs via rAF / lifecycle, never as a tracked
  // effect, so reading the deriveds below must not establish subscriptions.
  const scheduleRender = createRenderScheduler(() => untrack(render))

  const registerExportSource = (getCanvas: () => HTMLCanvasElement | null) =>
    registerCanvasExportSource(exportRegistrar, getCanvas)

  const actionOptions: CanvasLifecycleActionOptions = $derived({
    getState,
    setState,
    getDimensions,
    getDpiOverride,
    render: () => untrack(render),
    scheduleRender,
    registerExportSource: el => registerExportSource(() => el),
  })

  function refresh() {
    refreshCanvasLifecycle({ getState, setState, getDimensions, getDpiOverride, scheduleRender })
  }

  // ---- plot bounds (content area = total minus export margins) ----
  const plotAreaWidth = $derived(
    Math.max(1, options.width() - options.margins().left - options.margins().right)
  )
  const plotAreaHeight = $derived(
    Math.max(1, options.height() - options.margins().top - options.margins().bottom)
  )
  const plotLeft = $derived(options.margins().left)
  const plotRight = $derived(options.width() - options.margins().right)
  const plotTop = $derived(options.margins().top)
  const plotBottom = $derived(options.height() - options.margins().bottom)
  const safeWidth = $derived(Math.max(1, options.width()))
  const safeHeight = $derived(Math.max(1, options.height()))

  // ---- interaction state + helpers ----
  let mouseX = $state<number | null>(null)
  let mouseY = $state<number | null>(null)
  const isOverPlotArea = $derived(
    mouseX !== null &&
      mouseY !== null &&
      mouseX >= plotLeft &&
      mouseX <= plotRight &&
      mouseY >= plotTop &&
      mouseY <= plotBottom
  )

  function setCursor(cursor: string) {
    const c = canvasState.canvas
    if (c) c.style.cursor = cursor
  }

  function createLinearProjection(
    min: number,
    max: number,
    pixelStart: number,
    pixelEnd: number
  ): PlotProjection {
    const range = max - min
    const invRange = range > 0 ? 1 / range : 0
    const pixelRange = pixelEnd - pixelStart
    return {
      toPixels(val: number, clamp = true): number {
        let ratio = (val - min) * invRange
        if (clamp) ratio = Math.max(0, Math.min(1, ratio))
        return pixelStart + ratio * pixelRange
      },
      toLogical(px: number): number {
        const ratio = pixelRange !== 0 ? (px - pixelStart) / pixelRange : 0
        return min + ratio * range
      },
    }
  }

  function showTooltip(
    id: string,
    content: Array<{ key: string; value: string }>,
    logicalX: number,
    logicalY: number,
    offset = { x: 5, y: 5 },
    tooltipWidth?: number,
    delay?: number
  ) {
    const screenPos = getTooltipPosition(canvasState, logicalX, logicalY, offset)
    updateTooltip(
      { id, visible: true, content, x: screenPos.x, y: screenPos.y, width: tooltipWidth },
      delay
    )
  }

  function hideTooltip(delay?: number) {
    updateTooltip(null, delay)
  }

  // ---- frame: gutters → data rect ----
  const resolved = $derived.by(() =>
    resolveFrameLayout(options.gutters(), {
      left: plotLeft,
      top: plotTop,
      right: plotRight,
      bottom: plotBottom,
    })
  )
  const frame = $derived.by<PlotFrame>(() => ({ ...resolved.rect, mouseX, mouseY }))

  // ---- render: begin → placeholder → clip+marks → axes → overlay → finish ----
  function render() {
    beginCanvasDrawing(canvasState, true)
    const ctx = canvasState.context
    if (!ctx) return

    const msg = options.placeholder?.()
    if (msg) {
      drawCanvasPlaceholder(ctx, options.width(), options.height(), msg)
      finishCanvasDrawing(canvasState)
      return
    }

    const r = resolved.rect
    const f = frame

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

    options.drawOverlay?.(ctx, f)

    finishCanvasDrawing(canvasState)
  }

  // ---- hover: legend-then-data hit-test → tooltip/cursor/redraw ----
  const hasHitLogic = !!(options.hitTest || options.legend?.hitTest)

  function onHover(x: number | null, y: number | null, isOver: boolean) {
    if (x === null || y === null) {
      // Hit-based figures: clear tooltip/cursor here. Pointer-only figures own
      // that in onMove, so stay hands-off for them.
      if (hasHitLogic) {
        const changed = options.onHoverChange?.(null, null, null) ?? false
        setCursor('default')
        hideTooltip(0)
        if (changed) scheduleRender()
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
        setCursor(hit.cursor ?? 'crosshair')
        // An empty-content hit is "track-only" — updates hover state via
        // onHoverChange (e.g. a crosshair position) but shows no tooltip.
        if (hit.content.length > 0) {
          showTooltip(hit.tooltipId, hit.content, hit.anchorX, hit.anchorY, hit.offset, hit.tooltipWidth, hit.delay)
        } else {
          hideTooltip(0)
        }
      } else {
        setCursor('default')
        hideTooltip(0)
      }
      if (changed) scheduleRender()
    }

    options.pointer?.onMove?.({ x, y, isOver, buttons: 0 })
  }

  const wantsHover = hasHitLogic || !!options.pointer?.onMove

  // Raw canvas mouse events → projected coords → onHover.
  function rawMouseMove(event: MouseEvent) {
    if (!canvasState.canvas) return
    const pos = getScaledMousePosition(canvasState, event)
    mouseX = pos.x
    mouseY = pos.y
    const isOver =
      pos.x >= plotLeft && pos.x <= plotRight && pos.y >= plotTop && pos.y <= plotBottom
    onHover(pos.x, pos.y, isOver)
  }
  function rawMouseLeave() {
    mouseX = null
    mouseY = null
    onHover(null, null, false)
  }

  // ---- reactive redraw triggers ----
  $effect(() => {
    // Establish dependencies on layout properties, then refresh untracked.
    const _ = [
      options.width(),
      options.height(),
      options.margins().top,
      options.margins().right,
      options.margins().bottom,
      options.margins().left,
      getDpiOverride(),
    ]
    void _
    untrack(refresh)
  })
  $effect(() => {
    options.deps()
    untrack(scheduleRender)
  })

  // ---- composed action: canvas lifecycle + mouse listeners + pointer/drag ----
  const scaled = (e: MouseEvent) => getScaledMousePosition(canvasState, e)

  const plotAction: Action<HTMLCanvasElement> = (node) => {
    const life = canvasLifecycleAction(node, actionOptions)
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

    if (wantsHover) {
      node.addEventListener('mousemove', rawMouseMove)
      node.addEventListener('mouseleave', rawMouseLeave)
    }
    if (pointer && browser) node.addEventListener('mousedown', onDown)

    return {
      update() {
        life?.update?.(actionOptions)
      },
      destroy() {
        if (wantsHover) {
          node.removeEventListener('mousemove', rawMouseMove)
          node.removeEventListener('mouseleave', rawMouseLeave)
        }
        if (pointer && browser) node.removeEventListener('mousedown', onDown)
        teardownDrag()
        life?.destroy?.()
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
    scheduleRender,
    get canvasState() {
      return canvasState
    },
    get plotAreaWidth() {
      return plotAreaWidth
    },
    get plotAreaHeight() {
      return plotAreaHeight
    },
    get plotLeft() {
      return plotLeft
    },
    get plotRight() {
      return plotRight
    },
    get plotTop() {
      return plotTop
    },
    get plotBottom() {
      return plotBottom
    },
    get safeWidth() {
      return safeWidth
    },
    get safeHeight() {
      return safeHeight
    },
    get mouseX() {
      return mouseX
    },
    get mouseY() {
      return mouseY
    },
    get isOverPlotArea() {
      return isOverPlotArea
    },
    setCursor,
    createLinearProjection,
    showTooltip,
    hideTooltip,
  }
}
