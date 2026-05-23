import {
  type BaseInterpretedDataType,
  type ExtendedInterpretedDataType,
} from '$lib/data/types'
import type { DataEngine } from '../DataEngine.svelte'
import { getCategoryRaw } from '../utils/interpreters'

export const getStimuliOrderVector = (engine: DataEngine): number[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  const order = meta.stimuli.orderVector
  if (order.length === 0) {
    return Array.from({ length: meta.stimuli.data.length }, (_, i) => i)
  }
  return order
}

export const getStimulus = (
  engine: DataEngine,
  id: number
): BaseInterpretedDataType => {
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

export const getStimuli = (engine: DataEngine): BaseInterpretedDataType[] => {
  return getStimuliOrderVector(engine).map(id => getStimulus(engine, id))
}

export const getParticipantOrderVector = (engine: DataEngine): number[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  const order = meta.participants.orderVector
  if (order.length === 0) {
    return Array.from({ length: meta.participants.data.length }, (_, i) => i)
  }
  return order
}

export const getParticipant = (
  engine: DataEngine,
  id: number
): BaseInterpretedDataType => {
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

export const getAllParticipants = (
  engine: DataEngine
): BaseInterpretedDataType[] => {
  return getParticipantOrderVector(engine).map(id => getParticipant(engine, id))
}

export const getCategory = (
  engine: DataEngine,
  id: number
): ExtendedInterpretedDataType => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine not initialized')
  return getCategoryRaw(id, meta)
}
