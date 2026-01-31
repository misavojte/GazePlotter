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
import { collectAoiStreamMetrics, type CollectorWorkspace } from './collector'

export function getAoiStreamPlotData(
  settings: Pick<
    AoiStreamPlotGridType,
    'stimulusId' | 'groupId' | 'binSize'
  > & {
    timelineMin?: number
    timelineMax?: number
  },
  existingWorkspace: CollectorWorkspace | null
): { data: AoiStreamPlotResult; workspace: CollectorWorkspace } {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine not initialized')

  const { stimulusId, groupId, binSize: requestedBinSize } = settings

  // 1. Prepare filtering/ordering data
  const rawAois = getAois(stimulusId)
  const orderVector = getAoiOrderVector(stimulusId)

  // Use a simple array for ordered selection to avoid intermediate Map if possible
  // But we need to look up AOI details later. A local Map is fine if built once.
  const aoiMap = new Map<number, (typeof rawAois)[number]>()
  for (let i = 0; i < rawAois.length; i++) {
    aoiMap.set(rawAois[i].id, rawAois[i])
  }

  const orderedAois: (typeof rawAois)[number][] = []
  for (let i = 0; i < orderVector.length; i++) {
    const aoi = aoiMap.get(orderVector[i])
    if (aoi) orderedAois.push(aoi)
  }

  // 2. Timeline and binning
  const participantIds = getParticipantsIds(groupId, stimulusId)
  const numParticipants = participantIds.length

  let maxTime = 0
  for (let i = 0; i < numParticipants; i++) {
    const time = getParticipantEndTime(stimulusId, participantIds[i])
    if (time > maxTime) maxTime = time
  }

  const timelineMin = settings.timelineMin ?? 0
  const timelineMax = settings.timelineMax ?? maxTime
  const safeMaxTime = Math.max(1, timelineMax - timelineMin)

  const binSize = requestedBinSize ?? 500
  const binCount = Math.max(1, Math.floor(safeMaxTime / binSize))

  // 3. Collection
  const hidden = getHiddenAois(stimulusId)
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null

  const { metrics, workspace } = collectAoiStreamMetrics(
    stimulusId,
    participantIds,
    orderedAois,
    hiddenSet,
    binCount,
    timelineMin,
    safeMaxTime,
    existingWorkspace
  )

  // 4. Final transformation (Metadata attachment)
  const { noAoiTreatment } = meta
  const resultSeries: AoiStreamPlotSeries[] = new Array(metrics.series.length)

  for (let i = 0; i < metrics.series.length; i++) {
    const m = metrics.series[i]
    if (m.id === -1) {
      resultSeries[i] = {
        id: -1,
        label: noAoiTreatment.displayedName,
        color: noAoiTreatment.color,
        values: m.values,
      }
    } else {
      const aoi = aoiMap.get(m.id)
      resultSeries[i] = {
        id: m.id,
        label: aoi?.displayedName || aoi?.originalName || 'Unknown',
        color: aoi?.color || '#000000',
        values: m.values,
      }
    }
  }

  const data: AoiStreamPlotResult = {
    series: resultSeries,
    timeline: createAdaptiveTimeline(timelineMin, timelineMin + safeMaxTime, 6),
    binCount,
    binSize,
    maxTime: timelineMin + safeMaxTime,
    participants: numParticipants,
    maxTotal: metrics.maxTotal,
  }

  return { data, workspace }
}
