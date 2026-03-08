import { getParticipants, getParticipantEndTime } from '$lib/data/engine'
import {
  calculatePlotDimensionsWithHeader,
  PLOT_HEADER_HEIGHT,
} from '$lib/plots/shared'
import {
  calculateFlatLegendHeight,
  STREAM_LEGEND_CONFIG,
} from '$lib/plots/shared/legendRendering'
import { estimateTextWidth } from '$lib/shared/utils/textUtils'
import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid'
import { getAoiStreamPlotData } from '../core/transformer'
import { scanForSynchronizedTimelineMax } from './timeline'
import { engine } from '$lib/data/engine'
import type { AoiStreamPlotResult } from '../types'
import type { AllGridTypes } from '$lib/workspace/type/gridType'
import { calculateIdealStripHeight } from '../core/ridgeline'

import { MARGIN, RIDGELINE_SCALE } from '../const'

/**
 * Scan all active Time-binned AOI Occupancys with ridgeline alignment and the same height (h)
 * to find a synchronized strip height that works for all of them.
 *
 * Synchronization is only applied between plots that have:
 * - Same grid height (h)
 * - Same alignment ('ridgeline')
 * - Same ridgeline scale (scale)
 * - Same number of active AOIs
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
  // Ensure reactivity for Svelte 5 when called from $derived
  const _ = engine.metadata

  // Filter relevant plots by height and alignment
  const targetPlot = items.find(i => i.id === currentPlotId) as any
  const targetScale = targetPlot?.ridgelineScale ?? RIDGELINE_SCALE

  const candidates = items.filter(item => {
    const settings = item as any
    const itemScale = settings.ridgelineScale ?? RIDGELINE_SCALE
    return (
      item.type === 'aoiStreamPlot' &&
      item.h === targetHeight &&
      settings.alignment === 'ridgeline' &&
      Math.abs(itemScale - targetScale) < 1e-4
    )
  })

  if (candidates.length < 2) return null

  // Compute stream data for all candidates
  const candidateData: Array<{
    id: number
    streamData: AoiStreamPlotResult
    plotAreaHeight: number
    seriesCount: number
    ridgelineScale: number
  }> = []

  // Common values for all candidates with same height
  const sharedSafeHeight =
    targetHeight * DEFAULT_GRID_CONFIG.cellSize.height -
    DEFAULT_GRID_CONFIG.gap * 2 -
    PLOT_HEADER_HEIGHT

  for (const item of candidates) {
    const settings = item as any
    const stimulusId = settings.stimulusId
    const groupId = settings.groupId
    const itemScale = settings.ridgelineScale ?? RIDGELINE_SCALE

    // Width-based dimensions (needed for legend)
    const safeWidth =
      settings.w * DEFAULT_GRID_CONFIG.cellSize.width -
      DEFAULT_GRID_CONFIG.gap * 2

    let tMin = settings.absoluteStimuliLimits?.[stimulusId]?.[0] ?? 0
    let tMax = settings.absoluteStimuliLimits?.[stimulusId]?.[1] ?? 0

    if (tMax === 0) {
      const syncedMax = scanForSynchronizedTimelineMax(
        items,
        settings.w,
        stimulusId,
        settings.absoluteStimuliLimits
      )

      if (syncedMax !== null) {
        tMax = syncedMax
      } else {
        const participants = getParticipants(groupId, stimulusId)
        tMax = participants.reduce(
          (max, p) => Math.max(max, getParticipantEndTime(stimulusId, p.id)),
          0
        )
      }
    }

    const { data: streamData } = getAoiStreamPlotData(
      {
        stimulusId,
        groupId,
        binSize: settings.binSize ?? 500,
        timelineMin: tMin,
        timelineMax: tMax,
      },
      null
    )

    const seriesCount = streamData.series.length
    const { fontSize, fontFamily } = STREAM_LEGEND_CONFIG

    let maxTextWidth = 0
    if (seriesCount > 0) {
      for (const series of streamData.series) {
        const label = series.label || ''
        const w = estimateTextWidth(label, fontSize, fontFamily)
        if (w > maxTextWidth) maxTextWidth = w
      }
    }

    const legendHeight = calculateFlatLegendHeight(
      seriesCount,
      safeWidth,
      STREAM_LEGEND_CONFIG,
      maxTextWidth
    )

    const plotAreaHeight = Math.floor(
      Math.max(0, sharedSafeHeight - MARGIN.TOP - MARGIN.BOTTOM - legendHeight)
    )

    candidateData.push({
      id: item.id,
      streamData,
      plotAreaHeight,
      seriesCount,
      ridgelineScale: itemScale,
    })
  }

  const currentPlotData = candidateData.find(c => c.id === currentPlotId)
  if (!currentPlotData) return null

  const targetSeriesCount = currentPlotData.seriesCount
  const matchingCandidates = candidateData.filter(
    c => c.seriesCount === targetSeriesCount
  )

  if (matchingCandidates.length < 2) return null

  const idealHeights = matchingCandidates.map(c => {
    return calculateIdealStripHeight(
      c.streamData,
      c.plotAreaHeight,
      true,
      c.ridgelineScale
    )
  })

  return Math.min(...idealHeights)
}
