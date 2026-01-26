import {
  getAois,
  getParticipantsIds,
  getParticipantEndTime,
  getHiddenAois,
  getAoiOrderVector,
  engine,
} from '$lib/data/engine'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import type { AoiStreamPlotResult, AoiStreamPlotSeries } from '../types'
import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'
import { DEFAULT_BIN_COUNT } from '../const'
import { collectAoiStreamMetrics } from './collector'

export function getAoiStreamPlotData(
  settings: Pick<
    AoiStreamPlotGridType,
    'stimulusId' | 'groupId' | 'binCount'
  > & {
    timelineMin?: number
    timelineMax?: number
  }
): AoiStreamPlotResult {
  const stimulusId = settings.stimulusId
  const groupId = settings.groupId
  const meta = engine.metadata

  if (!meta) {
    throw new Error('Data engine not initialized')
  }

  // Prepare AOI data (ordered and filtered for existence)
  const aois = getAois(stimulusId)
  const orderVector = getAoiOrderVector(stimulusId)
  const aoiById = new Map(aois.map(aoi => [aoi.id, aoi]))
  const orderedAois = orderVector
    .map(id => aoiById.get(id))
    .filter((aoi): aoi is (typeof aois)[number] => Boolean(aoi))

  // Prepare participants
  const participantIds = getParticipantsIds(groupId, stimulusId)

  // Calculate timeline boundaries
  const maxTime = participantIds.reduce(
    (max, participantId) =>
      Math.max(max, getParticipantEndTime(stimulusId, participantId)),
    0
  )

  const timelineMin = settings.timelineMin ?? 0
  const timelineMax = settings.timelineMax ?? maxTime
  const safeMaxTime = Math.max(1, timelineMax - timelineMin)
  const binCount = Math.max(1, settings.binCount ?? DEFAULT_BIN_COUNT)
  const binSize = safeMaxTime / binCount

  // Prepare hidden AOIs
  const hidden = getHiddenAois(stimulusId)
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null

  // No-AOI treatment handling
  const noAoiTreatment = meta.noAoiTreatment

  // Execute collection
  const metrics = collectAoiStreamMetrics(
    stimulusId,
    participantIds,
    orderedAois,
    hiddenSet,
    binCount,
    timelineMin,
    timelineMax,
    safeMaxTime
  )

  // Transform metrics into plot series with metadata
  const series: AoiStreamPlotSeries[] = metrics.series.map(metricSeries => {
    // ID -1 is No-AOI
    if (metricSeries.id === -1) {
      return {
        id: -1,
        label: noAoiTreatment.displayedName,
        color: noAoiTreatment.color,
        values: metricSeries.values,
      }
    }

    // Matched AOI
    const aoi = aoiById.get(metricSeries.id)
    // Fallback if AOI missing (shouldn't happen since we used orderedAois)
    const label = aoi?.displayedName || aoi?.originalName || 'Unknown'
    const color = aoi?.color || '#000000'

    return {
      id: metricSeries.id,
      label,
      color,
      values: metricSeries.values,
    }
  })

  return {
    series,
    timeline: createAdaptiveTimeline(timelineMin, timelineMin + safeMaxTime, 6),
    binCount,
    binSize,
    maxTime: timelineMin + safeMaxTime,
    participants: participantIds.length,
    maxTotal: metrics.maxTotal,
  }
}
