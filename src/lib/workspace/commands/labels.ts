import type { WorkspaceCommand } from './types'

/**
 * Command Label Registry
 *
 * Provides human-readable labels for workspace commands based on their type
 * and history state (undo/redo/undefined).
 */

interface CommandLabels {
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
const WORKSPACE_COMMAND_LABELS: Record<
  WorkspaceCommand['type'],
  CommandLabels
> = {
  // Data change commands
  updateAois: {
    undone: 'Undo AOI update',
    redone: 'Redo AOI update',
    default: 'AOIs updated',
  },

  // Entity merge/update commands only ever run as children of `reconcileMerges`,
  // whose (root) label is what the toast and undo/redo tooltips show — these
  // never surface, so one generic entry per type suffices.
  updateEntities: {
    undone: 'Undo update',
    redone: 'Redo update',
    default: 'Updated',
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

  updateParticipantsSelections: {
    undone: 'Undo participant selections update',
    redone: 'Redo participant selections update',
    default: 'Participant selections updated',
  },

  updateStimuliSelections: {
    undone: 'Undo stimulus selections update',
    redone: 'Redo stimulus selections update',
    default: 'Stimulus selections updated',
  },

  updateCategoriesSelections: {
    undone: 'Undo eye-movement selections update',
    redone: 'Redo eye-movement selections update',
    default: 'Eye-movement selections updated',
  },

  updateEventsSelections: {
    undone: 'Undo event selections update',
    redone: 'Redo event selections update',
    default: 'Event selections updated',
  },

  updateAoiSelections: {
    undone: 'Undo AOI selections update',
    redone: 'Redo AOI selections update',
    default: 'AOI selections updated',
  },

  updateNoAoiTreatment: {
    undone: 'Undo No AOI treatment update',
    redone: 'Redo No AOI treatment update',
    default: 'No AOI treatment updated',
  },

  mergeEntities: {
    undone: 'Undo merge',
    redone: 'Redo merge',
    default: 'Merged',
  },

  unmergeEntities: {
    undone: 'Undo un-merge',
    redone: 'Redo un-merge',
    default: 'Un-merged',
  },

  reconcileMerges: {
    undone: 'Undo changes',
    redone: 'Redo changes',
    default: 'Changes applied',
  },

  noop: {
    undone: '',
    redone: '',
    default: '',
  },

  updateCategories: {
    undone: 'Undo eye-movement types update',
    redone: 'Redo eye-movement types update',
    default: 'Eye-movement types updated',
  },

  updateMetricInstances: {
    undone: 'Undo metric library update',
    redone: 'Redo metric library update',
    default: 'Metric library updated',
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
