import {
  FONT_PRIMARY,
  GRIDLINE_PRIMARY,
  GRIDLINE_SECONDARY,
  ROW_LABEL_GAP,
} from '$lib/plots/shared'
import { alignToPixelCenter } from '$lib/plots/shared/canvasUtils'
import { desaturateToWhite } from '$lib/color/utility'
import { EVENT_STRIDE, RECT_STRIDE } from '../const'
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
}

// --- Event marker geometry constants ---
/** Distance (in radius multiples) for merging nearby start/end markers into a dot */
const MARKER_MERGE_DISTANCE = 1.8
/** Margin (in radius multiples) from plot edge where markers are edge-clipped */
const MARKER_EDGE_THRESHOLD = 1.2

function drawDirectionalCompositeMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  isStart: boolean,
  color: string | null
) {
  const r = radius * 0.85
  const offset = radius * 0.3
  const tipOffset = radius * 1.2

  ctx.beginPath()
  if (isStart) {
    const cx = x - offset
    const px = x + tipOffset

    ctx.arc(cx, y, r, Math.PI / 2, (3 * Math.PI) / 2, false)
    ctx.bezierCurveTo(cx + r * 0.8, y - r, px - r * 0.6, y - r * 0.15, px, y)
    ctx.bezierCurveTo(
      px - r * 0.6,
      y + r * 0.15,
      cx + r * 0.8,
      y + r,
      cx,
      y + r
    )
  } else {
    const cx = x + offset
    const px = x - tipOffset

    ctx.arc(cx, y, r, Math.PI / 2, -Math.PI / 2, true)
    ctx.bezierCurveTo(cx - r * 0.8, y - r, px + r * 0.6, y - r * 0.15, px, y)
    ctx.bezierCurveTo(
      px + r * 0.6,
      y + r * 0.15,
      cx - r * 0.8,
      y + r,
      cx,
      y + r
    )
  }
  ctx.closePath()

  if (color === null) {
    // Halo pass
    ctx.lineJoin = 'round'
    ctx.lineWidth = 5.5
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fill()
  } else {
    // Normal pass
    ctx.fillStyle = color
    ctx.fill()

    ctx.lineJoin = 'miter'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function drawCircleEventMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string | null
) {
  const r = radius * 0.85

  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.closePath()

  if (color === null) {
    ctx.lineJoin = 'round'
    ctx.lineWidth = 5.5
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fill()
  } else {
    ctx.fillStyle = color
    ctx.fill()

    ctx.lineJoin = 'miter'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function drawDirectionalEventMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  type: number,
  color: string | null
) {
  if (type === 0) {
    drawDirectionalCompositeMarker(ctx, x, y, radius, true, color)
  } else {
    drawDirectionalCompositeMarker(ctx, x, y, radius, false, color)
  }
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

      let h = hOrig
      let yInternal = yOrig

      if (layout.scaleFactor !== 1) {
        if (hOrig === 4) {
          // NON_FIXATION_HEIGHT default
          h = layout.nonFixationHeight
          yInternal =
            layout.spaceAboveRect +
            (layout.heightOfBar - layout.nonFixationHeight) / 2
        } else {
          h = hOrig * layout.scaleFactor
          yInternal = layout.spaceAboveRect + (yOrig - 5) * layout.scaleFactor
        }
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
 * Core drawing for visibility event markers.
 */
export function drawScarfEvents(
  ctx: CanvasRenderingContext2D,
  data: ScarfData,
  layout: ScarfLayoutContext,
  styleArray: any[],
  highlightMask: Uint8Array | null,
  overrides: Map<number, number>
) {
  const buckets = data.visualEventBuckets
  const isHighlightActive = highlightMask !== null
  const pLeft = Math.floor(layout.leftLabelWidth + layout.marginLeft)
  const pWidth = Math.floor(layout.plotAreaWidth)

  for (let styleIdx = buckets.length - 1; styleIdx >= 0; styleIdx--) {
    const buffer = buckets[styleIdx]
    if (buffer.length === 0) continue

    const segmentCount = buffer.length / EVENT_STRIDE
    for (let i = 0; i < segmentCount; i++) {
      const idx = i * EVENT_STRIDE
      const xNorm = buffer[idx]
      const pIdx = buffer[idx + 1]
      const type = buffer[idx + 2] | 0

      const key = styleIdx * 1000000 + i
      const overrideY = layout.isCompact ? undefined : overrides.get(key)
      const yInternal =
        overrideY !== undefined
          ? overrideY * layout.scaleFactor
          : layout.spaceAboveRect + layout.heightOfBar / 2

      const pxX = pLeft + xNorm * pWidth
      const pxY =
        pIdx * layout.heightOfBarWrap + yInternal + layout.effectiveMarginTop
      const radius = Math.max(7, Math.min(12, layout.heightOfBar * 0.8)) / 2

      if (type === 0 && i + 1 < segmentCount) {
        const nextIdx = (i + 1) * EVENT_STRIDE
        const nextPIdx = buffer[nextIdx + 1]
        const nextType = buffer[nextIdx + 2] | 0

        if (nextPIdx === pIdx && nextType === 1) {
          const nextPxX = pLeft + buffer[nextIdx] * pWidth

          // Merge overlapping markers into a single dot or edge-specific marker
          if (nextPxX - pxX <= radius * MARKER_MERGE_DISTANCE) {
            const centerX = (pxX + nextPxX) / 2
            const edgeThreshold = radius * MARKER_EDGE_THRESHOLD

            if (centerX - pLeft <= edgeThreshold) {
              // Left edge: End marker (points left, outwards to indicate continuation)
              drawDirectionalEventMarker(
                ctx,
                Math.max(pLeft, centerX),
                pxY,
                radius,
                1,
                null
              )
            } else if (pLeft + pWidth - centerX <= edgeThreshold) {
              // Right edge: Start marker (points right, outwards to indicate continuation)
              drawDirectionalEventMarker(
                ctx,
                Math.min(pLeft + pWidth, centerX),
                pxY,
                radius,
                0,
                null
              )
            } else {
              // Inland: Normal circle
              drawCircleEventMarker(ctx, centerX, pxY, radius, null)
            }

            i++ // Skip the next marker
            continue
          }
        }
      }

      drawDirectionalEventMarker(ctx, pxX, pxY, radius, type, null)
    }
  }

  for (let styleIdx = buckets.length - 1; styleIdx >= 0; styleIdx--) {
    const buffer = buckets[styleIdx]
    if (buffer.length === 0) continue

    const isDimmed = isHighlightActive ? highlightMask[styleIdx] !== 1 : false
    const color = isDimmed
      ? desaturateToWhite(styleArray[styleIdx].normal.stroke, 0.85)
      : styleArray[styleIdx].normal.stroke
    const effectiveColor = isDimmed ? desaturateToWhite(color, 0.85) : color

    const segmentCount = buffer.length / EVENT_STRIDE
    for (let i = 0; i < segmentCount; i++) {
      const idx = i * EVENT_STRIDE
      const xNorm = buffer[idx]
      const pIdx = buffer[idx + 1]
      const type = buffer[idx + 2] | 0

      const key = styleIdx * 1000000 + i
      const overrideY = layout.isCompact ? undefined : overrides.get(key)
      const yInternal =
        overrideY !== undefined
          ? overrideY * layout.scaleFactor
          : layout.spaceAboveRect + layout.heightOfBar / 2

      const pxX = pLeft + xNorm * pWidth
      const pxY =
        pIdx * layout.heightOfBarWrap + yInternal + layout.effectiveMarginTop
      const radius = Math.max(7, Math.min(12, layout.heightOfBar * 0.8)) / 2

      if (type === 0 && i + 1 < segmentCount) {
        const nextIdx = (i + 1) * EVENT_STRIDE
        const nextPIdx = buffer[nextIdx + 1]
        const nextType = buffer[nextIdx + 2] | 0

        if (nextPIdx === pIdx && nextType === 1) {
          const nextPxX = pLeft + buffer[nextIdx] * pWidth

          // Merge overlapping markers into a single dot or edge-specific marker
          if (nextPxX - pxX <= radius * MARKER_MERGE_DISTANCE) {
            const centerX = (pxX + nextPxX) / 2
            const edgeThreshold = radius * MARKER_EDGE_THRESHOLD

            if (centerX - pLeft <= edgeThreshold) {
              // Left edge: End marker (points left, outwards to indicate continuation)
              drawDirectionalEventMarker(
                ctx,
                Math.max(pLeft, centerX),
                pxY,
                radius,
                1,
                effectiveColor
              )
            } else if (pLeft + pWidth - centerX <= edgeThreshold) {
              // Right edge: Start marker (points right, outwards to indicate continuation)
              drawDirectionalEventMarker(
                ctx,
                Math.min(pLeft + pWidth, centerX),
                pxY,
                radius,
                0,
                effectiveColor
              )
            } else {
              // Inland: Normal circle
              drawCircleEventMarker(ctx, centerX, pxY, radius, effectiveColor)
            }

            i++ // Skip the next marker
            continue
          }
        }
      }

      drawDirectionalEventMarker(ctx, pxX, pxY, radius, type, effectiveColor)
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
