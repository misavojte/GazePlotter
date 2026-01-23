import {
  getAois,
  getParticipantsIds,
  getData,
} from '$lib/gaze-data/front-process/stores/dataStore'
import {
  createAdaptiveTimeline,
  type AdaptiveTimeline,
} from '$lib/plots/shared'
import type { BarPlotGridType } from '$lib/workspace/type/gridType'
import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'
import {
  formatDecimal,
  calculateAverage,
  normalizeToPercentages,
  createArray,
} from '$lib/shared/utils/mathUtils'
import type { BarPlotResult, BarPlotDataItem } from '$lib/plots/bar/types'
import { collectParticipantBarMetrics } from './collectParticipantMetricsUtils'

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
 */
function aggregateMetrics(
  metrics: ReturnType<typeof collectParticipantBarMetrics>,
  method: string,
  aoiCount: number
): number[] {
  const totalSlots = aoiCount + 1 // We only show up to No-AOI (exclude AnyFixation for now unless needed)
  const result = createArray(totalSlots, 0)

  switch (method) {
    case 'absoluteTime':
      for (const m of metrics) {
        for (let i = 0; i < totalSlots; i++) result[i] += m.dwellTime[i]
      }
      return result

    case 'relativeTime':
      const absTimes = aggregateMetrics(metrics, 'absoluteTime', aoiCount)
      return normalizeToPercentages(absTimes)

    case 'timeToFirstFixation':
      for (let i = 0; i < totalSlots; i++) {
        const valid = metrics.map(m => m.ttff[i]).filter(t => t !== -1)
        result[i] = valid.length > 0 ? calculateAverage(valid) : 0
      }
      return result

    case 'avgFixationDuration':
      for (let i = 0; i < totalSlots; i++) {
        const all = metrics.flatMap(m => m.avgFixationDuration[i])
        result[i] = all.length > 0 ? calculateAverage(all) : 0
      }
      return result

    case 'avgFirstFixationDuration':
      for (let i = 0; i < totalSlots; i++) {
        const valid = metrics
          .map(m => m.firstFixationDuration[i])
          .filter(d => d !== -1)
        result[i] = valid.length > 0 ? calculateAverage(valid) : 0
      }
      return result

    case 'averageFixationCount':
      for (let i = 0; i < totalSlots; i++) {
        result[i] = calculateAverage(metrics.map(m => m.fixationCount[i]))
      }
      return result

    case 'hitRatio':
      const count = metrics.length
      for (let i = 0; i < totalSlots; i++) {
        const seen = metrics.reduce((sum, m) => sum + m.hitRatio[i], 0)
        result[i] = (seen / count) * 100
      }
      return result

    case 'averageEntries':
      for (let i = 0; i < totalSlots; i++) {
        result[i] = calculateAverage(metrics.map(m => m.entryCount[i]))
      }
      return result

    case 'avgDwellDuration':
      for (let i = 0; i < totalSlots; i++) {
        const all = metrics.flatMap(m => m.dwellDurations[i])
        result[i] = all.length > 0 ? calculateAverage(all) : 0
      }
      return result

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
  return rawData.map((value, index) => {
    const formattedValue = formatDecimal(value)
    const isNoAoi = index === aois.length

    if (aggregationMethod === 'timeToFirstFixation' && value === 0) {
      const label = isNoAoi
        ? noAoiTreatment.displayedName
        : aois[index].displayedName
      return {
        value: 0,
        label: `${label}: Never Fixated`,
        color: isNoAoi ? noAoiTreatment.color : aois[index].color,
      }
    }

    if (isNoAoi) {
      return {
        value: formattedValue,
        label: noAoiTreatment.displayedName,
        color: noAoiTreatment.color,
      }
    }

    return {
      value: formattedValue,
      label: aois[index].displayedName,
      color: aois[index].color,
    }
  })
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
  const maxValue = Math.max(
    ...rawData.filter(val => !isNaN(val) && val !== -1),
    0
  )

  let min = 0
  let max = maxValue

  if (scaleRange) {
    if (scaleRange[0] !== 0) min = scaleRange[0]
    if (scaleRange[1] !== 0) max = scaleRange[1]
  }

  return createAdaptiveTimeline(min, max, 6)
}
