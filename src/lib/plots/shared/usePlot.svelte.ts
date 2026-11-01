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
import type { PlotPlaceholderContent } from './drawCanvasPlaceholder'
import { canvasBlockSelect, type BlockedRegion } from './canvasBlockSelect.action'
import { hoverKeyChanged, type CanvasSize, type FrameHit } from './frame'
import type { KitChrome, PlotActions, PlotHost, PlotKit } from './kit'
import { hitPlot, paintPlaceholder, paintPlot } from './plotRender'
import { usePlotStages } from './plotStages.svelte'

const browser = typeof document !== 'undefined'

const RENDER_FAILED_PLACEHOLDER: PlotPlaceholderContent = {
  message: 'Plot failed to render',
  kind: 'error',
}

export interface PlotSources<I> {
  input: () => I
  /** The canvas: TOTAL width/height and the export margin carved out of them. */
  size: () => CanvasSize
  /** The platform's services for this plot (inert in export). */
  host: () => PlotHost
}

export interface PlotEngine {
  /** Canvas lifecycle, mouse listeners, pointer/drag and the grid's block-select. */
  readonly action: Action<HTMLCanvasElement>
  readonly label: string
  readonly onclick: (() => void) | undefined
}

/**
 * The canvas engine behind the one plot host (`PlotCanvas.svelte`): it runs a
 * kit. Each pipeline step (`plotRender.ts`) is cached in an object-returning
 * derived, so it recomputes once per input or size change however often the
 * render, hover and overlay read it. Around it: the DPI-aware canvas and export
 * registration, render scheduling with a cached data layer for overlay-only
 * repaints, hover → hit → tooltip, the pointer/drag lifecycle and render-failure
 * containment.
 */
export function usePlot<I, C extends KitChrome, S, H, St>(
  kit: PlotKit<I, C, S, H, St>,
  sources: PlotSources<I>
): PlotEngine {
  const width = () => sources.size().width
  const height = () => sources.size().height
  const margin = () => sources.size().margin

  // ---- canvas + DPI-aware sizing ----
  // Plain, as only renders and handlers read it; `canvasEl` lets the sizing effect run on mount.
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

  // ---- the pipeline, one cached stage each ----
  const stages = usePlotStages(kit, { input: sources.input, size: sources.size, pixelRatio: () => pixelRatio })
  const cursor = $derived(sources.host().cursor())
  const overlayKey = $derived(
    stages.build.scene !== null && kit.overlay?.key
      ? kit.overlay.key(stages.build.scene, cursor, sources.input())
      : ''
  )
  const label = $derived(typeof kit.label === 'function' ? kit.label(sources.input()) : kit.label)

  const act: PlotActions<I, S, St> = {
    scene: () => stages.build.scene,
    input: () => sources.input(),
    frame: () => stages.layout.frame,
    settings: () => sources.host().settings() as St,
    publish: at => sources.host().publish(at),
    toggle: (key, value) => sources.host().toggle(key, value),
    draft: patch => sources.host().draft(patch as Record<string, unknown>),
    commit: patch => sources.host().commit(patch as Record<string, unknown> | undefined),
  }

  // Cached data layer (everything a full render draws EXCEPT the overlay), kept
  // at device resolution so an overlay-only repaint can blit it back 1:1.
  let dataLayer: OffscreenCanvas | HTMLCanvasElement | null = null
  let dataLayerCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null
  let dataLayerValid = false

  // Engine-owned hover state (the current hit payload). `$state.raw`: hit
  // payloads are plain objects reassigned wholesale, never mutated.
  let hoverData = $state.raw<H | null>(null)

  // ---- render failure containment ----
  // A throwing kit would otherwise freeze its canvas silently and rethrow on
  // every hover repaint (rAF runs outside the plot's <svelte:boundary>). Contain
  // it: report through the session's error service, park on the placeholder,
  // retry when the input changes (data/settings edit).
  let renderFailed = false
  // Whether the last render drew a placeholder: interaction handlers read this
  // instead of re-evaluating the pipeline on every mouse move.
  let placeholderActive = false
  let reportRenderError = (error: unknown) => console.error('Plot render failed:', error)
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
      // placeholder branch runs before any kit code can throw again.
      try {
        untrack(render)
      } catch {
        // The placeholder path must never start a throw loop.
      }
    }
  }

  // Wrapped in untrack: renders run via rAF, never as a tracked effect. Two
  // schedulers: a FULL render (data layer + overlay, recaches the layer) and an
  // OVERLAY-only render (blit + overlay). Under a same-frame race the full
  // render's data always ends up shown.
  const scheduleRender = createRenderScheduler(() => guarded(() => untrack(render)))
  const scheduleOverlayRender = createRenderScheduler(() => guarded(() => untrack(renderOverlay)))
  // A hover change only moves the overlay: blit the cached layer instead of
  // re-running the draw (a full redraw per mouse move once cost 2 s on a dense plot).
  const scheduleHoverRepaint = () => (kit.overlay ? scheduleOverlayRender() : scheduleRender())

  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (!kit.overlay || stages.build.scene === null) return
    kit.overlay.draw(ctx, stages.build.scene, stages.layout.frame, {
      hover: hoverData,
      cursor,
      input: sources.input(),
    })
  }

  // ---- render: begin → placeholder | data layer → overlay → finish ----
  function render() {
    beginCanvasDrawing(canvasState, true)
    const ctx = canvasState.context
    if (!ctx) return

    // Render failure first (it must short-circuit all kit code), then the data
    // placeholder and the fit guard (both in `build`).
    const msg = renderFailed ? RENDER_FAILED_PLACEHOLDER : stages.build.placeholder
    placeholderActive = msg !== null || stages.build.scene === null
    if (placeholderActive) {
      dataLayerValid = false
      paintPlaceholder(ctx, sources.size(), msg ?? '')
      finishCanvasDrawing(canvasState)
      return
    }

    paintPlot(ctx, kit, stages.layout, stages.build.scene as S)
    // Snapshot the data layer (device pixels) so overlay-only repaints can blit it back.
    if (kit.overlay) captureDataLayer()
    drawOverlay(ctx)
    finishCanvasDrawing(canvasState)
  }

  // Size/throw guarding lives in createScratchLayer; above its cap the cache is
  // skipped and overlay renders fall back to a full render.
  function captureDataLayer() {
    const canvas = canvasState.canvas
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    if (!dataLayer || dataLayer.width !== w || dataLayer.height !== h) {
      const scratch = createScratchLayer(w, h)
      dataLayer = scratch?.canvas ?? null
      dataLayerCtx = scratch?.ctx ?? null
    }
    if (!dataLayerCtx) {
      dataLayerValid = false
      return
    }
    dataLayerCtx.clearRect(0, 0, w, h)
    dataLayerCtx.drawImage(canvas, 0, 0)
    dataLayerValid = true
  }

  // Overlay-only repaint: blit the cached data layer, then draw the overlay.
  // Falls back to a full render when the cache is missing or stale-sized.
  function renderOverlay() {
    const canvas = canvasState.canvas
    const ctx = canvasState.context
    if (!ctx || !canvas) return
    if (
      placeholderActive ||
      !kit.overlay ||
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
    drawOverlay(ctx)
    finishCanvasDrawing(canvasState)
  }

  // ---- tooltip ----
  // The tooltip is one per session: own it before retracting it, or destroy
  // would erase a sibling's.
  const tooltip = useTooltip()
  let tooltipShown = false
  // An open right-click menu covers the plot, so hover tooltips wait for it to close.
  const contextMenu = useContextMenu()

  function setCursor(cursorStyle: string) {
    const c = canvasState.canvas
    if (c) c.style.cursor = cursorStyle
  }

  function showTooltip(hit: FrameHit<H>) {
    if (contextMenu.current) return
    const screenPos = getTooltipPosition(canvasState, hit.anchorX, hit.anchorY, hit.offset ?? { x: 5, y: 5 })
    tooltip.update(
      { content: hit.content, x: screenPos.x, y: screenPos.y, width: hit.tooltipWidth },
      hit.delay
    )
    tooltipShown = true
  }

  function hideTooltip(delay?: number) {
    tooltipShown = false
    tooltip.update(null, delay)
  }

  // ---- hover: legend → colorbar cap → kit hit, then tooltip / cursor / overlay ----
  const hasHitLogic = !!(kit.hit || kit.hitChrome || kit.legend)
  const pointer = kit.pointer?.(act)

  // Updates the hover state, fires the deduped `hover` side effect, and reports
  // whether the overlay needs a repaint (hits are fresh objects, so effectively
  // per move while hovering, and only when the kit has an overlay).
  function applyHover(hit: FrameHit<H> | null): boolean {
    const next = hit?.data ?? null
    const keyChanged = hoverKeyChanged(hoverData, next, kit.hoverKey)
    const changed = kit.overlay ? !Object.is(next, hoverData) : false
    hoverData = next
    if (keyChanged) kit.hover?.(next, act)
    return changed
  }

  function onHover(x: number | null, y: number | null, isOver: boolean) {
    if (x === null || y === null || placeholderActive) {
      // Hit-based kits: clear tooltip/cursor here. Pointer-only kits own that
      // in onMove, so stay hands-off for them.
      if (hasHitLogic) {
        const changed = applyHover(null)
        setCursor('default')
        hideTooltip(0)
        if (changed) scheduleHoverRepaint()
      }
      pointer?.onMove?.({ x: 0, y: 0, isOver: false, buttons: 0 })
      return
    }

    if (hasHitLogic) {
      const hit = hitPlot(kit, stages.layout, stages.build, sources.input(), x, y)
      const changed = applyHover(hit)
      if (hit) {
        setCursor(hit.cursor ?? 'crosshair')
        // An empty-content hit is track-only: hover state, no tooltip.
        if (hit.content.length > 0) showTooltip(hit)
        else hideTooltip(0)
      } else {
        setCursor('default')
        hideTooltip(0)
      }
      if (changed) scheduleHoverRepaint()
    }

    pointer?.onMove?.({ x, y, isOver, buttons: 0 })
  }

  const wantsHover = hasHitLogic || !!pointer?.onMove

  // Raw mouse moves coalesced to one hit-test per animation frame: a high-poll
  // mouse fires 100+ moves a second and a dense plot's hit-test can be costly.
  // Drag uses a separate window listener (see onDown), so panning stays per-event.
  let pendingMoveEvent: MouseEvent | null = null
  let moveFrameScheduled = false
  let moveFrameId = 0

  function processMove(event: MouseEvent) {
    if (!canvasState.canvas) return
    const pos = getScaledMousePosition(canvasState, event)
    const isOver =
      pos.x >= margin() && pos.x <= width() - margin() && pos.y >= margin() && pos.y <= height() - margin()
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
    onHover(null, null, false)
  }

  $effect(() => {
    if (contextMenu.current && tooltipShown) hideTooltip(0)
  })

  // ---- reactive redraw triggers ----
  // Canvas mounted, size or pixel ratio changed: resize the backing store and repaint.
  $effect(() => {
    if (!canvasEl) return
    sizeCanvas(canvasState, width(), height(), pixelRatio)
    untrack(scheduleRender)
  })
  // A new layout or scene is new pixels; it also clears a parked render failure.
  $effect(() => {
    void stages.build
    renderFailed = false
    untrack(scheduleRender)
  })
  $effect(() => {
    void overlayKey
    // Parked on a placeholder: only a full render can un-park, and an overlay
    // render would promote itself to one and redraw the card per pointer frame.
    if (placeholderActive) return
    untrack(scheduleOverlayRender)
  })

  const blockedRegions = $derived.by<BlockedRegion[]>(() => {
    const f = stages.layout.frame
    const scene = stages.build.scene
    const base = kit.blockedRegions
      ? scene === null
        ? []
        : kit.blockedRegions(scene, f)
      : [{ x: f.x, y: f.y, w: f.width, h: f.height }]
    const band = kit.legend
    const geometry = band && scene !== null ? band.geometry(scene) : null
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

  // ---- canvas action: lifecycle + mouse listeners + pointer/drag ----
  const scaled = (e: MouseEvent) => getScaledMousePosition(canvasState, e)

  const action: Action<HTMLCanvasElement> = node => {
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
      // Tear down any prior drag first: a missed mouseup (release outside the
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
        if (!started && owned && Math.hypot(totalDx, totalDy) >= threshold) started = true
        if (started) {
          pointer.onDrag?.({
            x: p.x,
            y: p.y,
            startX: start.x,
            startY: start.y,
            dx: p.x - lastX,
            dy: p.y - lastY,
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

  return {
    action,
    get label() {
      return label
    },
    onclick: kit.click && (() => kit.click?.(hoverData, act)),
  }
}
