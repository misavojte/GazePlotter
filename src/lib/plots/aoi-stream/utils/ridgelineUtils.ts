import {
  getAois,
  getAoiOrderVector,
  getParticipants,
  getParticipantEndTime,
} from '$lib/gaze-data/front-process/stores/dataStore'
import { SCARF_LAYOUT, getItemsPerRow } from '$lib/plots/scarf/utils'
import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared/utils/plotSizeUtility'
import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid'
import { getAoiStreamPlotData } from '$lib/plots/aoi-stream/utils'
import type { AoiStreamPlotResult } from '$lib/plots/aoi-stream/types'

const MARGIN = {
  TOP: 20,
  RIGHT: SCARF_LAYOUT.RIGHT_MARGIN,
  BOTTOM: 55,
  LEFT: 50,
}

const LEGEND = {
  ITEM_HEIGHT: SCARF_LAYOUT.LEGEND_ITEM_HEIGHT,
  ICON_SIZE: SCARF_LAYOUT.LEGEND_ICON_WIDTH,
  TEXT_PADDING: SCARF_LAYOUT.LEGEND_TEXT_PADDING,
  ITEM_SPACING: SCARF_LAYOUT.LEGEND_ITEM_SPACING,
  ROW_PADDING: SCARF_LAYOUT.LEGEND_ITEM_PADDING,
  TOP_PADDING: SCARF_LAYOUT.LEGEND_GROUP_TITLE_SPACING,
}

const HEADER_HEIGHT = 150
const HORIZONTAL_PADDING = 40
const CONTENT_PADDING = 5
const RIDGELINE_OVERLAP = 0.6

/**
 * Extract the peak value (max across all bins) for the first series from stream data.
 * The first series corresponds to the first AOI in the order vector.
 */
function getFirstSeriesPeak(data: AoiStreamPlotResult): number {
  if (data.series.length === 0) return 0

  const firstSeries = data.series[0]
  const values = firstSeries.values
  const binCount = data.binCount
  const percentFactor = data.participants > 0 ? 100 / data.participants : 0

  let maxVal = 0
  for (let i = 0; i < binCount; i++) {
    const v = values[i] * percentFactor
    if (v > maxVal) maxVal = v
  }

  return maxVal
}

/**
 * Calculate the ideal strip height for a single ridgeline plot configuration.
 * This uses only the first AOI's peak for efficiency (as requested).
 * Returns the clamped strip height that fits the data without clipping.
 */
function calculateIdealStripHeight(
  data: AoiStreamPlotResult,
  plotAreaHeight: number
): number {
  const n = Math.max(1, data.series.length)
  const standardDenom = n - (n - 1) * RIDGELINE_OVERLAP
  const standardHeight = plotAreaHeight / standardDenom

  // Get peak from first series only (for efficiency)
  const maxVal = getFirstSeriesPeak(data)

  // Calculate constraint (same formula as component)
  // First series (s=0) has relativePosition = (n - 1 - 0) * (1 - OVERLAP) = (n-1) * (1 - OVERLAP)
  const relativePosition = (n - 1) * (1 - RIDGELINE_OVERLAP)
  const dataFactor = (maxVal * 0.9) / 100
  const totalFactor = relativePosition + dataFactor

  let minAllowableS = Infinity

  if (totalFactor > 1e-4) {
    minAllowableS = plotAreaHeight / totalFactor
  }

  // Apply clamping (same as component)
  if (minAllowableS === Infinity) {
    return standardHeight
  } else {
    let stripHeight = Math.min(minAllowableS, standardHeight * 10)
    stripHeight = Math.max(stripHeight, standardHeight)
    return stripHeight
  }
}

/**
 * Scan all active AOI stream plots with ridgeline alignment and the same height (h)
 * to find a synchronized strip height that works for all of them.
 *
 * Uses the ACTUAL stream data computation (via getAoiStreamPlotData) to ensure
 * perfect consistency with the rendered visualization.
 *
 * Only considers the first AOI's peak for computational efficiency.
 *
 * @param items - Current grid items from the workspace
 * @param targetHeight - The grid height (h) to filter by
 * @returns The synchronized strip height, or null if no synchronization needed
 */
export function scanForDynamicStripHeight(
  items: import('$lib/workspace/type/gridType').AllGridTypes[],
  targetHeight: number
): number | null {
  // Filter relevant plots
  const candidates = items.filter(
    item =>
      item.type === 'aoiStreamPlot' &&
      item.h === targetHeight &&
      (item as any).alignment === 'ridgeline'
  )

  if (candidates.length < 2) return null // No need to sync if only one or zero

  let globalMinHeight = Infinity

  for (const item of candidates) {
    const settings = item as any
    const stimulusId = settings.stimulusId
    const groupId = settings.groupId

    // Get the actual rendered dimensions (same as component)
    const dims = calculatePlotDimensionsWithHeader(
      settings.w,
      settings.h,
      DEFAULT_GRID_CONFIG,
      HEADER_HEIGHT,
      HORIZONTAL_PADDING,
      CONTENT_PADDING
    )

    const safeWidth = Math.max(1, dims.width)
    const safeHeight = Math.max(1, dims.height)

    // Calculate bin count (same as component)
    const autoBinCount = Math.max(1, Math.floor(safeWidth / 5))

    // Calculate timeline limits (same as component)
    let tMin = settings.absoluteStimuliLimits?.[stimulusId]?.[0] ?? 0
    let tMax = settings.absoluteStimuliLimits?.[stimulusId]?.[1] ?? 0

    if (tMax === 0) {
      const participants = getParticipants(groupId, stimulusId)
      tMax = participants.reduce(
        (max, p) => Math.max(max, getParticipantEndTime(stimulusId, p.id)),
        0
      )
    }

    // Get the ACTUAL stream data (same computation as the component uses)
    const streamData = getAoiStreamPlotData({
      stimulusId,
      groupId,
      binCount: autoBinCount,
      timelineMin: tMin,
      timelineMax: tMax,
    })

    // Calculate plot area height (same as component figure)
    const seriesCount = streamData.series.length
    const plotAreaWidthBeforeLegend = Math.max(
      0,
      safeWidth - MARGIN.LEFT - MARGIN.RIGHT
    )

    const legendItemsPerRow = Math.max(
      1,
      getItemsPerRow({
        chartWidth: plotAreaWidthBeforeLegend,
        leftLabelWidth: 0,
        padding: 0,
        iconWidth: LEGEND.ICON_SIZE,
        textPadding: LEGEND.TEXT_PADDING,
        itemSpacing: LEGEND.ITEM_SPACING,
        avgTextWidth: 90,
      })
    )

    const legendRows =
      seriesCount > 0 ? Math.ceil(seriesCount / legendItemsPerRow) : 0
    const legendHeight =
      legendRows === 0
        ? 0
        : legendRows * (LEGEND.ITEM_HEIGHT + LEGEND.ROW_PADDING) +
          LEGEND.TOP_PADDING

    const plotAreaHeight = Math.max(
      0,
      safeHeight - MARGIN.TOP - MARGIN.BOTTOM - legendHeight
    )

    // Calculate the ideal strip height for this plot
    const idealHeight = calculateIdealStripHeight(streamData, plotAreaHeight)

    if (idealHeight < globalMinHeight) {
      globalMinHeight = idealHeight
    }
  }

  if (globalMinHeight === Infinity) return null

  return globalMinHeight
}
