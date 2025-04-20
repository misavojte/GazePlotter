import { getAois, getParticipants, getSegments } from '$lib/stores/dataStore'
import { AdaptiveTimeline } from '$lib/class/Plot/AdaptiveTimeline/AdaptiveTimeline'
import type { BarPlotGridType } from '$lib/type/gridType'
import type { ExtendedInterpretedDataType } from '$lib/type/Data/InterpretedData/ExtendedInterpretedDataType'
import type { SegmentInterpretedDataType } from '$lib/type/Data/InterpretedData/SegmentInterpretedDataType'
import type { BaseInterpretedDataType } from '$lib/type/Data/InterpretedData/BaseInterpretedDataType'

export interface BarPlotDataItem {
  value: number
  label: string
  color: string
}

export interface BarPlotResult {
  data: BarPlotDataItem[]
  timeline: AdaptiveTimeline
}

export interface ParticipantSegmentData {
  participant: BaseInterpretedDataType
  segments: SegmentInterpretedDataType[]
}

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
  const aggregationMethod = settings.aggregationMethod || 'absoluteTime'

  // Get the raw data values based on the selected aggregation method
  let processedData: number[] = []

  switch (aggregationMethod) {
    case 'absoluteTime':
      processedData = collectDwellTimeData(
        settings.stimulusId,
        settings.groupId,
        aois
      )
      break

    case 'relativeTime':
      const absoluteTimes = collectDwellTimeData(
        settings.stimulusId,
        settings.groupId,
        aois
      )
      processedData = convertToRelativeValues(absoluteTimes)
      break

    case 'timeToFirstFixation':
      processedData = collectTimeToFirstFixationData(
        settings.stimulusId,
        settings.groupId,
        aois
      )
      break

    case 'avgFixationDuration':
      processedData = collectAvgFixationDurationData(
        settings.stimulusId,
        settings.groupId,
        aois
      )
      break

    case 'avgFirstFixationDuration':
      processedData = collectAvgFirstFixationDurationData(
        settings.stimulusId,
        settings.groupId,
        aois
      )
      break

    case 'averageFixationCount':
      processedData = collectAverageFixationCountData(
        settings.stimulusId,
        settings.groupId,
        aois
      )
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
  groupId: number,
  aois: ExtendedInterpretedDataType[]
): number[] {
  const participants = getParticipants(groupId, stimulusId)

  // Data structures for time tracking
  let noAoiTotalTime = 0
  const aoisSumTimes = new Array(aois.length).fill(0)

  // Process each participant
  for (const participant of participants) {
    // Get all fixation segments (category 0) for this participant
    const fixationSegments = getSegments(stimulusId, participant.id, [0])

    // Process each segment
    for (const segment of fixationSegments) {
      const duration = segment.end - segment.start

      // If segment has no AOIs, add to no-AOI time
      if (segment.aoi.length === 0) {
        noAoiTotalTime += duration
        continue
      }

      // Add segment duration to each AOI it belongs to
      for (const aoi of segment.aoi) {
        const aoiIndex = aois.findIndex(a => a.id === aoi.id)
        if (aoiIndex !== -1) {
          aoisSumTimes[aoiIndex] += duration
        }
      }
    }
  }

  // Return combined array with AOI times and no-AOI time
  return [...aoisSumTimes, noAoiTotalTime]
}

/**
 * Converts absolute time values to relative percentages
 */
export function convertToRelativeValues(absoluteValues: number[]): number[] {
  const totalTime = absoluteValues.reduce((sum, time) => sum + time, 0)

  if (totalTime === 0) {
    return new Array(absoluteValues.length).fill(0)
  }

  return absoluteValues.map(time => (time / totalTime) * 100)
}

/**
 * Collects time to first fixation data for each AOI and no-AOI
 * @returns Array of average times to first fixation, with the last element being no-AOI
 */
export function collectTimeToFirstFixationData(
  stimulusId: number,
  groupId: number,
  aois: ExtendedInterpretedDataType[]
): number[] {
  const participants = getParticipants(groupId, stimulusId)

  // Data structures for first fixation times
  const aoiFirstFixationTimes: number[][] = Array(aois.length)
    .fill(null)
    .map(() => [])
  let noAoiFirstFixationTimes: number[] = []

  // Process each participant
  for (const participant of participants) {
    // Track first fixation for this participant
    const participantFirstFixationTimes = new Array(aois.length).fill(-1)
    let participantFirstFixatedNoAoi = false

    // Get fixation segments in chronological order
    const fixationSegments = getSegments(stimulusId, participant.id, [0])

    // Process segments to find first fixations
    for (const segment of fixationSegments) {
      // Check for no-AOI fixation
      if (segment.aoi.length === 0) {
        if (!participantFirstFixatedNoAoi) {
          noAoiFirstFixationTimes.push(segment.start)
          participantFirstFixatedNoAoi = true
        }
        continue
      }

      // Check for AOI fixations
      for (const aoi of segment.aoi) {
        const aoiIndex = aois.findIndex(a => a.id === aoi.id)
        if (aoiIndex !== -1 && participantFirstFixationTimes[aoiIndex] === -1) {
          participantFirstFixationTimes[aoiIndex] = segment.start
        }
      }
    }

    // Add first fixation times to the accumulated data
    participantFirstFixationTimes.forEach((time, index) => {
      if (time !== -1) {
        aoiFirstFixationTimes[index].push(time)
      }
    })
  }

  // Calculate average first fixation time for each AOI
  const avgFirstFixationTimes = aoiFirstFixationTimes.map(times => {
    if (times.length === 0) return -1
    return times.reduce((sum, time) => sum + time, 0) / times.length
  })

  // Calculate average for no-AOI
  const noAoiAvgFirstFixation =
    noAoiFirstFixationTimes.length > 0
      ? noAoiFirstFixationTimes.reduce((sum, time) => sum + time, 0) /
        noAoiFirstFixationTimes.length
      : -1

  // Return combined array with normalized values (replace -1 with 0 for visualization)
  return [...avgFirstFixationTimes, noAoiAvgFirstFixation].map(value =>
    value < 0 ? 0 : value
  )
}

/**
 * Collects average fixation duration data for each AOI and no-AOI
 * @returns Array of average fixation durations, with the last element being no-AOI
 */
export function collectAvgFixationDurationData(
  stimulusId: number,
  groupId: number,
  aois: ExtendedInterpretedDataType[]
): number[] {
  const participants = getParticipants(groupId, stimulusId)

  // Data structures for fixation durations
  const aoiFixationDurations: number[][] = Array(aois.length)
    .fill(null)
    .map(() => [])
  let noAoiFixationDurations: number[] = []

  // Process each participant
  for (const participant of participants) {
    // Get all fixation segments
    const fixationSegments = getSegments(stimulusId, participant.id, [0])

    // Process each segment
    for (const segment of fixationSegments) {
      const duration = segment.end - segment.start

      // Check for no-AOI fixation
      if (segment.aoi.length === 0) {
        noAoiFixationDurations.push(duration)
        continue
      }

      // Add duration to each AOI's collection
      for (const aoi of segment.aoi) {
        const aoiIndex = aois.findIndex(a => a.id === aoi.id)
        if (aoiIndex !== -1) {
          aoiFixationDurations[aoiIndex].push(duration)
        }
      }
    }
  }

  // Calculate average fixation duration for each AOI
  const avgFixationDurations = aoiFixationDurations.map(durations => {
    if (durations.length === 0) return 0
    return (
      durations.reduce((sum, duration) => sum + duration, 0) / durations.length
    )
  })

  // Calculate average for no-AOI
  const noAoiAvgDuration =
    noAoiFixationDurations.length > 0
      ? noAoiFixationDurations.reduce((sum, duration) => sum + duration, 0) /
        noAoiFixationDurations.length
      : 0

  // Return combined array
  return [...avgFixationDurations, noAoiAvgDuration]
}

/**
 * Collects average first fixation duration data for each AOI and no-AOI
 * @returns Array of average durations of first fixations, with the last element being no-AOI
 */
export function collectAvgFirstFixationDurationData(
  stimulusId: number,
  groupId: number,
  aois: ExtendedInterpretedDataType[]
): number[] {
  const participants = getParticipants(groupId, stimulusId)

  // Data structures for first fixation durations
  const aoiFirstFixationDurations: number[] = Array(aois.length).fill(0)
  const aoiFirstFixationCounts: number[] = Array(aois.length).fill(0)
  let noAoiFirstFixationDuration = 0
  let noAoiFirstFixationCount = 0

  // Process each participant
  for (const participant of participants) {
    // Tracking for first fixation per participant
    const participantFirstFixated = new Array(aois.length).fill(false)
    let participantFirstFixatedNoAoi = false

    // Get fixation segments
    const fixationSegments = getSegments(stimulusId, participant.id, [0])

    // Process segments to find first fixations
    for (const segment of fixationSegments) {
      const duration = segment.end - segment.start

      // Check for no-AOI fixation
      if (segment.aoi.length === 0) {
        if (!participantFirstFixatedNoAoi) {
          noAoiFirstFixationDuration += duration
          noAoiFirstFixationCount++
          participantFirstFixatedNoAoi = true
        }
        continue
      }

      // Check for AOI fixations
      for (const aoi of segment.aoi) {
        const aoiIndex = aois.findIndex(a => a.id === aoi.id)
        if (aoiIndex !== -1 && !participantFirstFixated[aoiIndex]) {
          aoiFirstFixationDurations[aoiIndex] += duration
          aoiFirstFixationCounts[aoiIndex]++
          participantFirstFixated[aoiIndex] = true
        }
      }
    }
  }

  // Calculate average first fixation duration for each AOI
  const avgFirstFixationDurations = aoiFirstFixationDurations.map(
    (totalDuration, index) => {
      if (aoiFirstFixationCounts[index] === 0) return 0
      return totalDuration / aoiFirstFixationCounts[index]
    }
  )

  // Calculate average for no-AOI
  const noAoiAvgFirstFixationDuration =
    noAoiFirstFixationCount > 0
      ? noAoiFirstFixationDuration / noAoiFirstFixationCount
      : 0

  // Return combined array
  return [...avgFirstFixationDurations, noAoiAvgFirstFixationDuration]
}

/**
 * Collects average fixation count data for each AOI and no-AOI
 * @returns Array of average fixation counts, with the last element being no-AOI
 */
export function collectAverageFixationCountData(
  stimulusId: number,
  groupId: number,
  aois: ExtendedInterpretedDataType[]
): number[] {
  const participants = getParticipants(groupId, stimulusId)

  // Skip if no participants
  if (participants.length === 0) {
    return [...new Array(aois.length + 1).fill(0)]
  }

  // Arrays to store fixation counts for each participant
  const aoiFixationCounts: number[][] = Array(aois.length)
    .fill(null)
    .map(() => [])
  const noAoiFixationCounts: number[] = []

  // Process each participant
  for (const participant of participants) {
    // Initialize counters for this participant
    const participantAoiCounts = new Array(aois.length).fill(0)
    let participantNoAoiCount = 0

    // Get all fixation segments
    const fixationSegments = getSegments(stimulusId, participant.id, [0])

    // Count fixations for each AOI
    for (const segment of fixationSegments) {
      // Check for no-AOI fixation
      if (segment.aoi.length === 0) {
        participantNoAoiCount++
        continue
      }

      // Count fixation for each AOI
      for (const aoi of segment.aoi) {
        const aoiIndex = aois.findIndex(a => a.id === aoi.id)
        if (aoiIndex !== -1) {
          participantAoiCounts[aoiIndex]++
        }
      }
    }

    // Store this participant's counts
    participantAoiCounts.forEach((count, index) => {
      aoiFixationCounts[index].push(count)
    })
    noAoiFixationCounts.push(participantNoAoiCount)
  }

  // Calculate average fixation count for each AOI
  const avgAoiFixationCounts = aoiFixationCounts.map(counts => {
    // If this AOI was never fixated by any participant, return 0
    if (counts.length === 0) return 0

    // Calculate average fixation count across participants
    const total = counts.reduce((sum, count) => sum + count, 0)
    return total / participants.length
  })

  // Calculate average no-AOI fixation count
  const avgNoAoiFixationCount =
    noAoiFixationCounts.reduce((sum, count) => sum + count, 0) /
    participants.length

  // Return combined array
  return [...avgAoiFixationCounts, avgNoAoiFixationCount]
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
    const formattedValue = Number(value.toFixed(1))

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
