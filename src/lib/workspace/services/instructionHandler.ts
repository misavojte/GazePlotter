import type { WorkspaceCommandChain } from '$lib/shared/types/workspaceInstructions'
import { createChildCommand } from '$lib/shared/types/workspaceInstructions'
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
 * Creates a command handler for workspace changes.
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
 * @returns Handler function for processing commands
 */
export function createCommandHandler(
  gridStore: GridStoreType,
  onSuccess: (message: string) => void,
  onError: (error: Error) => void,
  onWorkspaceCommandChain: (command: WorkspaceCommandChain) => void
) {
  return function handleCommand(command: WorkspaceCommandChain): void {
    try {
      switch (command.type) {
        case 'updateAois': {
          const { aois, stimulusId, applyTo } = command
          updateMultipleAoi(aois, stimulusId, applyTo)
          onSuccess('AOIs updated successfully')
          break
        }

        case 'updateParticipants': {
          updateMultipleParticipants(command.participants)
          onSuccess('Participants updated successfully')
          break
        }

        case 'updateStimuli': {
          updateMultipleStimuli(command.stimuli)
          onSuccess('Stimuli updated successfully')
          break
        }

        case 'updateAoiVisibility': {
          const { stimulusId, aoiNames, visibilityArr, participantId } = command
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
          updateParticipantsGroups(command.groups)
          onSuccess('Participant groups updated')
          break
        }

        case 'updateSettings': {
          const { itemId, settings } = command
          const currentItem = get(gridStore).find(item => item.id === itemId)
          if (!currentItem) throw new Error(`Grid item ${itemId} not found`)

          gridStore.updateSettings({
            ...currentItem,
            ...settings,
            redrawTimestamp: Date.now(),
          } as AllGridTypes)

          // Only trigger collision resolution for root commands (original user actions)
          // This prevents infinite loops when collision resolution commands trigger more collision resolution
          const isRootCommand = 'isRootCommand' in command ? command.isRootCommand : true
          if (isRootCommand) {
            setTimeout(() => {
              const collisionCommands = gridStore.resolveItemPositionCollisions(itemId)
              // Emit each collision resolution command as child commands
              collisionCommands.forEach(collisionCommand => {
                const childCommand = createChildCommand({
                  type: 'updateSettings',
                  itemId: collisionCommand.itemId,
                  settings: collisionCommand.settings
                }, 'chainId' in command ? command.chainId : 0)
                handleCommand(childCommand)
              })
            }, 50)
          }
          break // Settings changes don't need global redraw
        }

        case 'addGridItem': {
          const { vizType, options } = command
          const newItemId = gridStore.addItem(vizType, options)
          
          // Only trigger collision resolution for root commands (original user actions)
          const isRootCommand = 'isRootCommand' in command ? command.isRootCommand : true
          if (isRootCommand) {
            setTimeout(() => {
              const collisionCommands = gridStore.resolveItemPositionCollisions(newItemId)
              // Emit each collision resolution command as child commands
              collisionCommands.forEach(collisionCommand => {
                const childCommand = createChildCommand({
                  type: 'updateSettings',
                  itemId: collisionCommand.itemId,
                  settings: collisionCommand.settings
                }, 'chainId' in command ? command.chainId : 0)
                handleCommand(childCommand)
              })
            }, 50)
          }
          
          break // No success message needed for adding items
        }

        case 'removeGridItem': {
          gridStore.removeItem(command.itemId)
          break // No success message needed for removing items
        }


        case 'duplicateGridItem': {
          const currentItem = get(gridStore).find(item => item.id === command.itemId)
          if (!currentItem) throw new Error(`Grid item ${command.itemId} not found`)
          const newItemId = gridStore.duplicateItem(currentItem)
          
          // Only trigger collision resolution for root commands (original user actions)
          const isRootCommand = 'isRootCommand' in command ? command.isRootCommand : true
          if (isRootCommand) {
            setTimeout(() => {
              const collisionCommands = gridStore.resolveItemPositionCollisions(newItemId)
              // Emit each collision resolution command as child commands
              collisionCommands.forEach(collisionCommand => {
                const childCommand = createChildCommand({
                  type: 'updateSettings',
                  itemId: collisionCommand.itemId,
                  settings: collisionCommand.settings
                }, 'chainId' in command ? command.chainId : 0)
                handleCommand(childCommand)
              })
            }, 50)
          }
          
          break // No success message needed for duplication
        }
      }

      onWorkspaceCommandChain(command)

      // Trigger redraw for all grid items after data changes
      //gridStore.triggerRedraw()
    } catch (error) {
      onError(error as Error)
      throw error
    }
  }
}

