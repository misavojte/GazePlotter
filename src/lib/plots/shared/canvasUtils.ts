/**
 * Canvas utility functions for DPI-aware sizing, mouse position calculations,
 * and crisp rendering on high-resolution displays.
 */

const browser = typeof document !== 'undefined'
import { UI_COLORS } from '$lib/color'

/** A plot's canvas and its device pixels per CSS pixel. */
export interface CanvasState {
  canvas: HTMLCanvasElement | null
  context: CanvasRenderingContext2D | null
  pixelRatio: number
}

/**
 * Sizes the canvas to `width` x `height` CSS px at `pixelRatio`. The backing
 * store is only reassigned when its device-pixel size changes, because that
 * clears the bitmap.
 */
export function sizeCanvas(
  state: CanvasState,
  width: number,
  height: number,
  pixelRatio: number
): void {
  const { canvas } = state
  if (!canvas) return

  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1
  const w = Number.isFinite(width) ? Math.max(1, width) : 1
  const h = Number.isFinite(height) ? Math.max(1, height) : 1
  const deviceW = Math.round(w * ratio)
  const deviceH = Math.round(h * ratio)

  if (canvas.width !== deviceW) canvas.width = deviceW
  if (canvas.height !== deviceH) canvas.height = deviceH
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  state.pixelRatio = ratio
}

/**
 * Gets correctly scaled mouse coordinates considering DPI and canvas transformations
 * @param state - Current canvas state
 * @param event - Mouse event
 * @returns Scaled coordinates {x, y} in logical (pre-scaling) coordinates
 */
export function getScaledMousePosition(
  state: CanvasState,
  event: MouseEvent
): { x: number; y: number } {
  const { canvas, pixelRatio } = state
  if (!canvas || !browser) return { x: 0, y: 0 }

  // Always get the latest rect for accurate coordinates
  const rect = canvas.getBoundingClientRect()

  // Calculate CSS pixels (position in the displayed element)
  const cssX = event.clientX - rect.left
  const cssY = event.clientY - rect.top

  // Convert to canvas coordinates (accounting for DPI scaling)
  // 1. Convert CSS pixels to a percentage of the canvas visual size
  // 2. Apply that percentage to the actual canvas dimensions (which include DPI scaling)
  // 3. Divide by pixelRatio to get back to logical coordinates
  const widthRatio = rect.width > 0 ? canvas.width / rect.width : 0
  const heightRatio = rect.height > 0 ? canvas.height / rect.height : 0

  const x = (cssX * widthRatio) / pixelRatio
  const y = (cssY * heightRatio) / pixelRatio

  return { x, y }
}

/**
 * Calculates a position for displaying tooltips correctly positioned relative to canvas elements
 * @param state - Current canvas state
 * @param canvasX - Logical X position in the canvas
 * @param canvasY - Logical Y position in the canvas
 * @param offset - Optional offset {x, y} in pixels
 * @returns Absolute position {x, y} for tooltip placement
 */
export function getTooltipPosition(
  state: CanvasState,
  canvasX: number,
  canvasY: number,
  offset: { x: number; y: number } = { x: 5, y: 5 }
): { x: number; y: number } {
  const { canvas, pixelRatio } = state
  if (!canvas || !browser) return { x: 0, y: 0 }

  // Always get the latest rect for accurate positioning
  const rect = canvas.getBoundingClientRect()

  // Convert logical coordinates (pre-scaling) back to screen coordinates
  // 1. Multiply by pixelRatio to get canvas coordinates
  // 2. Convert to a percentage of the actual canvas dimensions
  // 3. Apply that percentage to the visual canvas size
  // 4. Add the canvas position and offset
  const xPercent = canvas.width > 0 ? (canvasX * pixelRatio) / canvas.width : 0
  const yPercent =
    canvas.height > 0 ? (canvasY * pixelRatio) / canvas.height : 0

  const screenX = rect.left + xPercent * rect.width + offset.x
  const screenY = rect.top + yPercent * rect.height + offset.y

  return { x: screenX, y: screenY }
}

/**
 * Creates a throttled render scheduler to optimize canvas rendering
 * @param renderFn - Function to execute for rendering
 * @returns A function that schedules rendering with throttling
 */
export function createRenderScheduler(renderFn: () => void): () => void {
  let scheduled = false
  return () => {
    if (!browser) return
    if (scheduled) return

    scheduled = true
    requestAnimationFrame(() => {
      try {
        renderFn()
      } finally {
        scheduled = false
      }
    })
  }
}

/**
 * Prepares canvas for DPI-aware drawing
 * @param state - Canvas state
 * @param clearCanvas - Whether to clear the canvas before drawing
 */
export function beginCanvasDrawing(
  state: CanvasState,
  clearCanvas = true
): void {
  const { canvas, context, pixelRatio } = state
  if (!canvas || !context || !browser) return

  if (clearCanvas) {
    context.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Scale all drawing operations by the device pixel ratio
  context.save()
  context.scale(pixelRatio, pixelRatio)
}

/**
 * Completes canvas drawing operations
 * @param state - Canvas state
 */
export function finishCanvasDrawing(state: CanvasState): void {
  const { context } = state
  if (!context || !browser) return

  context.restore()
}

/**
 * Aligns a coordinate to the center of a pixel for crisp 1px lines.
 * For 1px strokes, drawing at integer + 0.5 ensures the stroke perfectly fills
 * the pixel rather than being blurred across two pixels.
 * Uses bitwise truncation for maximum performance in hot render loops.
 */
export function alignToPixelCenter(val: number): number {
  return (val | 0) + 0.5
}

/** The one hover-crosshair color shared by every plot figure's hover chrome. */
export const CROSSHAIR_COLOR = '#007acc'

/** THE hover-mark dash. Exported so a figure dashing its own path (an emphasised
 *  step line) reuses it instead of duplicating the appearance. */
export const CROSSHAIR_DASH = [2, 2]

/**
 * Translucent crosshair band — the shared hover-highlight fill. Alpha varies
 * by plot, and bands may stack (evolving-metrics layers a 0.08 window band
 * under a 0.15 step band); each call composites like a bare fillRect.
 */
export function fillCrosshairBand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = CROSSHAIR_COLOR
  ctx.fillRect(x, y, width, height)
  ctx.restore()
}

/**
 * Dashed 1px crosshair guide lines, batched into one stroke.
 * `segments` is flat [x1, y1, x2, y2, ...]; callers align the varying
 * coordinate with alignToPixelCenter for crispness.
 */
export function strokeCrosshairGuides(
  ctx: CanvasRenderingContext2D,
  segments: readonly number[]
): void {
  ctx.save()
  ctx.strokeStyle = CROSSHAIR_COLOR
  ctx.lineWidth = 1
  ctx.setLineDash(CROSSHAIR_DASH)
  ctx.beginPath()
  for (let i = 0; i < segments.length; i += 4) {
    ctx.moveTo(segments[i], segments[i + 1])
    ctx.lineTo(segments[i + 2], segments[i + 3])
  }
  ctx.stroke()
  ctx.restore()
}

/**
 * Strokes `count` parallel axis-aligned lines as ONE path — one stroke
 * composite instead of one per line. The caller sets strokeStyle/lineWidth and
 * aligns positions (alignToPixelCenter) in `positionAt`.
 */
export function strokeParallelLines(
  ctx: CanvasRenderingContext2D,
  horizontal: boolean,
  count: number,
  positionAt: (i: number) => number,
  from: number,
  to: number
): void {
  if (count <= 0) return
  ctx.beginPath()
  for (let i = 0; i < count; i++) {
    const p = positionAt(i)
    if (horizontal) {
      ctx.moveTo(from, p)
      ctx.lineTo(to, p)
    } else {
      ctx.moveTo(p, from)
      ctx.lineTo(p, to)
    }
  }
  ctx.stroke()
}

export interface HighlightRect {
  x: number
  y: number
  width: number
  height: number
  alpha?: number
  along?: 'x' | 'y' | 'both'
}

/** One full-band strip per row (rows `pitch` apart from `band.y`), for markCrosshairStrips. */
export const rowStrips = (
  rows: readonly number[],
  band: { x: number; y: number; width: number },
  pitch: number,
  alpha: number
): HighlightRect[] =>
  rows.map(row => ({
    x: band.x,
    y: band.y + row * pitch,
    width: band.width,
    height: pitch,
    alpha,
    along: 'x',
  }))

let _segmentsScratch: number[] = []

/**
 * Given a set of rectangular highlight regions, calculates flat [x1, y1, x2, y2, ...]
 * coordinate segments for dashed guide lines strictly along the OUTER edges of their union.
 * Inner dashed lines at crossings or shared abutting borders are omitted.
 */
export function getOuterCrosshairSegments(rects: readonly HighlightRect[]): readonly number[] {
  _segmentsScratch.length = 0
  for (let i = 0; i < rects.length; i++) {
    const along = rects[i].along ?? 'both'
    if (along === 'x' || along === 'both') {
      pushOuterEdge(rects, i, true, true)
      pushOuterEdge(rects, i, true, false)
    }
    if (along === 'y' || along === 'both') {
      pushOuterEdge(rects, i, false, true)
      pushOuterEdge(rects, i, false, false)
    }
  }
  return _segmentsScratch
}

/**
 * One edge of one rect: collect the spans other rects cover on it, then push
 * what remains. A rect strictly crossing the edge always covers it; on a
 * coincident edge the OPPOSITE edge (their union is seamless there) covers
 * outright while the SAME edge dedups by index, so exactly one owner draws it.
 * `horizontal` picks the edge axis; `isNear` is top/left vs bottom/right.
 */
function pushOuterEdge(
  rects: readonly HighlightRect[],
  i: number,
  horizontal: boolean,
  isNear: boolean
): void {
  const r = rects[i]
  const fixed = horizontal
    ? isNear ? r.y : r.y + r.height
    : isNear ? r.x : r.x + r.width
  const spanMin = horizontal ? r.x : r.y
  const spanMax = horizontal ? r.x + r.width : r.y + r.height

  const covered: Array<{ min: number; max: number }> = []
  for (let j = 0; j < rects.length; j++) {
    if (j === i) continue
    const o = rects[j]
    const oAlong = o.along ?? 'both'
    const oNear = horizontal ? o.y : o.x
    const oFar = horizontal ? o.y + o.height : o.x + o.width
    const alongMatches =
      oAlong === 'both' || oAlong === (horizontal ? 'x' : 'y')
    const sameEdge = isNear ? oNear : oFar
    const oppositeEdge = isNear ? oFar : oNear
    if (
      (fixed > oNear && fixed < oFar) ||
      (fixed === oppositeEdge && alongMatches) ||
      (fixed === sameEdge && alongMatches && j < i)
    ) {
      covered.push(
        horizontal
          ? { min: o.x, max: o.x + o.width }
          : { min: o.y, max: o.y + o.height }
      )
    }
  }
  subtractIntervalsAndPush(spanMin, spanMax, alignToPixelCenter(fixed), horizontal, covered)
}

function subtractIntervalsAndPush(
  start: number,
  end: number,
  cross: number,
  horizontal: boolean,
  covered: readonly { min: number; max: number }[]
): void {
  let remaining = [{ min: start, max: end }]
  for (let cIdx = 0; cIdx < covered.length && remaining.length > 0; cIdx++) {
    const c = covered[cIdx]
    const next: Array<{ min: number; max: number }> = []
    for (let rIdx = 0; rIdx < remaining.length; rIdx++) {
      const r = remaining[rIdx]
      if (c.max <= r.min || c.min >= r.max) {
        next.push(r)
      } else {
        if (c.min > r.min) next.push({ min: r.min, max: c.min })
        if (c.max < r.max) next.push({ min: c.max, max: r.max })
      }
    }
    remaining = next
  }
  for (let k = 0; k < remaining.length; k++) {
    const seg = remaining[k]
    if (seg.max > seg.min) {
      if (horizontal) _segmentsScratch.push(seg.min, cross, seg.max, cross)
      else _segmentsScratch.push(cross, seg.min, cross, seg.max)
    }
  }
}

/**
 * Renders one or more highlight areas (strips, cells, or bands), filling their translucent
 * background in a single unified path pass (so meeting/crossing areas have uniform color
 * with zero alpha stacking) and drawing dashed outlines ONLY on the outer perimeter of their union.
 * Inner dashed lines at crossings or abutting borders are automatically omitted.
 */
export function markCrosshairStrips(
  ctx: CanvasRenderingContext2D,
  rects: readonly HighlightRect[],
  defaultAlpha = 0.18
): void {
  if (rects.length === 0) return

  const alpha = rects[0].alpha ?? defaultAlpha

  // Fill all rects in a single path pass so overlapping areas (crossings) do not stack alpha
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = CROSSHAIR_COLOR
  ctx.beginPath()
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    ctx.rect(r.x, r.y, r.width, r.height)
  }
  ctx.fill()
  ctx.restore()

  const segments = getOuterCrosshairSegments(rects)
  if (segments.length > 0) {
    strokeCrosshairGuides(ctx, segments)
  }
}

/**
 * THE strip mark: "this row / column is designated". A translucent band plus its
 * two LONG edges dashed — `along: 'x'` for a row (horizontal edges), `'y'` for a
 * column.
 */
export function markCrosshairStrip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number,
  along: 'x' | 'y'
): void {
  markCrosshairStrips(ctx, [{ x, y, width, height, alpha, along }])
}

/**
 * Dashed 1px crosshair rectangle — the closed-outline form, for a region that is
 * not a strip.
 */
export function strokeCrosshairRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const left = alignToPixelCenter(x)
  const top = alignToPixelCenter(y)
  const right = alignToPixelCenter(x + width)
  const bottom = alignToPixelCenter(y + height)
  // Co-directional, NOT a perimeter walk: canvas restarts the dash phase per
  // subpath, so reversed opposing edges would render a shared edge between two
  // adjacent outlines solid.
  strokeCrosshairGuides(ctx, [
    left, top, right, top,
    left, bottom, right, bottom,
    left, top, left, bottom,
    right, top, right, bottom,
  ])
}

/**
 * THE point mark: "this node / dot is designated". The strip mark's sibling for a
 * round thing — a translucent halo plus its dashed ring — so a 1px ring alone is
 * never all there is to find. Like the strip mark it says nothing about WHO
 * designated the point, so a plot's own hover and the PLOT CURSOR share it.
 *
 * The alpha is fixed here, unlike `markCrosshairStrip`: strips carry three
 * established per-plot hover weights, points have none.
 */
export function markCrosshairNode(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.globalAlpha = 0.2
  ctx.fillStyle = CROSSHAIR_COLOR
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = CROSSHAIR_COLOR
  ctx.lineWidth = 1
  ctx.setLineDash(CROSSHAIR_DASH)
  ctx.stroke()
  ctx.restore()
}

/**
 * The point mark's WEAKER tier: the ring alone, no halo — "adjacent to something
 * designated", not designated itself. Only a graph has this second tier, and the
 * missing fill is the whole difference, so the two can never be misread.
 */
export function strokeCrosshairRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
): void {
  ctx.save()
  ctx.strokeStyle = CROSSHAIR_COLOR
  ctx.lineWidth = 1
  ctx.setLineDash(CROSSHAIR_DASH)
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

/**
 * Draws a crisp 1px rectangle border.
 * Handles the 0.5px offset logic internally to ensure sharp lines.
 * Optimized with bitwise truncation for hot rendering paths.
 */
export function strokeCrispRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  strokeStyle: string = UI_COLORS.GRID_PRIMARY,
  lineWidth: number = 1
): void {
  ctx.save()
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  // Using bitwise alignment on all edges for a perfectly sharp box
  ctx.strokeRect((x | 0) + 0.5, (y | 0) + 0.5, width | 0, height | 0)
  ctx.restore()
}

// ============================================================================
// SCRATCH LAYERS
// ============================================================================

/**
 * Device-pixel cap for offscreen scratch layers (~256 MB at 4 bytes/px). The
 * main canvas of a very large plot is already near browser canvas limits;
 * mirroring it would double an already-huge buffer, and `new OffscreenCanvas`
 * can throw. Above the cap callers skip the layer and render without it.
 */
export const MAX_SCRATCH_PX = 64 * 1024 * 1024

export interface ScratchLayer {
  canvas: OffscreenCanvas | HTMLCanvasElement
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
}

/**
 * Allocate an offscreen scratch canvas with its 2d context. Returns null when
 * the size is unsafe, the environment has no canvas (node tests), or the
 * allocation throws; callers treat null as "skip the layer".
 */
export function createScratchLayer(
  width: number,
  height: number
): ScratchLayer | null {
  if (
    width <= 0 ||
    height <= 0 ||
    width > 16384 ||
    height > 16384 ||
    width * height > MAX_SCRATCH_PX
  ) {
    return null
  }
  try {
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : typeof document !== 'undefined'
          ? Object.assign(document.createElement('canvas'), { width, height })
          : null
    if (!canvas) return null
    const ctx = canvas.getContext('2d') as ScratchLayer['ctx'] | null
    return ctx ? { canvas, ctx } : null
  } catch {
    return null
  }
}

/** A scratch layer with its ImageData and a packed-RGBA view of the pixels. */
export interface PixelLayer extends ScratchLayer {
  image: ImageData
  pixels: Uint32Array
}

/** `prev` while it has this size, else a fresh pixel layer (null as for createScratchLayer). */
export function pixelLayer(
  prev: PixelLayer | null,
  width: number,
  height: number
): PixelLayer | null {
  if (prev && prev.canvas.width === width && prev.canvas.height === height) return prev
  const layer = createScratchLayer(width, height)
  if (!layer) return null
  const image = layer.ctx.createImageData(width, height)
  return { ...layer, image, pixels: new Uint32Array(image.data.buffer) }
}

/**
 * A pixel layer that repaints only when its size or one of its keys changes
 * (compared with `Object.is`); otherwise the last raster is handed back as is.
 * `paint` fills `layer.pixels`; the cache puts them on the layer. Null as for
 * createScratchLayer.
 */
export function cachedRaster(): (
  keys: readonly unknown[],
  width: number,
  height: number,
  paint: (layer: PixelLayer) => void
) => PixelLayer | null {
  let layer: PixelLayer | null = null
  let painted: readonly unknown[] | null = null
  return (keys, width, height, paint) => {
    const next = pixelLayer(layer, width, height)
    if (!next) return null
    if (
      next === layer &&
      painted?.length === keys.length &&
      keys.every((key, i) => Object.is(key, painted![i]))
    )
      return next
    layer = next
    painted = null
    paint(next)
    next.ctx.putImageData(next.image, 0, 0)
    painted = keys
    return next
  }
}
