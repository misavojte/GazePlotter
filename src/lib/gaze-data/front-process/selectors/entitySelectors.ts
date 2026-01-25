import {
  type BaseInterpretedDataType,
  type ExtendedInterpretedDataType,
} from '$lib/gaze-data/shared/types'
import { engine } from '../stores/dataStore.svelte'
import { getCategoryRaw } from '../utils/interpreters'

export const getStimuliOrderVector = (): number[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  const order = meta.stimuli.orderVector
  if (order.length === 0) {
    return Array.from({ length: meta.stimuli.data.length }, (_, i) => i)
  }
  return order
}

export const getStimulus = (id: number): BaseInterpretedDataType => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  const stimulusArray = meta.stimuli.data[id]
  if (!stimulusArray) throw new Error('Stimulus with this id does not exist')

  const originalName = stimulusArray[0]
  return {
    id,
    originalName,
    displayedName: stimulusArray[1] ?? originalName,
  }
}

export const getStimuli = (): BaseInterpretedDataType[] => {
  const ids = getStimuliOrderVector()
  const result = new Array(ids.length)
  for (let i = 0; i < ids.length; i++) {
    result[i] = getStimulus(ids[i])
  }
  return result
}

export const getParticipantOrderVector = (): number[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  const order = meta.participants.orderVector
  if (order.length === 0) {
    return Array.from({ length: meta.participants.data.length }, (_, i) => i)
  }
  return order
}

export const getParticipant = (id: number): BaseInterpretedDataType => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  const participantArray = meta.participants.data[id]
  if (!participantArray)
    throw new Error('Participant with this id does not exist')

  const originalName = participantArray[0]
  return {
    id,
    displayedName: participantArray[1] ?? originalName,
    originalName,
  }
}

export const getAllParticipants = (): BaseInterpretedDataType[] => {
  const ids = getParticipantOrderVector()
  const result = new Array(ids.length)
  for (let i = 0; i < ids.length; i++) {
    result[i] = getParticipant(ids[i])
  }
  return result
}

export const getCategory = (id: number): ExtendedInterpretedDataType => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine not initialized')
  return getCategoryRaw(id, meta)
}
