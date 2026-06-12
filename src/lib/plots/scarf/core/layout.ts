import {
  FONT_PRIMARY,
  computeGroupedLegendGeometry,
  SCARF_LEGEND_CONFIG,
} from '$lib/plots/shared'
import { calculateTextMetrics } from '$lib/shared/utils/textUtils'
import { SCARF_LAYOUT } from '../const'

/**
 * Calculates if compact mode should be active based on available vertical space.
 */
export function calculateIsCompactMode(
  participantCount: number,
  availableHeight: number
): boolean {
  if (participantCount === 0) return false
  const rawScale =
    availableHeight /
    (participantCount *
      (SCARF_LAYOUT.HEIGHT_BAR_DEFAULT +
        SCARF_LAYOUT.SPACE_ABOVE_RECT_DEFAULT * 2))
  const prelimScale = Math.max(
    SCARF_LAYOUT.MIN_BAR_HEIGHT / SCARF_LAYOUT.HEIGHT_BAR_DEFAULT,
    Math.min(SCARF_LAYOUT.MAX_BAR_SCALE, rawScale)
  )
  return (
    SCARF_LAYOUT.HEIGHT_BAR_DEFAULT * prelimScale <
    SCARF_LAYOUT.COMPACT_MODE_THRESHOLD
  )
}

/**
 * Computes the width of the left label area.
 */
export function calculateLeftLabelWidth(
  isCompact: boolean,
  participantLabels: string[]
): number {
  if (isCompact) return 55
  if (participantLabels.length === 0) return SCARF_LAYOUT.LEFT_LABEL_MAX_WIDTH

  const { maxWidth: measuredMaxWidth } = calculateTextMetrics(
    participantLabels,
    FONT_PRIMARY.SIZE,
    FONT_PRIMARY.FAMILY
  )

  // Use the measured max width plus some padding, capped at a reasonable max
  // Default padding is 15px (10px for alignment)
  const paddedWidth = measuredMaxWidth + 10
  return Math.min(SCARF_LAYOUT.LEFT_LABEL_MAX_WIDTH, paddedWidth)
}

/**
 * Computes the vertical layout and scaling factors.
 */
export function calculatePlotLayout(
  participantCount: number,
  availableHeight: number,
  isCompact: boolean
) {
  const defaultBH = SCARF_LAYOUT.HEIGHT_BAR_DEFAULT
  const defaultSAR = SCARF_LAYOUT.SPACE_ABOVE_RECT_DEFAULT
  const defaultNFH = SCARF_LAYOUT.HEIGHT_NON_FIXATION_DEFAULT
  const defaultWrap = defaultBH + defaultSAR * 2

  const targetHeightOfBarWrap =
    participantCount > 0 ? availableHeight / participantCount : defaultWrap

  let scale: number
  if (isCompact) {
    scale = Math.max(
      SCARF_LAYOUT.MIN_BAR_HEIGHT / defaultBH,
      Math.min(SCARF_LAYOUT.MAX_BAR_SCALE, targetHeightOfBarWrap / defaultBH)
    )
  } else {
    scale = Math.max(
      SCARF_LAYOUT.MIN_BAR_HEIGHT / defaultBH,
      Math.min(SCARF_LAYOUT.MAX_BAR_SCALE, targetHeightOfBarWrap / defaultWrap)
    )
  }

  const scaledBH = defaultBH * scale
  const scaledSAR = isCompact ? 0 : defaultSAR * scale
  const scaledNFH = defaultNFH * scale
  const scaledWrap = isCompact ? scaledBH : scaledBH + scaledSAR * 2

  return {
    heightOfBar: scaledBH,
    spaceAboveRect: scaledSAR,
    nonFixationHeight: scaledNFH,
    heightOfBarWrap: scaledWrap,
    scaleFactor: scale,
    isCompact,
  }
}

/**
 * Computes the vertical layout for COMBINED (overlay) mode.
 *
 * The row is symmetric about a central SEAM = the shared baseline (bottom edge)
 * of the gaze segments. Fixations and non-fixations are both bottom-aligned to
 * the seam; the gaze sequence rises UP from it and the event band (height =
 * concurrency × lane height) HANGS DOWN from it. `concurrency` is the OBSERVED
 * max simultaneous events, so the band — and the row pitch — is uniform across
 * rows. A single scale drives bar and band; lane height is floored at the
 * legibility minimum, the bar at MIN_BAR_HEIGHT, the row gap at MIN_ROW_GAP.
 */
export function calculateOverlayLayout(
  participantCount: number,
  concurrency: number,
  availableHeight: number
) {
  const baseBar = SCARF_LAYOUT.HEIGHT_BAR_DEFAULT
  const baseSAR = SCARF_LAYOUT.SPACE_ABOVE_RECT_DEFAULT
  const baseNFH = SCARF_LAYOUT.HEIGHT_NON_FIXATION_DEFAULT
  const baseLane = SCARF_LAYOUT.EVENT_LANE_H
  const baseSeamGap = SCARF_LAYOUT.EVENT_ZONE_GAP
  const baseRowGap = SCARF_LAYOUT.MIN_ROW_GAP
  const lanes = Math.max(0, Math.floor(concurrency))

  // Natural (scale 1) pitch: top pad + bar + seam gap + band + bottom gap.
  const seamGap1 = lanes > 0 ? baseSeamGap : 0
  const naturalPitch =
    baseSAR + baseBar + seamGap1 + lanes * baseLane + baseRowGap

  const targetPitch =
    participantCount > 0 ? availableHeight / participantCount : naturalPitch

  // Helper function to compute the height of the bar wrap for a given scale.
  const getWrapHeightForScale = (s: number) => {
    const isComp = baseBar * s < SCARF_LAYOUT.COMPACT_MODE_THRESHOLD
    const hBar = baseBar * s
    const sSAR = isComp ? 0 : baseSAR * s
    const eLaneH = lanes > 0 ? Math.max(SCARF_LAYOUT.MIN_EVENT_LANE_H, baseLane * s) : 0
    const eZoneH = lanes * eLaneH
    const sGap = lanes > 0 ? Math.max(2, baseSeamGap * s) : 0
    const rGap = Math.max(baseRowGap, baseRowGap * s)
    return sSAR + hBar + sGap + eZoneH + rGap
  }

  const minScale = SCARF_LAYOUT.MIN_BAR_HEIGHT / baseBar
  const maxScale = SCARF_LAYOUT.MAX_BAR_SCALE

  let scale = minScale
  if (getWrapHeightForScale(minScale) <= targetPitch) {
    let low = minScale
    let high = maxScale
    // Binary search to find the largest scale where wrap height <= targetPitch.
    // 15 iterations provide highly precise scaling (1 in 32,768 precision).
    for (let iter = 0; iter < 15; iter++) {
      const mid = (low + high) / 2
      if (getWrapHeightForScale(mid) <= targetPitch) {
        scale = mid
        low = mid
      } else {
        high = mid
      }
    }
  }

  const isCompact = baseBar * scale < SCARF_LAYOUT.COMPACT_MODE_THRESHOLD

  const heightOfBar = baseBar * scale
  const spaceAboveRect = isCompact ? 0 : baseSAR * scale
  const nonFixationHeight = baseNFH * scale
  const eventLaneHeight =
    lanes > 0 ? Math.max(SCARF_LAYOUT.MIN_EVENT_LANE_H, baseLane * scale) : 0
  const eventZoneHeight = lanes * eventLaneHeight
  // A real whitespace gap separates the gaze baseline (seam) from the event band
  // — a hue-independent separator so same-coloured events never merge into the
  // gaze. Kept ≥ 2px even when scaled down.
  const seamGap = lanes > 0 ? Math.max(2, baseSeamGap * scale) : 0
  const rowGap = Math.max(baseRowGap, baseRowGap * scale)

  // Seam = gaze baseline (bottom of the bottom-aligned gaze segments). The event
  // band hangs below it across the gap; gaze segments are never overdrawn.
  const eventBandTop = spaceAboveRect + heightOfBar + seamGap
  const heightOfBarWrap = eventBandTop + eventZoneHeight + rowGap

  return {
    heightOfBar,
    spaceAboveRect,
    nonFixationHeight,
    heightOfBarWrap,
    scaleFactor: scale,
    isCompact,
    eventLaneHeight,
    eventZoneHeight,
    eventBandTop,
  }
}

/**
 * The minimum row pitch for overlay mode at the legibility floor — used to
 * decide whether the plot can render or must ask for more height. Matches the
 * floored components of calculateOverlayLayout (compact: no top pad).
 */
export function calculateOverlayMinRowPitch(concurrency: number): number {
  const lanes = Math.max(0, Math.floor(concurrency))
  const seamGap = lanes > 0 ? 2 : 0
  const band = lanes * SCARF_LAYOUT.MIN_EVENT_LANE_H
  return (
    SCARF_LAYOUT.MIN_BAR_HEIGHT + seamGap + band + SCARF_LAYOUT.MIN_ROW_GAP
  )
}

/**
 * Computes layout for events-only display mode.
 * Each participant row is divided into sub-lanes for event channels.
 */
export function calculateEventOnlyLayout(
  participantCount: number,
  totalLanesPerParticipant: number,
  availableHeight: number
) {
  if (participantCount === 0 || totalLanesPerParticipant === 0) {
    return { laneHeight: 10, rowHeight: 10, scaleFactor: 1 }
  }

  const targetRowHeight = availableHeight / participantCount
  const laneHeight = Math.max(2, Math.min(20, targetRowHeight / totalLanesPerParticipant))
  const rowHeight = laneHeight * totalLanesPerParticipant

  return { laneHeight, rowHeight, scaleFactor: 1 }
}

/**
 * Computes the x-axis label.
 */
export function getXAxisLabel(
  timelineType: 'absolute' | 'relative' | 'ordinal',
  timelineStart = 0,
  timelineEnd = 0
): string {
  if (timelineType === 'ordinal') return 'Order index'
  if (timelineType === 'absolute') return 'Elapsed time [ms]'

  // Scientific notation for relative view
  let label = `Elapsed time [%]`
  if (timelineStart > 0 && timelineEnd > 0) {
    label += `, t ∈ [${timelineStart}, ${timelineEnd}] ms`
  } else if (timelineStart > 0) {
    label += `, t ≥ ${timelineStart} ms`
  } else if (timelineEnd > 0) {
    label += `, t ≤ ${timelineEnd} ms`
  }

  return label
}
/**
 * Creates a unified identifier mapping system for Scarf Plots.
 */
export function getScarfIdentifierSystem(
  aoiIdentifiers: string[],
  categoryIdentifiers: string[],
  visibilityIdentifiers: string[]
) {
  const idToIndex = new Map<string, number>()
  const indexToId = new Map<number, string>()
  const idToType = new Map<string, 'aoi' | 'category' | 'visibility'>()

  let idx = 0

  for (const id of aoiIdentifiers) {
    indexToId.set(idx, id)
    idToIndex.set(id, idx++)
    idToType.set(id, 'aoi')
  }

  for (const id of categoryIdentifiers) {
    indexToId.set(idx, id)
    idToIndex.set(id, idx++)
    idToType.set(id, 'category')
  }

  for (const id of visibilityIdentifiers) {
    indexToId.set(idx, id)
    idToIndex.set(id, idx++)
    idToType.set(id, 'visibility')
  }

  return {
    idToIndex,
    indexToId,
    idToType,
    totalIdentifiers: idx,
    counts: {
      aoi: aoiIdentifiers.length,
      category: categoryIdentifiers.length,
      visibility: visibilityIdentifiers.length,
    },
  }
}

/**
 * Calculates the static legend height based only on data.
 */
export function calculateLegendStructuralHeight(
  groups: {
    title: string
    items: { identifier: string; name: string; color: string }[]
  }[],
  chartWidth: number
): number {
  if (groups.length === 0) return 0

  const dummyGroups = groups.map(g => ({
    title: g.title,
    items: g.items.map(i => ({
      identifier: i.identifier,
      name: i.name,
      color: i.color,
      type: 'fixation' as const,
    })),
  }))

  const tempLayout = computeGroupedLegendGeometry(
    dummyGroups,
    SCARF_LEGEND_CONFIG,
    0,
    0,
    chartWidth
  )
  return tempLayout.totalHeight
}

/**
 * Calculates the intrinsic content height of the visualization.
 */
export function calculateIntrinsicContentHeight(
  legendHeight: number,
  legendY: number,
  xAxisHeight: number,
  participantBarsHeight: number,
  internalPaddingBottom: number
): number {
  if (legendHeight > 0) {
    return legendY + legendHeight + internalPaddingBottom
  }
  return participantBarsHeight + xAxisHeight + internalPaddingBottom
}

/**
 * Calculates the effective top margin based on available space and centering.
 */
export function calculateEffectiveMarginTop(
  availableHeight: number,
  intrinsicHeight: number,
  marginTop: number,
  marginBottom: number,
  internalPaddingTop: number
): number {
  const centeringOffset =
    availableHeight >
    intrinsicHeight + marginTop + marginBottom + internalPaddingTop
      ? Math.floor(
          (availableHeight -
            intrinsicHeight -
            marginTop -
            marginBottom -
            internalPaddingTop) /
            2
        )
      : 0
  return marginTop + centeringOffset + internalPaddingTop
}
