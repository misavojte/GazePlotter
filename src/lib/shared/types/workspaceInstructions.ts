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
 */

// Data change instructions
export interface UpdateAoisInstruction {
  type: 'updateAois'
  payload: {
    aois: ExtendedInterpretedDataType[]
    stimulusId: number
    applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'
  }
}

export interface UpdateParticipantsInstruction {
  type: 'updateParticipants'
  payload: { participants: BaseInterpretedDataType[] }
}

export interface UpdateStimuliInstruction {
  type: 'updateStimuli'
  payload: { stimuli: BaseInterpretedDataType[] }
}

export interface UpdateAoiVisibilityInstruction {
  type: 'updateAoiVisibility'
  payload: {
    stimulusId: number
    aoiNames: string[]
    visibilityArr: number[][]
    participantId?: number | null
  }
}

export interface UpdateParticipantsGroupsInstruction {
  type: 'updateParticipantsGroups'
  payload: { groups: ParticipantsGroup[] }
}

// Settings change instruction (already works well)
export interface UpdateSettingsInstruction {
  type: 'updateSettings'
  payload: {
    itemId: number
    settings: Partial<AllGridTypes>
  }
}

export type WorkspaceInstruction =
  | UpdateAoisInstruction
  | UpdateParticipantsInstruction
  | UpdateStimuliInstruction
  | UpdateAoiVisibilityInstruction
  | UpdateParticipantsGroupsInstruction
  | UpdateSettingsInstruction

