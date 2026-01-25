import {
  type ParticipantsGroup,
  type BaseInterpretedDataType,
} from '$lib/gaze-data/shared/types'
import { engine } from '../stores/dataStore.svelte'
import {
  getParticipant,
  getAllParticipants,
  getParticipantOrderVector,
} from './entitySelectors'
import { getNumberOfSegments } from './segmentSelectors'

export const getNonEmptyParticipants = (
  stimulusId: number
): BaseInterpretedDataType[] => {
  const ids = getParticipantOrderVector()
  const result: BaseInterpretedDataType[] = []
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (getNumberOfSegments(stimulusId, id) > 0) {
      result.push(getParticipant(id))
    }
  }
  return result
}

export const getParticipantsGroups = (
  isDefault = false,
  stimulusId = 0
): ParticipantsGroup[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const result: ParticipantsGroup[] = []
  if (isDefault) {
    result.push({
      id: -1,
      name: 'All participants',
      participantsIds: getParticipantOrderVector(),
    })
    const nonEmpty = getNonEmptyParticipants(stimulusId)
    const nonEmptyIds = new Array(nonEmpty.length)
    for (let i = 0; i < nonEmpty.length; i++) {
      nonEmptyIds[i] = nonEmpty[i].id
    }
    result.push({
      id: -2,
      name: 'Non-empty',
      participantsIds: nonEmptyIds,
    })
  }

  const groups = meta.participantsGroups
  for (let i = 0; i < groups.length; i++) {
    result.push(groups[i])
  }
  return result
}

export const getParticipantsGroup = (groupId: number): ParticipantsGroup => {
  const groups = getParticipantsGroups()
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].id === groupId) return groups[i]
  }
  throw new Error(`Participants group with id ${groupId} does not exist`)
}

/**
 * Get all participants of given group ID.
 */
export const getParticipants = (
  groupId = -1,
  stimulusId = 0
): BaseInterpretedDataType[] => {
  if (groupId === -1) return getAllParticipants()
  if (groupId === -2) return getNonEmptyParticipants(stimulusId)

  const group = getParticipantsGroup(groupId)
  const ids = getParticipantOrderVector()
  const result: BaseInterpretedDataType[] = []
  const groupSet = new Set(group.participantsIds)

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (groupSet.has(id)) {
      result.push(getParticipant(id))
    }
  }
  return result
}

export const getParticipantsIds = (groupId = -1, stimulusId = 0): number[] => {
  if (groupId === -1) return getParticipantOrderVector()
  if (groupId === -2) {
    const nonEmpty = getNonEmptyParticipants(stimulusId)
    const result = new Array(nonEmpty.length)
    for (let i = 0; i < nonEmpty.length; i++) {
      result[i] = nonEmpty[i].id
    }
    return result
  }
  return getParticipantsGroup(groupId).participantsIds
}
