import type {
  ExtendedInterpretedDataType,
  BaseInterpretedDataType,
  ParticipantsGroup,
} from '$lib/data/types'
import type {
  AllPlotSettings,
  GridItemLayoutUpdate,
  GridItemSnapshot,
} from '$lib/workspace'

/**
 * Workspace Command System
 *
 * Centralized command types for all workspace changes.
 * All data and settings modifications go through these commands
 * to ensure proper tracking and automatic redraw propagation.
 *
 * Simplified structure without nested payload - TypeScript ensures type safety
 * through discriminated unions based on the 'type' field.
 */

interface BaseCommandInterface {
  type: string
  source: string // this has specific pattern! 'scarfPlot.IDOFPLOT.PLACEOFTRIGGER' and for undo the same 'undo.scarfPlot.IDOFPLOT.PLACEOFTRIGGER'
}

// Data change commands
export interface UpdateAoisCommand extends BaseCommandInterface {
  type: 'updateAois'
  aois: ExtendedInterpretedDataType[]
  stimulusId: number
  applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'
  /** Optional raw AOI ids to hide for this stimulus (treated as inactive). */
  hiddenAois?: number[]
}

export interface UpdateParticipantsCommand extends BaseCommandInterface {
  type: 'updateParticipants'
  participants: BaseInterpretedDataType[]
}

export interface UpdateStimuliCommand extends BaseCommandInterface {
  type: 'updateStimuli'
  stimuli: BaseInterpretedDataType[]
}

export interface UpdateEventDataCommand extends BaseCommandInterface {
  type: 'updateEventData'
  stimulusId: number
  channelDefs: string[][]
  eventBuffers: number[][][]
  /** Hidden ids valid for the NEW channel indexing (omit to clear: the
      engine resets the hidden list whenever defs are replaced). */
  hiddenChannels?: number[]
  /** Display order for the NEW defs (omit for identity). Inverse commands
      carry it so undo restores a custom channel order. */
  orderVector?: number[]
}

export interface UpdateEventChannelsCommand extends BaseCommandInterface {
  type: 'updateEventChannels'
  stimulusId: number
  channels: ExtendedInterpretedDataType[]
  /** Optional raw channel ids to hide for this stimulus (treated as inactive). */
  hiddenChannels?: number[]
}

export interface UpdateParticipantsGroupsCommand extends BaseCommandInterface {
  type: 'updateParticipantsGroups'
  groups: ParticipantsGroup[]
}

export interface UpdateNoAoiTreatmentCommand extends BaseCommandInterface {
  type: 'updateNoAoiTreatment'
  noAoiTreatment: { displayedName: string; color: string }
}

export interface UpdateCategoriesCommand extends BaseCommandInterface {
  type: 'updateCategories'
  categories: ExtendedInterpretedDataType[]
  hiddenCategories?: number[]
}

// Settings change command
export interface UpdateSettingsCommand extends BaseCommandInterface {
  type: 'updateSettings'
  itemId: number
  settings: Partial<AllPlotSettings>
}

export interface UpdateLayoutCommand extends BaseCommandInterface {
  type: 'updateLayout'
  itemId: number
  layout: GridItemLayoutUpdate
}

// Grid item management commands
export interface AddGridItemCommand extends BaseCommandInterface {
  type: 'addGridItem'
  vizType: string
  options?: GridItemSnapshot & { skipCollisionResolution?: boolean }
  itemId: number // Required itemId for command reversal
  /** Explicit grid-coord placement; omit to fall back to auto-placement. */
  position?: { x: number; y: number }
}

export interface RemoveGridItemCommand extends BaseCommandInterface {
  type: 'removeGridItem'
  itemId: number
}

export interface DuplicateGridItemCommand extends BaseCommandInterface {
  type: 'duplicateGridItem'
  itemId: number
  duplicateId: number
  /** Explicit grid-coord placement; omit to fall back to auto-placement. */
  position?: { x: number; y: number }
}

export interface SetLayoutStateCommand extends BaseCommandInterface {
  type: 'setLayoutState'
  layoutState: GridItemSnapshot[]
}

export type WorkspaceCommand =
  | UpdateAoisCommand
  | UpdateParticipantsCommand
  | UpdateStimuliCommand
  | UpdateEventDataCommand
  | UpdateEventChannelsCommand
  | UpdateParticipantsGroupsCommand
  | UpdateNoAoiTreatmentCommand
  | UpdateCategoriesCommand
  | UpdateSettingsCommand // includes position and size updates
  | UpdateLayoutCommand
  | AddGridItemCommand
  | RemoveGridItemCommand
  | DuplicateGridItemCommand
  | SetLayoutStateCommand

/**
 * WorkspaceCommandChain
 *
 * A workspace command with an associated chain identifier.
 * When a command triggers additional commands (e.g., collision resolution),
 * those generated commands share the same chainId to track the operation chain.
 *
 * This enables tracking causality: "which commands were triggered by which original action?"
 * Essential for logging, debugging, and future undo/redo functionality.
 */
export type WorkspaceCommandChain = WorkspaceCommand & {
  /** Unique identifier for the command chain. All related commands share the same chainId. */
  chainId: number
  isRootCommand: boolean
  history?: 'undo' | 'redo'
}
