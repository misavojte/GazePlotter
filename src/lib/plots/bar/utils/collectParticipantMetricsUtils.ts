import { getSegments } from '$lib/gaze-data/front-process/stores/dataStore'
import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'
import { createArray } from '$lib/shared/utils/mathUtils'

/**
 * Collects dwell time data for each participant separately.
 * Dwell time is the total time spent in an AOI (sum of all dwell durations).
 * 
 * This function reuses the dwell duration data collection for consistency and DRY principles.
 * Absolute time = sum of all dwell durations.
 * 
 * @param {number} stimulusId - The ID of the stimulus to analyze
 * @param {number[]} participantIds - Array of participant IDs to include in analysis
 * @param {ExtendedInterpretedDataType[]} aois - Array of AOI definitions
 * @returns {number[][]} Array of arrays - each inner array contains total dwell times 
 *                       for AOIs + any fixation + no-AOI for one participant
 */
export function collectParticipantsDwellTimeData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[][] {
  // Get dwell durations for all participants
  const dwellDurationData = collectParticipantsDwellDurationData(
    stimulusId,
    participantIds,
    aois
  )

  const participantData: number[][] = []

  // For each participant, sum all dwell durations to get total time
  for (const participantDwellDurations of dwellDurationData) {
    const participantTotalTimes: number[] = []

    // Sum all dwell durations for each AOI (including no-AOI and any fixation)
    for (const dwellDurations of participantDwellDurations) {
      const totalTime = dwellDurations.reduce((sum, duration) => sum + duration, 0)
      participantTotalTimes.push(totalTime)
    }

    participantData.push(participantTotalTimes)
  }

  return participantData
}

/**
 * Collects time to first fixation data for each participant separately
 * @returns Array of arrays - each inner array contains time to first fixation for AOIs + any fixation + no-AOI for one participant (-1 if never fixated)
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
    let participantFirstFixatedAny = -1
    let participantFirstFixatedNoAoi = -1

    // Get fixation segments in chronological order
    const fixationSegments = getSegments(stimulusId, participantId, [0])

    // Process segments to find first fixations
    for (const segment of fixationSegments) {
      // Check for any fixation (first time we see any fixation)
      if (participantFirstFixatedAny === -1) {
        participantFirstFixatedAny = segment.start
      }

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

    // Add this participant's data: [...aois, noAoi, anyFixation]
    participantData.push([
      ...participantFirstFixationTimes,
      participantFirstFixatedNoAoi,
      participantFirstFixatedAny,
    ])
  }

  return participantData
}

/**
 * Collects all fixation durations for each participant separately
 * @returns Array of arrays - each inner array contains arrays of fixation durations for AOIs + any fixation + no-AOI for one participant
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
    let anyFixationDurations: number[] = []
    let noAoiFixationDurations: number[] = []

    // Get all fixation segments
    const fixationSegments = getSegments(stimulusId, participantId, [0])

    // Process each segment
    for (const segment of fixationSegments) {
      const duration = segment.end - segment.start

      // Add to any fixation durations
      anyFixationDurations.push(duration)

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

    // Add this participant's data: [...aois, noAoi, anyFixation]
    participantData.push([
      ...aoiFixationDurations,
      noAoiFixationDurations,
      anyFixationDurations,
    ])
  }

  return participantData
}

/**
 * Collects first fixation duration data for each participant separately
 * @returns Array of arrays - each inner array contains first fixation durations for AOIs + any fixation + no-AOI for one participant (-1 if never fixated)
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
    let participantFirstFixatedAny = false
    let participantFirstFixationAnyDuration = -1
    let participantFirstFixatedNoAoi = false
    let participantFirstFixationNoAoiDuration = -1

    // Get fixation segments
    const fixationSegments = getSegments(stimulusId, participantId, [0])

    // Process segments to find first fixations
    for (const segment of fixationSegments) {
      const duration = segment.end - segment.start

      // Check for any fixation (first time we see any fixation)
      if (!participantFirstFixatedAny) {
        participantFirstFixationAnyDuration = duration
        participantFirstFixatedAny = true
      }

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

    // Add this participant's data: [...aois, noAoi, anyFixation]
    participantData.push([
      ...participantFirstFixationDurations,
      participantFirstFixationNoAoiDuration,
      participantFirstFixationAnyDuration,
    ])
  }

  return participantData
}

/**
 * Collects fixation count data for each participant separately
 * @returns Array of arrays - each inner array contains fixation counts for AOIs + any fixation + no-AOI for one participant
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
    let participantAnyFixationCount = 0
    let participantNoAoiCount = 0

    // Get all fixation segments
    const fixationSegments = getSegments(stimulusId, participantId, [0])

    // Count fixations for each AOI
    for (const segment of fixationSegments) {
      // Count any fixation
      participantAnyFixationCount++

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

    // Add this participant's data: [...aois, noAoi, anyFixation]
    participantData.push([
      ...participantAoiCounts,
      participantNoAoiCount,
      participantAnyFixationCount,
    ])
  }

  return participantData
}

/**
 * Collects hit ratio (seen %) data for each participant separately.
 * Hit ratio indicates whether a participant looked at an AOI at least once.
 * 
 * @param {number} stimulusId - The ID of the stimulus to analyze
 * @param {number[]} participantIds - Array of participant IDs to include in analysis
 * @param {ExtendedInterpretedDataType[]} aois - Array of AOI definitions
 * @returns {number[][]} Array of arrays - each inner array contains binary indicators (1 = seen, 0 = not seen) 
 *                       for AOIs + any fixation + no-AOI for one participant
 * 
 * @example
 * // Returns [[1, 0, 1, 1, 1], [1, 1, 0, 1, 1]] for 2 participants with 3 AOIs
 * // First participant saw AOI 0 and 2, but not AOI 1
 * // Second participant saw AOI 0 and 1, but not AOI 2
 */
export function collectParticipantsHitRatioData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[][] {
  const participantData: number[][] = []

  // Process each participant to determine which AOIs they fixated on
  for (const participantId of participantIds) {
    // Track whether this participant has seen each AOI (binary indicator: 0 or 1)
    const participantSeenAois = createArray(aois.length, 0)
    let participantSeenAnyFixation = 0
    let participantSeenNoAoi = 0

    // Get all fixation segments for this participant
    const fixationSegments = getSegments(stimulusId, participantId, [0])

    // Check if participant has any fixations at all
    if (fixationSegments.length > 0) {
      participantSeenAnyFixation = 1
    }

    // Iterate through segments to mark which AOIs were seen
    for (const segment of fixationSegments) {
      // Check if this is a no-AOI fixation
      if (segment.aoi.length === 0) {
        participantSeenNoAoi = 1
        continue
      }

      // Mark each AOI in this segment as seen (set to 1 if not already)
      for (const aoi of segment.aoi) {
        const aoiIndex = aois.findIndex(a => a.id === aoi.id)
        if (aoiIndex !== -1) {
          participantSeenAois[aoiIndex] = 1
        }
      }
    }

    // Add this participant's binary indicators: [...aois, noAoi, anyFixation]
    participantData.push([
      ...participantSeenAois,
      participantSeenNoAoi,
      participantSeenAnyFixation,
    ])
  }

  return participantData
}

/**
 * Collects entry count (visit count) data for each participant separately.
 * An "entry" or "visit" is defined as one or more consecutive fixations within an AOI.
 * 
 * This metric answers: "How many distinct encounters did a participant have with this AOI?"
 * For example, looking at AOI A, then B, then A again = 2 entries to AOI A.
 * 
 * @param {number} stimulusId - The ID of the stimulus to analyze
 * @param {number[]} participantIds - Array of participant IDs to include in analysis
 * @param {ExtendedInterpretedDataType[]} aois - Array of AOI definitions
 * @returns {number[][]} Array of arrays - each inner array contains entry counts 
 *                       for AOIs + any fixation + no-AOI for one participant
 * 
 * @example
 * // Participant looks at: AOI 0 -> AOI 1 -> AOI 0 -> AOI 0 -> AOI 1
 * // This results in: AOI 0 = 2 entries, AOI 1 = 2 entries
 * // (consecutive fixations in the same AOI count as 1 entry)
 */
export function collectParticipantsEntryCountData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[][] {
  const participantData: number[][] = []

  // Process each participant to count distinct visits to each AOI
  for (const participantId of participantIds) {
    // Track entry counts for this participant
    const participantEntryCounts = createArray(aois.length, 0)
    let participantAnyFixationEntries = 0
    let participantNoAoiEntries = 0

    // Track which AOIs were present in the previous segment to detect transitions
    const previousAoiIds = new Set<number>()
    let wasInNoAoi = false
    let wasInAnyFixation = false

    // Get all fixation segments in chronological order
    const fixationSegments = getSegments(stimulusId, participantId, [0])

    // Iterate through segments to count entries (visits)
    for (const segment of fixationSegments) {
      // Check for new "any fixation" entry (transition from no fixations to fixations)
      if (!wasInAnyFixation) {
        participantAnyFixationEntries++
        wasInAnyFixation = true
      }

      // Handle no-AOI case (segment with no AOIs)
      if (segment.aoi.length === 0) {
        // Check for new no-AOI entry (transition into no-AOI area)
        if (!wasInNoAoi) {
          participantNoAoiEntries++
          wasInNoAoi = true
        }

        // Clear previous AOI tracking since we left all AOIs
        previousAoiIds.clear()
        continue
      }

      // We're now in AOI(s), so we're not in no-AOI anymore
      wasInNoAoi = false

      // Collect current AOI IDs from this segment
      const currentAoiIds = new Set<number>()
      for (const aoi of segment.aoi) {
        currentAoiIds.add(aoi.id)
      }

      // Check each AOI in the current segment
      for (const aoi of segment.aoi) {
        const aoiIndex = aois.findIndex(a => a.id === aoi.id)
        if (aoiIndex === -1) continue

        // If this AOI wasn't in the previous segment, it's a new entry
        if (!previousAoiIds.has(aoi.id)) {
          participantEntryCounts[aoiIndex]++
        }
      }

      // Update previous AOIs for next iteration
      previousAoiIds.clear()
      currentAoiIds.forEach(id => previousAoiIds.add(id))
    }

    // Add this participant's entry counts: [...aois, noAoi, anyFixation]
    participantData.push([
      ...participantEntryCounts,
      participantNoAoiEntries,
      participantAnyFixationEntries,
    ])
  }

  return participantData
}

/**
 * Collects dwell durations for each participant separately.
 * A "dwell" is one or more consecutive fixations within the same AOI.
 * 
 * This metric answers: "How long did each visit to an AOI last?"
 * For example: AOI A (200ms + 150ms) → AOI B (300ms) → AOI A (180ms)
 * Results in AOI A dwell durations: [350ms, 180ms]
 * 
 * @param {number} stimulusId - The ID of the stimulus to analyze
 * @param {number[]} participantIds - Array of participant IDs to include in analysis
 * @param {ExtendedInterpretedDataType[]} aois - Array of AOI definitions
 * @returns {number[][][]} Array of arrays of arrays - each inner array contains arrays of dwell durations
 *                         for AOIs + any fixation + no-AOI for one participant
 * 
 * @example
 * // Participant fixates: AOI 0 (200ms, 150ms) -> AOI 1 (300ms) -> AOI 0 (180ms)
 * // Returns for AOI 0: [350, 180] (sum of consecutive fixations per visit)
 */
export function collectParticipantsDwellDurationData(
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[]
): number[][][] {
  const participantData: number[][][] = []

  // Process each participant to collect dwell durations for each AOI
  for (const participantId of participantIds) {
    // Track dwell durations for this participant - array of arrays of durations
    const participantDwellDurations: number[][] = Array(aois.length)
      .fill(null)
      .map(() => [])
    let participantAnyFixationDwells: number[] = []
    let participantNoAoiDwells: number[] = []

    // Track which AOIs were present in the previous segment and accumulate durations
    const previousAoiIds = new Set<number>()
    const currentDwellDurations = new Map<number, number>() // aoiId -> accumulated duration
    let wasInNoAoi = false
    let currentNoAoiDwellDuration = 0
    let wasInAnyFixation = false
    let currentAnyFixationDwellDuration = 0

    // Get all fixation segments in chronological order
    const fixationSegments = getSegments(stimulusId, participantId, [0])

    // Iterate through segments to accumulate dwell durations
    for (const segment of fixationSegments) {
      const duration = segment.end - segment.start

      // Handle "any fixation" dwells
      if (!wasInAnyFixation) {
        // Starting a new "any fixation" dwell
        currentAnyFixationDwellDuration = duration
        wasInAnyFixation = true
      } else {
        // Continuing the "any fixation" dwell (this is always consecutive)
        currentAnyFixationDwellDuration += duration
      }

      // Handle no-AOI case (segment with no AOIs)
      if (segment.aoi.length === 0) {
        // Check if we're starting a new no-AOI dwell or continuing one
        if (!wasInNoAoi) {
          // Starting a new no-AOI dwell
          currentNoAoiDwellDuration = duration
          wasInNoAoi = true
        } else {
          // Continuing the no-AOI dwell
          currentNoAoiDwellDuration += duration
        }

        // We left all AOIs - save any accumulated AOI dwells
        for (const [aoiId, dwellDuration] of currentDwellDurations.entries()) {
          const aoiIndex = aois.findIndex(a => a.id === aoiId)
          if (aoiIndex !== -1) {
            participantDwellDurations[aoiIndex].push(dwellDuration)
          }
        }

        // Clear previous AOI tracking
        currentDwellDurations.clear()
        previousAoiIds.clear()
        continue
      }

      // We're now in AOI(s), so we're not in no-AOI anymore
      if (wasInNoAoi) {
        // We left no-AOI, save the dwell duration
        participantNoAoiDwells.push(currentNoAoiDwellDuration)
        currentNoAoiDwellDuration = 0
        wasInNoAoi = false
      }

      // Collect current AOI IDs from this segment
      const currentAoiIds = new Set<number>()
      for (const aoi of segment.aoi) {
        currentAoiIds.add(aoi.id)
      }

      // Process each AOI in the current segment
      for (const aoi of segment.aoi) {
        if (previousAoiIds.has(aoi.id)) {
          // Continuing a dwell in this AOI - add to accumulated duration
          currentDwellDurations.set(
            aoi.id,
            (currentDwellDurations.get(aoi.id) || 0) + duration
          )
        } else {
          // Starting a new dwell in this AOI
          currentDwellDurations.set(aoi.id, duration)
        }
      }

      // Check which AOIs we left (were in previous but not in current)
      for (const prevAoiId of previousAoiIds) {
        if (!currentAoiIds.has(prevAoiId)) {
          // We left this AOI - save the dwell duration
          const dwellDuration = currentDwellDurations.get(prevAoiId)
          if (dwellDuration !== undefined) {
            const aoiIndex = aois.findIndex(a => a.id === prevAoiId)
            if (aoiIndex !== -1) {
              participantDwellDurations[aoiIndex].push(dwellDuration)
            }
          }
          currentDwellDurations.delete(prevAoiId)
        }
      }

      // Update previous AOIs for next iteration
      previousAoiIds.clear()
      currentAoiIds.forEach(id => previousAoiIds.add(id))
    }

    // Save any remaining accumulated dwells at the end
    for (const [aoiId, dwellDuration] of currentDwellDurations.entries()) {
      const aoiIndex = aois.findIndex(a => a.id === aoiId)
      if (aoiIndex !== -1) {
        participantDwellDurations[aoiIndex].push(dwellDuration)
      }
    }

    // Save remaining no-AOI dwell if we ended in no-AOI
    if (wasInNoAoi) {
      participantNoAoiDwells.push(currentNoAoiDwellDuration)
    }

    // Save the final "any fixation" dwell
    if (wasInAnyFixation) {
      participantAnyFixationDwells.push(currentAnyFixationDwellDuration)
    }

    // Add this participant's dwell durations: [...aois, noAoi, anyFixation]
    participantData.push([
      ...participantDwellDurations,
      participantNoAoiDwells,
      participantAnyFixationDwells,
    ])
  }

  return participantData
}
