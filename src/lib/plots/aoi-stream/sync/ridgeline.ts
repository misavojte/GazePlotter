import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getParticipants, getParticipantEndTime } from '$lib/data/engine'
import { getAoiStreamPlotData } from '../core/transformer'
import { computeMTop } from '../core/ridgeline'
import { scanForSynchronizedTimelineMax } from './timeline'
import type {
  AoiStreamPlotItem,
  AoiStreamPlotResult,
  AoiStreamPlotSettings,
} from '../types'
import type { AllGridTypes } from '$lib/workspace'
import { RIDGELINE_SCALE } from '../const'

type CurrentPlotContext = {
  plotId: number
  widthUnits: number
  heightUnits: number
  settings: AoiStreamPlotSettings
  streamData: AoiStreamPlotResult
}

/**
 * Scan all active ridgeline plots with matching height and scale to find
 * the most constraining mTop factor for synchronized data scale.
 *
 * mTop is dimension-independent (derived purely from data), so applying it
 * in each plot's local `calculateIdealStripHeight(data, floorHeight, ..., mTop)`
 * produces a strip height that:
 *  - fills the actual available space (no whitespace from estimation mismatch)
 *  - uses the same data scale across comparable plots
 *
 * @returns The max mTop across candidates, or null if fewer than 2 qualify
 */
export function scanForDynamicRidgelineReferenceHeight(
  engine: DataEngine,
  items: AllGridTypes[],
  targetHeight: number,
  currentPlotId: number,
  currentContext: CurrentPlotContext
): number | null {
  // Ensure reactivity for Svelte 5 when called from $derived
  const _ = engine.metadata

  const targetScale = currentContext.settings.ridgelineScale ?? RIDGELINE_SCALE

  const aoiStreamItems = items.filter(
    (item): item is AoiStreamPlotItem => item.type === 'aoiStreamPlot'
  )

  const candidates = aoiStreamItems.filter(item => {
    const itemScale = item.settings.ridgelineScale ?? RIDGELINE_SCALE
    return (
      item.h === targetHeight &&
      item.settings.alignment === 'ridgeline' &&
      Math.abs(itemScale - targetScale) < 1e-4
    )
  })

  if (candidates.length < 2) return null

  const candidateInfo: Array<{
    id: number
    seriesCount: number
    mTop: number
  }> = []

  for (const item of candidates) {
    const s = item.settings

    let streamData: AoiStreamPlotResult

    if (item.id === currentPlotId) {
      streamData = currentContext.streamData
    } else {
      const { stimulusId, groupId } = s

      let tMin = s.absoluteStimuliLimits?.[stimulusId]?.[0] ?? 0
      let tMax = s.absoluteStimuliLimits?.[stimulusId]?.[1] ?? 0

      if (tMax === 0) {
        const syncedMax = scanForSynchronizedTimelineMax(
          engine,
          items,
          item.w,
          stimulusId,
          s.absoluteStimuliLimits
        )

        if (syncedMax !== null) {
          tMax = syncedMax
        } else {
          const participants = getParticipants(engine, groupId, stimulusId)
          tMax = participants.reduce(
            (max, p) =>
              Math.max(max, getParticipantEndTime(engine, stimulusId, p.id)),
            0
          )
        }
      }

      const { data } = getAoiStreamPlotData(
        engine,
        {
          stimulusId,
          groupId,
          binSize: s.binSize ?? 500,
          timelineMin: tMin,
          timelineMax: tMax,
        },
        null
      )

      streamData = data
    }

    candidateInfo.push({
      id: item.id,
      seriesCount: streamData.series.length,
      mTop: computeMTop(streamData, true),
    })
  }

  const currentInfo = candidateInfo.find(c => c.id === currentPlotId)
  if (!currentInfo) return null

  // Only sync plots with the same number of series
  const matching = candidateInfo.filter(
    c => c.seriesCount === currentInfo.seriesCount
  )

  if (matching.length < 2) return null

  // Return the max mTop — the most constraining factor
  return Math.max(...matching.map(c => c.mTop))
}
