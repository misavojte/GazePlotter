import type {
  ExtendedInterpretedDataType,
  BaseInterpretedDataType,
  ParticipantsGroup,
} from '$lib/gaze-data/shared/types'
import type { AllGridTypes } from '$lib/workspace/type/gridType'

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

// Data change commands
export interface UpdateAoisCommand {
  type: 'updateAois'
  aois: ExtendedInterpretedDataType[]
  stimulusId: number
  applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'
}

export interface UpdateParticipantsCommand {
  type: 'updateParticipants'
  participants: BaseInterpretedDataType[]
}

export interface UpdateStimuliCommand {
  type: 'updateStimuli'
  stimuli: BaseInterpretedDataType[]
}

export interface UpdateAoiVisibilityCommand {
  type: 'updateAoiVisibility'
  stimulusId: number
  aoiNames: string[]
  visibilityArr: number[][]
  participantId?: number | null
}

export interface UpdateParticipantsGroupsCommand {
  type: 'updateParticipantsGroups'
  groups: ParticipantsGroup[]
}

// Settings change command
export interface UpdateSettingsCommand {
  type: 'updateSettings'
  itemId: number
  settings: Partial<AllGridTypes>
}

// Grid item management commands
export interface AddGridItemCommand {
  type: 'addGridItem'
  vizType: string
  options?: Partial<AllGridTypes> & { skipCollisionResolution?: boolean }
  itemId: number // Required itemId for command reversal
}

export interface RemoveGridItemCommand {
  type: 'removeGridItem'
  itemId: number
}


export interface DuplicateGridItemCommand {
  type: 'duplicateGridItem'
  itemId: number
}

export interface SetLayoutStateCommand {
  type: 'setLayoutState'
  layoutState: Array<Partial<AllGridTypes> & { type: string }>
}

export type WorkspaceCommand =
  | UpdateAoisCommand
  | UpdateParticipantsCommand
  | UpdateStimuliCommand
  | UpdateAoiVisibilityCommand
  | UpdateParticipantsGroupsCommand
  | UpdateSettingsCommand // includes position and size updates
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

/**
 * Generates a unique chain ID for command chaining.
 * Each command chain represents a sequence of related commands (e.g., original command + collision resolution commands).
 */
let chainIdCounter = 0
export function generateChainId(): number {
  return ++chainIdCounter
}

/**
 * Creates a root command (original user action) with a new chain ID.
 */
export function createRootCommand<T extends WorkspaceCommand>(command: T): WorkspaceCommandChain {
  return {
    ...command,
    chainId: generateChainId(),
    isRootCommand: true
  }
}

/**
 * Creates a child command (e.g., collision resolution) that inherits the chain ID from its parent.
 */
export function createChildCommand<T extends WorkspaceCommand>(
  command: T, 
  parentChainId: number
): WorkspaceCommandChain {
  return {
    ...command,
    chainId: parentChainId,
    isRootCommand: false
  }
}