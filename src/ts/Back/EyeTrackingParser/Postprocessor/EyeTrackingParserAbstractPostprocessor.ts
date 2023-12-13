import { ETDInterface } from '../../../Data/EyeTrackingData'

export abstract class EyeTrackingParserAbstractPostprocessor {
  abstract process (data: ETDInterface): ETDInterface

  orderAoisAlphabetically (data: ETDInterface): void {
    const aois = data.aois
    for (let i = 0; i < aois.data.length; i++) {
      const currentAoiArray = aois.data[i]
      const indexedArr = currentAoiArray.map((value, index) => ({ index, name: value[0] }))
      indexedArr.sort((a, b) => a.name.localeCompare(b.name))
      aois.orderVector[i] = indexedArr.map((value) => value.index)
    }
  }

  orderParticipantsAlphabetically (data: ETDInterface): void {
    const participants = data.participants
    const indexedArr = participants.data.map((value, index) => ({ index, name: value[0] }))
    indexedArr.sort((a, b) => a.name.localeCompare(b.name))
    participants.orderVector = indexedArr.map((value) => value.index)
  }

  sortSegments (data: ETDInterface): ETDInterface {
    const noOfStimuli = data.segments.length
    const noOfParticipants = data.participants.data.length
    for (let stimulusId = 0; stimulusId < noOfStimuli; stimulusId++) {
      for (let participantId = 0; participantId < noOfParticipants; participantId++) {
        const segmentPart = data.segments[stimulusId][participantId]
        if (segmentPart === undefined) continue
        segmentPart.sort(sortFn)
      }
    }
    // sort by start time in segment array (index 0)
    function sortFn (a: number[], b: number[]): number {
      return a[0] - b[0]
    }
    return data
  }
}
