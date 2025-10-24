import type { WorkspaceCommandChain } from '$lib/shared/types/workspaceInstructions'
import { createChildCommand, isHistoryCommand } from '$lib/shared/types/workspaceInstructions'
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
import { 
  recordCommand, 
  finalizeChain, 
  undo as undoCommand, 
  redo as redoCommand, 
  endUndoRedo, 
} from '$lib/workspace/stores/undoRedoStore'
import { createCommandReverser } from './workspaceCommandReverse'
import { getCommandLabel } from '$lib/workspace/const/workspaceCommandLabels'

/**
 * Creates a command handler for workspace changes with integrated undo/redo support.
 * 
 * This handler centralizes all data and settings mutations, ensuring:
 * - All changes go through a single point
 * - Automatic redraw propagation after data changes
 * - Consistent error handling
 * - Full undo/redo functionality through command reversal
 * 
 * @param gridStore - The grid store instance
 * @param onSuccess - Callback for successful operations
 * @param onError - Callback for error handling
 * @returns Object containing the handler function and undo/redo service
 */
export function createCommandHandler(
  gridStore: GridStoreType,
  onSuccess: (message: string) => void,
  onError: (error: Error) => void,
  onWorkspaceCommandChain: (command: WorkspaceCommandChain) => void
) {
  // Create command reverser for undo/redo functionality
  const commandReverser = createCommandReverser(gridStore)

  function handleCommand(command: WorkspaceCommandChain): void {
    try {

      const isUndoRedoOperation = isHistoryCommand(command.source)

      if (!isUndoRedoOperation) {
        // Create reverse command BEFORE executing (to capture current state)
        // For ALL commands (root and children) unless we're in undo/redo mode
        const reverseCommand = commandReverser(command)

        // Record the command BEFORE executing so it appears in correct order
        // (root first, then children)
        recordCommand(command, reverseCommand)
      }

      // Now execute the command (this changes the state)
      switch (command.type) {
        case 'updateAois': {
          const { aois, stimulusId, applyTo } = command
          updateMultipleAoi(aois, stimulusId, applyTo)
          gridStore.triggerRedraw()
          break
        }

        case 'updateParticipants': {
          updateMultipleParticipants(command.participants)
          gridStore.triggerRedraw()
          break
        }

        case 'updateStimuli': {
          updateMultipleStimuli(command.stimuli)
          gridStore.triggerRedraw()
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
          gridStore.triggerRedraw()
          break
        }

        case 'updateParticipantsGroups': {
          updateParticipantsGroups(command.groups)
          gridStore.triggerRedraw()
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

          // Only trigger collision resolution for root commands during normal operations
          // Skip during undo/redo because we're already executing the recorded children
          if (command.isRootCommand && !isUndoRedoOperation) {
            const collisionCommands = gridStore.resolveItemPositionCollisions(itemId)
            // Emit each collision resolution command as child commands
            collisionCommands.forEach(collisionCommand => {
              const childCommand = createChildCommand({
                type: 'updateSettings',
                itemId: collisionCommand.itemId,
                settings: collisionCommand.settings,
                source: 'collision'
              }, command.chainId)
              handleCommand(childCommand)
            })
          }
          break // Settings changes don't need global redraw
        }

        case 'addGridItem': {
          const { vizType, options, itemId } = command
          // Use the pre-assigned itemId if provided, otherwise let addItem generate one
          const optionsWithId = itemId ? { ...options, id: itemId } : options
          const newItemId = gridStore.addItem(vizType, optionsWithId)

          // Store the itemId in the command for potential reversal
          command.itemId = newItemId

          // Only trigger collision resolution for root commands during normal operations
          // Skip during undo/redo because we're already executing the recorded children
          if (command.isRootCommand && !isUndoRedoOperation) {
            const collisionCommands = gridStore.resolveItemPositionCollisions(newItemId)
            // Emit each collision resolution command as child commands
            collisionCommands.forEach(collisionCommand => {
              const childCommand = createChildCommand({
                type: 'updateSettings',
                itemId: collisionCommand.itemId,
                settings: collisionCommand.settings,
                source: 'collision'
              }, command.chainId)
              handleCommand(childCommand)
            })
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

          // Only trigger collision resolution for root commands during normal operations
          // Skip during undo/redo because we're already executing the recorded children
          if (command.isRootCommand && !isUndoRedoOperation) {
            const collisionCommands = gridStore.resolveItemPositionCollisions(newItemId)
            // Emit each collision resolution command as child commands
            collisionCommands.forEach(collisionCommand => {
              const childCommand = createChildCommand({
                type: 'updateSettings',
                itemId: collisionCommand.itemId,
                settings: collisionCommand.settings,
                source: 'collision'
              }, command.chainId)
              handleCommand(childCommand)
            })
          }

          break // No success message needed for duplication
        }

        case 'setLayoutState': {
          const { layoutState } = command
          // Set the entire grid state to the provided layout
          gridStore.setLayoutState(layoutState)
          break // Success message will be handled by the command label system
        }
      }

      // Finalize the command chain if this is a root command
      // This groups the root + all children together as an atomic operation
      if (command.isRootCommand && !isUndoRedoOperation) {
        finalizeChain()
      }


      // Show success message for root commands only
      if (command.isRootCommand && !isUndoRedoOperation) {
        // ignore updateSettings commands 
        // THAT ARE NOT FROM A MODAL (source ends with .modal)
        const isSettingsCommandFromModal = command.type === 'updateSettings' && command.source.endsWith('.modal')
        if (!isSettingsCommandFromModal) {
          const message = getCommandLabel(command.type, command.history)
          if (message) {
            onSuccess(message)
          }
        } 
      }

      // Notify listeners about the command
      onWorkspaceCommandChain(command)
    } catch (error) {
      // Make sure to end undo/redo processing on error
      endUndoRedo()
      onError(error as Error)
      throw error
    }
  }
  return handleCommand
}

