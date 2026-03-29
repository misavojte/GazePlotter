import {
  type ParticipantsGroup,
  type BaseInterpretedDataType,
} from '$lib/data/types'
import type { DataEngine } from '../DataEngine.svelte'
import {
  getParticipant,
  getAllParticipants,
  getParticipantOrderVector,
} from './entitySelectors'
import { getNumberOfSegments } from './segmentSelectors'

export const getNonEmptyParticipants = (
  engine: DataEngine,
  stimulusId: number
): BaseInterpretedDataType[] => {
  const ids = getParticipantOrderVector(engine)
  const result: BaseInterpretedDataType[] = []
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (getNumberOfSegments(engine, stimulusId, id) > 0) {
      result.push(getParticipant(engine, id))
    }
  }
  return result
}

export const getParticipantsGroups = (
  engine: DataEngine,
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
      participantsIds: getParticipantOrderVector(engine),
    })
    const nonEmpty = getNonEmptyParticipants(engine, stimulusId)
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

export const getParticipantsGroup = (
  engine: DataEngine,
  groupId: number
): ParticipantsGroup => {
  const groups = getParticipantsGroups(engine)
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].id === groupId) return groups[i]
  }
  throw new Error(`Participants group with id ${groupId} does not exist`)
}

/**
 * Get all participants of given group ID.
 */
export const getParticipants = (
  engine: DataEngine,
  groupId = -1,
  stimulusId = 0
): BaseInterpretedDataType[] => {
  if (groupId === -1) return getAllParticipants(engine)
  if (groupId === -2) return getNonEmptyParticipants(engine, stimulusId)

  const group = getParticipantsGroup(engine, groupId)
  const ids = getParticipantOrderVector(engine)
  const result: BaseInterpretedDataType[] = []
  const groupSet = new Set(group.participantsIds)

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (groupSet.has(id)) {
      result.push(getParticipant(engine, id))
    }
  }
  return result
}

export const getParticipantsIds = (
  engine: DataEngine,
  groupId = -1,
  stimulusId = 0
): number[] => {
  if (groupId === -1) return getParticipantOrderVector(engine)
  if (groupId === -2) {
    const nonEmpty = getNonEmptyParticipants(engine, stimulusId)
    const result = new Array(nonEmpty.length)
    for (let i = 0; i < nonEmpty.length; i++) {
      result[i] = nonEmpty[i].id
    }
    return result
  }
  return getParticipantsGroup(engine, groupId).participantsIds
}
