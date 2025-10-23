import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'

/**
 * Command Label Registry
 * 
 * Provides human-readable labels for workspace commands based on their type
 * and history state (undo/redo/undefined). Each command type has three label variants:
 * - undone: Past tense for undo operations
 * - redone: Past tense for redo operations  
 * - default: Present/past tense for normal operations
 */

export interface CommandLabels {
  /** Label for when this command is being undone */
  undone: string
  /** Label for when this command is being redone */
  redone: string
  /** Label for normal command execution (null means no message should be shown) */
  default: string | null
}

/**
 * Registry mapping workspace command types to their human-readable labels.
 * Each command type has three label variants for different history states.
 */
export const WORKSPACE_COMMAND_LABELS: Record<WorkspaceCommand['type'], CommandLabels> = {
  // Data change commands
  updateAois: {
    undone: 'Undo AOI update',
    redone: 'Redo AOI update',
    default: 'AOIs updated'
  },
  
  updateParticipants: {
    undone: 'Undo participant update',
    redone: 'Redo participant update',
    default: 'Participants updated'
  },
  
  updateStimuli: {
    undone: 'Undo stimulus update',
    redone: 'Redo stimulus update',
    default: 'Stimuli updated'
  },
  
  updateAoiVisibility: {
    undone: 'Undo AOI visibility update',
    redone: 'Redo AOI visibility update',
    default: 'AOI visibility updated'
  },
  
  updateParticipantsGroups: {
    undone: 'Undo participant groups update',
    redone: 'Redo participant groups update',
    default: 'Participant groups updated'
  },
  
  // Settings change command
  updateSettings: {
    undone: 'Undo plot update',
    redone: 'Redo plot update',
    default: null // No message for settings updates as they would annoy users with frequent notifications
  },
  
  // Grid item management commands
  addGridItem: {
    undone: 'Undo plot addition',
    redone: 'Redo plot addition',
    default: 'Added plot to the nearest empty space in the workspace'
  },
  
  removeGridItem: {
    undone: 'Undo plot removal',
    redone: 'Redo plot removal',
    default: 'Removed plot from workspace'
  },
  
  duplicateGridItem: {
    undone: 'Undo plot duplication',
    redone: 'Redo plot duplication',
    default: 'Duplicated plot to the nearest empty space in the workspace'
  }
}

/**
 * Gets the appropriate label for a workspace command based on its type and history state.
 * 
 * @param commandType - The type of the workspace command
 * @param history - The history state ('undo', 'redo', or undefined)
 * @returns The appropriate human-readable label, or null if no message should be shown
 * 
 * @example
 * ```typescript
 * getCommandLabel('removeGridItem', 'undo') // Returns: 'Undo plot removal'
 * getCommandLabel('addGridItem', 'redo')    // Returns: 'Redo plot addition'
 * getCommandLabel('updateSettings', undefined) // Returns: null (no message)
 * ```
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
