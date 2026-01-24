import {
  getParticipants,
  getParticipantEndTime,
} from '$lib/gaze-data/front-process/stores/dataStore.svelte'
import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared/plotSizeUtility'
import {
  calculateFlatLegendHeight,
  STREAM_LEGEND_CONFIG,
} from '$lib/plots/shared/legendRendering'
import { estimateTextWidth } from '$lib/shared/utils/textUtils'
import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid'
import { getAoiStreamPlotData } from '../core/transformer'
import { scanForSynchronizedTimelineMax } from './timeline'
import { engine } from '$lib/gaze-data/front-process/stores/dataStore.svelte'
import type { AoiStreamPlotResult } from '../types'
import type { AllGridTypes } from '$lib/workspace/type/gridType'
import { calculateIdealStripHeight } from '../core/ridgeline'

import { MARGIN, HEADER_HEIGHT } from '../const'

/**
 * Scan all active Time-binned AOI Occupancys with ridgeline alignment and the same height (h)
 * to find a synchronized strip height that works for all of them.
 *
 * Synchronization is only applied between plots that have:
 * - Same grid height (h)
 * - Same alignment ('ridgeline')
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
  const candidates = items.filter(
    item =>
      item.type === 'aoiStreamPlot' &&
      item.h === targetHeight &&
      (item as any).alignment === 'ridgeline'
  )

  if (candidates.length < 2) return null

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

    const dims = calculatePlotDimensionsWithHeader(
      settings.w,
      settings.h,
      DEFAULT_GRID_CONFIG,
      HEADER_HEIGHT
    )

    const safeWidth = Math.max(1, dims.width)
    const safeHeight = Math.max(1, dims.height)
    const autoBinCount = Math.max(1, Math.floor(safeWidth / 5))

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

    const streamData = getAoiStreamPlotData({
      stimulusId,
      groupId,
      binCount: autoBinCount,
      timelineMin: tMin,
      timelineMax: tMax,
    })

    const seriesCount = streamData.series.length
    const plotAreaWidthBeforeLegend = Math.max(
      0,
      safeWidth - MARGIN.LEFT - MARGIN.RIGHT
    )

    let maxTextWidth = 0
    const { fontSize, fontFamily } = STREAM_LEGEND_CONFIG

    if (streamData.series.length > 0) {
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
      Math.max(0, safeHeight - MARGIN.TOP - MARGIN.BOTTOM - legendHeight)
    )

    candidateData.push({
      id: item.id,
      streamData,
      plotAreaHeight,
      seriesCount,
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
    return calculateIdealStripHeight(c.streamData, c.plotAreaHeight, true)
  })

  return Math.min(...idealHeights)
}
