import type { WorkspaceCommand } from '$lib/workspace/commands'

/**
 * Command Label Registry
 *
 * Provides human-readable labels for workspace commands based on their type
 * and history state (undo/redo/undefined).
 */

export interface CommandLabels {
  /** Label for when this command is being undone */
  undone: string
  /** Label for when this command is being redone */
  redone: string
  /** Label for normal command execution */
  default: string
}

/**
 * Registry mapping workspace command types to their human-readable labels.
 */
export const WORKSPACE_COMMAND_LABELS: Record<
  WorkspaceCommand['type'],
  CommandLabels
> = {
  // Data change commands
  updateAois: {
    undone: 'Undo AOI update',
    redone: 'Redo AOI update',
    default: 'AOIs updated',
  },

  updateParticipants: {
    undone: 'Undo participant update',
    redone: 'Redo participant update',
    default: 'Participants updated',
  },

  updateStimuli: {
    undone: 'Undo stimulus update',
    redone: 'Redo stimulus update',
    default: 'Stimuli updated',
  },

  updateEventData: {
    undone: 'Undo event data update',
    redone: 'Redo event data update',
    default: 'Event data updated',
  },

  updateEventChannels: {
    undone: 'Undo event channels update',
    redone: 'Redo event channels update',
    default: 'Event channels updated',
  },

  updateParticipantsGroups: {
    undone: 'Undo participant groups update',
    redone: 'Redo participant groups update',
    default: 'Participant groups updated',
  },

  updateNoAoiTreatment: {
    undone: 'Undo No AOI treatment update',
    redone: 'Redo No AOI treatment update',
    default: 'No AOI treatment updated',
  },

  updateCategories: {
    undone: 'Undo eye-movement types update',
    redone: 'Redo eye-movement types update',
    default: 'Eye-movement types updated',
  },

  // Settings change command
  updateSettings: {
    undone: 'Undo plot update',
    redone: 'Redo plot update',
    default: 'Plot updated',
  },

  updateLayout: {
    undone: 'Undo layout update',
    redone: 'Redo layout update',
    default: 'Layout updated',
  },

  // Grid item management commands
  addGridItem: {
    undone: 'Undo plot addition',
    redone: 'Redo plot addition',
    default: 'Added plot to the nearest empty space in the workspace',
  },

  removeGridItem: {
    undone: 'Undo plot removal',
    redone: 'Redo plot removal',
    default: 'Removed plot from workspace',
  },

  duplicateGridItem: {
    undone: 'Undo plot duplication',
    redone: 'Redo plot duplication',
    default: 'Duplicated plot to the nearest empty space in the workspace',
  },

  setLayoutState: {
    undone: 'Undo layout reset',
    redone: 'Redo layout reset',
    default: 'Workspace layout returned to the initial state',
  },
}

/**
 * Gets the appropriate label for a workspace command based on its type and history state.
 */
export function getCommandLabel(
  commandType: WorkspaceCommand['type'],
  history?: 'undo' | 'redo'
): string | null {
  const labels = WORKSPACE_COMMAND_LABELS[commandType]

  if (history === 'undo') {
    return labels.undone
  } else if (history === 'redo') {
    return labels.redone
  } else {
    return labels.default
  }
}
