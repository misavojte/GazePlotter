import type { DataType } from '$lib/type/Data/DataType'
import { getAoi } from '$lib/stores/dataStore'

/**
 * Converts the complex hierarchical eye-tracking data structure to a flat array format.
 *
 * This function transforms the multi-dimensional data structure used internally by the application
 * into a flat array of records, making it suitable for CSV export and data processing workflows.
 * Each record in the output array represents one eye-tracking segment (fixation, saccade, etc.)
 * with information about the stimulus, participant, timing, and associated Areas Of Interest (AOIs).
 *
 * Used by the WorkplaceDownloader class for both standard CSV exports and individual participant/stimulus
 * CSV exports, enabling data sharing and external analysis.
 *
 * @param {DataType} data - The hierarchical eye-tracking data object containing segments, stimuli, participants and AOIs
 * @returns {Array<{
 *   stimulus: string,          - The name of the visual stimulus
 *   participant: string,       - The participant identifier
 *   timestamp: string,         - Start time of the eye movement event (in milliseconds)
 *   duration: string,          - Duration of the eye movement event (in milliseconds)
 *   eyemovementtype: string,   - Type of eye movement (e.g., "0" for fixation)
 *   AOI: string[] | null       - Array of AOI names that were looked at, or null if none
 * }>} An array of flattened eye-tracking data records
 */
export const convertDataStructure = (
  data: DataType
): Array<{
  stimulus: string
  participant: string
  timestamp: string
  duration: string
  eyemovementtype: string
  AOI: string[] | null
}> => {
  const result: Array<{
    stimulus: string
    participant: string
    timestamp: string
    duration: string
    eyemovementtype: string
    AOI: string[] | null
  }> = []

  for (
    let stimulusIndex = 0;
    stimulusIndex < data.segments.length;
    stimulusIndex++
  ) {
    for (
      let participantIndex = 0;
      participantIndex < data.participants.data.length;
      participantIndex++
    ) {
      const segments = data.segments[stimulusIndex][participantIndex]
      if (segments) {
        for (const segment of segments) {
          const [start, end, category, ...aoiIds] = segment
          const aoiNames =
            aoiIds.length > 0
              ? aoiIds.map(id => getAoi(stimulusIndex, id).displayedName)
              : null
          result.push({
            stimulus: data.stimuli.data[stimulusIndex][0],
            participant: data.participants.data[participantIndex][0],
            timestamp: String(start),
            duration: String(Number(end) - Number(start)), // Calculate duration
            eyemovementtype: String(category),
            AOI: aoiNames,
          })
        }
      }
    }
  }

  return result
}
