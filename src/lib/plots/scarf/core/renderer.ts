import type { ScarfData } from '../types'
import { SCARF_LAYOUT } from '../const'
import {
  GRIDLINE_PRIMARY,
  GRIDLINE_SECONDARY,
  FONT_PRIMARY,
} from '$lib/plots/shared'
import { alignToPixelCenter } from '$lib/shared/utils/canvasUtils'
import { desaturateToWhite } from '$lib/shared/utils/colorUtils'

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
    ctx.textAlign = 'right'
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
    const xPos = leftX - 10
    for (let i = 0; i < len; i++) {
      ctx.fillText(
        participants[i].label,
        xPos,
        i * layout.heightOfBarWrap +
          (layout.heightOfBarWrap >> 1) +
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
  const RECT_STRIDE = 8

  for (let styleIdx = 0; styleIdx < buckets.length; styleIdx++) {
    const buffer = buckets[styleIdx]
    if (buffer.length === 0) continue

    const isDimmed = isHighlightActive ? highlightMask[styleIdx] !== 1 : false
    const styleSet = styleArray[styleIdx]
    ctx.fillStyle = isDimmed
      ? desaturateToWhite(styleSet.normal.fill, 0.85)
      : styleSet.normal.fill

    ctx.beginPath()
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

      ctx.rect(
        pLeft + xNorm * pWidth,
        pIdx * layout.heightOfBarWrap + yInternal + layout.effectiveMarginTop,
        wNorm * pWidth,
        h
      )
    }
    ctx.fill()
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
  const EVENT_STRIDE = 5

  for (let styleIdx = buckets.length - 1; styleIdx >= 0; styleIdx--) {
    const buffer = buckets[styleIdx]
    if (buffer.length === 0) continue

    const isDimmed = isHighlightActive ? highlightMask[styleIdx] !== 1 : false
    const color = isDimmed
      ? desaturateToWhite(styleArray[styleIdx].normal.stroke, 0.85)
      : styleArray[styleIdx].normal.stroke
    const outline = isDimmed ? desaturateToWhite('#333333', 0.85) : '#333333'

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
      const innerRadius = Math.max(2, radius * 0.4)

      ctx.beginPath()
      ctx.fillStyle = type === 0 ? color : '#ffffff'
      ctx.arc(pxX, pxY, radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.fillStyle = type === 0 ? '#ffffff' : color
      ctx.arc(pxX, pxY, innerRadius, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.strokeStyle = outline
      ctx.lineWidth = 1
      ctx.arc(pxX, pxY, radius + 0.2, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

function calculateTickStep(len: number): number {
  const niceSteps = [5, 10, 20, 25, 50, 100, 200, 500, 1000]
  for (const s of niceSteps) {
    if (len / s <= 10) return s
  }
  return 1000
}
