import type { DataType } from '$lib/type/Data/DataType.js'

/**
 * Refines the const. It is the last step of the pipeline.
 *
 * - Orders segments by start time
 * - Merges duplicated segments
 * - Orders AOIs alphabetically
 * - Orders participants alphabetically
 */
export class EyeRefiner {
  process (data: DataType): DataType {
    this.mergeDuplicatedSegments(this.sortSegments(data))
    this.orderAoisAlphabetically(data)
    this.orderParticipantsAlphabetically(data)
    return data
  }

  orderAoisAlphabetically (data: DataType): void {
    const aois = data.aois
    for (let i = 0; i < aois.data.length; i++) {
      const currentAoiArray = aois.data[i]
      const indexedArr = currentAoiArray.map((value, index) => ({ index, name: value[0] }))
      indexedArr.sort((a, b) => a.name.localeCompare(b.name))
      aois.orderVector[i] = indexedArr.map((value) => value.index)
    }
  }

  orderParticipantsAlphabetically (data: DataType): void {
    const participants = data.participants
    const indexedArr = participants.data.map((value, index) => ({ index, name: value[0] }))
    indexedArr.sort((a, b) => a.name.localeCompare(b.name))
    participants.orderVector = indexedArr.map((value) => value.index)
  }

  sortSegments (data: DataType): DataType {
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

  mergeDuplicatedSegments (data: DataType): DataType {
    // must be sorted beforehand
    const noOfStimuli = data.segments.length
    const noOfParticipants = data.participants.data.length
    const fixationCategoryId = 0 // 0 in category slot stands for "Fixation" - merging only fixations

    // for logging how many merges were done
    // const info = {} // for creating table
    // let mergeCount = 0 // total count

    for (let stimulusId = 0; stimulusId < noOfStimuli; stimulusId++) {
      // logging info
      // const stimulName = const.stimuli.const[stimulusId][0]
      // info[stimulName] = {}

      for (let particId = 0; particId < noOfParticipants; particId++) {
        const segmentPart = data.segments[stimulusId][particId]

        // logging
        // const mergeCountBase = mergeCount

        // if defined, not null...
        if (segmentPart !== undefined) {
          let prevStart = null
          let prevEnd = null
          let segIdToJoin = null
          // go through every segment for given participant and stimulus
          for (let segmentId = 0; segmentId < segmentPart.length; segmentId++) {
            const currSegment = segmentPart[segmentId]
            // if fixation with identical start and end (than assuming, there are two AOIs to join))
            if (currSegment[0] === prevStart && currSegment[1] === prevEnd && currSegment[2] === fixationCategoryId && segIdToJoin !== null) {
              // //add AOI id to the previous one
              // //Control wheter the AOI is already in dataset
              const currentAoi = currSegment[3]
              const segmentToJoin = segmentPart[segIdToJoin]
              const aoiAlreadyIn = segmentToJoin.slice(3).includes(currentAoi)

              if (!aoiAlreadyIn && currentAoi !== undefined) {
                segmentToJoin.push(currentAoi)
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
      }
    }
    return data
  }
}
