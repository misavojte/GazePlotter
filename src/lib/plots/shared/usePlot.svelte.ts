import { getContext, untrack } from 'svelte'
import type { Action } from 'svelte/action'
import { getGazePlotterSession } from '$lib/session'
import {
  createRenderScheduler,
  getScaledMousePosition,
  getTooltipPosition,
  sizeCanvas,
  beginCanvasDrawing,
  finishCanvasDrawing,
  createScratchLayer,
  type CanvasState,
} from './canvasUtils'
import { useDisplayPixelRatio } from './displayPixelRatio.svelte'
import {
  EXPORT_SOURCE_CONTEXT,
  type ExportSourceRegistrar,
  registerCanvasExportSource,
} from './figureExport'
import { useTooltip } from '$lib/tooltip'
import { useContextMenu } from '$lib/context-menu'
import { drawPlotArea, type PlotAreaTicks } from './plotArea'
import {
  drawXAxisLabel,
  drawYAxisMainLabel,
  getXAxisLabelOffset,
  getXAxisHeight,
  getYAxisLabelOffset,
  measureAxisTitleHeight,
} from './axisUtils'
import {
  drawCanvasPlaceholder,
  type PlotPlaceholderContent,
} from './drawCanvasPlaceholder'
import { canvasBlockSelect, type BlockedRegion } from './canvasBlockSelect.action'
import {
  getLegendTooltipContent,
  getLegendTooltipPosition,
  hitTestLegend,
  type LegendConfig,
  type LegendGeometry,
  type LegendItemGeometry,
} from './legendRendering'
import {
  computeGradientLegendGeometry,
  drawGradientLegend,
  getGradientLegendRequiredHeight,
  type GradientLegendConfig,
  type GradientLegendGeometry,
} from './legendGradient'
import type { CanvasExportProps } from './types'
import { FONT_PRIMARY, PLOT_AXIS_TITLE_GAP, PLOT_LEGEND_GAP, PLOT_TICK_LABEL_GAP } from './const'
import { measureTextHeight, calculateTextMetrics } from '$lib/shared/textMeasure'

const browser = typeof document !== 'undefined'

const RENDER_FAILED_PLACEHOLDER: PlotPlaceholderContent = {
  message: 'Plot failed to render',
  kind: 'error',
}

/**
 * `usePlot` — the single composable behind every GazePlotter canvas plot.
 *
 * It owns the whole stack so a figure never reimplements it: the DPI-aware
 * canvas lifecycle + export registration, the measurement-driven chrome gutters
 * that carve a data rect out of the canvas, the begin/placeholder/clip/finish
 * render scaffold, the `drawPlotArea` + axis-title chrome, the mouse-move →
 * hit-test → tooltip/cursor plumbing, and a generic pointer/drag lifecycle.
 *
 * A figure hands over its `props` and DECLARES its plot — `placeholder`,
 * `axes`, `gutters`, `drawData`, optional `legend`/`gradientLegend`/
 * `drawOverlay`/`hitTest`/`pointer` — and writes only the
 * genuinely plot-specific marks, hit-test geometry and tooltip content. The
 * lower-level surface (`plotAreaWidth`, `canvasState`, …) is on
 * the same handle for the rare figure that needs it.
 */

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

/**
 * One edge's axis chrome. The frame measures its tick labels, `reserve` and
 * title (height on top/bottom, width on left/right) to reserve the gutter, and
 * draws the ticks through `drawPlotArea`. Titles are drawn on the bottom and left.
 */
export interface FrameAxis {
  ticks?: PlotAreaTicks
  title?: string
  /** Labels the figure draws itself on this edge (row labels, a scale bar, an
   *  extra origin): measured with the tick labels, never drawn by the frame. */
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

export interface UsePlotOptions<THit = unknown> {
  // ---- sizing + redraw ----
  /**
   * The figure's `$props()` object. `width`/`height`/`margin` size the canvas;
   * every other prop is a redraw dependency, so no prop can go missing from a
   * hand-kept list (a palette edit once left a heatmap stale that way).
   */
  props: () => CanvasExportProps
  /** Canvas height when it differs from the `height` prop (a DOM row below it). */
  height?: () => number
  /**
   * Figure state the props don't cover (an async media element, a drag draft,
   * a frame-derived projection): a change schedules a redraw.
   */
  deps?: () => unknown
  /**
   * `deps`' overlay-only twin, for view state the data layer doesn't depend on
   * (hover marks, a shared cursor): a change repaints `drawOverlay` over the
   * cached data layer instead of re-running `drawData`.
   *
   * The RETURN VALUE IS IGNORED — what schedules the repaint is what this getter
   * READS. So read only equality-stable `$derived`s (a number, a boolean, a joined
   * key), never a live source that changes faster than the mark does, or the
   * overlay repaints on every pointer frame for nothing.
   */
  overlayDeps?: () => unknown

  /** Data-level placeholder (missing metric, empty selection). Checked first. */
  placeholder?: () => PlotPlaceholderContent | null

  /**
   * Frame-dependent fit guard, evaluated with the resolved frame: return a
   * placeholder (see `cannotFitPlaceholder`) when the data cannot be legibly
   * rendered at the current size. The harness re-evaluates it whenever the
   * frame changes; figures never read `plot.frame` to build placeholders.
   */
  fit?: (frame: PlotFrame) => PlotPlaceholderContent | null

  // ---- axis chrome (drawPlotArea + axis titles); its labels size the gutters ----
  /** Null draws no chrome and reserves nothing (an empty result with no real axis). */
  axes?: () => FrameAxes | null
  /** Fixed insets, legend block, aspect and height cap around the measured axes. */
  gutters?: () => FrameGutters

  // ---- marks only (begun + optionally clipped to the data rect) ----
  drawData: (ctx: CanvasRenderingContext2D, frame: PlotFrame) => void
  /** Clip drawData to the data rect. Default true; set false for matrices that
   * draw their own labels outside the cell grid. */
  clipData?: boolean

  /**
   * Marks that belong ON TOP of the axis chrome. `drawPlotArea` strokes a border
   * around the data rect as its last step, so anything drawn in `drawData` that
   * touches the rect's edge gets that border painted across it — a dot sitting on
   * the axis maximum comes out sliced in half. Draw such marks here instead.
   *
   * Still part of the cached data layer, so hover repaints blit it back like any
   * other mark. This is NOT the hover layer: that is `drawOverlay`, which reruns
   * every pointer frame. Never clipped by the harness; clip inside if you need it.
   */
  drawAboveAxes?: (ctx: CanvasRenderingContext2D, frame: PlotFrame) => void

  // ---- hover overlay, drawn unclipped on top of the chrome ----
  drawOverlay?: (ctx: CanvasRenderingContext2D, frame: PlotFrame) => void

  // ---- interactive legend band; the figure draws the legend inside drawData ----
  /**
   * Declarative legend-band contract: the harness hit-tests the items
   * (standard Highlight/Dehighlight tooltip, pointer cursor) and appends each
   * item's padded rect to `blockedRegions`. Legend clicks stay with the
   * figure (pointer handlers / canvas click), which re-hit-tests the geometry.
   */
  legend?: {
    /** Reactive geometry; return null while the band is inactive
     *  (e.g. a plot mode without an interactive legend). */
    geometry: () => LegendGeometry | null
    config: LegendConfig
    /** Highlighted identifiers — drives the tooltip verb. */
    highlights: () => readonly string[]
    /** Optional payload attached to legend hits (read back via plot.hover). */
    hitData?: (item: LegendItemGeometry) => THit
  }

  /**
   * Gradient legend in the bottom band, below the x-axis: reserved to its
   * title's real line count, laid across the content width and drawn over the
   * axis chrome. Return null while the plot shows none (another mode, no data).
   */
  gradientLegend?: () => GradientLegendSlot | null

  // ---- interaction ----
  hitTest?: (x: number, y: number, frame: PlotFrame) => FrameHit<THit> | null
  /** Hit-test for chrome OUTSIDE the data rect (a legend title's tooltip). */
  hitTestChrome?: (x: number, y: number, frame: PlotFrame) => FrameHit<THit> | null
  /**
   * Dedup key for the `onHover` side effect: `onHover` fires only when the key
   * (compared with `Object.is`) changes. Defaults to the hit payload itself —
   * hits are usually fresh objects, so the default fires per move while
   * hovering and once on leave. Overlay repaints are NOT keyed by this.
   */
  hoverKey?: (data: THit) => unknown
  /** Side effect on hover-key change (e.g. notify the host of the hovered datum). */
  onHover?: (data: THit | null) => void
  /**
   * ESCAPE HATCH: figures with multi-variable overlay state apply it here and
   * return true when it changed (schedules an overlay repaint). Most figures
   * should instead read the harness-owned `plot.hover.data` in `drawOverlay`
   * and declare `hoverKey`/`onHover`. The composable owns the tooltip/cursor.
   */
  onHoverChange?: (hit: FrameHit<THit> | null, x: number | null, y: number | null) => boolean
  /** Generic pointer/drag lifecycle (panning, brushing, selection). */
  pointer?: FramePointerHandlers

  /** Override blocked regions. Default: the data rect. */
  blockedRegions?: (frame: PlotFrame) => BlockedRegion[]
}

export interface UsePlotHandle<THit = unknown> {
  /** Svelte action — wires canvas lifecycle, mouse listeners, pointer/drag and
   *  the grid's block-select over `blockedRegions`. */
  readonly plotAction: Action<HTMLCanvasElement>
  /** Where a click must not toggle grid-item selection. */
  readonly blockedRegions: BlockedRegion[]
  /** Resolved frame geometry (reactive). */
  readonly frame: PlotFrame
  /**
   * Harness-owned hover state: the current hit payload (null when nothing is
   * hovered or the pointer left). Read it in `drawOverlay` instead of keeping
   * per-figure `$state` mirrors of the hit.
   */
  readonly hover: { readonly data: THit | null }
  /** The placed `gradientLegend` (null when none), for hit-testing its title. */
  readonly gradientLegend: GradientLegendGeometry | null
  /** Its band height without the gap (0 when none); frame-independent, so a
   *  layout probe that must not read `frame` can count it. */
  readonly gradientLegendHeight: number
  // Lower-level surface (for the rare figure that needs it directly)
  readonly canvasState: CanvasState
  readonly plotAreaWidth: number
  readonly plotAreaHeight: number
}

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
 * Pure gutter resolver — carves the data rect out of the content bounds by
 * measuring each axis's labels + title, then reserving the
 * legend block and (optionally) centring a rect of a fixed aspect. Exported for unit testing;
 * the reactive `$derived` inside `usePlot` is a thin wrapper over it.
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
      // The legend block sits directly below the bottom-edge gutter, so it
      // follows the rect when a cap (maxHeight/square) shrinks + centres it,
      // and the whole block centres as one. Uncapped, this lands at the
      // reserved space at the bounds bottom as before.
      legendY: y + fh + insetBottom,
    },
    leftTitleOffset: left.titleOffset,
    bottomTitleOffset: bottom.titleOffset,
  }
}

// ── The composable ──

/** Props that size the canvas; a change resizes it rather than counting as data. */
const SIZE_PROPS = new Set(['width', 'height'])

export function usePlot<THit = unknown>(options: UsePlotOptions<THit>): UsePlotHandle<THit> {
  const props = options.props
  const width = () => props().width
  const height = options.height ?? (() => props().height)
  const margin = () => props().margin ?? 0

  // ---- canvas + DPI-aware sizing ----
  // A plain object: only renders and event handlers read it. `canvasEl` is the
  // reactive twin that lets the sizing effect run once the canvas mounts.
  const canvasState: CanvasState = { canvas: null, context: null, pixelRatio: 1 }
  let canvasEl = $state<HTMLCanvasElement | null>(null)
  const exportRegistrar = getContext<ExportSourceRegistrar | undefined>(EXPORT_SOURCE_CONTEXT)

  let display: { readonly current: number }
  try {
    display = useDisplayPixelRatio()
  } catch {
    // Outside a session tree (bare test mounts): the ratio at mount.
    display = { current: browser ? window.devicePixelRatio || 1 : 1 }
  }
  // Export renders at its own DPI (96 = 1x); on screen the canvas follows the display.
  const pixelRatio = $derived.by(() => {
    const dpi = exportRegistrar?.dpiOverride ?? null
    return dpi !== null ? dpi / 96 : display.current
  })

  // Cached data layer (everything a full render draws EXCEPT `drawOverlay`),
  // kept at device resolution so an overlay-only repaint can blit it back 1:1
  // instead of re-running drawData. Only maintained when `drawOverlay` exists.
  let dataLayer: OffscreenCanvas | HTMLCanvasElement | null = null
  let dataLayerCtx:
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null = null
  let dataLayerValid = false

  // Harness-owned hover state (the current hit payload). `$state.raw`: hit
  // payloads are plain objects reassigned wholesale, never mutated.
  let hoverData = $state.raw<THit | null>(null)

  // ---- render failure containment ----
  // A throwing figure would otherwise freeze its canvas silently and rethrow
  // on every hover repaint (rAF runs outside the plot's <svelte:boundary>).
  // Contain it: report through the session's error service, park on the
  // regular placeholder, retry when `deps` change (data/settings edit).
  let renderFailed = false
  // Whether the last render drew a placeholder — interaction handlers use
  // this instead of re-evaluating placeholder code on every mouse move.
  let placeholderActive = false
  let reportRenderError = (error: unknown) =>
    console.error('Plot render failed:', error)
  try {
    const { errorService } = getGazePlotterSession()
    reportRenderError = error =>
      errorService.report({
        origin: 'plot',
        severity: 'recoverable',
        userMessage: 'A plot failed to render. Changing its settings retries it.',
        cause: error,
      })
  } catch {
    // Outside a session tree (bare test mounts) — keep the console fallback.
  }

  function guarded(draw: () => void): void {
    try {
      draw()
    } catch (error) {
      renderFailed = true
      reportRenderError(error)
      // Repaint through the normal pipeline: with `renderFailed` set, the
      // placeholder branch runs before any figure code can throw again.
      try {
        untrack(render)
      } catch {
        // The placeholder path must never start a throw loop.
      }
    }
  }

  // Wrapped in untrack: the render runs via rAF / lifecycle, never as a tracked
  // effect, so reading the deriveds below must not establish subscriptions.
  // Two schedulers: a FULL render (drawData + overlay, recaches the data layer)
  // and an OVERLAY-only render (blit cache + drawOverlay). Under a same-frame
  // race the full render's data always ends up shown — it either runs last, or
  // the overlay blit re-shows the data layer the full render just captured.
  const scheduleRender = createRenderScheduler(() =>
    guarded(() => untrack(render))
  )
  const scheduleOverlayRender = createRenderScheduler(() =>
    guarded(() => untrack(renderOverlay))
  )

  // A hit-test figure's hover change only moves the overlay (crosshair,
  // highlight). When the plot has a `drawOverlay`, its `drawData` is
  // hover-independent and the data layer is cached, so repaint via the overlay
  // blit instead of re-running `drawData` — on a dense plot a full redraw per
  // mouse move is the difference between instant and laggy hover. Plots without
  // an overlay fall back to a full render.
  const scheduleHoverRepaint = () =>
    options.drawOverlay ? scheduleOverlayRender() : scheduleRender()

  // ---- plot bounds (content area = total minus export margins) ----
  const plotAreaWidth = $derived(Math.max(1, width() - margin() * 2))
  const plotAreaHeight = $derived(Math.max(1, height() - margin() * 2))
  const plotLeft = $derived(margin())
  const plotRight = $derived(width() - margin())
  const plotTop = $derived(margin())
  const plotBottom = $derived(height() - margin())

  // ---- interaction state + helpers ----
  // Plain lets: only event handlers read these. Keeping them out of $state
  // (and out of PlotFrame) is what makes frame-derived geometry stable
  // across mouse moves.
  let mouseX: number | null = null
  let mouseY: number | null = null

  function setCursor(cursor: string) {
    const c = canvasState.canvas
    if (c) c.style.cursor = cursor
  }

  // The tooltip is one per session: own it before retracting it, or destroy
  // would erase a sibling's.
  const tooltip = useTooltip()
  let tooltipShown = false
  // An open right-click menu covers the plot, so hover tooltips wait for it to close.
  const contextMenu = useContextMenu()

  function showTooltip(
    content: Array<{ key: string; value: string }>,
    logicalX: number,
    logicalY: number,
    offset = { x: 5, y: 5 },
    tooltipWidth?: number,
    delay?: number
  ) {
    if (contextMenu.current) return
    const screenPos = getTooltipPosition(canvasState, logicalX, logicalY, offset)
    tooltip.update(
      { content, x: screenPos.x, y: screenPos.y, width: tooltipWidth },
      delay
    )
    tooltipShown = true
  }

  function hideTooltip(delay?: number) {
    tooltipShown = false
    tooltip.update(null, delay)
  }

  // ---- gradient legend: its band height feeds the gutters ----
  const gradientSlot = $derived(options.gradientLegend?.() ?? null)
  const gradientHeight = $derived(
    gradientSlot
      ? getGradientLegendRequiredHeight(undefined, gradientSlot.title, plotAreaWidth)
      : 0
  )

  // ---- frame: axes + gutters → data rect ----
  const axes = $derived(options.axes?.() ?? null)
  const resolved = $derived.by(() => {
    const gutters = options.gutters?.() ?? {}
    const gradientBand = gradientHeight > 0 ? PLOT_LEGEND_GAP + gradientHeight : 0
    return resolveFrameLayout(
      { ...gutters, legendHeight: (gutters.legendHeight ?? 0) + gradientBand },
      { left: plotLeft, top: plotTop, right: plotRight, bottom: plotBottom },
      axes ?? {}
    )
  })
  const frame = $derived.by<PlotFrame>(() => ({
    ...resolved.rect,
    leftTitleOffset: resolved.leftTitleOffset,
    bottomTitleOffset: resolved.bottomTitleOffset,
  }))

  // The band directly below the x-axis gutter (`legendY`), across the content width.
  const gradientLegend = $derived(
    gradientSlot && gradientHeight > 0
      ? computeGradientLegendGeometry({
          x: plotLeft,
          y: frame.legendY + PLOT_LEGEND_GAP,
          availableWidth: plotAreaWidth,
          availableHeight: gradientHeight,
          ...gradientSlot,
        })
      : null
  )

  // ---- render: begin → placeholder → clip+marks → axes → overlay → finish ----
  function render() {
    beginCanvasDrawing(canvasState, true)
    const ctx = canvasState.context
    if (!ctx) return

    // Render-failure state first (it must short-circuit all figure code),
    // then data-level reasons, then the frame-fit guard.
    const msg = renderFailed
      ? RENDER_FAILED_PLACEHOLDER
      : (options.placeholder?.() ?? options.fit?.(frame) ?? null)
    placeholderActive = msg !== null
    if (msg) {
      dataLayerValid = false
      drawCanvasPlaceholder(ctx, width(), height(), msg)
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

    if (gradientLegend) drawGradientLegend(ctx, gradientLegend)

    // Marks that must sit over the axis border rather than be sliced by it.
    options.drawAboveAxes?.(ctx, f)

    // Snapshot the data layer (data + axes + above-axes marks, no overlay) so
    // overlay-only repaints can blit it back. Captures device pixels, so the
    // active dpr transform is irrelevant to the copy.
    if (options.drawOverlay) captureDataLayer()

    options.drawOverlay?.(ctx, f)

    finishCanvasDrawing(canvasState)
  }

  // Size/throw guarding lives in createScratchLayer; above its cap we skip the
  // cache and overlay renders fall back to a full render (correct, just not
  // accelerated).
  function captureDataLayer() {
    const canvas = canvasState.canvas
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    if (!dataLayer || dataLayer.width !== w || dataLayer.height !== h) {
      const layer = createScratchLayer(w, h)
      dataLayer = layer?.canvas ?? null
      dataLayerCtx = layer?.ctx ?? null
    }
    if (!dataLayerCtx) {
      dataLayerValid = false
      return
    }
    dataLayerCtx.clearRect(0, 0, w, h)
    dataLayerCtx.drawImage(canvas, 0, 0)
    dataLayerValid = true
  }

  // Overlay-only repaint: blit the cached data layer (device pixels, 1:1) then
  // draw just the overlay. Falls back to a full render if the cache is missing,
  // stale-sized, or there is no overlay to draw.
  function renderOverlay() {
    const canvas = canvasState.canvas
    const ctx = canvasState.context
    if (!ctx || !canvas) return
    if (placeholderActive) {
      render()
      return
    }
    if (
      !options.drawOverlay ||
      !dataLayer ||
      !dataLayerValid ||
      dataLayer.width !== canvas.width ||
      dataLayer.height !== canvas.height
    ) {
      render()
      return
    }
    beginCanvasDrawing(canvasState, true)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // device pixels for the 1:1 blit
    ctx.drawImage(dataLayer, 0, 0)
    ctx.restore() // back to the dpr-scaled transform for the overlay
    options.drawOverlay(ctx, frame)
    finishCanvasDrawing(canvasState)
  }

  // ---- hover: legend-then-data hit-test → tooltip/cursor/redraw ----
  const hasHitLogic = !!(options.hitTest || options.hitTestChrome || options.legend)

  // Standard legend-band hit — identical for every plot with an interactive
  // legend: identifier tooltip with the Highlight/Dehighlight verb, pointer
  // cursor, optional figure payload.
  function legendBandHit(x: number, y: number): FrameHit<THit> | null {
    const band = options.legend
    if (!band) return null
    const geometry = band.geometry()
    if (!geometry || geometry.items.length === 0) return null
    const item = hitTestLegend(geometry, band.config, x, y)
    if (!item) return null
    const pos = getLegendTooltipPosition(item, band.config)
    return {
      content: getLegendTooltipContent(
        item,
        band.highlights().includes(item.identifier)
      ),
      anchorX: pos.x,
      anchorY: pos.y,
      offset: { x: 0, y: 7 },
      cursor: 'pointer',
      data: band.hitData?.(item),
    }
  }

  // Updates the harness-owned hover state, fires the deduped `onHover` side
  // effect, and reports whether an overlay repaint is needed. The default
  // repaint policy (no custom `onHoverChange`) repaints while the payload
  // changes — hits are fresh objects, so effectively per-move while hovering —
  // and only when the figure actually has an overlay to repaint.

  function applyHover(
    hit: FrameHit<THit> | null,
    x: number | null,
    y: number | null
  ): boolean {
    const next = hit?.data ?? null
    const keyChanged = hoverKeyChanged(hoverData, next, options.hoverKey)
    const changed = options.onHoverChange
      ? options.onHoverChange(hit, x, y)
      : options.drawOverlay
        ? !Object.is(next, hoverData)
        : false
    hoverData = next
    if (keyChanged) options.onHover?.(next)
    return changed
  }

  function onHover(x: number | null, y: number | null, isOver: boolean) {
    if (x === null || y === null || placeholderActive) {
      // Hit-based figures: clear tooltip/cursor here. Pointer-only figures own
      // that in onMove, so stay hands-off for them.
      if (hasHitLogic) {
        const changed = applyHover(null, null, null)
        setCursor('default')
        hideTooltip(0)
        if (changed) scheduleHoverRepaint()
      }
      options.pointer?.onMove?.({ x: 0, y: 0, isOver: false, buttons: 0 })
      return
    }

    if (hasHitLogic) {
      const r = resolved.rect
      let hit = legendBandHit(x, y)
      if (!hit) {
        const inRect = x >= r.x && x <= r.right && y >= r.y && y <= r.bottom
        hit = (inRect ? options.hitTest : options.hitTestChrome)?.(x, y, frame) ?? null
      }

      const changed = applyHover(hit, x, y)
      if (hit) {
        setCursor(hit.cursor ?? 'crosshair')
        // An empty-content hit is "track-only" — updates hover state via
        // onHoverChange (e.g. a crosshair position) but shows no tooltip.
        if (hit.content.length > 0) {
          showTooltip(hit.content, hit.anchorX, hit.anchorY, hit.offset, hit.tooltipWidth, hit.delay)
        } else {
          hideTooltip(0)
        }
      } else {
        setCursor('default')
        hideTooltip(0)
      }
      if (changed) scheduleHoverRepaint()
    }

    options.pointer?.onMove?.({ x, y, isOver, buttons: 0 })
  }

  const wantsHover = hasHitLogic || !!options.pointer?.onMove

  // Raw canvas mouse events → projected coords → onHover, coalesced to one
  // hit-test per animation frame. A high-poll mouse fires mousemove 100+ times
  // a second and onHover's legend + data hit-test can be costly on dense plots
  // (e.g. a scarf with >1M segments); processing only the latest move per frame
  // caps that work at the frame rate, and the tooltip/crosshair update is
  // visually identical. Drag uses a separate window listener (see onDown) and is
  // unaffected, so panning stays per-event responsive.
  let pendingMoveEvent: MouseEvent | null = null
  let moveFrameScheduled = false
  let moveFrameId = 0

  function processMove(event: MouseEvent) {
    if (!canvasState.canvas) return
    const pos = getScaledMousePosition(canvasState, event)
    mouseX = pos.x
    mouseY = pos.y
    const isOver =
      pos.x >= plotLeft && pos.x <= plotRight && pos.y >= plotTop && pos.y <= plotBottom
    onHover(pos.x, pos.y, isOver)
  }

  function rawMouseMove(event: MouseEvent) {
    pendingMoveEvent = event
    if (moveFrameScheduled) return
    moveFrameScheduled = true
    moveFrameId = requestAnimationFrame(() => {
      moveFrameScheduled = false
      const e = pendingMoveEvent
      pendingMoveEvent = null
      if (e) processMove(e)
    })
  }
  function rawMouseLeave() {
    // Drop a move still queued for this frame so it cannot re-show hover after
    // the pointer has already left.
    pendingMoveEvent = null
    mouseX = null
    mouseY = null
    onHover(null, null, false)
  }

  $effect(() => {
    if (contextMenu.current && tooltipShown) hideTooltip(0)
  })

  // ---- reactive redraw triggers ----
  // Canvas mounted, CSS size or pixel ratio changed: resize the backing store
  // (a no-op when its device size is unchanged) and repaint for the new frame.
  $effect(() => {
    if (!canvasEl) return
    sizeCanvas(canvasState, width(), height(), pixelRatio)
    untrack(scheduleRender)
  })
  $effect(() => {
    const all = props() as unknown as Record<string, unknown>
    for (const key in all) {
      if (!SIZE_PROPS.has(key)) void all[key]
    }
    options.deps?.()
    // New data or settings clear a parked render failure — natural retry.
    renderFailed = false
    untrack(scheduleRender)
  })
  $effect(() => {
    options.overlayDeps?.()
    // Parked on a placeholder: only a full render can un-park, and an overlay
    // render would promote itself to one and redraw the card per pointer frame.
    if (placeholderActive) return
    untrack(scheduleOverlayRender)
  })

  // ---- composed action: canvas lifecycle + mouse listeners + pointer/drag ----
  const scaled = (e: MouseEvent) => getScaledMousePosition(canvasState, e)

  const plotAction: Action<HTMLCanvasElement> = (node) => {
    canvasState.canvas = node
    canvasState.context = node.getContext('2d')
    canvasEl = node
    const unregisterExport = registerCanvasExportSource(exportRegistrar, () => node)
    // The browser may discard the bitmap (a backgrounded tab, a GPU reset) and
    // hand back a blank one.
    const onContextRestored = () => scheduleRender()
    node.addEventListener('contextrestored', onContextRestored)
    // Read per mouse move, so the getter always hands over the current regions.
    const blockSelect = canvasBlockSelect(node, {
      get regions() {
        return blockedRegions
      },
    })
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
      if (!pointer || e.button !== 0 || placeholderActive) return
      // Tear down any prior drag first — a missed mouseup (release outside the
      // window, multi-button press) must not orphan a window-listener pair.
      teardownDrag()
      const start = scaled(e)
      const owned = pointer.ownsDragAt?.(start.x, start.y) ?? true
      let started = false
      let lastX = start.x
      let lastY = start.y
      const threshold = pointer.dragThreshold ?? 5
      pointer.onDown?.({ x: start.x, y: start.y, isOver: true, buttons: e.buttons })

      winMove = (ev: MouseEvent) => {
        const p = scaled(ev)
        const totalDx = p.x - start.x
        const totalDy = p.y - start.y
        const dx = p.x - lastX
        const dy = p.y - lastY
        if (!started && owned && Math.hypot(totalDx, totalDy) >= threshold)
          started = true
        if (started) {
          pointer.onDrag?.({
            x: p.x,
            y: p.y,
            startX: start.x,
            startY: start.y,
            dx,
            dy,
            totalDx,
            totalDy,
            isOver: true,
            buttons: ev.buttons,
          })
          lastX = p.x
          lastY = p.y
        }
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
    // Workspace pan yields where the plot owns the drag. Set on pointerdown,
    // before the press bubbles to the pan surface.
    const claimDrag = (e: PointerEvent) => {
      const p = scaled(e)
      node.toggleAttribute('data-owns-drag', pointer?.ownsDragAt?.(p.x, p.y) ?? true)
    }
    if (pointer?.onDrag) node.addEventListener('pointerdown', claimDrag)

    return {
      destroy() {
        node.removeEventListener('contextrestored', onContextRestored)
        unregisterExport?.()
        canvasEl = null
        canvasState.canvas = null
        canvasState.context = null
        if (wantsHover) {
          node.removeEventListener('mousemove', rawMouseMove)
          node.removeEventListener('mouseleave', rawMouseLeave)
          if (moveFrameScheduled) {
            cancelAnimationFrame(moveFrameId)
            moveFrameScheduled = false
            pendingMoveEvent = null
          }
        }
        if (pointer && browser) node.removeEventListener('mousedown', onDown)
        if (pointer?.onDrag) node.removeEventListener('pointerdown', claimDrag)
        teardownDrag()
        // Like the plot cursor: a plot removed under the pointer gets no
        // `mouseleave`, so it retracts itself.
        if (tooltipShown) hideTooltip(0)
        blockSelect?.destroy?.()
      },
    }
  }

  const blockedRegions = $derived.by<BlockedRegion[]>(() => {
    const r = resolved.rect
    const base = options.blockedRegions
      ? options.blockedRegions(frame)
      : [{ x: r.x, y: r.y, w: r.width, h: r.height }]
    const band = options.legend
    const geometry = band?.geometry()
    if (!band || !geometry || geometry.items.length === 0) return base
    // The legend band blocks its own items: pad = half the item spacing, the
    // same halo the hit-test's tolerance implies.
    const pad = Math.ceil(band.config.itemSpacing / 2)
    return [
      ...base,
      ...geometry.items.map(item => ({
        x: item.x - pad,
        y: item.y - pad,
        w: item.width + pad * 2,
        h: band.config.itemHeight + pad * 2,
      })),
    ]
  })

  return {
    plotAction,
    get blockedRegions() {
      return blockedRegions
    },
    get frame() {
      return frame
    },
    hover: {
      get data() {
        return hoverData
      },
    },
    get gradientLegend() {
      return gradientLegend
    },
    get gradientLegendHeight() {
      return gradientHeight
    },
    get canvasState() {
      return canvasState
    },
    get plotAreaWidth() {
      return plotAreaWidth
    },
    get plotAreaHeight() {
      return plotAreaHeight
    },
  }
}
