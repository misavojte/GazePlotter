import type { DataEngine } from '../dataEngine.svelte'

/**
 * Checks if the data store contains valid, non-empty data.
 * @returns true if data contains valid content
 */
const getHasValidData = (engine: DataEngine): boolean => {
  return engine.hasValidData
}

const getNumberOfStimuli = (engine: DataEngine): number => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  return meta.stimuli.data.length
}

export const getNumberOfParticipants = (engine: DataEngine): number => {
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
const getAoiIdMapping = (
  engine: DataEngine,
  stimulusId: number,
  aoiId: number
): number => {
  return engine.getAoiMapping(stimulusId, aoiId)
}
