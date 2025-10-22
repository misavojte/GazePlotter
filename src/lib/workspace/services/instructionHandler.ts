import type { WorkspaceInstruction } from '$lib/shared/types/workspaceInstructions'
import type { GridStoreType } from '$lib/workspace/stores/gridStore'
import { get } from 'svelte/store'
import {
  updateMultipleAoi,
  updateMultipleParticipants,
  updateMultipleStimuli,
  updateMultipleAoiVisibility,
  updateParticipantsGroups,
} from '$lib/gaze-data/front-process/stores/dataStore'
import type { AllGridTypes } from '$lib/workspace/type/gridType'

/**
 * Creates an instruction handler for workspace changes.
 * 
 * This handler centralizes all data and settings mutations, ensuring:
 * - All changes go through a single point
 * - Automatic redraw propagation after data changes
 * - Consistent error handling
 * - Foundation for future undo/redo functionality
 * 
 * @param gridStore - The grid store instance
 * @param onSuccess - Callback for successful operations
 * @param onError - Callback for error handling
 * @returns Handler function for processing instructions
 */
export function createInstructionHandler(
  gridStore: GridStoreType,
  onSuccess: (message: string) => void,
  onError: (error: Error) => void
) {
  return function handleInstruction(instruction: WorkspaceInstruction): void {
    try {
      switch (instruction.type) {
        case 'updateAois': {
          const { aois, stimulusId, applyTo } = instruction
          updateMultipleAoi(aois, stimulusId, applyTo)
          onSuccess('AOIs updated successfully')
          break
        }

        case 'updateParticipants': {
          updateMultipleParticipants(instruction.participants)
          onSuccess('Participants updated successfully')
          break
        }

        case 'updateStimuli': {
          updateMultipleStimuli(instruction.stimuli)
          onSuccess('Stimuli updated successfully')
          break
        }

        case 'updateAoiVisibility': {
          const { stimulusId, aoiNames, visibilityArr, participantId } = instruction
          updateMultipleAoiVisibility(
            stimulusId,
            aoiNames,
            visibilityArr,
            participantId
          )
          onSuccess('AOI visibility updated')
          break
        }

        case 'updateParticipantsGroups': {
          updateParticipantsGroups(instruction.groups)
          onSuccess('Participant groups updated')
          break
        }

        case 'updateSettings': {
          const { itemId, settings } = instruction
          const currentItem = get(gridStore).find(item => item.id === itemId)
          if (!currentItem) throw new Error(`Grid item ${itemId} not found`)

          const heightChanged = 'h' in settings && settings.h !== currentItem.h

          gridStore.updateSettings({
            ...currentItem,
            ...settings,
            redrawTimestamp: Date.now(),
          } as AllGridTypes)

          if (heightChanged) {
            setTimeout(() => gridStore.resolveItemPositionCollisions(itemId), 50)
          }
          return // Settings changes don't need global redraw
        }

        case 'addGridItem': {
          const { vizType, options } = instruction
          gridStore.addItem(vizType, options)
          return // No success message needed for adding items
        }

        case 'removeGridItem': {
          gridStore.removeItem(instruction.itemId)
          return // No success message needed for removing items
        }

        case 'updateGridItemPosition': {
          const { itemId, x, y, shouldResolveCollisions = false } = instruction
          gridStore.updateItemPosition(itemId, x, y, shouldResolveCollisions)
          return // No success message needed for position updates
        }

        case 'updateGridItemSize': {
          const { itemId, w, h, shouldResolveCollisions = false } = instruction
          gridStore.updateItemSize(itemId, w, h, shouldResolveCollisions)
          return // No success message needed for size updates
        }

        case 'duplicateGridItem': {
          const currentItem = get(gridStore).find(item => item.id === instruction.itemId)
          if (!currentItem) throw new Error(`Grid item ${instruction.itemId} not found`)
          gridStore.duplicateItem(currentItem)
          return // No success message needed for duplication
        }
      }

      // Trigger redraw for all grid items after data changes
      gridStore.triggerRedraw()
    } catch (error) {
      onError(error as Error)
      throw error
    }
  }
}

