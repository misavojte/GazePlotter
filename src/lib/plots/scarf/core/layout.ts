import { SCARF_LAYOUT } from '../const'
import type { ScarfData } from '../types'
import { computeGroupedLegendGeometry, FONT_PRIMARY } from '$lib/plots/shared'
import { calculateTextMetrics } from '$lib/shared/utils/textUtils'

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
 * Computes the timeline unit string.
 */
export function getTimelineUnit(
  timelineType: 'absolute' | 'relative' | 'ordinal'
): string {
  if (timelineType === 'relative') return '%'
  if (timelineType === 'absolute') return 'ms'
  return ''
}

/**
 * Helper function determining whether dynamic AOI is displayed in the current context.
 */
export function getDynamicAoiBoolean(
  timeline: 'ordinal' | 'absolute' | 'relative',
  dynamicAOIAllowed: boolean,
  dynamicAOIInData: boolean
): boolean {
  if (timeline === 'ordinal') return false
  if (!dynamicAOIAllowed) return false
  return dynamicAOIInData
}

/**
 * Computes the x-axis label.
 */
export function getXAxisLabel(
  timelineType: 'absolute' | 'relative' | 'ordinal'
): string {
  if (timelineType === 'ordinal') return 'Order index'
  return `Elapsed time [${getTimelineUnit(timelineType)}]`
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
