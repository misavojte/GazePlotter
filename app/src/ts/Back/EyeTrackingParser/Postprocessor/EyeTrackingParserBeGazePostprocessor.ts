import { EyeTrackingParserAbstractPostprocessor } from './EyeTrackingParserAbstractPostprocessor'
import { ETDInterface } from '../../../Data/EyeTrackingData'

export class EyeTrackingParserBeGazePostprocessor extends EyeTrackingParserAbstractPostprocessor {
  process (data: ETDInterface): ETDInterface {
    return this.mergeDuplicatedSegments(this.sortSegments(data))
  }

  sortSegments (data: ETDInterface): ETDInterface {
    const noOfStimuli = data.segments.length
    const noOfParticipants = data.participants.data.length
    for (let stimulusId = 0; stimulusId < noOfStimuli; stimulusId++) {
      for (let participantId = 0; participantId < noOfParticipants; participantId++) {
        const segmentPart = data.segments[stimulusId][participantId]
        segmentPart.sort(sortFn)
      }
    }
    // sort by start time in segment array (index 0)
    function sortFn (a: number[], b: number[]): number {
      return a[0] - b[0]
    }
    return data
  }

  mergeDuplicatedSegments (data: ETDInterface): ETDInterface {
    // must be sorted beforehand
    const noOfStimuli = data.segments.length
    const noOfParticipants = data.participants.data.length
    const fixationCategoryId = 0 // 0 in category slot stands for "Fixation" - merging only fixations

    // for logging how many merges were done
    // const info = {} // for creating table
    // let mergeCount = 0 // total count

    for (let stimulusId = 0; stimulusId < noOfStimuli; stimulusId++) {
      // logging info
      // const stimulName = data.stimuli.data[stimulusId][0]
      // info[stimulName] = {}

      for (let particId = 0; particId < noOfParticipants; particId++) {
        const segmentPart = data.segments[stimulusId][particId]

        // logging
        // const mergeCountBase = mergeCount

        // if defined, not null...
        if (segmentPart !== undefined) {
          let prevStart
          let prevEnd
          let segIdToJoin
          // go through every segment for given participant and stimulus
          for (let segmentId = 0; segmentId < segmentPart.length; segmentId++) {
            const currSegment = segmentPart[segmentId]
            // if fixation with identical start and end (than assuming, there are two AOIs to join))
            if (currSegment[0] === prevStart && currSegment[1] === prevEnd && currSegment[2] === fixationCategoryId && segIdToJoin !== undefined) {
              // //add AOI id to the previous one
              // //Control wheter the AOI is already in dataset
              if (!segmentPart[segIdToJoin].slice(3).includes(currSegment[3])) {
                segmentPart[segIdToJoin].push(currSegment[3])
              }

              // mergeCount++
              // delete segment from array
              segmentPart.splice(segmentId, 1)
              segmentId--
            } else {
              segIdToJoin = segmentId
            }
            prevStart = currSegment[0]
            prevEnd = currSegment[1]
          }
        }

        // const partiName = data.participants.data[particId][0]
        // info[stimulName][partiName] = mergeCount - mergeCountBase
      }
    }
    return data
  }
}
