import {
  FONT_PRIMARY,
  GRIDLINE_PRIMARY,
  GRIDLINE_SECONDARY,
  ROW_LABEL_GAP,
} from '$lib/plots/shared'
import { alignToPixelCenter } from '$lib/plots/shared/canvasUtils'
import { desaturateToWhite } from '$lib/color'
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
  /** Combined-mode: total event-band height (capped at the gaze bar). 0 otherwise. */
  eventZoneHeight: number
  /** Combined-mode: y within a row where the event band begins, just below the
   * AOI bar's bottom seam (events hang downward from here). 0 otherwise. */
  eventBandTop: number
  /** Combined-mode: lanes were collapsed into a single presence strip because the
   * band cap squeezed them below the legibility floor — draw every strip in lane 0. */
  eventLanesMerged: boolean
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
 * Core drawing for the scarf segments (rectangles).
 */
export function drawScarfRectangles(
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

  for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
    const buffer = buckets[styleIdx]
    if (buffer.length === 0) continue

    const isDimmed = isHighlightActive ? highlightMask[styleIdx] !== 1 : false
    const styleSet = styleArray[styleIdx]
    ctx.fillStyle = isDimmed
      ? desaturateToWhite(styleSet.normal.fill, 0.85)
      : styleSet.normal.fill

    const segmentCount = buffer.length / RECT_STRIDE
    for (let i = 0; i < segmentCount; i++) {
      const idx = i * RECT_STRIDE
      const xNorm = buffer[idx]
      const pIdx = buffer[idx + 1]
      const wNorm = buffer[idx + 2]
      const hOrig = buffer[idx + 3]
      const yOrig = buffer[idx + 7]

      let h: number
      let yInternal: number

      if (hOrig === SCARF_LAYOUT.HEIGHT_NON_FIXATION_DEFAULT) {
        // Non-fixation (saccade / other). In overlay mode its BOTTOM edge is
        // aligned with the fixation bottom (the seam baseline), so the whole gaze
        // sequence shares one baseline; otherwise centred within the gaze bar.
        h = layout.nonFixationHeight
        yInternal = layout.isOverlay
          ? layout.spaceAboveRect +
            layout.heightOfBar -
            layout.nonFixationHeight
          : layout.spaceAboveRect +
            (layout.heightOfBar - layout.nonFixationHeight) / 2
      } else {
        // Fixation / AOI / no-AOI: rises from the top pad down to the seam.
        h = hOrig * layout.scaleFactor
        yInternal =
          layout.spaceAboveRect +
          (yOrig - SCARF_LAYOUT.SPACE_ABOVE_RECT_DEFAULT) * layout.scaleFactor
      }

      ctx.fillRect(
        pLeft + xNorm * pWidth,
        pIdx * layout.heightOfBarWrap + yInternal + layout.effectiveMarginTop,
        wNorm * pWidth,
        h
      )
    }
  }
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
export function drawOverlayEventStrips(
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
    ctx.fillStyle = isDimmed ? desaturateToWhite(base, 0.85) : base

    const count = buffer.length / OVERLAY_EVENT_STRIDE
    for (let i = 0; i < count; i++) {
      const idx = i * OVERLAY_EVENT_STRIDE
      const xNorm = buffer[idx]
      const pIdx = buffer[idx + 1]
      const wNorm = buffer[idx + 2]
      // Merged presence strip: ignore the per-event lane, paint all in lane 0.
      const lane = layout.eventLanesMerged ? 0 : buffer[idx + 3] | 0
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

  // --- AOI + category rectangles ---
  {
    const buckets = data.visualRectBuckets
    const pitch = layout.heightOfBarWrap
    // Ring the bar's vertical centre regardless of AOI-stacking, so every
    // segment of one identifier in a row shares a band.
    const barCenter = layout.spaceAboveRect + layout.heightOfBar / 2
    for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
      if (highlightMask[styleIdx] !== 1) continue
      const buffer = buckets[styleIdx]
      if (buffer.length === 0) continue
      const color = opts.rectStyleArray[styleIdx]?.normal?.fill
      if (!color) continue
      const count = buffer.length / RECT_STRIDE
      for (let i = 0; i < count; i++) {
        const idx = i * RECT_STRIDE
        const rowTop = buffer[idx + 1] * pitch + top
        const cy = rowTop + barCenter
        const b = band(`r${styleIdx}@${cy}`, color, cy, rowTop, rowTop + pitch)
        add(b, pLeft + buffer[idx] * pWidth, buffer[idx + 2] * pWidth)
      }
    }
  }

  // --- Overlaid event strips ---
  if (layout.isOverlay && layout.eventLaneHeight > 0) {
    const buckets = data.visualEventBuckets
    const pitch = layout.heightOfBarWrap
    const bandCenter = layout.eventBandTop + layout.eventZoneHeight / 2
    const hw = SCARF_LAYOUT.MIN_POINT_PX / 2
    for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
      if (highlightMask[styleIdx] !== 1) continue
      const buffer = buckets[styleIdx]
      if (buffer.length === 0) continue
      const style = opts.eventStyleArray[styleIdx]?.normal
      const color = style?.fill ?? style?.stroke
      if (!color) continue
      const count = buffer.length / OVERLAY_EVENT_STRIDE
      for (let i = 0; i < count; i++) {
        const idx = i * OVERLAY_EVENT_STRIDE
        const x0 = pLeft + buffer[idx] * pWidth
        const rowTop = buffer[idx + 1] * pitch + top
        const cy = rowTop + bandCenter
        const b = band(`e${styleIdx}@${cy}`, color, cy, rowTop, rowTop + pitch)
        // Point (zero-duration) events are intentional, always-visible diamonds:
        // never ringed, but they count as a visible span of their type.
        if ((buffer[idx + 4] | 0) === 1) b.visible.push(x0 - hw, x0 + hw)
        else add(b, x0, buffer[idx + 2] * pWidth)
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
