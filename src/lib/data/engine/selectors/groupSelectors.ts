import {
  type ParticipantsGroup,
  type BaseInterpretedDataType,
} from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'
import {
  getParticipant,
  getAllParticipants,
  getParticipantOrderVector,
} from './entitySelectors'
import { getNumberOfSegments } from './segmentSelectors'

const getNonEmptyParticipants = (
  engine: DataEngine,
  stimulusId: number
): BaseInterpretedDataType[] => {
  return getParticipantOrderVector(engine)
    .filter(id => getNumberOfSegments(engine, stimulusId, id) > 0)
    .map(id => getParticipant(engine, id))
}

export const getParticipantsGroups = (
  engine: DataEngine,
  isDefault = false,
  stimulusId = 0
): ParticipantsGroup[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const defaultGroups: ParticipantsGroup[] = isDefault
    ? [
        {
          id: -1,
          name: 'All participants',
          participantsIds: getParticipantOrderVector(engine),
        },
        {
          id: -2,
          name: 'Non-empty',
          participantsIds: getNonEmptyParticipants(engine, stimulusId).map(p => p.id),
        },
      ]
    : []

  return [...defaultGroups, ...meta.participantsGroups]
}

const getParticipantsGroup = (
  engine: DataEngine,
  groupId: number
): ParticipantsGroup => {
  const group = getParticipantsGroups(engine).find(g => g.id === groupId)
  if (!group) {
    throw new Error(`Participants group with id ${groupId} does not exist`)
  }
  return group
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
  const groupSet = new Set(group.participantsIds)

  return getParticipantOrderVector(engine)
    .filter(id => groupSet.has(id))
    .map(id => getParticipant(engine, id))
}

export const getParticipantsIds = (
  engine: DataEngine,
  groupId = -1,
  stimulusId = 0
): number[] => {
  if (groupId === -1) return getParticipantOrderVector(engine)
  if (groupId === -2) {
    return getNonEmptyParticipants(engine, stimulusId).map(p => p.id)
  }
  return getParticipantsGroup(engine, groupId).participantsIds
}

