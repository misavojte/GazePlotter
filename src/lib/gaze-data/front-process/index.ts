export * from './selectors'
export {
  engine,
  setData,
  updateParticipantsGroups,
  updateMultipleAoiVisibility,
  updateHiddenAois,
  updateHiddenAoisWithPropagation,
  updateMultipleAoi,
  updateMultipleParticipants,
  updateMultipleStimuli,
  updateNoAoiTreatment,
} from './stores/dataStore.svelte'
export { EyeWorkerService } from './class/EyeWorkerService'
export {
  processAndValidateData,
  processJsonFile,
  processJsonFileWithGrid,
} from './utils/jsonParsing'

// Types are re-exported from shared/types, but some are defined here as well
export type { JsonProcessingResult } from './utils/jsonParsing'
