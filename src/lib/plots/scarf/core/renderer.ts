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

  // Pass 2: emit the composite layer (full bar height). For dense content the
  // per-run `fillStyle = rgba(...)` string churn (allocate + the canvas parsing
  // the string) dominates — measured 3-8x of the whole paint — so blit packed
  // pixels through an offscreen canvas instead. For sparse content the blit's
  // fixed clear+upload overhead loses, so fall back to per-run rects. The
  // threshold (sub-pixel count vs ~cells/256) is where the two cross over.
  const blitted =
    subPixelCount > cells >> 8 &&
    blitCompositeLayer(ctx, acc, rows, pWidth, pLeft, top, pitch, barTop, barH)
  if (!blitted) {
    // rgba so it composites over the real background (export-safe), not white.
    for (let r = 0; r < rows; r++) {
      const rowBase = r * pWidth
      const yBase = r * pitch + top + barTop
      let runStart = -1
      let runR = -1
      let runG = -1
      let runB = -1
      let runA = -1
      for (let px = 0; px <= pWidth; px++) {
        const k = (rowBase + px) << 2
        const a = px < pWidth ? acc[k + 3] : 0
        let rr = -1
        let gg = -1
        let bb = -1
        let aq = -1
        if (a > 0) {
          const inv = 1 / a
          rr = (acc[k] * inv + 0.5) | 0
          gg = (acc[k + 1] * inv + 0.5) | 0
          bb = (acc[k + 2] * inv + 0.5) | 0
          aq = (a * 255 + 0.5) | 0
        }
        if (runStart >= 0 && (rr !== runR || gg !== runG || bb !== runB || aq !== runA)) {
          ctx.fillStyle = `rgba(${runR},${runG},${runB},${runA / 255})`
          ctx.fillRect(pLeft + runStart, yBase, px - runStart, barH)
          runStart = -1
        }
        if (a > 0 && runStart < 0) {
          runStart = px
          runR = rr
          runG = gg
          runB = bb
          runA = aq
        }
      }
    }
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
      const hOrig = buffer[idx + 3]

      let h: number
      let yInternal: number
      if (hOrig === SCARF_LAYOUT.HEIGHT_NON_FIXATION_DEFAULT) {
        h = layout.nonFixationHeight
        yInternal = layout.isOverlay
          ? layout.spaceAboveRect + layout.heightOfBar - layout.nonFixationHeight
          : layout.spaceAboveRect + (layout.heightOfBar - layout.nonFixationHeight) / 2
      } else {
        h = hOrig * layout.scaleFactor
        yInternal =
          layout.spaceAboveRect +
          (buffer[idx + 7] - SCARF_LAYOUT.SPACE_ABOVE_RECT_DEFAULT) * layout.scaleFactor
      }

      ctx.fillRect(
        pLeft + buffer[idx] * pWidth,
        pIdx * pitch + yInternal + top,
        buffer[idx + 2] * pWidth,
        h
      )
    }
  }
}

/**
 * Emits the composite layer by writing packed RGBA pixels into a reused
 * offscreen ImageData and blitting it once with `drawImage`, avoiding the
 * per-run `fillStyle = rgba(...)` string allocate + parse that dominates a
 * dense emit. The offscreen is at LOGICAL resolution (one cell per logical
 * pixel, exactly what the accumulator holds); `drawImage` under the
 * dpr-scaled context upscales it, with smoothing off so it matches the
 * fillRect path's sharp logical-pixel blocks (verified pixel-identical at
 * integer dpr, <=2 RGB at fractional). Returns false if no 2D context is
 * available so the caller can fall back to per-run rects.
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
): boolean {
  const offH = rows * pitch
  if (!_offCanvas || _offCanvas.width !== pWidth || _offCanvas.height !== offH) {
    _offCanvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(pWidth, offH)
        : Object.assign(document.createElement('canvas'), { width: pWidth, height: offH })
    _offCtx = _offCanvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null
    _offImg = _offCtx ? _offCtx.createImageData(pWidth, offH) : null
  }
  if (!_offCtx || !_offImg) return false

  const data = _offImg.data
  data.fill(0)
  // Little-endian RGBA packing (every current target platform is LE).
  const u32 = new Uint32Array(data.buffer)
  const bh = (barH + 0.5) | 0
  for (let r = 0; r < rows; r++) {
    const rowBase = r * pWidth
    const yTop = (r * pitch + barTop) | 0
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
  ctx.drawImage(_offCanvas as CanvasImageSource, pLeft, top)
  ctx.imageSmoothingEnabled = prevSmoothing
  return true
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
      const slotTop = pIdx * pitch + bandTop + lane * laneH + top
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

/** Accumulates one identifier's segments within a single vertical band
 * (participant row × element type). `vanished` holds the logical x-intervals of
 * segments that don't fill a device pixel of colour on their own — the ring
 * candidates — and `visible` holds the [x0, x1] logical spans of segments that
 * clearly do. A candidate's ring is dropped when the colour actually renders:
 * either the cluster covers ≥1 device pixel at the current DPI (one fat segment,
 * or several packed thin ones together), or a visible span of the same type
 * already sits under the ring — in every such case the identifier is locatable
 * without it. */
interface MarkerBand {
  color: string
  cy: number
  rowTop: number
  rowBottom: number
  vanished: { x0: number; x1: number }[]
  visible: number[] // flat [x0, x1, x0, x1, …] logical pairs
}

export interface ScarfHighlightMarkerOptions {
  rectStyleArray: ScarfRectStyle[]
  eventStyleArray: ScarfEventStyle[]
  highlightMask: Uint8Array | null
  /** Device pixels per logical pixel (devicePixelRatio, or dpiOverride/96 on
   * export). Vanishing is judged in DEVICE pixels: a segment that's sub-pixel on
   * screen may paint solid colour at export DPI, and then needs no ring. */
  deviceScale: number
}

/**
 * Rings the location of HIGHLIGHTED segments whose true duration is so brief
 * they render sub-pixel-wide and would otherwise vanish among the desaturated
 * neighbours. Covers every highlightable type — AOI fixations, category
 * (saccade/other) segments and overlaid event strips — keyed off the same
 * highlight mask the dimming uses.
 *
 * The ring is an annotation, not a resized datum: it never inflates the
 * segment's width, so the timeline stays truthful. Adjacent vanished segments
 * of one identifier collapse into a single ring drawn at their centroid, and a
 * cluster whose colour does paint (≥1 device pixel covered at the render DPI)
 * is left ringless — the marker only ever stands in for colour you can't see.
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
  const top = layout.effectiveMarginTop
  const scale = opts.deviceScale > 0 ? opts.deviceScale : 1
  // A segment is "vanished" only if it covers less than this many DEVICE pixels.
  const VANISH = SCARF_LAYOUT.HIGHLIGHT_MARKER_VANISH_PX

  // One band per (style × participant row). A segment whose device-pixel width
  // falls below the floor is a ring candidate; a wider one is a visible span
  // that, when overlapped, suppresses a ring.
  const bands = new Map<string, MarkerBand>()
  const band = (
    key: string,
    color: string,
    cy: number,
    rowTop: number,
    rowBottom: number
  ): MarkerBand => {
    let b = bands.get(key)
    if (!b) {
      b = { color, cy, rowTop, rowBottom, vanished: [], visible: [] }
      bands.set(key, b)
    }
    return b
  }
  const add = (b: MarkerBand, x0: number, wPx: number) => {
    if (wPx * scale < VANISH) b.vanished.push({ x0, x1: x0 + wPx })
    else b.visible.push(x0, x0 + wPx)
  }

  // Gaze rectangles and overlaid event strips are one thing here: a colour band
  // per (style × row) that gets ringed wherever a highlighted member is too
  // brief to paint. They feed the SAME pass — an empty event bucket simply
  // contributes nothing, so whether events are shown changes neither the code
  // path nor the ring geometry. Point (zero-duration) events are intentional
  // always-visible diamonds, so they count as visible spans, never candidates.
  const pitch = layout.heightOfBarWrap
  const hw = SCARF_LAYOUT.MIN_POINT_PX / 2
  type RingStyle = { normal?: { fill?: string; stroke?: string } }
  const sources = [
    {
      tag: 'r',
      buckets: data.visualRectBuckets,
      stride: RECT_STRIDE,
      styles: opts.rectStyleArray as RingStyle[],
      hasPoints: false,
    },
    {
      tag: 'e',
      buckets: data.visualEventBuckets,
      stride: OVERLAY_EVENT_STRIDE,
      styles: opts.eventStyleArray as RingStyle[],
      hasPoints: true,
    },
  ]

  for (const src of sources) {
    for (let styleIdx = 0; styleIdx < src.buckets.length; styleIdx++) {
      if (highlightMask[styleIdx] !== 1) continue
      const buffer = src.buckets[styleIdx]
      if (buffer.length === 0) continue
      const style = src.styles[styleIdx]?.normal
      const color = style?.fill ?? style?.stroke
      if (!color) continue
      const count = buffer.length / src.stride
      for (let i = 0; i < count; i++) {
        const idx = i * src.stride
        const pIndex = buffer[idx + 1]
        const rowTop = pIndex * pitch + top
        // Locator rings sit at the ROW centre — one rule for gaze and event
        // bands alike, independent of how a row's height splits between the gaze
        // bar and the event band. In a gaze-only row the row centre IS the bar
        // centre, so existing plots are unchanged; with events on the ring no
        // longer shrinks below the threshold and vanishes as the bar yields
        // height to the band.
        const cy = rowTop + pitch / 2
        const x0 = pLeft + buffer[idx] * pWidth
        const b = band(`${src.tag}${styleIdx}@${pIndex}`, color, cy, rowTop, rowTop + pitch)
        if (src.hasPoints && (buffer[idx + 4] | 0) === 1) {
          b.visible.push(x0 - hw, x0 + hw)
        } else {
          add(b, x0, buffer[idx + 2] * pWidth)
        }
      }
    }
  }

  if (bands.size === 0) return

  ctx.save()
  for (const b of bands.values()) {
    const segs = b.vanished
    if (segs.length === 0) continue
    // Fit the ring inside its row so neighbouring rows never overlap.
    const r = Math.min(
      SCARF_LAYOUT.HIGHLIGHT_MARKER_RADIUS,
      Math.floor(Math.min(b.cy - b.rowTop, b.rowBottom - b.cy)) - 1
    )
    if (r < SCARF_LAYOUT.HIGHLIGHT_MARKER_MIN_RADIUS) continue

    const clusterGap = 2 * r
    segs.sort((p, q) => p.x0 + p.x1 - (q.x0 + q.x1))
    let start = 0
    for (let i = 1; i <= segs.length; i++) {
      const prevC = (segs[i - 1].x0 + segs[i - 1].x1) / 2
      const curC = i < segs.length ? (segs[i].x0 + segs[i].x1) / 2 : Infinity
      if (curC - prevC <= clusterGap) continue

      // Close the cluster segs[start..i). Skip the ring when the colour renders:
      // the cluster covers ≥1 device pixel, or a visible span of this same type
      // already lies under the footprint.
      let sum = 0
      for (let k = start; k < i; k++) sum += (segs[k].x0 + segs[k].x1) / 2
      const centroid = sum / (i - start)
      if (
        !clusterPaintsDevicePixel(segs, start, i, scale, VANISH) &&
        !spanOverlaps(centroid - r, centroid + r, b.visible)
      ) {
        drawHighlightRing(ctx, centroid, b.cy, r, b.color)
      }
      start = i
    }
  }
  ctx.restore()
}

/** True if [a, b] intersects any [x0, x1] pair in the flat `spans` array. */
function spanOverlaps(a: number, b: number, spans: number[]): boolean {
  for (let k = 0; k < spans.length; k += 2) {
    if (spans[k] <= b && spans[k + 1] >= a) return true
  }
  return false
}

/**
 * True if the cluster `segs[start..end)` paints a contiguous run of colour at
 * least `minCov` device pixels wide at `scale` — i.e. the colour is actually
 * visible, so no ring is needed. Touching/overlapping segments merge into one
 * run; the widest run is compared against the floor. A run ≥ 1 device pixel is a
 * mark you can see, whether it comes from one segment or several packed thin
 * ones. (Contiguous-length, not per-pixel coverage, so it's robust at the
 * exact-pixel boundary.)
 */
function clusterPaintsDevicePixel(
  segs: { x0: number; x1: number }[],
  start: number,
  end: number,
  scale: number,
  minCov: number
): boolean {
  if (end - start === 1) {
    return (segs[start].x1 - segs[start].x0) * scale >= minCov
  }
  // A gap smaller than this (device px) won't show white between two marks, so
  // they read as one — bridge it. Also absorbs float-rounding at exact abutment.
  const BRIDGE = 0.5
  const iv: [number, number][] = []
  for (let k = start; k < end; k++) {
    iv.push([segs[k].x0 * scale, segs[k].x1 * scale])
  }
  iv.sort((p, q) => p[0] - q[0])
  let maxRun = 0
  let curS = iv[0][0]
  let curE = iv[0][1]
  for (let k = 1; k < iv.length; k++) {
    if (iv[k][0] <= curE + BRIDGE) {
      if (iv[k][1] > curE) curE = iv[k][1]
    } else {
      if (curE - curS > maxRun) maxRun = curE - curS
      curS = iv[k][0]
      curE = iv[k][1]
    }
  }
  if (curE - curS > maxRun) maxRun = curE - curS
  return maxRun >= minCov
}

/** A colour ring over a white halo, so it reads on any backdrop. */
function drawHighlightRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string
) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = SCARF_LAYOUT.HIGHLIGHT_MARKER_RING_WIDTH + 2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.lineWidth = SCARF_LAYOUT.HIGHLIGHT_MARKER_RING_WIDTH
  ctx.stroke()
}

function calculateTickStep(len: number): number {
  const niceSteps = [5, 10, 20, 25, 50, 100, 200, 500, 1000]
  for (const s of niceSteps) {
    if (len / s <= 10) return s
  }
  return 1000
}
