import {
  FONT_PRIMARY,
  GRIDLINE_PRIMARY,
  GRIDLINE_SECONDARY,
  ROW_LABEL_GAP,
} from '$lib/plots/shared'
import { alignToPixelCenter } from '$lib/plots/shared/canvasUtils'
import { desaturateToWhite } from '$lib/color'
import { OVERLAY_EVENT_STRIDE, RECT_STRIDE, SCARF_LAYOUT } from '../const'
import type { ScarfData } from '../types'

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
  /** Combined-mode: total event-band height (lanes × laneHeight). 0 otherwise. */
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
 * Core drawing for the scarf segments (rectangles).
 */
export function drawScarfRectangles(
  ctx: CanvasRenderingContext2D,
  data: ScarfData,
  layout: ScarfLayoutContext,
  styleArray: any[],
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
          ? layout.spaceAboveRect + layout.heightOfBar - layout.nonFixationHeight
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
  styleArray: any[],
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

/**
 * Core drawing for event channel rectangles (events-only mode).
 * Renders gantt-style colored rectangles from the event channel buffer.
 */
export function drawEventChannelRects(
  ctx: CanvasRenderingContext2D,
  data: ScarfData,
  layout: ScarfLayoutContext,
  laneHeight: number,
  rowHeight: number,
  highlightMask: Uint8Array | null,
  channelStyleIndices: number[] | null
) {
  const buffer = data.visualEventChannelBuffer
  if (!buffer || buffer.length === 0) return
  const channels = data.eventChannels
  if (!channels || channels.length === 0) return

  const EVENT_CHANNEL_STRIDE = 5
  const pLeft = Math.floor(layout.leftLabelWidth + layout.marginLeft)
  const pWidth = Math.floor(layout.plotAreaWidth)
  const segmentCount = buffer.length / EVENT_CHANNEL_STRIDE
  const isHighlightActive = highlightMask !== null

  for (let i = 0; i < segmentCount; i++) {
    const idx = i * EVENT_CHANNEL_STRIDE
    const xNorm = buffer[idx]
    const wNorm = buffer[idx + 1]
    const laneIndex = buffer[idx + 2] | 0
    const pIdx = buffer[idx + 3] | 0
    const chIdx = buffer[idx + 4] | 0

    const channel = channels[chIdx]
    if (!channel) continue

    const pxX = pLeft + xNorm * pWidth
    const pxW = Math.max(1, wNorm * pWidth)
    const pxY =
      pIdx * rowHeight + laneIndex * laneHeight + layout.effectiveMarginTop

    const styleIdx = channelStyleIndices ? channelStyleIndices[chIdx] : -1
    const isDimmed =
      isHighlightActive && styleIdx >= 0 ? highlightMask[styleIdx] !== 1 : false
    ctx.fillStyle = isDimmed
      ? desaturateToWhite(channel.color, 0.85)
      : channel.color
    ctx.fillRect(pxX, pxY, pxW, laneHeight)
  }
}

function calculateTickStep(len: number): number {
  const niceSteps = [5, 10, 20, 25, 50, 100, 200, 500, 1000]
  for (const s of niceSteps) {
    if (len / s <= 10) return s
  }
  return 1000
}
