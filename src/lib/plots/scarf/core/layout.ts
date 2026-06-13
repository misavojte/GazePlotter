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
 * Resolves the event band given the gaze bar height it must sit beneath.
 *
 * Invariant: the band NEVER exceeds the gaze bar — gaze is the primary datum,
 * events only annotate it. So:
 *  - band fits naturally (lanes × naturalLaneH ≤ bar) → use it unchanged;
 *  - otherwise the band is capped at the bar and the lanes compress to share it;
 *  - if that squeezes lanes below the legibility floor, the lanes collapse into
 *    a SINGLE presence strip (height ≤ bar) — at that density per-lane timing is
 *    illegible anyway, so we show only "an event was active here".
 */
function resolveEventBand(
  heightOfBar: number,
  lanes: number,
  naturalLaneH: number
): { bandHeight: number; laneHeight: number; merged: boolean } {
  if (lanes <= 0) return { bandHeight: 0, laneHeight: 0, merged: false }

  const bandHeight = Math.min(lanes * naturalLaneH, heightOfBar)
  const perLane = bandHeight / lanes
  if (perLane >= SCARF_LAYOUT.MIN_COMPRESSED_EVENT_LANE_H) {
    return { bandHeight, laneHeight: perLane, merged: false }
  }
  const strip = Math.min(naturalLaneH, heightOfBar)
  return { bandHeight: strip, laneHeight: strip, merged: true }
}

/**
 * Computes the vertical layout for COMBINED (overlay) mode.
 *
 * The row is symmetric about a central SEAM = the shared baseline (bottom edge)
 * of the gaze segments. Fixations and non-fixations are both bottom-aligned to
 * the seam; the gaze sequence rises UP from it and the event band HANGS DOWN
 * from it. The band height is capped at the gaze bar height (see
 * `resolveEventBand`) so events never dominate the gaze; `concurrency` is the
 * OBSERVED max simultaneous events, so the band — and the row pitch — is uniform
 * across rows. A single scale drives bar and band; the bar is floored at
 * MIN_BAR_HEIGHT and the row gap at MIN_ROW_GAP.
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

  const naturalLaneHForScale = (s: number) =>
    lanes > 0 ? Math.max(SCARF_LAYOUT.MIN_EVENT_LANE_H, baseLane * s) : 0

  // Natural (scale 1) pitch: top pad + bar + seam gap + band + bottom gap.
  const seamGap1 = lanes > 0 ? baseSeamGap : 0
  const naturalPitch =
    baseSAR +
    baseBar +
    seamGap1 +
    resolveEventBand(baseBar, lanes, naturalLaneHForScale(1)).bandHeight +
    baseRowGap

  const targetPitch =
    participantCount > 0 ? availableHeight / participantCount : naturalPitch

  // Helper function to compute the height of the bar wrap for a given scale.
  const getWrapHeightForScale = (s: number) => {
    const isComp = baseBar * s < SCARF_LAYOUT.COMPACT_MODE_THRESHOLD
    const hBar = baseBar * s
    const sSAR = isComp ? 0 : baseSAR * s
    const { bandHeight } = resolveEventBand(hBar, lanes, naturalLaneHForScale(s))
    const sGap = lanes > 0 ? Math.max(2, baseSeamGap * s) : 0
    const rGap = Math.max(baseRowGap, baseRowGap * s)
    return sSAR + hBar + sGap + bandHeight + rGap
  }

  const minScale = SCARF_LAYOUT.MIN_BAR_HEIGHT / baseBar
  const maxScale = SCARF_LAYOUT.MAX_BAR_SCALE

  let scale = minScale
  if (getWrapHeightForScale(minScale) <= targetPitch) {
    let low: number = minScale
    let high: number = maxScale
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
  const band = resolveEventBand(heightOfBar, lanes, naturalLaneHForScale(scale))
  const eventLaneHeight = band.laneHeight
  const eventZoneHeight = band.bandHeight
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
    eventLanesMerged: band.merged,
  }
}

/**
 * The minimum row pitch for overlay mode at the legibility floor — used to
 * decide whether the plot can render or must ask for more height. Because the
 * event band is now capped at the gaze bar, concurrency no longer inflates this:
 * at the smallest bar the band is at most MIN_BAR_HEIGHT.
 */
export function calculateOverlayMinRowPitch(concurrency: number): number {
  const lanes = Math.max(0, Math.floor(concurrency))
  const seamGap = lanes > 0 ? 2 : 0
  const band = lanes > 0 ? SCARF_LAYOUT.MIN_BAR_HEIGHT : 0
  return (
    SCARF_LAYOUT.MIN_BAR_HEIGHT + seamGap + band + SCARF_LAYOUT.MIN_ROW_GAP
  )
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
