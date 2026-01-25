import {
  type DataType,
  type BaseInterpretedDataType,
  type ExtendedInterpretedDataType,
} from '$lib/gaze-data/shared/types'
import { getData } from './baseSelectors'

// --- Internal Helpers ---

const getDefaultColor = (index: number): string => {
  const COLORS = ['#66c5cc', '#f6cf71', '#f89c74', '#dcb0f2', '#87c55f']
  return COLORS[index % COLORS.length]
}

const getAoiOrderVectorFromData = (
  stimulusId: number,
  dataSnapshot: DataType
): number[] => {
  const order = dataSnapshot.aois.orderVector?.[stimulusId]
  if (order == null) {
    const noOfAois = dataSnapshot.aois.data[stimulusId]?.length ?? 0
    return [...Array(noOfAois).keys()]
  }
  return order
}

const getAoiRaw = (
  stimulusId: number,
  aoiId: number,
  dataSnapshot: DataType
): ExtendedInterpretedDataType => {
  const aoiArray = dataSnapshot.aois.data[stimulusId][aoiId]
  if (aoiArray === undefined)
    throw new Error(
      `AOI with id ${aoiId} does not exist in stimulus with id ${stimulusId}`
    )
  const originalName = aoiArray[0]
  const displayedName = aoiArray[1] ?? originalName
  const color = aoiArray[2] ?? getDefaultColor(aoiId)

  return {
    id: aoiId,
    originalName,
    displayedName,
    color,
  }
}

/**
 * Get all AOIs for a stimulus from a data snapshot
 */
export const getAoisRawFromData = (
  stimulusId: number,
  dataSnapshot: DataType
): ExtendedInterpretedDataType[] => {
  const aoiIds = getAoiOrderVectorFromData(stimulusId, dataSnapshot)
  return aoiIds.map((aoiId: number) =>
    getAoiRaw(stimulusId, aoiId, dataSnapshot)
  )
}

// --- Public Selectors ---

export const getStimuliOrderVector = (): number[] => {
  const order = getData().stimuli.orderVector
  if (order.length === 0) {
    const noOfStimuli = getData().stimuli.data.length
    return [...Array(noOfStimuli).keys()]
  }
  return order
}

export const getStimulus = (id: number): BaseInterpretedDataType => {
  const stimulusArray = getData().stimuli.data[id]
  if (stimulusArray === undefined)
    throw new Error('Stimulus with this id does not exist')
  const originalName = stimulusArray[0]
  const displayedName = stimulusArray[1] ?? originalName
  return {
    id,
    originalName,
    displayedName,
  }
}

export const getStimuli = (): BaseInterpretedDataType[] => {
  const stimuliIds = getStimuliOrderVector()
  return stimuliIds.map((stimulusId: number) => getStimulus(stimulusId))
}

export const getParticipantOrderVector = (): number[] => {
  const order = getData().participants.orderVector
  if (order.length === 0) {
    const noOfParticipants = getData().participants.data.length
    return [...Array(noOfParticipants).keys()]
  }
  return order
}

export const getParticipant = (id: number): BaseInterpretedDataType => {
  const participantArray = getData().participants.data[id]
  if (participantArray === undefined)
    throw new Error('Participant with this id does not exist')
  const originalName = participantArray[0]
  const displayedName = participantArray[1] ?? originalName
  return {
    id,
    displayedName,
    originalName,
  }
}

export const getAllParticipants = (): BaseInterpretedDataType[] => {
  const participantsIds = getParticipantOrderVector()
  return participantsIds.map((participantId: number) =>
    getParticipant(participantId)
  )
}

export const getAoiOrderVector = (stimulusId: number): number[] => {
  return getAoiOrderVectorFromData(stimulusId, getData())
}

export const getHiddenAois = (stimulusId: number): number[] => {
  return getData().aois.hiddenAois?.[stimulusId] ?? []
}

export const getAllAois = (
  stimulusId: number
): ExtendedInterpretedDataType[] => {
  const aoiIds = getAoiOrderVector(stimulusId)
  const data = getData()
  return aoiIds.map((aoiId: number) => {
    const aoi = getAoiRaw(stimulusId, aoiId, data)
    return {
      id: aoi.id,
      originalName: aoi.originalName,
      displayedName: aoi.displayedName,
      color: aoi.color,
    }
  })
}

import { getAoiIdMapping } from './baseSelectors'

export const getAois = (stimulusId: number): ExtendedInterpretedDataType[] => {
  const aoiIds = getAoiOrderVector(stimulusId)
  const hidden = getHiddenAois(stimulusId)
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null
  const visibleAoiIds = hiddenSet
    ? aoiIds.filter(aoiId => !hiddenSet.has(aoiId))
    : aoiIds

  const mappedAoiIds = [
    ...new Set(visibleAoiIds.map(aoiId => getAoiIdMapping(stimulusId, aoiId))),
  ]

  const data = getData()
  return mappedAoiIds.map((aoiId: number) => getAoiRaw(stimulusId, aoiId, data))
}

export const getAoi = (
  stimulusId: number,
  aoiId: number
): ExtendedInterpretedDataType => {
  const mappedAoiId = getAoiIdMapping(stimulusId, aoiId)
  return getAoiRaw(stimulusId, mappedAoiId, getData())
}

export const getCategory = (id: number): ExtendedInterpretedDataType => {
  const categoryArray = getData().categories.data[id]
  if (categoryArray === undefined)
    throw new Error(`Category with id ${id} does not exist`)
  const originalName = categoryArray[0]
  const displayedName = categoryArray[1] ?? originalName
  const color = categoryArray[2] ?? '#626262'
  return {
    id,
    originalName,
    displayedName,
    color,
  }
}
