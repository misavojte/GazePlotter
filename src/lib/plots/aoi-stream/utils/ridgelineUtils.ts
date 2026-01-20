import {
  getParticipants,
  getParticipantEndTime,
} from '$lib/gaze-data/front-process/stores/dataStore'
import { SCARF_LAYOUT } from '$lib/plots/scarf/utils'
import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared/utils/plotSizeUtility'
import { calculateFlatLegendHeight, STREAM_LEGEND_CONFIG } from '$lib/plots/shared'
import { estimateTextWidth } from '$lib/shared/utils/textUtils'
import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid'
import { getAoiStreamPlotData } from '$lib/plots/aoi-stream/utils'
import type { AoiStreamPlotResult } from '$lib/plots/aoi-stream/types'
import type { AllGridTypes } from '$lib/workspace/type/gridType'

const MARGIN = {
  TOP: 20,
  RIGHT: SCARF_LAYOUT.RIGHT_MARGIN,
  BOTTOM: 55,
  LEFT: 50,
}

const HEADER_HEIGHT = 150
const HORIZONTAL_PADDING = 40
const CONTENT_PADDING = 5
const RIDGELINE_OVERLAP = 0.6

/**
 * Calculate the ideal strip height for a single ridgeline plot configuration.
 * Optimizes for "zero redundancy space" by finding the maximum possible strip height
 * that fits ALL series within the plot area without clipping.
 * 
 * Considers the specific geometry of each series based on its stack order and overlap.
 */
export function calculateIdealStripHeight(
  data: AoiStreamPlotResult,
  plotAreaHeight: number
): number {
  if (!data.series || data.series.length === 0) return plotAreaHeight

  const n = data.series.length
  const percentFactor = data.participants > 0 ? 100 / data.participants : 0
  
  // Calculate the "Standard" height (if all series were maxed out at 100%)
  // This serves as a baseline minimum usually, but we prioritize fitting the data.
  const standardDenom = n - (n - 1) * RIDGELINE_OVERLAP
  const standardHeight = plotAreaHeight / standardDenom

  let maxConstraintFactor = 0

  // Iterate over ALL series to find the binding constraint
  // We want to find s that maximizes: (VerticalOffset_s + PeakHeight_s) normalized by stripHeight
  // Constraint: stripHeight * factor <= plotAreaHeight
  // Therefore: stripHeight <= plotAreaHeight / max(factor)
  
  // Optimization: For small overlap (large k), limit to first few AOIs as they are geometrically higher
  // But calculating for all is cheap (N is small), so we just scan all for correctness.
  for (let s = 0; s < Math.min(data.series.length, 5); s++) { // Check first 5 is sufficiently safe optimization
    const series = data.series[s]
    const values = series.values
    const binCount = data.binCount
    
    // Find peak value for this series (0-100)
    let maxVal = 0
    for (let i = 0; i < binCount; i++) {
      const v = values[i] * percentFactor
      if (v > maxVal) maxVal = v
    }

    // Geometric factor:
    // (N - 1 - s) * (1 - OVERLAP)  -> Static vertical offset due to stacking
    // (maxVal * 0.9) / 100         -> Dynamic height of the data itself
    const geometricOffset = (n - 1 - s) * (1 - RIDGELINE_OVERLAP)
    const dataHeight = (maxVal * 0.9) / 100
    
    const totalFactor = geometricOffset + dataHeight
    
    if (totalFactor > maxConstraintFactor) {
      maxConstraintFactor = totalFactor
    }
  }

  if (maxConstraintFactor <= 1e-4) return standardHeight * 10 // Fallback if empty

  const idealHeight = plotAreaHeight / maxConstraintFactor

  // Cap at a reasonable max multiplier to prevent explosions on flat lines,
  // but allow it to be smaller than standardHeight if needed to prevent clipping.
  return Math.min(idealHeight, standardHeight * 10)
}

/**
 * Scan all active Time-binned AOI Occupancys with ridgeline alignment and the same height (h)
 * to find a synchronized strip height that works for all of them.
 *
 * Uses the ACTUAL stream data computation (via getAoiStreamPlotData) to ensure
 * perfect consistency with the rendered visualization.
 *
 * Synchronization is only applied between plots that have:
 * - Same grid height (h)
 * - Same alignment ('ridgeline')
 * - Same number of active AOIs (series count, accounting for grouping/visibility)
 *
 * Only considers the first AOI's peak for computational efficiency.
 *
 * @param items - Current grid items from the workspace
 * @param targetHeight - The grid height (h) to filter by
 * @param currentPlotId - The ID of the plot requesting the synchronized height
 * @returns The synchronized strip height, or null if no synchronization needed
 */
export function scanForDynamicStripHeight(
  items: AllGridTypes[],
  targetHeight: number,
  currentPlotId: number
): number | null {
  // Filter relevant plots by height and alignment
  const candidates = items.filter(
    item =>
      item.type === 'aoiStreamPlot' &&
      item.h === targetHeight &&
      (item as any).alignment === 'ridgeline'
  )

  if (candidates.length < 2) return null // No need to sync if only one or zero

  // Compute stream data for all candidates
  const candidateData: Array<{
    id: number
    streamData: AoiStreamPlotResult
    plotAreaHeight: number
    seriesCount: number
  }> = []

  for (const item of candidates) {
    const settings = item as any
    const stimulusId = settings.stimulusId
    const groupId = settings.groupId

    // Get the actual rendered dimensions
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

    // Calculate bin count
    const autoBinCount = Math.max(1, Math.floor(safeWidth / 5))

    // Calculate timeline limits
    let tMin = settings.absoluteStimuliLimits?.[stimulusId]?.[0] ?? 0
    let tMax = settings.absoluteStimuliLimits?.[stimulusId]?.[1] ?? 0

    if (tMax === 0) {
      const participants = getParticipants(groupId, stimulusId)
      tMax = participants.reduce(
        (max, p) => Math.max(max, getParticipantEndTime(stimulusId, p.id)),
        0
      )
    }

    // Get the ACTUAL stream data
    const streamData = getAoiStreamPlotData({
      stimulusId,
      groupId,
      binCount: autoBinCount,
      timelineMin: tMin,
      timelineMax: tMax,
    })

    // Calculate plot area height
    const seriesCount = streamData.series.length
    const plotAreaWidthBeforeLegend = Math.max(
      0,
      safeWidth - MARGIN.LEFT - MARGIN.RIGHT
    )

    // Calculate max text width to match component logic exactly
    let maxTextWidth = 0
    const { fontSize, fontFamily } = STREAM_LEGEND_CONFIG
    
    if (streamData.series.length > 0) {
      for (const series of streamData.series) {
        // Use the label from data
        const label = series.label || ''
        const w = estimateTextWidth(label, fontSize, fontFamily)
        if (w > maxTextWidth) maxTextWidth = w
      }
    }

    const legendHeight = calculateFlatLegendHeight(
      seriesCount,
      plotAreaWidthBeforeLegend,
      STREAM_LEGEND_CONFIG,
      maxTextWidth
    )

    const plotAreaHeight = Math.max(
      0,
      safeHeight - MARGIN.TOP - MARGIN.BOTTOM - legendHeight
    )

    candidateData.push({
      id: item.id,
      streamData,
      plotAreaHeight,
      seriesCount,
    })
  }

  // Find the current plot's series count
  const currentPlotData = candidateData.find(c => c.id === currentPlotId)
  if (!currentPlotData) return null

  const targetSeriesCount = currentPlotData.seriesCount

  // Filter to only candidates with same series count
  const matchingCandidates = candidateData.filter(
    c => c.seriesCount === targetSeriesCount
  )

  if (matchingCandidates.length < 2) return null // No need to sync if only one with this series count

  // Calculate synchronized height across matching candidates
  let globalMinHeight = Infinity

  for (const candidate of matchingCandidates) {
    const idealHeight = calculateIdealStripHeight(
      candidate.streamData,
      candidate.plotAreaHeight
    )

    if (idealHeight < globalMinHeight) {
      globalMinHeight = idealHeight
    }
  }

  if (globalMinHeight === Infinity) return null

  return globalMinHeight
}

