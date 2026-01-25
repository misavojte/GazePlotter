import { engine } from '../stores/dataStore.svelte'

/**
 * Checks if the data store contains valid, non-empty data.
 * @returns true if data contains valid content
 */
export const getHasValidData = (): boolean => {
  return engine.hasValidData
}

export const getNumberOfStimuli = (): number => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  return meta.stimuli.data.length
}

export const getNumberOfParticipants = (): number => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  return meta.participants.data.length
}

/**
 * BACKWARD COMPATIBLE AOI ID MAPPING (Delegated to DataEngine)
 *
 * This function performs a direct, non-reactive memory read from the DataEngine
 * interpretation cache. Zero overhead.
 *
 * @param stimulusId - The numeric ID of the stimulus
 * @param aoiId - The original AOI ID
 * @returns The mapped (representative) AOI ID, or the original ID if no mapping exists
 */
export const getAoiIdMapping = (stimulusId: number, aoiId: number): number => {
  return engine.getAoiMapping(stimulusId, aoiId)
}
