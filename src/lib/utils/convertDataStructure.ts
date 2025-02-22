import type { DataType } from '$lib/type/Data/DataType.ts'
import { getAoi } from '$lib/stores/dataStore.ts'

export const convertDataStructure = (
  data: DataType
): Array<{
  stimulus: string
  participant: string
  timestamp: string
  duration: string
  eyemovementtype: string
  AOI: string[] | null
  coordinates?: [number, number]
}> => {
  const result: Array<{
    stimulus: string
    participant: string
    timestamp: string
    duration: string
    eyemovementtype: string
    AOI: string[] | null
    coordinates?: [number, number]
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
          const [start, end, category, ...rest] = segment
          let coordinates: [number, number] | undefined
          let aoiIds: number[]

          // Only process coordinates for fixations (category 0)
          if (data.hasCoordinates && category === 0) {
            coordinates = [rest[0], rest[1]]
            aoiIds = rest.slice(2)
          } else {
            aoiIds = []
          }

          const aoiNames =
            aoiIds.length > 0
              ? aoiIds.map(id => getAoi(stimulusIndex, id).displayedName)
              : null

          result.push({
            stimulus: data.stimuli.data[stimulusIndex][0],
            participant: data.participants.data[participantIndex][0],
            timestamp: String(start),
            duration: String(Number(end) - Number(start)),
            eyemovementtype: String(category),
            AOI: aoiNames,
            coordinates,
          })
        }
      }
    }
  }

  return result
}
