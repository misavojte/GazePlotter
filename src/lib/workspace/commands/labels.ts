import type { SelectionsAxis, WorkspaceCommand } from './types'

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

/** `noun` leads the toast; `sentenceNoun` sits mid-sentence in undo/redo. */
const selectionsLabels = (
  noun: string,
  sentenceNoun = noun.toLowerCase()
): CommandLabels => ({
  undone: `Undo ${sentenceNoun} selections update`,
  redone: `Redo ${sentenceNoun} selections update`,
  default: `${noun} selections updated`,
})

const SELECTIONS_LABELS: Record<SelectionsAxis, CommandLabels> = {
  participant: selectionsLabels('Participant'),
  stimulus: selectionsLabels('Stimulus'),
  category: selectionsLabels('Eye-movement'),
  event: selectionsLabels('Event'),
  aoi: selectionsLabels('AOI', 'AOI'),
}

/**
 * Registry mapping workspace command types to their human-readable labels.
 * `updateSelections` labels are per-axis (SELECTIONS_LABELS above).
 */
const WORKSPACE_COMMAND_LABELS: Record<
  Exclude<WorkspaceCommand['type'], 'updateSelections'>,
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
 * Gets the appropriate label for a workspace command based on its type (and,
 * for `updateSelections`, its axis) and history state.
 */
export function getCommandLabel(
  command: WorkspaceCommand,
  history?: 'undo' | 'redo'
): string | null {
  const labels =
    command.type === 'updateSelections'
      ? SELECTIONS_LABELS[command.axis]
      : WORKSPACE_COMMAND_LABELS[command.type]

  if (history === 'undo') {
    return labels.undone
  } else if (history === 'redo') {
    return labels.redone
  } else {
    return labels.default
  }
}
