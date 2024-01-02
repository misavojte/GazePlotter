import { writable, get } from 'svelte/store'
import type { Writable } from 'svelte/store'
import type { DataType } from '$lib/type/Data/DataType.ts'
import { demoData } from '$lib/const/demoData.ts'
import type { BaseInterpretedDataType } from '$lib/type/Data/InterpretedData/BaseInterpretedDataType.ts'
import type { ExtendedInterpretedDataType } from '$lib/type/Data/InterpretedData/ExtendedInterpretedDataType.ts'
import type { SegmentInterpretedDataType } from '$lib/type/Data/InterpretedData/SegmentInterpretedDataType.ts'

export const getDemoDataWritable = (): Writable<DataType> => {
  return writable<DataType>(demoData)
}
export const data = getDemoDataWritable()

export const setData = (newData: DataType): void => {
  data.set(newData)
}

export const getData = (): DataType => {
  return get(data)
}

export const getNumberOfStimuli = (): number => {
  return getData().stimuli.data.length
}

export const getNumberOfParticipants = (): number => {
  return getData().participants.data.length
}

/**
 * Returns the stimulus with the given id
 * @param id - id of the stimulus
 * @returns BaseInterpretedDataType
 * @throws Error if stimulus with given id does not exist
 */
export const getStimulus = (id: number): BaseInterpretedDataType => {
  const stimulusArray = getData().stimuli.data[id]
  if (stimulusArray === undefined) throw new Error('Stimulus with this id does not exist')
  const originalName = stimulusArray[0]
  const displayedName = stimulusArray[1] ?? originalName
  return {
    id,
    originalName,
    displayedName
  }
}

export const getStimulusHighestEndTime = (stimulusIndex: number): number => {
  let max = 0
  for (let participantIndex = 0; participantIndex < getNumberOfParticipants(); participantIndex++) {
    const lastSegmentEndTime = getParticipantEndTime(stimulusIndex, participantIndex)
    max = lastSegmentEndTime > max ? max = lastSegmentEndTime : max
  }
  return max
}

export const getParticipantEndTime = (stimulusIndex: number, particIndex: number): number => {
  const segmentsInfo = getData().segments[stimulusIndex][particIndex]
  return segmentsInfo === undefined ? 0 : segmentsInfo.length > 0 ? segmentsInfo[segmentsInfo.length - 1][1] : 0
}

export const getParticipant = (id: number): BaseInterpretedDataType => {
  const participantArray = getData().participants.data[id]
  if (participantArray === undefined) throw new Error('Participant with this id does not exist')
  const originalName = participantArray[0]
  const displayedName = participantArray[1] ?? originalName
  return {
    id,
    displayedName,
    originalName
  }
}

const getDefaultColor = (index: number): string => {
  const COLORS = ['#66c5cc', '#f6cf71', '#f89c74', '#dcb0f2', '#87c55f']
  return COLORS[index % COLORS.length]
}

export const getAoi = (stimulusId: number, aoiId: number): ExtendedInterpretedDataType => {
  const aoiArray = getData().aois.data[stimulusId][aoiId]
  if (aoiArray === undefined) throw new Error(`AOI with id ${aoiId} does not exist in stimulus with id ${stimulusId}`)
  const originalName = aoiArray[0]
  const displayedName = aoiArray[1] ?? originalName
  const color = aoiArray[2] ?? getDefaultColor(aoiId)
  return {
    id: aoiId,
    originalName,
    displayedName,
    color
  }
}

export const getCategory = (id: number): ExtendedInterpretedDataType => {
  const categoryArray = getData().categories.data[id]
  if (categoryArray === undefined) throw new Error(`Category with id ${id} does not exist`)
  const originalName = categoryArray[0]
  const displayedName = categoryArray[1] ?? originalName
  const color = categoryArray[2] ?? '#626262'
  return {
    id,
    originalName,
    displayedName,
    color
  }
}

export const getSegment = (stimulusId: number, participantId: number, id: number): SegmentInterpretedDataType => {
  const segmentArray = getData().segments[stimulusId][participantId][id]
  if (segmentArray === undefined) throw new Error(`Segment with id ${id} does not exist in stimulus with id ${stimulusId} and participant with id ${participantId}`)
  const start = segmentArray[0]
  const end = segmentArray[1]
  const aoiIds = getSortedAoiIdsByOrderVector(stimulusId, segmentArray.slice(3))
  const aoi = aoiIds.map((aoiId: number) => getAoi(stimulusId, aoiId))
  const categoryId = segmentArray[2]
  const category = getCategory(categoryId)
  return {
    id,
    start,
    end,
    aoi,
    category
  }
}

/**
 * Returns given array of aoi ids sorted by its order vector.
 * @param stimulusId - id of the stimulus as AOIs are stimulus specific (thus, order vectors too)
 * @param aoiIds - array of aoi ids to be sorted
 */
const getSortedAoiIdsByOrderVector = (stimulusId: number, aoiIds: number[]): number[] => {
  const orderVector = getAoiOrderVector(stimulusId)
  return aoiIds.sort((a, b) => orderVector.indexOf(a) - orderVector.indexOf(b))
}

export const getNumberOfSegments = (stimulusId: number, participantId: number): number => {
  return getData().segments[stimulusId][participantId]?.length ?? 0
}

export const getAoiOrderVector = (stimulusId: number): number[] => {
  const order = getData().aois.orderVector?.[stimulusId]
  // if it does not exist in const, return array of sequence from 0 to N
  // N ... number of aoi categories for given stimulus
  if (order == null) {
    const noOfAois = getData().aois.data[stimulusId].length
    return [...Array(noOfAois).keys()]
  }
  return order
}

export const getStimuliOrderVector = (): number[] => {
  const order = getData().stimuli.orderVector
  // if it does not exist in const, return array of sequence from 0 to N
  // N ... number of aoi categories for given stimulus
  if (order.length === 0) {
    const noOfStimuli = getData().stimuli.data.length
    return [...Array(noOfStimuli).keys()]
  }
  return order
}

export const getParticipantOrderVector = (): number[] => {
  const order = getData().participants.orderVector
  // if it does not exist in const, return array of sequence from 0 to N
  // N ... number of aoi categories for given stimulus
  if (order.length === 0) {
    const noOfParticipants = getData().participants.data.length
    return [...Array(noOfParticipants).keys()]
  }
  return order
}

export const getAois = (stimulusId: number): ExtendedInterpretedDataType[] => {
  const aoiIds = getAoiOrderVector(stimulusId)
  return aoiIds.map((aoiId: number) => getAoi(stimulusId, aoiId))
}

export const getStimuli = (): BaseInterpretedDataType[] => {
  const stimuliIds = getStimuliOrderVector()
  return stimuliIds.map((stimulusId: number) => getStimulus(stimulusId))
}

export const getParticipants = (): BaseInterpretedDataType[] => {
  const participantsIds = getParticipantOrderVector()
  return participantsIds.map((participantId: number) => getParticipant(participantId))
}

export const getAoiVisibility = (stimulusId: number, aoiId: number, participantId: number | null = null): number[] | null => {
  const baseKey = `${stimulusId}_${aoiId}`
  let result = getData().aois.dynamicVisibility[baseKey] ?? null
  if (participantId != null) {
    const extendedKey = `${baseKey}_${participantId}`
    result = getData().aois.dynamicVisibility[extendedKey] ?? result
  }
  console.log(getData().aois)
  return result
}

export const updateMultipleAoiVisibility = (
  stimulusId: number,
  aoiNames: string[],
  visibilityArr: number[][],
  participantId: number | null = null
): void => {
  data.update(currentData => {
    const aoiData = currentData.aois.data[stimulusId]
    if (aoiData === undefined) {
      console.error(`No AOI data found for stimulusId: ${stimulusId}`)
      return currentData // No update if no AOI data found
    }

    aoiNames.forEach((aoiName, index) => {
      const aoiId = aoiData.findIndex(el => el[0] === aoiName)
      if (aoiId === -1) {
        console.warn(`AOI with name ${aoiName} not found for stimulusId: ${stimulusId}`)
        return // Continue to next AOI name if current one not found
      }

      let key = `${stimulusId}_${aoiId}`
      if (participantId != null) {
        key += `_${participantId}`
      }

      currentData.aois.dynamicVisibility[key] = visibilityArr[index]
    })

    return currentData
  })
}

export const updateMultipleAoi = (aoi: ExtendedInterpretedDataType[], stimulusId: number, applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'): void => {
  data.update((data) => {
    if (data.aois.data[stimulusId] === undefined) {
      throw new Error(`Stimulus with id ${stimulusId} does not exist in AOIs data`)
    }
    if (aoi.length !== data.aois.data[stimulusId].length) {
      throw new Error(`Number of AOIs in stimulus with id ${stimulusId} does not match number of AOIs in given array`)
    }
    aoi.forEach((aoi) => {
      const aoiArray = [aoi.originalName, aoi.displayedName, aoi.color]
      if (data.aois.data[stimulusId][aoi.id] === undefined) {
        throw new Error(`AOI with id ${aoi.id} does not exist in stimulus with id ${stimulusId}`)
      }
      data.aois.data[stimulusId][aoi.id] = aoiArray
    })
    if (applyTo === 'all_by_original_name') {
      const originalNames = aoi.map((aoi) => aoi.originalName)
      const displayedNames = aoi.map((aoi) => aoi.displayedName)
      const colors = aoi.map((aoi) => aoi.color)
      const noOfStimuli = data.stimuli.data.length
      for (let stimulusId = 0; stimulusId < noOfStimuli; stimulusId++) {
        const aois = data.aois.data[stimulusId]
        for (const aoi of aois) {
          if (aoi === undefined) continue
          const originalName = aoi[0]
          if (originalNames.includes(originalName)) {
            const index = originalNames.indexOf(originalName)
            aoi[1] = displayedNames[index]
            aoi[2] = colors[index]
          }
        }
      }
    }
    if (applyTo === 'all_by_displayed_name') {
      const displayedNames = aoi.map((aoi) => aoi.displayedName)
      const colors = aoi.map((aoi) => aoi.color)
      const noOfStimuli = data.stimuli.data.length
      for (let stimulusId = 0; stimulusId < noOfStimuli; stimulusId++) {
        const aois = data.aois.data[stimulusId]
        for (const aoi of aois) {
          if (aoi === undefined) continue
          const displayedName = aoi[1]
          if (displayedNames.includes(displayedName)) {
            const index = displayedNames.indexOf(displayedName)
            aoi[1] = displayedNames[index]
            aoi[2] = colors[index]
          }
        }
      }
    }
    return data
  })
}
