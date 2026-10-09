<script lang="ts">
  import { untrack } from 'svelte'
  import { SYSTEM_SANS_SERIF_SMALL_STACK } from '$lib/shared/textMeasure'
  import { SCANPATH_COLORS } from '$lib/plots/scanpath/const'
  import { UI_COLORS } from '$lib/color/palettes'
  import {
    densityAlpha,
    densityGrid,
    fitView,
    hitTest,
    moveRect,
    niceTicks,
    pointsBounds,
    resizeRect,
    snapStep,
    snapValue,
    toView,
    toWorld,
    unionRect,
    zoomView,
    type Corner,
    type Insets,
    type Rect,
    type View,
  } from '$lib/data/media/mediaAlignment'

  interface Props {
    kind: 'image' | 'video'
    /** Object URL of the media; null while none is available. */
    src: string | null
    /** Fixation points in gaze coordinates, flat [x0, y0, x1, y1, ...]. */
    points: Float64Array
    /** Where the media sits in gaze coordinates; null while the typed values are invalid. */
    region: Rect | null
    /** The position when the modal opened, drawn as a dashed outline; null if none. */
    original: Rect | null
    onchange: (region: Rect) => void
    /** An edit is about to start (drag or nudge): the caller snapshots for undo. */
    onbegin?: (kind: 'drag' | 'nudge') => void
    describedBy?: string
  }

  let { kind, src, points, region, original, onchange, onbegin, describedBy }: Props =
    $props()

  // Room for the gaze-coordinate rulers along the top and left edges.
  const INSETS: Insets = { top: 24, right: 16, bottom: 16, left: 48 }
  /** Fixed, so the modal never reflows while the media is edited. */
  const HEIGHT = 312
  const HANDLE_SIZE = 8
  const HIT_RADIUS = 9
  const ZOOM_STEP = 1.15
  /** Above this many fixations, individual markers give way to a density raster. */
  const DENSE_THRESHOLD = 5000
  /** Density cell size, in CSS px. */
  const DENSITY_CELL_PX = 3
  /** SCANPATH_COLORS.fixationStroke (#a04816) as RGB, for the raster. */
  const DENSITY_RGB = [0xa0, 0x48, 0x16] as const

  let canvas: HTMLCanvasElement | null = null
  let width = $state(0)

  // The drawable media element, created per src. Videos park on their first
  // frame, as in the scanpath plot.
  let mediaEl = $state.raw<HTMLImageElement | HTMLVideoElement | null>(null)
  $effect(() => {
    mediaEl = null
    if (!src) return
    let alive = true
    const ready = (el: HTMLImageElement | HTMLVideoElement) => () => {
      if (alive) mediaEl = el
    }
    if (kind === 'image') {
      const el = new Image()
      el.onload = ready(el)
      el.src = src
    } else {
      const el = document.createElement('video')
      el.muted = true
      el.playsInline = true
      el.preload = 'auto'
      el.addEventListener('seeked', ready(el), { once: true })
      el.addEventListener('loadedmetadata', () => (el.currentTime = 0.001), {
        once: true,
      })
      el.src = src
    }
    return () => {
      alive = false
    }
  })

  // The view fits once, when the canvas opens or the fixation set changes,
  // and otherwise stays put: an edit never moves the view under the pointer.
  // Wheel zoom and panning replace it with a manual view; fit() restores it.
  let fitTarget = $state.raw<Rect | null>(null)
  let manualView = $state.raw<View | null>(null)

  function currentWorld(): Rect | null {
    const b = pointsBounds(points)
    const base = region ?? b
    return base ? unionRect(unionRect(base, b), original) : null
  }

  /** Fits the view to the media, the fixations and the starting position. */
  export function fit() {
    manualView = null
    fitTarget = currentWorld()
  }

  $effect(() => {
    void points
    untrack(fit)
  })
  $effect(() => {
    if (fitTarget === null && region) untrack(fit)
  })

  const height = HEIGHT
  const view = $derived<View | null>(
    manualView ?? (fitTarget && width > 0 ? fitView(fitTarget, width, HEIGHT, INSETS) : null)
  )
  /** Drag and nudge resolution: one canvas pixel, as a power of ten in gaze units. */
  const step = $derived(view ? snapStep(view) : 1)

  let pointer = $state<{ x: number; y: number } | null>(null)

  $effect(() => {
    if (!canvas || !view || width === 0) return
    const dpr = window.devicePixelRatio || 1
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    // Resizing the backing store clears and reallocates it: only on change.
    if (canvas.width !== pw) canvas.width = pw
    if (canvas.height !== ph) canvas.height = ph
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    draw(ctx, view, dpr)
  })

  // The fixation dots, drawn once per (points, view, size) into an offscreen
  // layer. A media drag changes none of those, so every drag frame is one
  // image copy instead of tens of thousands of arcs.
  let dotsLayer: { canvas: HTMLCanvasElement; key: string; points: Float64Array } | null =
    null
  let densityScratch: HTMLCanvasElement | null = null

  function dotsFor(v: View, dpr: number): HTMLCanvasElement {
    const key = `${v.scale}|${v.offsetX}|${v.offsetY}|${width}|${height}|${dpr}`
    if (dotsLayer && dotsLayer.key === key && dotsLayer.points === points) {
      return dotsLayer.canvas
    }
    const layer = dotsLayer?.canvas ?? document.createElement('canvas')
    layer.width = Math.round(width * dpr)
    layer.height = Math.round(height * dpr)
    const ctx = layer.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Few fixations: outlined markers, each readable on its own. Many: a
    // density raster.
    const n = points.length / 2
    if (n > DENSE_THRESHOLD) {
      // A density raster instead of one mark per fixation: count fixations
      // into small screen cells, then paint the cells as one image. Opacity
      // follows the log of the count (capped, so the media shows through);
      // a cell holding a single fixation still shows as a clear point.
      const cell = Math.max(1, Math.round(DENSITY_CELL_PX * dpr))
      const grid = densityGrid(points, v, layer.width, layer.height, dpr, cell)
      // One pixel per cell, scaled up with smoothing: soft edges for free and
      // a cols × rows write instead of a full-resolution one.
      const small = densityScratch ?? document.createElement('canvas')
      densityScratch = small
      small.width = grid.cols
      small.height = grid.rows
      const sctx = small.getContext('2d')!
      const image = sctx.createImageData(grid.cols, grid.rows)
      const data = image.data
      const [r, g, b] = DENSITY_RGB
      for (let k = 0; k < grid.counts.length; k++) {
        const count = grid.counts[k]
        if (count === 0) continue
        const o = k * 4
        data[o] = r
        data[o + 1] = g
        data[o + 2] = b
        data[o + 3] = Math.round(255 * densityAlpha(count, grid.max))
      }
      sctx.putImageData(image, 0, 0)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(small, 0, 0, grid.cols * cell, grid.rows * cell)
    } else {
      const radius = n > 2000 ? 2.5 : 3.5
      ctx.beginPath()
      for (let i = 0; i < points.length; i += 2) {
        const p = toView(v, points[i], points[i + 1])
        ctx.moveTo(p.x + radius, p.y)
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
      }
      ctx.fillStyle = SCANPATH_COLORS.fixationFill
      // Light halo under a dark rim keeps the dots legible on light and busy media.
      ctx.lineWidth = 2.5
      ctx.strokeStyle = SCANPATH_COLORS.halo
      ctx.stroke()
      ctx.globalAlpha = 0.85
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.lineWidth = 1
      ctx.strokeStyle = SCANPATH_COLORS.fixationStroke
      ctx.stroke()
    }
    dotsLayer = { canvas: layer, key, points }
    return layer
  }

  function viewRect(v: View, r: Rect) {
    const a = toView(v, r.x, r.y)
    return { x: a.x, y: a.y, w: r.width * v.scale, h: r.height * v.scale }
  }

  function draw(ctx: CanvasRenderingContext2D, v: View, dpr: number) {
    const plotX = INSETS.left
    const plotY = INSETS.top
    const plotW = width - INSETS.left - INSETS.right
    const plotH = height - INSETS.top - INSETS.bottom
    const xTicks = niceTicks(toWorld(v, plotX, 0).x, toWorld(v, plotX + plotW, 0).x, plotW / 80)
    const yTicks = niceTicks(toWorld(v, 0, plotY).y, toWorld(v, 0, plotY + plotH).y, plotH / 50)

    // Grid in gaze coordinates, under everything.
    ctx.lineWidth = 1
    ctx.strokeStyle = UI_COLORS.GRID_SECONDARY
    ctx.beginPath()
    for (const t of xTicks) {
      const x = Math.round(toView(v, t, 0).x) + 0.5
      ctx.moveTo(x, plotY)
      ctx.lineTo(x, plotY + plotH)
    }
    for (const t of yTicks) {
      const y = Math.round(toView(v, 0, t).y) + 0.5
      ctx.moveTo(plotX, y)
      ctx.lineTo(plotX + plotW, y)
    }
    ctx.stroke()

    ctx.save()
    ctx.beginPath()
    ctx.rect(plotX, plotY, plotW, plotH)
    ctx.clip()

    if (region) {
      const r = viewRect(v, region)
      if (mediaEl) {
        ctx.drawImage(mediaEl, r.x, r.y, r.w, r.h)
      } else {
        ctx.fillStyle = '#e2e8f0' // --c-grey
        ctx.fillRect(r.x, r.y, r.w, r.h)
      }
    }

    // The starting position, so every change reads against where it began.
    const moved =
      original &&
      region &&
      (original.x !== region.x ||
        original.y !== region.y ||
        original.width !== region.width ||
        original.height !== region.height)
    if (original && moved) {
      const o = viewRect(v, original)
      ctx.setLineDash([4, 3])
      ctx.strokeStyle = UI_COLORS.TEXT_SECONDARY
      ctx.strokeRect(Math.round(o.x) + 0.5, Math.round(o.y) + 0.5, Math.round(o.w), Math.round(o.h))
      ctx.setLineDash([])
      ctx.font = `11px ${SYSTEM_SANS_SERIF_SMALL_STACK}`
      ctx.textBaseline = 'top'
      const label = 'Starting position'
      const lw = ctx.measureText(label).width
      ctx.fillStyle = SCANPATH_COLORS.halo
      ctx.fillRect(Math.round(o.x) + 2, Math.round(o.y) + 2, lw + 6, 15)
      ctx.fillStyle = UI_COLORS.TEXT_SECONDARY
      ctx.fillText(label, Math.round(o.x) + 5, Math.round(o.y) + 4)
    }

    if (points.length > 0) ctx.drawImage(dotsFor(v, dpr), 0, 0, width, height)

    if (region) {
      const r = viewRect(v, region)
      ctx.lineWidth = 1
      ctx.strokeStyle = SCANPATH_COLORS.hoverRing
      ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w), Math.round(r.h))
      ctx.fillStyle = '#ffffff'
      const s = HANDLE_SIZE
      for (const [cx, cy] of [
        [r.x, r.y],
        [r.x + r.w, r.y],
        [r.x, r.y + r.h],
        [r.x + r.w, r.y + r.h],
      ]) {
        ctx.fillRect(Math.round(cx - s / 2), Math.round(cy - s / 2), s, s)
        ctx.strokeRect(Math.round(cx - s / 2) + 0.5, Math.round(cy - s / 2) + 0.5, s - 1, s - 1)
      }
    }
    ctx.restore()

    // Rulers: tick labels in gaze units along the top and left edges.
    ctx.font = `10px ${SYSTEM_SANS_SERIF_SMALL_STACK}`
    ctx.fillStyle = UI_COLORS.TEXT_SECONDARY
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'center'
    // Labels within a few px of the shared corner are dropped so the two
    // rulers never print on top of each other.
    for (const t of xTicks) {
      const x = toView(v, t, 0).x
      if (x >= plotX + 12) ctx.fillText(String(t), x, plotY - 8)
    }
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (const t of yTicks) {
      const y = toView(v, 0, t).y
      if (y >= plotY + 6) ctx.fillText(String(t), plotX - 6, y)
    }
    ctx.textAlign = 'start'
  }

  // --- Interaction ---------------------------------------------------------

  type Drag =
    | {
        kind: 'edit'
        grab: { kind: 'corner'; corner: Corner } | { kind: 'body' }
        start: Rect
        startWorld: { x: number; y: number }
        view: View
        step: number
      }
    | { kind: 'pan'; startPx: { x: number; y: number }; view: View }
  let drag: Drag | null = null
  let cursor = $state('default')

  const CURSORS: Record<Corner, string> = {
    nw: 'nwse-resize',
    se: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
  }

  function localPoint(e: MouseEvent) {
    const r = canvas!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  /** Ctrl (or Cmd) + drag pans from anywhere, also over the media. */
  const wantsPan = (e: MouseEvent) => e.ctrlKey || e.metaKey

  function hoverCursor(e: MouseEvent, p: { x: number; y: number }): string {
    if (wantsPan(e)) return 'grab'
    const grab = view && region ? hitTest(view, region, p.x, p.y, HIT_RADIUS) : null
    // Empty space pans too, so it shows the grab hand.
    return !grab ? 'grab' : grab.kind === 'body' ? 'move' : CURSORS[grab.corner]
  }

  function onPointerDown(e: PointerEvent) {
    if (!view || e.button !== 0) return
    const p = localPoint(e)
    const grab = region && !wantsPan(e) ? hitTest(view, region, p.x, p.y, HIT_RADIUS) : null
    canvas!.setPointerCapture(e.pointerId)
    // Focus, so arrow keys and Ctrl+Z work right after a click.
    canvas!.focus({ preventScroll: true })
    if (grab && region) {
      onbegin?.('drag')
      drag = { kind: 'edit', grab, start: region, startWorld: toWorld(view, p.x, p.y), view, step }
    } else {
      drag = { kind: 'pan', startPx: p, view }
      cursor = 'grabbing'
    }
    e.preventDefault()
  }

  function onPointerMove(e: PointerEvent) {
    const p = localPoint(e)
    if (!drag) {
      if (view) pointer = toWorld(view, p.x, p.y)
      cursor = hoverCursor(e, p)
      return
    }
    if (drag.kind === 'pan') {
      manualView = {
        scale: drag.view.scale,
        offsetX: drag.view.offsetX + (p.x - drag.startPx.x),
        offsetY: drag.view.offsetY + (p.y - drag.startPx.y),
      }
      return
    }
    pointer = toWorld(drag.view, p.x, p.y)
    const w = pointer
    // Only the drag DELTA is rounded, never the stored position.
    const next =
      drag.grab.kind === 'body'
        ? moveRect(
            drag.start,
            snapValue(w.x - drag.startWorld.x, drag.step),
            snapValue(w.y - drag.startWorld.y, drag.step)
          )
        : resizeRect(drag.start, drag.grab.corner, w.x, w.y, !e.shiftKey, drag.step, drag.step)
    onchange(next)
  }

  function onPointerUp(e: PointerEvent) {
    if (!drag) return
    if (canvas?.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    drag = null
    cursor = hoverCursor(e, localPoint(e))
  }

  function onPointerLeave() {
    if (!drag) pointer = null
  }

  // Ctrl (or Cmd) + wheel zooms around the pointer, for placing the media at
  // full precision; a plain wheel keeps scrolling the modal. Trackpad pinch
  // arrives as ctrl + wheel too. Attached by hand: the listener must be
  // non-passive to stop the browser's own page zoom.
  $effect(() => {
    if (!canvas) return
    const el = canvas
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !view || drag) return
      e.preventDefault()
      const p = localPoint(e)
      manualView = zoomView(view, e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, p.x, p.y)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const NUDGE: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }

  function onKeyDown(e: KeyboardEvent) {
    const dir = NUDGE[e.key]
    if (!dir || !region) return
    e.preventDefault()
    onbegin?.('nudge')
    const by = step * (e.shiftKey ? 10 : 1)
    onchange(moveRect(region, dir[0] * by, dir[1] * by))
  }

  const decimals = $derived(Math.max(0, -Math.floor(Math.log10(step))))
</script>

<div class="frame" bind:clientWidth={width}>
  <canvas
    bind:this={canvas}
    style:width="{width}px"
    style:height="{height}px"
    style:cursor
    tabindex="0"
    aria-label="Drag the media to move it, drag a corner to resize it, or use the arrow keys."
    aria-describedby={describedBy}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onpointerleave={onPointerLeave}
    ondblclick={fit}
    onkeydown={onKeyDown}
  ></canvas>
</div>
<div class="readout" aria-live="off">
  {#if pointer}
    Pointer at x {pointer.x.toFixed(decimals)}, y {pointer.y.toFixed(decimals)}
  {:else}
    Ctrl + scroll to zoom, Ctrl + drag to pan, double-click to fit
  {/if}
  <span class="step">Drag and arrow-key step: {step} (Shift: {step * 10})</span>
</div>

<style>
  .frame {
    background: var(--c-white);
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    overflow: hidden;
    line-height: 0;
  }

  canvas {
    display: block;
    touch-action: none;
  }

  canvas:focus-visible {
    outline: 2px solid var(--c-brand);
    outline-offset: -2px;
  }

  .readout {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: var(--text-sm);
    font-family: var(--font-small);
    font-variant-numeric: tabular-nums;
    color: var(--c-darkgrey);
  }
</style>
