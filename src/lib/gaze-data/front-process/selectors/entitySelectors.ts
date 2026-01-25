import {
  type BaseInterpretedDataType,
  type ExtendedInterpretedDataType,
} from '$lib/gaze-data/shared/types'
import { getData } from './baseSelectors'

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
