import type { ScarfGridType } from '$lib/workspace/type/gridType'
import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'
import {
  getDynamicAoiBoolean,
  getScarfGridHeightFromCurrentData,
} from './scarfServices'
import { hasStimulusAoiVisibility } from '$lib/gaze-data/front-process/stores/dataStore'

/**
 * Handles the selection changes for Scarf Plot select components
 * Calculates new grid height based on selection and dispatches workspace command
 *
 * @param settings Current scarf grid settings
 * @param changes Partial settings to update
 * @param onWorkspaceCommand Callback function to dispatch workspace commands
 */
export function handleScarfSelectionChange(
  settings: ScarfGridType,
  changes: Partial<ScarfGridType>,
  source: string,
  onWorkspaceCommand: (command: WorkspaceCommand) => void
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

  // Dispatch workspace command with updated settings including height
  onWorkspaceCommand({
    type: 'updateSettings',
    itemId: settings.id,
    settings: {
      ...changes,
      h,
    },
    source,
  })
}
