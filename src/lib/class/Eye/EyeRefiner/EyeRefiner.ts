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
  process(data: DataType): DataType {
    this.mergeDuplicatedSegments(this.sortSegments(data))
    this.orderAoisAlphabetically(data)
    this.orderParticipantsAlphabetically(data)
    return data
  }

  orderAoisAlphabetically(data: DataType): void {
    const aois = data.aois
    for (let i = 0; i < aois.data.length; i++) {
      const currentAoiArray = aois.data[i]
      const indexedArr = currentAoiArray.map((value, index) => ({
        index,
        name: value[0],
      }))
      indexedArr.sort((a, b) => a.name.localeCompare(b.name))
      aois.orderVector[i] = indexedArr.map(value => value.index)
    }
  }

  orderParticipantsAlphabetically(data: DataType): void {
    const participants = data.participants
    const indexedArr = participants.data.map((value, index) => ({
      index,
      name: value[0],
    }))
    indexedArr.sort((a, b) => a.name.localeCompare(b.name))
    participants.orderVector = indexedArr.map(value => value.index)
  }

  sortSegments(data: DataType): DataType {
    const noOfStimuli = data.segments.length
    const noOfParticipants = data.participants.data.length
    for (let stimulusId = 0; stimulusId < noOfStimuli; stimulusId++) {
      for (
        let participantId = 0;
        participantId < noOfParticipants;
        participantId++
      ) {
        const segmentPart = data.segments[stimulusId][participantId]
        if (segmentPart === undefined) continue
        segmentPart.sort(sortFn)
      }
    }
    // sort by start time in segment array (index 0)
    function sortFn(a: number[], b: number[]): number {
      return a[0] - b[0]
    }
    return data
  }

  mergeDuplicatedSegments(data: DataType): DataType {
    const hasCoords = data.hasCoordinates
    const noOfStimuli = data.segments.length
    const noOfParticipants = data.participants.data.length
    const fixationCategoryId = 0

    for (let stimulusId = 0; stimulusId < noOfStimuli; stimulusId++) {
      for (let particId = 0; particId < noOfParticipants; particId++) {
        const segmentPart = data.segments[stimulusId][particId]

        if (segmentPart !== undefined) {
          let prevStart = null
          let prevEnd = null
          let segIdToJoin = null

          for (let segmentId = 0; segmentId < segmentPart.length; segmentId++) {
            const currSegment = segmentPart[segmentId]
            if (
              currSegment[0] === prevStart &&
              currSegment[1] === prevEnd &&
              currSegment[2] === fixationCategoryId &&
              segIdToJoin !== null
            ) {
              // Only apply coordinate offset for fixations
              const coordOffset =
                hasCoords && currSegment[2] === fixationCategoryId ? 2 : 0
              const currentAoi = currSegment[3 + coordOffset]
              const segmentToJoin = segmentPart[segIdToJoin]
              const aoiAlreadyIn = segmentToJoin
                .slice(
                  3 +
                    (hasCoords && segmentToJoin[2] === fixationCategoryId
                      ? 2
                      : 0)
                )
                .includes(currentAoi)

              if (!aoiAlreadyIn && currentAoi !== undefined) {
                segmentToJoin.push(currentAoi)
              }

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
