import type { ScarfGridType } from '$lib/type/gridType'
import {
  getDynamicAoiBoolean,
  getScarfGridHeightFromCurrentData,
} from './scarfServices'
import { hasStimulusAoiVisibility } from '$lib/stores/dataStore'

/**
 * Handles the selection changes for Scarf Plot select components
 * Calculates new grid height based on selection and updates settings
 *
 * @param settings Current scarf grid settings
 * @param changes Partial settings to update
 * @param callback Callback function to apply changes
 * @returns Updated settings
 */
export function handleScarfSelectionChange(
  settings: ScarfGridType,
  changes: Partial<ScarfGridType>,
  callback: (settings: Partial<ScarfGridType>) => void
): void {
  // Extract settings
  const {
    stimulusId = settings.stimulusId,
    groupId = settings.groupId,
    timeline = settings.timeline,
  } = changes

  // Calculate dynamic AOI state
  const isDynamicAoi = getDynamicAoiBoolean(
    timeline,
    settings.dynamicAOI,
    hasStimulusAoiVisibility(stimulusId)
  )

  // Calculate grid height based on updated settings
  const h = getScarfGridHeightFromCurrentData(stimulusId, isDynamicAoi, groupId)

  // Call the callback with updated settings including height
  callback({
    ...changes,
    h,
  })
}
