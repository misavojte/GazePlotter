import type { SelectionsAxis, WorkspaceCommand } from './types'

/**
 * Command Label Registry
 *
 * Provides human-readable labels for workspace commands based on their type
 * and history state (undo/redo/undefined).
 */

interface CommandLabels {
  /** Mid-sentence noun phrase; prefixed with "Undo"/"Redo" for history labels. */
  action: string
  /** Label for normal command execution (the success toast). */
  default: string
}

/** `noun` leads the toast; `sentenceNoun` sits mid-sentence in undo/redo. */
const selectionsLabels = (
  noun: string,
  sentenceNoun = noun.toLowerCase()
): CommandLabels => ({
  action: `${sentenceNoun} selections update`,
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
  updateAois: { action: 'AOI update', default: 'AOIs updated' },

  // Entity merge/update commands only ever run as children of `reconcileMerges`,
  // whose (root) label is what the toast and undo/redo tooltips show — these
  // never surface, so one generic entry per type suffices.
  updateEntities: { action: 'update', default: 'Updated' },

  updateEventData: { action: 'event data update', default: 'Event data updated' },

  updateEventChannels: {
    action: 'event channels update',
    default: 'Event channels updated',
  },

  updateNoAoiTreatment: {
    action: 'No AOI treatment update',
    default: 'No AOI treatment updated',
  },

  mergeEntities: { action: 'merge', default: 'Merged' },

  unmergeEntities: { action: 'un-merge', default: 'Un-merged' },

  reconcileMerges: { action: 'changes', default: 'Changes applied' },

  noop: { action: '', default: '' },

  updateCategories: {
    action: 'eye-movement types update',
    default: 'Eye-movement types updated',
  },

  updateMetricInstances: {
    action: 'metric library update',
    default: 'Metric library updated',
  },

  // Settings change command
  updateSettings: { action: 'plot update', default: 'Plot updated' },

  updateLayout: { action: 'layout update', default: 'Layout updated' },

  // Grid item management commands
  addGridItem: {
    action: 'plot addition',
    default: 'Added plot to the nearest empty space in the workspace',
  },

  removeGridItem: {
    action: 'plot removal',
    default: 'Removed plot from workspace',
  },

  duplicateGridItem: {
    action: 'plot duplication',
    default: 'Duplicated plot to the nearest empty space in the workspace',
  },

  setLayoutState: {
    action: 'layout reset',
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

  if (!history) return labels.default
  if (!labels.action) return ''
  return `${history === 'undo' ? 'Undo' : 'Redo'} ${labels.action}`
}
