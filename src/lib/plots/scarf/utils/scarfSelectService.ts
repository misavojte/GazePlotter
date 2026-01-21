import type { ScarfGridType } from '$lib/workspace/type/gridType'
import type { WorkspaceCommand } from '$lib/workspace/commands'
import { getDynamicAoiBoolean } from './scarfServices'
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

  // Dispatch workspace command with updated settings (height is now independent)
  onWorkspaceCommand({
    type: 'updateSettings',
    itemId: settings.id,
    settings: {
      ...changes,
    },
    source,
  })
}
