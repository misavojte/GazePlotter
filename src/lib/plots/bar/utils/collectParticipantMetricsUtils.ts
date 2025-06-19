import {
  getParticipants,
  getSegments,
} from '$lib/gaze-data/front-process/stores/dataStore'
import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'
import { createArray } from '$lib/shared/utils/mathUtils'

/**
 * Collects dwell time data for each participant separately
 * @returns Array of arrays - each inner array contains dwell times for AOIs + no-AOI for one participant
 */
export function collectParticipantsDwellTimeData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[][] {
  const participantData: number[][] = []

  // Process each participant
  for (const participantId of participantIds) {
    let noAoiTotalTime = 0
    const aoisSumTimes = createArray(aois.length, 0)

    // Get all fixation segments (category 0) for this participant
    const fixationSegments = getSegments(stimulusId, participantId, [0])

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

    // Add this participant's data
    participantData.push([...aoisSumTimes, noAoiTotalTime])
  }

  return participantData
}

/**
 * Collects time to first fixation data for each participant separately
 * @returns Array of arrays - each inner array contains time to first fixation for AOIs + no-AOI for one participant (-1 if never fixated)
 */
export function collectParticipantsTimeToFirstFixationData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[][] {
  const participantData: number[][] = []

  // Process each participant
  for (const participantId of participantIds) {
    // Track first fixation for this participant
    const participantFirstFixationTimes = createArray(aois.length, -1)
    let participantFirstFixatedNoAoi = -1

    // Get fixation segments in chronological order
    const fixationSegments = getSegments(stimulusId, participantId, [0])

    // Process segments to find first fixations
    for (const segment of fixationSegments) {
      // Check for no-AOI fixation
      if (segment.aoi.length === 0) {
        if (participantFirstFixatedNoAoi === -1) {
          participantFirstFixatedNoAoi = segment.start
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

    // Add this participant's data
    participantData.push([
      ...participantFirstFixationTimes,
      participantFirstFixatedNoAoi,
    ])
  }

  return participantData
}

/**
 * Collects all fixation durations for each participant separately
 * @returns Array of arrays - each inner array contains arrays of fixation durations for AOIs + no-AOI for one participant
 */
export function collectParticipantsAvgFixationDurationData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[][][] {
  const participantData: number[][][] = []

  // Process each participant
  for (const participantId of participantIds) {
    // Data structures for fixation durations for this participant
    const aoiFixationDurations: number[][] = Array(aois.length)
      .fill(null)
      .map(() => [])
    let noAoiFixationDurations: number[] = []

    // Get all fixation segments
    const fixationSegments = getSegments(stimulusId, participantId, [0])

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

    // Add this participant's data
    participantData.push([...aoiFixationDurations, noAoiFixationDurations])
  }

  return participantData
}

/**
 * Collects first fixation duration data for each participant separately
 * @returns Array of arrays - each inner array contains first fixation durations for AOIs + no-AOI for one participant (-1 if never fixated)
 */
export function collectParticipantsFirstFixationDurationData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[][] {
  const participantData: number[][] = []

  // Process each participant
  for (const participantId of participantIds) {
    // Tracking for first fixation per participant
    const participantFirstFixated = createArray(aois.length, false)
    const participantFirstFixationDurations = createArray(aois.length, -1)
    let participantFirstFixatedNoAoi = false
    let participantFirstFixationNoAoiDuration = -1

    // Get fixation segments
    const fixationSegments = getSegments(stimulusId, participantId, [0])

    // Process segments to find first fixations
    for (const segment of fixationSegments) {
      const duration = segment.end - segment.start

      // Check for no-AOI fixation
      if (segment.aoi.length === 0) {
        if (!participantFirstFixatedNoAoi) {
          participantFirstFixationNoAoiDuration = duration
          participantFirstFixatedNoAoi = true
        }
        continue
      }

      // Check for AOI fixations
      for (const aoi of segment.aoi) {
        const aoiIndex = aois.findIndex(a => a.id === aoi.id)
        if (aoiIndex !== -1 && !participantFirstFixated[aoiIndex]) {
          participantFirstFixationDurations[aoiIndex] = duration
          participantFirstFixated[aoiIndex] = true
        }
      }
    }

    // Add this participant's data
    participantData.push([
      ...participantFirstFixationDurations,
      participantFirstFixationNoAoiDuration,
    ])
  }

  return participantData
}

/**
 * Collects fixation count data for each participant separately
 * @returns Array of arrays - each inner array contains fixation counts for AOIs + no-AOI for one participant
 */
export function collectParticipantsFixationCountData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[][] {
  const participantData: number[][] = []

  // Process each participant
  for (const participantId of participantIds) {
    // Initialize counters for this participant
    const participantAoiCounts = createArray(aois.length, 0)
    let participantNoAoiCount = 0

    // Get all fixation segments
    const fixationSegments = getSegments(stimulusId, participantId, [0])

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

    // Add this participant's data
    participantData.push([...participantAoiCounts, participantNoAoiCount])
  }

  return participantData
}
