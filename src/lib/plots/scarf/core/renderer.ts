import {
  FONT_PRIMARY,
  GRIDLINE_PRIMARY,
  GRIDLINE_SECONDARY,
  ROW_LABEL_GAP,
} from '$lib/plots/shared'
import { alignToPixelCenter } from '$lib/plots/shared/canvasUtils'
import { desaturateToWhite, convertToHex, hexToRgb } from '$lib/color'
import {
  OVERLAY_EVENT_STRIDE,
  RECT_STRIDE,
  SCARF_LAYOUT,
} from '../const'
import type { ScarfData, ScarfRectStyle, ScarfEventStyle } from '../types'

export interface ScarfLayoutContext {
  heightOfBar: number
  spaceAboveRect: number
  nonFixationHeight: number
  heightOfBarWrap: number
  scaleFactor: number
  isCompact: boolean
  leftLabelWidth: number
  plotAreaWidth: number
  effectiveMarginTop: number
  participantBarsHeight: number
  totalWidth: number
  marginLeft: number
  /** Combined-mode: height of one event lane (strip slot). 0 otherwise. */
  eventLaneHeight: number
  /** Combined-mode: total event-band height = lanes × eventLaneHeight (every
   * lane gets its own non-overlapping strip; never capped into overlap). 0 otherwise. */
  eventZoneHeight: number
  /** Combined-mode: y within a row where the event band begins, just below the
   * AOI bar's bottom seam (events hang downward from here). 0 otherwise. */
  eventBandTop: number
  /** Combined (overlay) mode: non-fixations are centred on the seam (bar bottom)
   * rather than within the gaze bar, for a symmetric layout. */
  isOverlay: boolean
  /** Device pixels per logical pixel (devicePixelRatio, or dpiOverride/96 on
   * export). Gaze rects snap their vertical edges to whole DEVICE pixels so they
   * don't anti-alias ~0.5px past the bar — most visible on fractional-DPI
   * displays (e.g. Windows 125%/150%) where a tiny bar is only a few device px. */
  deviceScale: number
}

/**
 * Draws the participant labels on the left side of the plot.
 */
export function drawScarfLabels(
  ctx: CanvasRenderingContext2D,
  data: ScarfData,
  layout: ScarfLayoutContext
) {
  const { participants } = data
  const len = participants.length
  const leftX = Math.floor(layout.leftLabelWidth + layout.marginLeft)

  ctx.font = `${FONT_PRIMARY.SIZE}px ${FONT_PRIMARY.FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = FONT_PRIMARY.COLOR

  if (layout.isCompact) {
    // Rotated label for "Participants"
    ctx.save()
    ctx.textAlign = 'center'
    const labelX = leftX - 40
    const labelY = layout.effectiveMarginTop + layout.participantBarsHeight / 2
    ctx.translate(labelX, labelY)
    ctx.rotate(-Math.PI / 2)
    const lineHeight = FONT_PRIMARY.SIZE * 1.2
    ctx.fillText('Participants', 0, -lineHeight / 2)
    ctx.fillText('[order indices]', 0, lineHeight / 2)
    ctx.restore()

    // Index ticks
    ctx.textAlign = 'end'
    const tickX = leftX - 8
    const step = calculateTickStep(len)

    for (let i = 0; i < len; i += step) {
      const y =
        i * layout.heightOfBarWrap +
        layout.heightOfBarWrap / 2 +
        layout.effectiveMarginTop
      ctx.fillText(String(i), tickX, y)
    }
    const lastIdx = len - 1
    if (lastIdx % step !== 0) {
      const y =
        lastIdx * layout.heightOfBarWrap +
        layout.heightOfBarWrap / 2 +
        layout.effectiveMarginTop
      ctx.fillText(String(lastIdx), tickX, y)
    }
  } else {
    ctx.textAlign = 'end'
    const xPos = leftX - ROW_LABEL_GAP
    for (let i = 0; i < len; i++) {
      ctx.fillText(
        participants[i].label,
        xPos,
        i * layout.heightOfBarWrap +
          layout.heightOfBarWrap / 2 +
          layout.effectiveMarginTop
      )
    }
  }
}

/**
 * Draws the vertical axis and horizontal grid lines.
 */
export function drawScarfGrid(
  ctx: CanvasRenderingContext2D,
  data: ScarfData,
  layout: ScarfLayoutContext
) {
  const leftX = Math.floor(layout.leftLabelWidth + layout.marginLeft)
  const rightX = leftX + Math.floor(layout.plotAreaWidth)
  const yTop = Math.floor(layout.effectiveMarginTop)
  const yBottom = Math.floor(
    layout.participantBarsHeight + layout.effectiveMarginTop
  )

  // Vertical axis lines
  ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
  ctx.lineWidth = GRIDLINE_PRIMARY.WIDTH
  ctx.beginPath()
  ctx.moveTo(leftX + 0.5, yTop)
  ctx.lineTo(leftX + 0.5, yBottom)
  ctx.moveTo(rightX + 0.5, yTop)
  ctx.lineTo(rightX + 0.5, yBottom)
  ctx.stroke()

  if (layout.isCompact) {
    const step = calculateTickStep(data.participants.length)
    for (let i = 0; i < data.participants.length; i += step) {
      const y = alignToPixelCenter(
        i * layout.heightOfBarWrap +
          layout.heightOfBarWrap / 2 +
          layout.effectiveMarginTop
      )
      ctx.beginPath()
      ctx.moveTo(leftX + 0.5, y)
      ctx.lineTo(leftX - 4.5, y)
      ctx.stroke()
    }
  } else {
    // Dividers between participant rows (all modes). In combined mode the gaze
    // and the event band are separated by the whitespace seam gap, so gray is
    // used only here, to divide participants.
    ctx.strokeStyle = GRIDLINE_SECONDARY.COLOR
    ctx.lineWidth = GRIDLINE_SECONDARY.WIDTH
    for (let i = 0; i <= data.participants.length; i++) {
      const y = alignToPixelCenter(
        i * layout.heightOfBarWrap + layout.effectiveMarginTop
      )
      ctx.beginPath()
      ctx.moveTo(leftX + 0.5, y)
      ctx.lineTo(rightX + 0.5, y)
      ctx.stroke()
    }
  }
}

/**
 * Shared fill resolution for every scarf band: an active band keeps its colour,
 * a dimmed one washes toward white. Gaze rectangles and event strips dim by the
 * SAME rule — this is the single place that rule lives.
 */
function bandFill(color: string, dimmed: boolean): string {
  return dimmed ? desaturateToWhite(color, 0.85) : color
}

/**
 * Vertical placement (height + in-row y offset) of a single gaze rect, shared by
 * the exact painter (pass 3) and the highlighted-opaque painter (pass 4) so the
 * two can never disagree on where a segment sits. Non-fixations are a thin bar
 * (seam-aligned in overlay, bar-centred otherwise); fixations take their stored
 * per-segment offset scaled to the current bar height.
 */
function gazeRectVPlacement(
  hOrig: number,
  internalY: number,
  layout: ScarfLayoutContext
): { h: number; yInternal: number } {
  if (hOrig === SCARF_LAYOUT.HEIGHT_NON_FIXATION_DEFAULT) {
    return {
      h: layout.nonFixationHeight,
      yInternal: layout.isOverlay
        ? layout.spaceAboveRect + layout.heightOfBar - layout.nonFixationHeight
        : layout.spaceAboveRect + (layout.heightOfBar - layout.nonFixationHeight) / 2,
    }
  }
  return {
    h: hOrig * layout.scaleFactor,
    yInternal:
      layout.spaceAboveRect +
      (internalY - SCARF_LAYOUT.SPACE_ABOVE_RECT_DEFAULT) * layout.scaleFactor,
  }
}

/**
 * Draws every coloured band of the plot in one pass — gaze segments (rectangles
 * rising to the seam) and, when an event band exists, the overlaid event strips
 * (packed lanes hanging below the seam). Both are "a colour per (style × row)"
 * dimmed by the same highlight rule; they differ only in geometry, split into
 * the two painters below. `paintEventStrips` no-ops without an event band, so
 * this single entry point serves gaze-only and combined plots identically.
 */
export function drawScarfBands(
  ctx: CanvasRenderingContext2D,
  data: ScarfData,
  layout: ScarfLayoutContext,
  rectStyleArray: ScarfRectStyle[],
  eventStyleArray: ScarfEventStyle[],
  highlightMask: Uint8Array | null
) {
  paintGazeRects(ctx, data, layout, rectStyleArray, highlightMask)
  paintEventStrips(ctx, data, layout, eventStyleArray, highlightMask)
}

/**
 * Gaze segments: fixation/AOI bars rise from the top pad to the seam baseline;
 * non-fixations are a thin bar bottom-aligned to the seam (overlay) or centred
 * in the gaze bar (otherwise).
 */
// Reused per-(row, pixel) premultiplied-alpha accumulator for the sub-pixel
// composite layer below: interleaved [R, G, B, A] per cell, so the four
// channels of a pixel share a cache line in the hot loop. Grown to the largest
// (rows × plot-width × 4) seen; the used range is zeroed each render
// (channel A == 0 means an uncovered pixel).
let _acc = new Float32Array(0)

// Reused offscreen canvas + buffer for the ImageData emit path (see
// `blitCompositeLayer`). Allocated lazily — only dense renders take that path.
let _offCanvas: OffscreenCanvas | HTMLCanvasElement | null = null
let _offCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null
let _offImg: ImageData | null = null

/**
 * Gaze segments rendered at display resolution.
 *
 * A dense scarf packs far more segments than pixels, so drawing each as its own
 * fillRect (millions) is the redraw cost. Picking one segment per pixel (by
 * dwell, rarity, whatever) jitters — the chosen winner flips as the pixel grid
 * shifts on resize/drag (the "appears and reappears" effect). The stable,
 * faithful downsample is to REPLICATE what the browser's overdraw already does:
 * alpha-composite the overlapping segments in draw order, each segment's alpha
 * being its x-coverage of the pixel × its share of the bar height. Coverage
 * varies continuously with size, so there are no discrete flips.
 *
 * Segments still >= 1px wide are drawn EXACTLY (own height/y) on top,
 * preserving thin saccades, stacking, and sparse detail; only sub-pixel
 * segments — the millions — are composited into a per-pixel layer drawn at the
 * full bar height. The output is therefore pixel-identical to per-segment
 * overdraw when sparse and within a few RGB units when dense, while the
 * fillRect count is bounded by the canvas, not the segment count. Validated
 * against exact overdraw on @napi-rs/canvas: mean RGB diff 0 (sparse) / <=7
 * (1.2M segs), resize stability ~9 vs ~36 for winner-take-all, ~3x faster.
 */
function paintGazeRects(
  ctx: CanvasRenderingContext2D,
  data: ScarfData,
  layout: ScarfLayoutContext,
  styleArray: ScarfRectStyle[],
  highlightMask: Uint8Array | null
) {
  const buckets = data.visualRectBuckets
  const isHighlightActive = highlightMask !== null
  const pLeft = Math.floor(layout.leftLabelWidth + layout.marginLeft)
  const pWidth = Math.floor(layout.plotAreaWidth)
  if (pWidth <= 0) return
  const rows = data.participants.length
  const top = layout.effectiveMarginTop
  const pitch = layout.heightOfBarWrap
  const barTop = layout.spaceAboveRect
  const barH = layout.heightOfBar
  const invBarH = 1 / barH // multiply in the hot loop instead of dividing
  const cells = rows * pWidth
  if (cells <= 0 || barH <= 0) return

  // Snap a logical-y to a whole DEVICE pixel: vector fillRects (the fallback and
  // exact paths) otherwise anti-alias their top/bottom edges ~0.5px past the bar
  // on fractional-DPI displays. The blit path needs no such snap — its
  // nearest-neighbour upscale already lands edges on device pixels.
  const dpr = layout.deviceScale > 0 ? layout.deviceScale : 1
  const snapDev = (y: number) => Math.round(y * dpr) / dpr

  const slots = cells * 4
  if (_acc.length < slots) _acc = new Float32Array(slots)
  else _acc.fill(0, 0, slots)
  const acc = _acc

  // Pass 1: composite sub-pixel (< 1px) segments in draw order (premultiplied
  // "over" with alpha = x-coverage × bar-height share). `anyWide` records
  // whether any >= 1px segment exists so pass 3 can be skipped when none do
  // (the common fully-dense case); `subPixelCount` picks the emit strategy.
  let anyWide = false
  let subPixelCount = 0
  for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
    const buffer = buckets[styleIdx]
    if (buffer.length === 0) continue

    const isDimmed = isHighlightActive ? highlightMask[styleIdx] !== 1 : false
    const rgb = hexToRgb(convertToHex(bandFill(styleArray[styleIdx].normal.fill, isDimmed)))
    const cr = rgb.r
    const cg = rgb.g
    const cb = rgb.b

    const segmentCount = buffer.length / RECT_STRIDE
    for (let i = 0; i < segmentCount; i++) {
      const idx = i * RECT_STRIDE
      const wPx = buffer[idx + 2] * pWidth
      if (wPx >= 1) {
        anyWide = true
        continue // wide -> drawn exactly in pass 3
      }
      const pIdx = buffer[idx + 1] | 0
      if (pIdx < 0 || pIdx >= rows) continue
      subPixelCount++

      const hOrig = buffer[idx + 3]
      const h =
        hOrig === SCARF_LAYOUT.HEIGHT_NON_FIXATION_DEFAULT
          ? layout.nonFixationHeight
          : hOrig * layout.scaleFactor
      let hFrac = h * invBarH
      if (hFrac > 1) hFrac = 1

      const x0 = buffer[idx] * pWidth // plot-relative pixels (xNorm >= 0)
      const x1 = x0 + wPx
      let p0 = x0 | 0 // floor; x0 >= 0
      let p1 = Math.ceil(x1)
      if (p0 < 0) p0 = 0
      if (p1 > pWidth) p1 = pWidth
      const rowBase = pIdx * pWidth
      for (let px = p0; px < p1; px++) {
        const right = x1 < px + 1 ? x1 : px + 1
        const left = x0 > px ? x0 : px
        const cx = right - left
        if (cx <= 0) continue
        let a = cx * hFrac
        if (a > 1) a = 1
        const ia = 1 - a
        const k = (rowBase + px) << 2
        acc[k] = cr * a + acc[k] * ia
        acc[k + 1] = cg * a + acc[k + 1] * ia
        acc[k + 2] = cb * a + acc[k + 2] * ia
        acc[k + 3] = a + acc[k + 3] * ia
      }
    }
  }

  // Pass 2: emit the composite layer through ONE path — blit the packed pixels
  // via an offscreen canvas. It is fast at any density (cost bounded by the plot
  // size, not the segment count) and device-clean (its nearest-neighbour upscale
  // lands edges on whole device pixels, so the band never bleeds past the bar).
  // There is deliberately no second, content-switched emit path: a density
  // threshold used to flip between strategies and shifted the image as a plot
  // crossed it. Nothing to emit when there is no sub-pixel content.
  if (subPixelCount > 0) {
    blitCompositeLayer(ctx, acc, rows, pWidth, pLeft, top, pitch, barTop, barH)
  }

  // Pass 3: draw >= 1px segments exactly, on top of the composite layer.
  if (!anyWide) return
  for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
    const buffer = buckets[styleIdx]
    if (buffer.length === 0) continue

    const isDimmed = isHighlightActive ? highlightMask[styleIdx] !== 1 : false
    ctx.fillStyle = bandFill(styleArray[styleIdx].normal.fill, isDimmed)

    const segmentCount = buffer.length / RECT_STRIDE
    for (let i = 0; i < segmentCount; i++) {
      const idx = i * RECT_STRIDE
      if (buffer[idx + 2] * pWidth < 1) continue
      const pIdx = buffer[idx + 1]
      const { h, yInternal } = gazeRectVPlacement(
        buffer[idx + 3],
        buffer[idx + 5],
        layout
      )
      // Snap the vertical edges to device pixels (no ~0.5px bleed past the bar);
      // keep a >= 1 device-px floor so a thin non-fixation can't round away.
      const yTop = snapDev(pIdx * pitch + yInternal + top)
      let yH = snapDev(pIdx * pitch + yInternal + top + h) - yTop
      if (yH < 1 / dpr) yH = 1 / dpr
      ctx.fillRect(pLeft + buffer[idx] * pWidth, yTop, buffer[idx + 2] * pWidth, yH)
    }
  }
}

/**
 * THE composite-layer emitter (single path). Writes packed RGBA pixels into a
 * reused offscreen ImageData and blits it once with `drawImage`. This avoids the
 * per-run `fillStyle = rgba(...)` string allocate + parse that would dominate a
 * dense emit, and — because the offscreen is at LOGICAL resolution (one cell per
 * logical pixel, exactly what the accumulator holds) and `drawImage` upscales it
 * under the dpr-scaled context with smoothing OFF (nearest-neighbour) — every
 * band edge lands on a whole device pixel, so the composite never anti-aliases
 * past the bar. There is no alternate emit path: a browser (the only runtime,
 * incl. PNG export) always has a canvas. In a canvas-less environment (node unit
 * tests) this is simply a no-op — nothing renders, nothing throws.
 */
function blitCompositeLayer(
  ctx: CanvasRenderingContext2D,
  acc: Float32Array,
  rows: number,
  pWidth: number,
  pLeft: number,
  top: number,
  pitch: number,
  barTop: number,
  barH: number
): void {
  // Integer height with +2 slack rows: the slack absorbs the fractional part of
  // `top` folded in below, and an integer (vs fractional `rows * pitch`) keeps
  // the reuse check stable so the offscreen isn't reallocated every frame.
  const offH = Math.ceil(rows * pitch) + 2
  if (!_offCanvas || _offCanvas.width !== pWidth || _offCanvas.height !== offH) {
    if (typeof OffscreenCanvas !== 'undefined') {
      _offCanvas = new OffscreenCanvas(pWidth, offH)
    } else if (typeof document !== 'undefined') {
      _offCanvas = Object.assign(document.createElement('canvas'), {
        width: pWidth,
        height: offH,
      })
    } else {
      return // canvas-less environment (tests): nothing to render
    }
    _offCtx = _offCanvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null
    _offImg = _offCtx ? _offCtx.createImageData(pWidth, offH) : null
  }
  if (!_offCtx || !_offImg) return

  const data = _offImg.data
  data.fill(0)
  // Little-endian RGBA packing (every current target platform is LE).
  const u32 = new Uint32Array(data.buffer)
  // Snap each row's bar band to whole logical pixels at BOTH edges (height =
  // bottom − top), so the composite can never overhang the bar into the seam the
  // way a floored top with a rounded height could. The fractional part of `top`
  // is folded into the per-row rounding and only its integer part offsets the
  // single drawImage, so the snapped band lands on exact device rows.
  const topInt = Math.floor(top)
  const topFrac = top - topInt
  for (let r = 0; r < rows; r++) {
    const rowBase = r * pWidth
    const yTop = Math.round(r * pitch + barTop + topFrac)
    let yBot = Math.round(r * pitch + barTop + barH + topFrac)
    if (yBot > offH) yBot = offH
    const bh = yBot - yTop
    for (let px = 0; px < pWidth; px++) {
      const k = (rowBase + px) << 2
      const a = acc[k + 3]
      if (a <= 0) continue
      const inv = 1 / a
      const rr = (acc[k] * inv + 0.5) | 0
      const gg = (acc[k + 1] * inv + 0.5) | 0
      const bb = (acc[k + 2] * inv + 0.5) | 0
      const aq = (a * 255 + 0.5) | 0
      const packed = ((aq << 24) | (bb << 16) | (gg << 8) | rr) >>> 0
      for (let yy = 0; yy < bh; yy++) u32[(yTop + yy) * pWidth + px] = packed
    }
  }
  _offCtx.putImageData(_offImg, 0, 0)
  const prevSmoothing = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(_offCanvas as CanvasImageSource, pLeft, topInt)
  ctx.imageSmoothingEnabled = prevSmoothing
}

/**
 * Core drawing for COMBINED-mode (overlay) events: packed horizontal strips in
 * the band hanging below the AOI seam (the row's symmetric centre).
 *
 * - The band hangs DOWN from the AOI bar's bottom seam; lane 0 is the slot
 *   nearest the seam and lanes stack downward.
 * - Intervals are rectangles spanning their full extent (so "when type X was
 *   active" is directly visible), min-width-clamped so they never sub-px vanish.
 * - Point (zero-duration) events are min-width diamonds — distinct from thin
 *   interval rectangles even at the legibility floor.
 * - Colour is keyed by event type. The AOI bar (above the seam) is never overdrawn.
 */
function paintEventStrips(
  ctx: CanvasRenderingContext2D,
  data: ScarfData,
  layout: ScarfLayoutContext,
  styleArray: ScarfEventStyle[],
  highlightMask: Uint8Array | null
) {
  const buckets = data.visualEventBuckets
  if (layout.eventLaneHeight <= 0 || buckets.length === 0) return

  const isHighlightActive = highlightMask !== null
  const pLeft = Math.floor(layout.leftLabelWidth + layout.marginLeft)
  const pWidth = Math.floor(layout.plotAreaWidth)
  const pRight = pLeft + pWidth
  const laneH = layout.eventLaneHeight
  const bandTop = layout.eventBandTop
  const pitch = layout.heightOfBarWrap
  const top = layout.effectiveMarginTop
  const stripGap = layout.isCompact ? 0 : SCARF_LAYOUT.EVENT_LANE_GAP
  const stripH = Math.max(1, laneH - stripGap)
  const minInterval = SCARF_LAYOUT.MIN_INTERVAL_PX
  const hw = SCARF_LAYOUT.MIN_POINT_PX / 2

  for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
    const buffer = buckets[styleIdx]
    if (buffer.length === 0) continue

    const isDimmed = isHighlightActive ? highlightMask[styleIdx] !== 1 : false
    const base =
      styleArray[styleIdx]?.normal?.fill ??
      styleArray[styleIdx]?.normal?.stroke ??
      '#888888'
    ctx.fillStyle = bandFill(base, isDimmed)

    const count = buffer.length / OVERLAY_EVENT_STRIDE
    for (let i = 0; i < count; i++) {
      const idx = i * OVERLAY_EVENT_STRIDE
      const xNorm = buffer[idx]
      const pIdx = buffer[idx + 1]
      const wNorm = buffer[idx + 2]
      // Every concurrent event keeps its own lane — never stacked into one strip.
      const lane = buffer[idx + 3] | 0
      const isPoint = buffer[idx + 4] | 0

      // Band hangs down from the seam: lane 0 nearest the bar, stacking downward.
      const slotTop = pIdx * pitch + bandTop + lane * laneH + top + 1
      const x = pLeft + xNorm * pWidth

      if (isPoint) {
        const cy = slotTop + stripH / 2
        const cx = Math.min(pRight - hw, Math.max(pLeft + hw, x))
        ctx.beginPath()
        ctx.moveTo(cx, slotTop)
        ctx.lineTo(cx + hw, cy)
        ctx.lineTo(cx, slotTop + stripH)
        ctx.lineTo(cx - hw, cy)
        ctx.closePath()
        ctx.fill()
      } else {
        let w = wNorm * pWidth
        if (w < minInterval) w = minInterval
        if (x + w > pRight) w = pRight - x
        if (w <= 0) continue
        ctx.fillRect(x, slotTop, w, stripH)
      }
    }
  }
}

export interface ScarfHighlightMarkerOptions {
  rectStyleArray: ScarfRectStyle[]
  highlightMask: Uint8Array | null
}

// Reused per-row scratch for the ring visibility test: one row's segment
// centres (logical px) and their column-alpha weights (width × bar-height
// share). Grown to the largest row seen. Centres are ascending and disjoint
// within a (style × row) bucket — one participant's fixations of one AOI never
// overlap in time — which both the windowing and the clustering rely on.
let _ctr = new Float32Array(0)
let _wt = new Float32Array(0)
let _xStart = new Float32Array(0)
let _xEnd = new Float32Array(0)
let _isBoundary = new Uint8Array(0)
let _deque = new Int32Array(0)

/**
 * Rings the location of HIGHLIGHTED gaze segments that the faithful blend draws
 * too faintly to see. The blend is never altered: a sub-pixel fixation shares
 * its pixel with the desaturated neighbours composited over it, so its true
 * colour can wash out to almost nothing. The ring is a pure annotation pointing
 * at "the highlighted identifier is here, even though you can barely see it".
 *
 * Visibility is judged AGAINST THE BLEND, not segment widths: each segment's
 * legibility is its local column-alpha coverage — `Σ (width × bar-height share)`
 * over the same-colour segments whose centres fall within a one-pixel window of
 * it, the quantity the blend actually lays down. Below `HIGHLIGHT_VISIBLE_COVERAGE`
 * the colour is washed out no matter how many thin segments pile up (they are
 * diluted by everything else sharing those pixels) and the segment is ringed;
 * above it the colour renders and it is left alone. This is what the old
 * width-based test got wrong: packed thin segments looked "wide enough together"
 * yet still rendered invisibly once the neighbours diluted them.
 *
 * The window is measured in DATA space (segment centres), not on the pixel grid,
 * so it is invariant to a timeline drag (a rigid translation of every segment):
 * verdicts and gaps don't change, so rings translate with the data instead of
 * flickering as segments cross pixel boundaries. Within a (style × row) bucket
 * one participant's fixations of one AOI are time-disjoint, so the centres are
 * ascending and the window sum is their true combined coverage (no overlap).
 *
 * Overlaid event strips are intentionally excluded: they are min-width clamped
 * and drawn opaque (never sub-pixel), so they are always visible and never need
 * a ring.
 */
export function drawScarfHighlightMarkers(
  ctx: CanvasRenderingContext2D,
  data: ScarfData,
  layout: ScarfLayoutContext,
  opts: ScarfHighlightMarkerOptions
) {
  const { highlightMask } = opts
  if (highlightMask === null) return

  const pLeft = Math.floor(layout.leftLabelWidth + layout.marginLeft)
  const pWidth = Math.floor(layout.plotAreaWidth)
  if (pWidth <= 0) return
  const rows = data.participants.length
  const top = layout.effectiveMarginTop
  const pitch = layout.heightOfBarWrap
  const barH = layout.heightOfBar
  if (rows <= 0 || barH <= 0) return
  const invBarH = 1 / barH

  // Ring sits on the gaze bar (where the fixations live), not the row centre: in
  // a gaze-only row they coincide, but in combined mode the bar is at the top of
  // the row and the event band hangs below, so a row-centred ring would float in
  // the seam gap below the fixation it marks.
  const gazeBandCy = layout.spaceAboveRect + barH / 2
  // Radius is uniform across rows (so is the geometry). Fit it inside the row so
  // neighbouring rows never overlap; bail entirely if the row is too short.
  // Keep the ring inside the row (never overlapping a neighbouring row's gaze
  // bar). In compact+overlay the gaze bar is thin and top-anchored, so the
  // upward clearance is small — allow the ring to shrink to it rather than bail.
  const r = Math.min(
    SCARF_LAYOUT.HIGHLIGHT_MARKER_RADIUS,
    Math.floor(Math.min(gazeBandCy, pitch - gazeBandCy))
  )
  if (r < SCARF_LAYOUT.HIGHLIGHT_MARKER_MIN_RADIUS) return

  const visible = SCARF_LAYOUT.HIGHLIGHT_VISIBLE_COVERAGE
  const clusterGap = 2 * r
  // Half-width of the legibility window. Coverage is summed over segments whose
  // CENTRES lie within ±HALF logical px of the candidate — a span tied to the
  // data, not the pixel grid. A timeline drag is a rigid translation of every
  // segment, so every windowed sum, every visible/invisible verdict and every
  // inter-segment gap is unchanged by it; the rings simply translate with the
  // data instead of flickering on and off as segments cross pixel boundaries.
  const HALF = SCARF_LAYOUT.HIGHLIGHT_WINDOW_PX / 2

  const buckets = data.visualRectBuckets
  const styles = opts.rectStyleArray

  ctx.save()
  for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
    if (highlightMask[styleIdx] !== 1) continue
    const buffer = buckets[styleIdx]
    if (buffer.length === 0) continue
    const color = styles[styleIdx]?.normal?.fill
    if (!color) continue

    const count = buffer.length / RECT_STRIDE
    let i = 0
    while (i < count) {
      const row = buffer[i * RECT_STRIDE + 1] | 0
      let end = i
      while (end < count && (buffer[end * RECT_STRIDE + 1] | 0) === row) end++

      if (row >= 0 && row < rows) {
        const m = end - i
        if (_ctr.length < m) {
          _ctr = new Float32Array(m)
          _wt = new Float32Array(m)
          _xStart = new Float32Array(m)
          _xEnd = new Float32Array(m)
          _isBoundary = new Uint8Array(m)
          _deque = new Int32Array(m)
        }
        for (let s = 0; s < m; s++) {
          const idx = (i + s) * RECT_STRIDE
          const x0 = buffer[idx] * pWidth
          const w = buffer[idx + 2] * pWidth
          _ctr[s] = x0 + w * 0.5
          _xStart[s] = x0
          _xEnd[s] = x0 + w
          // Inline of gazeRectVPlacement's `h` (the only field the ring test
          // needs): skips the per-segment object allocation and the unused
          // yInternal math in this hot loop.
          const hOrig = buffer[idx + 3]
          const h =
            hOrig === SCARF_LAYOUT.HEIGHT_NON_FIXATION_DEFAULT
              ? layout.nonFixationHeight
              : hOrig * layout.scaleFactor
          let hFrac = h * invBarH
          if (hFrac > 1) hFrac = 1
          
          _wt[s] = w * hFrac
          _isBoundary[s] = (x0 <= 0.001 || (x0 + w) >= pWidth - 0.001) ? 1 : 0
        }

        const V_max = SCARF_LAYOUT.HIGHLIGHT_SELF_LEGIBLE_LIMIT
        const cy = row * pitch + top + gazeBandCy
        let lo = 0
        let hiPtr = 0
        let winSum = 0
        let dequeHead = 0
        let dequeTail = 0
        let clusterStart = 0
        let clusterEnd = 0
        let clusterN = 0
        for (let s = 0; s < m; s++) {
          const cs = _ctr[s]
          
          // Monotonic Queue: push hiPtr
          while (hiPtr < m && _xStart[hiPtr] <= cs + HALF) {
            const idx = hiPtr
            const wt_idx = _wt[idx]
            while (dequeTail > dequeHead && _wt[_deque[dequeTail - 1]] <= wt_idx) {
              dequeTail--
            }
            _deque[dequeTail++] = idx
            winSum += wt_idx
            hiPtr++
          }
          
          // Pop from sliding window
          while (lo < hiPtr && _xEnd[lo] < cs - HALF) {
            winSum -= _wt[lo]
            lo++
          }
          
          // Monotonic Queue: pop lo
          while (dequeHead < dequeTail && _deque[dequeHead] < lo) {
            dequeHead++
          }
          
          if (_isBoundary[s] === 1) continue // boundary segment — no ring
          
          const wt_s = _wt[s]
          const threshold = wt_s >= V_max ? 0 : V_max - wt_s
          
          const maxWt = dequeHead < dequeTail ? _wt[_deque[dequeHead]] : 0
          
          if (maxWt >= SCARF_LAYOUT.HIGHLIGHT_SINGLE_VISIBLE_LIMIT || winSum >= threshold) continue
          if (clusterN > 0 && cs - clusterEnd > clusterGap) {
            drawHighlightCapsule(ctx, pLeft + clusterStart, pLeft + clusterEnd, cy, r, color)
            clusterN = 0
          }
          if (clusterN === 0) {
            clusterStart = cs
          }
          clusterEnd = cs
          clusterN++
        }
        if (clusterN > 0) {
          drawHighlightCapsule(ctx, pLeft + clusterStart, pLeft + clusterEnd, cy, r, color)
        }
      }
      i = end
    }
  }
  ctx.restore()
}

/** A capsule (or circle if x1 === x2) outlining overlapping highlight markers to erase inner lines. */
function drawHighlightCapsule(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  cy: number,
  r: number,
  color: string
) {
  const prevGCO = ctx.globalCompositeOperation

  // White halo (drawn behind the gaze bands so they erase the inner halo part)
  ctx.globalCompositeOperation = 'destination-over'
  ctx.beginPath()
  if (x1 === x2) {
    ctx.arc(x1, cy, r, 0, Math.PI * 2)
  } else {
    ctx.arc(x1, cy, r, Math.PI * 0.5, Math.PI * 1.5)
    ctx.lineTo(x2, cy - r)
    ctx.arc(x2, cy, r, Math.PI * 1.5, Math.PI * 2.5)
    ctx.closePath()
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = SCARF_LAYOUT.HIGHLIGHT_MARKER_RING_WIDTH + 2
  ctx.stroke()

  // Color stroke (drawn on top)
  ctx.globalCompositeOperation = 'source-over'
  ctx.beginPath()
  if (x1 === x2) {
    ctx.arc(x1, cy, r, 0, Math.PI * 2)
  } else {
    ctx.arc(x1, cy, r, Math.PI * 0.5, Math.PI * 1.5)
    ctx.lineTo(x2, cy - r)
    ctx.arc(x2, cy, r, Math.PI * 1.5, Math.PI * 2.5)
    ctx.closePath()
  }
  ctx.strokeStyle = color
  ctx.lineWidth = SCARF_LAYOUT.HIGHLIGHT_MARKER_RING_WIDTH
  ctx.stroke()

  ctx.globalCompositeOperation = prevGCO
}

function calculateTickStep(len: number): number {
  const niceSteps = [5, 10, 20, 25, 50, 100, 200, 500, 1000]
  for (const s of niceSteps) {
    if (len / s <= 10) return s
  }
  return 1000
}
