import {
  type ParticipantsGroup,
  type BaseInterpretedDataType,
} from '$lib/gaze-data/shared/types'
import { getData } from './baseSelectors'
import {
  getParticipant,
  getAllParticipants,
  getParticipantOrderVector,
} from './entitySelectors'
import { getNumberOfSegments } from './segmentSelectors'

export const getNonEmptyParticipants = (
  stimulusId: number
): BaseInterpretedDataType[] => {
  const participantsIds = getParticipantOrderVector()
  const nonEmptyParticipantsIds = participantsIds.filter(
    (participantId: number) =>
      getNumberOfSegments(stimulusId, participantId) > 0
  )
  return nonEmptyParticipantsIds.map((participantId: number) =>
    getParticipant(participantId)
  )
}

export const getParticipantsGroups = (
  isDefault = false,
  stimulusId = 0
): ParticipantsGroup[] => {
  const defaultGroups: ParticipantsGroup[] = []
  if (isDefault) {
    defaultGroups.push({
      id: -1,
      name: 'All participants',
      participantsIds: getParticipantOrderVector(),
    })
    defaultGroups.push({
      id: -2,
      name: 'Non-empty',
      participantsIds: getNonEmptyParticipants(stimulusId).map(
        participant => participant.id
      ),
    })
  }
  return [...defaultGroups, ...getData().participantsGroups]
}

export const getParticipantsGroup = (groupId: number): ParticipantsGroup => {
  const group = getParticipantsGroups().find(group => group.id === groupId)
  if (group === undefined) {
    throw new Error(`Participants group with id ${groupId} does not exist`)
  }
  return group
}

/**
 * Get all participants of given group ID.
 */
export const getParticipants = (
  groupId = -1,
  stimulusId = 0
): BaseInterpretedDataType[] => {
  if (groupId === -1) {
    return getAllParticipants()
  }
  if (groupId === -2) {
    return getNonEmptyParticipants(stimulusId)
  }
  const group = getParticipantsGroup(groupId)
  const participantsIds = getParticipantOrderVector()
  const groupParticipantsIds = participantsIds.filter((participantId: number) =>
    group.participantsIds.includes(participantId)
  )
  return groupParticipantsIds.map((participantId: number) =>
    getParticipant(participantId)
  )
}

export const getParticipantsIds = (groupId = -1, stimulusId = 0): number[] => {
  if (groupId === -1) {
    return getParticipantOrderVector()
  }
  if (groupId === -2) {
    return getNonEmptyParticipants(stimulusId).map(
      participant => participant.id
    )
  }
  return getParticipantsGroup(groupId).participantsIds
}
