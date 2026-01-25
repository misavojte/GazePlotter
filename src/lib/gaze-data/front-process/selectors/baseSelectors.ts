import {
  type DataType,
  DEFAULT_NO_AOI_TREATMENT,
} from '$lib/gaze-data/shared/types'
import { engine } from '../stores/dataStore.svelte'

/**
 * Checks if the data store contains valid, non-empty data.
 * @returns true if data contains valid content
 */
export const getHasValidData = (): boolean => {
  return engine.hasValidData
}

/**
 * Basic data access function.
 * Returns the engine state merged with binary segments.
 * @returns The current DataType snapshot
 */
export const getData = (): DataType => {
  if (!engine.metadata) {
    return {
      isOrdinalOnly: false,
      aois: {
        data: [],
        orderVector: [],
        dynamicVisibility: {},
        hiddenAois: [],
      },
      categories: { data: [], orderVector: [] },
      participants: { data: [], orderVector: [] },
      participantsGroups: [],
      stimuli: { data: [], orderVector: [] },
      segments: {
        segmentBuffer: new Float32Array(0),
        indexTable: new Uint32Array(0),
        aoiPool: new Uint16Array(0),
        maxParticipants: 0,
        stimuliCount: 0,
      },
      noAoiTreatment: DEFAULT_NO_AOI_TREATMENT,
    }
  }
  return { ...engine.metadata, segments: engine.segments! } as DataType
}

export const getNumberOfStimuli = (): number => {
  return getData().stimuli.data.length
}

export const getNumberOfParticipants = (): number => {
  return getData().participants.data.length
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
