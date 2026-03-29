import {
  getAois,
  getParticipantsIds,
  getParticipantEndTime,
  getHiddenAois,
  getAoiOrderVector,
} from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
import type { AoiStreamPlotResult, AoiStreamPlotSeries } from '../types'
import type { AoiStreamPlotSettings } from '../types'
import { collectAoiStreamMetrics, type CollectorWorkspace } from './collector'
import { COLOR_FALLBACKS } from '$lib/color'

export function getAoiStreamPlotData(
  engine: DataEngine,
  settings: Pick<
    AoiStreamPlotSettings,
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
  const rawAois = getAois(engine, stimulusId)
  const orderVector = getAoiOrderVector(engine, stimulusId)

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
  const participantIds = getParticipantsIds(engine, groupId, stimulusId)
  const numParticipants = participantIds.length

  let maxTime = 0
  for (let i = 0; i < numParticipants; i++) {
    const time = getParticipantEndTime(engine, stimulusId, participantIds[i])
    if (time > maxTime) maxTime = time
  }

  const timelineMin = settings.timelineMin ?? 0
  const timelineMax = settings.timelineMax ?? maxTime
  const safeMaxTime = Math.max(1, timelineMax - timelineMin)

  const binSize = requestedBinSize ?? 500
  const binCount = Math.max(1, Math.ceil(safeMaxTime / binSize))
  const collectionMaxTime = binCount * binSize

  // 3. Collection
  const hidden = getHiddenAois(engine, stimulusId)
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null

  const { metrics, workspace } = collectAoiStreamMetrics(
    engine,
    stimulusId,
    participantIds,
    orderedAois,
    hiddenSet,
    binCount,
    timelineMin,
    collectionMaxTime,
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
        color: aoi?.color || COLOR_FALLBACKS.BLACK,
        values: m.values,
      }
    }
  }

  const data: AoiStreamPlotResult = {
    series: resultSeries,
    timeline: createAdaptiveTimeline(
      timelineMin,
      timelineMin + collectionMaxTime,
      6
    ),
    binCount,
    binSize,
    maxTime: timelineMin + collectionMaxTime,
    participants: numParticipants,
    maxTotal: metrics.maxTotal,
  }

  return { data, workspace }
}
