import type { DataType } from '$lib/type/Data/DataType'
import { getAoi } from '$lib/stores/dataStore'

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
