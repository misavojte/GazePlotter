import type {
  ExtendedInterpretedDataType,
  BaseInterpretedDataType,
  ParticipantsGroup,
} from '$lib/gaze-data/shared/types'
import type { AllGridTypes } from '$lib/workspace/type/gridType'

/**
 * Workspace Instruction System
 * 
 * Centralized instruction types for all workspace changes.
 * All data and settings modifications go through these instructions
 * to ensure proper tracking and automatic redraw propagation.
 * 
 * Simplified structure without nested payload - TypeScript ensures type safety
 * through discriminated unions based on the 'type' field.
 */

// Data change instructions
export interface UpdateAoisInstruction {
  type: 'updateAois'
  aois: ExtendedInterpretedDataType[]
  stimulusId: number
  applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'
}

export interface UpdateParticipantsInstruction {
  type: 'updateParticipants'
  participants: BaseInterpretedDataType[]
}

export interface UpdateStimuliInstruction {
  type: 'updateStimuli'
  stimuli: BaseInterpretedDataType[]
}

export interface UpdateAoiVisibilityInstruction {
  type: 'updateAoiVisibility'
  stimulusId: number
  aoiNames: string[]
  visibilityArr: number[][]
  participantId?: number | null
}

export interface UpdateParticipantsGroupsInstruction {
  type: 'updateParticipantsGroups'
  groups: ParticipantsGroup[]
}

// Settings change instruction
export interface UpdateSettingsInstruction {
  type: 'updateSettings'
  itemId: number
  settings: Partial<AllGridTypes>
}

// Grid item management instructions
export interface AddGridItemInstruction {
  type: 'addGridItem'
  vizType: string
  options?: Partial<AllGridTypes> & { skipCollisionResolution?: boolean }
}

export interface RemoveGridItemInstruction {
  type: 'removeGridItem'
  itemId: number
}

export interface UpdateGridItemPositionInstruction {
  type: 'updateGridItemPosition'
  itemId: number
  x: number
  y: number
  shouldResolveCollisions?: boolean
}

export interface UpdateGridItemSizeInstruction {
  type: 'updateGridItemSize'
  itemId: number
  w: number
  h: number
  shouldResolveCollisions?: boolean
}

export interface DuplicateGridItemInstruction {
  type: 'duplicateGridItem'
  itemId: number
}

export type WorkspaceInstruction =
  | UpdateAoisInstruction
  | UpdateParticipantsInstruction
  | UpdateStimuliInstruction
  | UpdateAoiVisibilityInstruction
  | UpdateParticipantsGroupsInstruction
  | UpdateSettingsInstruction
  | AddGridItemInstruction
  | RemoveGridItemInstruction
  | UpdateGridItemPositionInstruction
  | UpdateGridItemSizeInstruction
  | DuplicateGridItemInstruction

