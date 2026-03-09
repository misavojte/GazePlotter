import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { getAoiRaw } from '$lib/data/engine/utils/interpreters'
import {
  createAdaptiveTimeline,
  type AdaptiveTimeline,
} from '$lib/plots/shared'
import type { BarPlotGridType } from '$lib/workspace/type/gridType'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import {
  formatDecimal,
  normalizeToPercentages,
} from '$lib/shared/utils/mathUtils'
import type { BarPlotResult, BarPlotDataItem } from '../types'
import { collectParticipantBarMetrics } from './collector'

/**
 * Main function to get bar plot data based on selected settings.
 * Now uses a single pass collector for all participants.
 */
export function getBarPlotData(
  engine: DataEngine,
  settings: Pick<
    BarPlotGridType,
    | 'stimulusId'
    | 'groupId'
    | 'aggregationMethod'
    | 'orderBy'
    | 'orderDirection'
    | 'scaleRange'
    | 'timelineStart'
    | 'timelineEnd'
  >
): BarPlotResult {
  const meta = engine.metadata
  if (!meta) throw new Error('No metadata found')

  const aois = getVisibleAois(engine, settings.stimulusId)
  const participantIds = getParticipantIdsForGroup(
    engine,
    settings.groupId,
    settings.stimulusId
  )
  const aggregationMethod = settings.aggregationMethod || 'absoluteTime'

  if (participantIds.length === 0) {
    return { data: [], timeline: createAdaptiveTimeline(0, 100, 6) }
  }

  // Single pass collection of all metrics for all participants
  const participantMetrics = collectParticipantBarMetrics(
    engine,
    settings.stimulusId,
    participantIds,
    aois,
    settings.timelineStart ?? 0,
    settings.timelineEnd ?? 0
  )

  // Aggregate participant metrics into final bar values
  const rawData = aggregateMetrics(
    participantMetrics,
    aggregationMethod,
    aois.length
  )

  // Create labeled data with AOI information
  const labeledData = createLabeledData(
    rawData,
    aois,
    meta.noAoiTreatment,
    aggregationMethod
  )

  // Apply sorting if needed
  const sortedData = applySorting(
    labeledData,
    settings.orderBy || 'aoi',
    settings.orderDirection || 'asc'
  )

  // Create timeline with appropriate scale
  const timeline = createTimeline(rawData, settings.scaleRange)

  return {
    data: sortedData,
    timeline,
  }
}

function getParticipantOrderVector(engine: DataEngine): number[] {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  const order = meta.participants.orderVector
  if (order.length === 0) {
    return Array.from({ length: meta.participants.data.length }, (_, i) => i)
  }
  return order
}

function getParticipantIdsForGroup(
  engine: DataEngine,
  groupId = -1,
  stimulusId = 0
): number[] {
  const meta = engine.metadata
  const reader = engine.getReader()
  if (!meta || !reader) throw new Error('Data engine metadata not available')

  const participantOrder = getParticipantOrderVector(engine)
  if (groupId === -1) return participantOrder

  if (groupId === -2) {
    return participantOrder.filter(
      participantId => reader.getSegmentCount(stimulusId, participantId) > 0
    )
  }

  const group = meta.participantsGroups.find(candidate => candidate.id === groupId)
  if (!group) throw new Error(`Participants group with id ${groupId} does not exist`)
  return group.participantsIds
}

function getVisibleAois(
  engine: DataEngine,
  stimulusId: number
): ExtendedInterpretedDataType[] {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const stimulusAois = meta.aois.data[stimulusId]
  if (!stimulusAois) throw new Error(`AOI data for stimulus ${stimulusId} not found`)

  const order = meta.aois.orderVector?.[stimulusId]
  const ids =
    order == null
      ? Array.from({ length: stimulusAois.length }, (_, i) => i)
      : order

  const hidden = meta.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null
  const uniqueMappedIds = new Set<number>()

  for (let i = 0; i < ids.length; i++) {
    const rawId = ids[i]
    if (hiddenSet?.has(rawId)) continue
    uniqueMappedIds.add(engine.getAoiMapping(stimulusId, rawId))
  }

  const aois: ExtendedInterpretedDataType[] = []
  for (const aoiId of uniqueMappedIds) {
    aois.push(getAoiRaw(stimulusId, aoiId, meta))
  }

  return aois
}

/**
 * Aggregates individual participant metrics into the final bar values.
 * Optimized for performance: avoids intermediate arrays and closures in hot loops.
 */
export function aggregateMetrics(
  metrics: ReturnType<typeof collectParticipantBarMetrics>,
  method: string,
  aoiCount: number
): number[] {
  const totalSlots = aoiCount + 1 // We only show up to No-AOI (exclude AnyFixation for now unless needed)
  const result = new Array(totalSlots).fill(0)
  const participantCount = metrics.length

  if (participantCount === 0) return result

  switch (method) {
    case 'absoluteTime':
    case 'relativeTime': {
      for (let p = 0; p < participantCount; p++) {
        const dwell = metrics[p].dwellTime
        for (let i = 0; i < totalSlots; i++) {
          result[i] += dwell[i]
        }
      }
      return method === 'relativeTime' ? normalizeToPercentages(result) : result
    }

    case 'timeToFirstFixation': {
      for (let i = 0; i < totalSlots; i++) {
        let sum = 0
        let count = 0
        for (let p = 0; p < participantCount; p++) {
          const val = metrics[p].ttff[i]
          if (val !== -1) {
            sum += val
            count++
          }
        }
        result[i] = count > 0 ? sum / count : 0
      }
      return result
    }

    case 'avgFixationDuration': {
      for (let i = 0; i < totalSlots; i++) {
        let sum = 0
        let count = 0
        for (let p = 0; p < participantCount; p++) {
          const durations = metrics[p].avgFixationDuration[i]
          for (let d = 0; d < durations.length; d++) {
            sum += durations[d]
            count++
          }
        }
        result[i] = count > 0 ? sum / count : 0
      }
      return result
    }

    case 'avgFirstFixationDuration': {
      for (let i = 0; i < totalSlots; i++) {
        let sum = 0
        let count = 0
        for (let p = 0; p < participantCount; p++) {
          const val = metrics[p].firstFixationDuration[i]
          if (val !== -1) {
            sum += val
            count++
          }
        }
        result[i] = count > 0 ? sum / count : 0
      }
      return result
    }

    case 'averageFixationCount': {
      for (let i = 0; i < totalSlots; i++) {
        let sum = 0
        for (let p = 0; p < participantCount; p++) {
          sum += metrics[p].fixationCount[i]
        }
        result[i] = sum / participantCount
      }
      return result
    }

    case 'hitRatio': {
      for (let i = 0; i < totalSlots; i++) {
        let seenCount = 0
        for (let p = 0; p < participantCount; p++) {
          seenCount += metrics[p].hitRatio[i]
        }
        result[i] = (seenCount / participantCount) * 100
      }
      return result
    }

    case 'averageEntries': {
      for (let i = 0; i < totalSlots; i++) {
        let sum = 0
        for (let p = 0; p < participantCount; p++) {
          sum += metrics[p].entryCount[i]
        }
        result[i] = sum / participantCount
      }
      return result
    }

    case 'avgDwellDuration': {
      for (let i = 0; i < totalSlots; i++) {
        let sum = 0
        let count = 0
        for (let p = 0; p < participantCount; p++) {
          const durations = metrics[p].dwellDurations[i]
          for (let d = 0; d < durations.length; d++) {
            sum += durations[d]
            count++
          }
        }
        result[i] = count > 0 ? sum / count : 0
      }
      return result
    }

    default:
      return result
  }
}

/**
 * Creates labeled data items from raw numeric values
 */
function createLabeledData(
  rawData: number[],
  aois: ExtendedInterpretedDataType[],
  noAoiTreatment: { displayedName: string; color: string },
  aggregationMethod: string
): BarPlotDataItem[] {
  const result: BarPlotDataItem[] = new Array(rawData.length)

  for (let i = 0; i < rawData.length; i++) {
    const value = rawData[i]
    const isNoAoi = i === aois.length
    const label = isNoAoi ? noAoiTreatment.displayedName : aois[i].displayedName
    const color = isNoAoi ? noAoiTreatment.color : aois[i].color

    // Special case for TTFF where 0 might mean "never looked" in some contexts,
    // though the collector uses -1 for that. Here we stick to clean labels.
    if (aggregationMethod === 'timeToFirstFixation' && value === 0) {
      result[i] = { value: 0, label, color }
    } else {
      result[i] = { value: formatDecimal(value), label, color }
    }
  }

  return result
}

/**
 * Applies sorting to labeled data based on user selection
 */
function applySorting(
  data: BarPlotDataItem[],
  orderBy: 'value' | 'aoi',
  orderDirection: 'asc' | 'desc'
): BarPlotDataItem[] {
  const sorted = [...data]

  if (orderBy === 'aoi') {
    return orderDirection === 'asc' ? data : sorted.reverse()
  }

  return sorted.sort((a, b) =>
    orderDirection === 'asc' ? a.value - b.value : b.value - a.value
  )
}

/**
 * Creates a timeline with appropriate scale based on data and user settings
 */
function createTimeline(
  rawData: number[],
  scaleRange?: [number, number]
): AdaptiveTimeline {
  let maxValue = 0
  let hasData = false

  for (let i = 0; i < rawData.length; i++) {
    const val = rawData[i]
    if (!isNaN(val)) {
      if (val > maxValue) {
        maxValue = val
      }
      hasData = true
    }
  }

  // Handle empty or invalid data
  if (!hasData) {
    return createAdaptiveTimeline(0, 100, 6)
  }

  let min = 0
  let max = maxValue

  const hasCustomScale =
    scaleRange && (scaleRange[0] !== 0 || scaleRange[1] !== 0)

  if (scaleRange) {
    if (scaleRange[0] !== 0) min = scaleRange[0]
    if (scaleRange[1] !== 0) max = scaleRange[1]
  }

  // Ensure min < max
  if (max <= min) {
    max = min + 1
  }

  // If we are in "Auto" mode (no custom scale range), use nice max rounding
  // so bars have some breathing room.
  return createAdaptiveTimeline(min, max, 6, !hasCustomScale)
}
