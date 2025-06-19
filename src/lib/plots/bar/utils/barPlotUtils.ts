import {
  getAois,
  getParticipantsIds,
} from '$lib/gaze-data/front-process/stores/dataStore'
import { AdaptiveTimeline } from '$lib/plots/shared/class/AdaptiveTimeline'
import type { BarPlotGridType } from '$lib/workspace/type/gridType'
import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'
import {
  formatDecimal,
  calculateAverage,
  normalizeToPercentages,
  createArray,
} from '$lib/shared/utils/mathUtils'
import type { BarPlotResult, BarPlotDataItem } from '$lib/plots/bar/types'
import {
  collectParticipantsDwellTimeData,
  collectParticipantsTimeToFirstFixationData,
  collectParticipantsAvgFixationDurationData,
  collectParticipantsFirstFixationDurationData,
  collectParticipantsFixationCountData,
} from './collectParticipantMetricsUtils'

/**
 * Main function to get bar plot data based on selected settings
 */
export function getBarPlotData(
  settings: Pick<
    BarPlotGridType,
    'stimulusId' | 'groupId' | 'aggregationMethod' | 'sortBars' | 'scaleRange'
  >
): BarPlotResult {
  const aois = getAois(settings.stimulusId)
  const participantIds = getParticipantsIds(
    settings.groupId,
    settings.stimulusId
  )
  const aggregationMethod = settings.aggregationMethod || 'absoluteTime'

  // Get the raw data values based on the selected aggregation method
  let processedData: number[] = []

  switch (aggregationMethod) {
    case 'absoluteTime':
      processedData = collectDwellTimeData(
        settings.stimulusId,
        participantIds,
        aois
      ).slice(0, -1)
      break

    case 'relativeTime':
      const absoluteTimes = collectDwellTimeData(
        settings.stimulusId,
        participantIds,
        aois
      ).slice(0, -1)
      processedData = normalizeToPercentages(absoluteTimes)
      break

    case 'timeToFirstFixation':
      processedData = collectTimeToFirstFixationData(
        settings.stimulusId,
        participantIds,
        aois
      ).slice(0, -1)
      break

    case 'avgFixationDuration':
      processedData = collectAvgFixationDurationData(
        settings.stimulusId,
        participantIds,
        aois
      ).slice(0, -1)
      break

    case 'avgFirstFixationDuration':
      processedData = collectAvgFirstFixationDurationData(
        settings.stimulusId,
        participantIds,
        aois
      ).slice(0, -1)
      break

    case 'averageFixationCount':
      processedData = collectAverageFixationCountData(
        settings.stimulusId,
        participantIds,
        aois
      ).slice(0, -1)
      break
  }

  // Create labeled data with AOI information
  const labeledData = createLabeledData(processedData, aois, aggregationMethod)

  // Apply sorting if needed
  const sortedData = applySorting(labeledData, settings.sortBars || 'none')

  // Create timeline with appropriate scale
  const timeline = createTimeline(processedData, settings.scaleRange)

  return {
    data: sortedData,
    timeline,
  }
}

/**
 * Collects dwell time data for each AOI and no-AOI
 * @returns Array of dwell times, with the last element being no-AOI time
 */
export function collectDwellTimeData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[] {
  const participantData = collectParticipantsDwellTimeData(
    stimulusId,
    participantIds,
    aois
  )

  // Sum across all participants
  const totalData = createArray(aois.length + 1, 0)
  for (const participantRow of participantData) {
    for (let i = 0; i < participantRow.length; i++) {
      totalData[i] += participantRow[i]
    }
  }

  return totalData
}

/**
 * Converts absolute time values to relative percentages
 */
export function convertToRelativeValues(absoluteValues: number[]): number[] {
  return normalizeToPercentages(absoluteValues)
}

/**
 * Collects time to first fixation data for each AOI and no-AOI
 * @returns Array of average times to first fixation, with the last element being no-AOI
 */
export function collectTimeToFirstFixationData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[] {
  const participantData = collectParticipantsTimeToFirstFixationData(
    stimulusId,
    participantIds,
    aois
  )

  // Calculate averages for each AOI + no-AOI
  const results: number[] = []
  const numAois = aois.length + 1 // +1 for no-AOI

  for (let aoiIndex = 0; aoiIndex < numAois; aoiIndex++) {
    const validTimes = participantData
      .map(row => row[aoiIndex])
      .filter(time => time !== -1)

    if (validTimes.length === 0) {
      results.push(0) // No valid fixations, return 0 for visualization
    } else {
      results.push(calculateAverage(validTimes))
    }
  }

  return results
}

/**
 * Collects average fixation duration data for each AOI and no-AOI
 * @returns Array of average fixation durations, with the last element being no-AOI
 */
export function collectAvgFixationDurationData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[] {
  const participantData = collectParticipantsAvgFixationDurationData(
    stimulusId,
    participantIds,
    aois
  )

  // Combine all participants' durations and calculate averages
  const results: number[] = []
  const numAois = aois.length + 1 // +1 for no-AOI

  for (let aoiIndex = 0; aoiIndex < numAois; aoiIndex++) {
    const allDurations: number[] = []

    // Collect all durations for this AOI across all participants
    for (const participantRow of participantData) {
      allDurations.push(...participantRow[aoiIndex])
    }

    if (allDurations.length === 0) {
      results.push(0)
    } else {
      results.push(calculateAverage(allDurations))
    }
  }

  return results
}

/**
 * Collects average first fixation duration data for each AOI and no-AOI
 * @returns Array of average durations of first fixations, with the last element being no-AOI
 */
export function collectAvgFirstFixationDurationData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[] {
  const participantData = collectParticipantsFirstFixationDurationData(
    stimulusId,
    participantIds,
    aois
  )

  // Calculate averages for each AOI + no-AOI
  const results: number[] = []
  const numAois = aois.length + 1 // +1 for no-AOI

  for (let aoiIndex = 0; aoiIndex < numAois; aoiIndex++) {
    const validDurations = participantData
      .map(row => row[aoiIndex])
      .filter(duration => duration !== -1)

    if (validDurations.length === 0) {
      results.push(0)
    } else {
      results.push(calculateAverage(validDurations))
    }
  }

  return results
}

/**
 * Collects average fixation count data for each AOI and no-AOI
 * @returns Array of average fixation counts, with the last element being no-AOI
 */
export function collectAverageFixationCountData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[] {
  const participantData = collectParticipantsFixationCountData(
    stimulusId,
    participantIds,
    aois
  )

  // Skip if no participants
  if (participantData.length === 0) {
    return createArray(aois.length + 1, 0)
  }

  // Calculate averages for each AOI + no-AOI
  const results: number[] = []
  const numAois = aois.length + 1 // +1 for no-AOI

  for (let aoiIndex = 0; aoiIndex < numAois; aoiIndex++) {
    const counts = participantData.map(row => row[aoiIndex])
    results.push(calculateAverage(counts))
  }

  return results
}

/**
 * Creates labeled data items from raw numeric values
 */
export function createLabeledData(
  rawData: number[],
  aois: ExtendedInterpretedDataType[],
  aggregationMethod: string
): BarPlotDataItem[] {
  const NO_AOI_COLOR = '#888888'

  return rawData.map((value, index) => {
    // Format value to 1 decimal place
    const formattedValue = formatDecimal(value)

    // Handle last element (No AOI)
    if (index === aois.length) {
      // Special case for never fixated in time to first fixation
      if (
        aggregationMethod === 'timeToFirstFixation' &&
        value === 0 &&
        rawData[index] === -1
      ) {
        return {
          value: 0,
          label: 'No AOI: Never Fixated',
          color: NO_AOI_COLOR,
        }
      }

      return {
        value: formattedValue,
        label: 'No AOI',
        color: NO_AOI_COLOR,
      }
    }

    // Handle regular AOI
    // Special case for never fixated in time to first fixation
    if (
      aggregationMethod === 'timeToFirstFixation' &&
      value === 0 &&
      rawData[index] === -1
    ) {
      return {
        value: 0,
        label: `${aois[index].displayedName}: Never Fixated`,
        color: aois[index].color,
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
  if (sortType === 'none') {
    return data
  }

  return [...data].sort((a, b) => {
    if (sortType === 'ascending') {
      return a.value - b.value
    } else {
      return b.value - a.value
    }
  })
}

/**
 * Creates a timeline with appropriate scale based on data and user settings
 */
export function createTimeline(
  rawData: number[],
  scaleRange?: [number, number]
): AdaptiveTimeline {
  // Calculate default max value from data
  const maxValue = Math.max(...rawData.filter(val => !isNaN(val) && val !== -1))

  // Default values
  let timelineMin = 0
  let timelineMax = maxValue

  // Apply custom scale if provided
  if (scaleRange) {
    // Apply min value if set
    if (scaleRange[0] !== 0) {
      timelineMin = scaleRange[0]
    }

    // Apply max value if set (0 means auto)
    if (scaleRange[1] !== 0) {
      timelineMax = scaleRange[1]
    }
  }

  return new AdaptiveTimeline(timelineMin, timelineMax, 6)
}
