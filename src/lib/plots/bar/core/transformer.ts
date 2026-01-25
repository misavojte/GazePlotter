import {
  getAois,
  getParticipantsIds,
  getData,
} from '$lib/gaze-data/front-process'
import {
  createAdaptiveTimeline,
  type AdaptiveTimeline,
} from '$lib/plots/shared'
import type { BarPlotGridType } from '$lib/workspace/type/gridType'
import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'
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
  settings: Pick<
    BarPlotGridType,
    'stimulusId' | 'groupId' | 'aggregationMethod' | 'sortBars' | 'scaleRange'
  >
): BarPlotResult {
  const data = getData()
  const aois = getAois(settings.stimulusId)
  const participantIds = getParticipantsIds(
    settings.groupId,
    settings.stimulusId
  )
  const aggregationMethod = settings.aggregationMethod || 'absoluteTime'

  if (participantIds.length === 0) {
    return { data: [], timeline: createAdaptiveTimeline(0, 100, 6) }
  }

  // Single pass collection of all metrics for all participants
  const participantMetrics = collectParticipantBarMetrics(
    settings.stimulusId,
    participantIds,
    aois
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
    data.noAoiTreatment,
    aggregationMethod
  )

  // Apply sorting if needed
  const sortedData = applySorting(labeledData, settings.sortBars || 'none')

  // Create timeline with appropriate scale
  const timeline = createTimeline(rawData, settings.scaleRange)

  return {
    data: sortedData,
    timeline,
  }
}

/**
 * Aggregates individual participant metrics into the final bar values.
 * Optimized for performance: avoids intermediate arrays and closures in hot loops.
 */
function aggregateMetrics(
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
export function createLabeledData(
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
export function applySorting(
  data: BarPlotDataItem[],
  sortType: 'none' | 'ascending' | 'descending'
): BarPlotDataItem[] {
  if (sortType === 'none') return data
  return [...data].sort((a, b) =>
    sortType === 'ascending' ? a.value - b.value : b.value - a.value
  )
}

/**
 * Creates a timeline with appropriate scale based on data and user settings
 */
export function createTimeline(
  rawData: number[],
  scaleRange?: [number, number]
): AdaptiveTimeline {
  let maxValue = 0
  for (let i = 0; i < rawData.length; i++) {
    const val = rawData[i]
    if (!isNaN(val) && val > maxValue) {
      maxValue = val
    }
  }

  let min = 0
  let max = maxValue

  if (scaleRange) {
    if (scaleRange[0] !== 0) min = scaleRange[0]
    if (scaleRange[1] !== 0) max = scaleRange[1]
  }

  return createAdaptiveTimeline(min, max, 6)
}
