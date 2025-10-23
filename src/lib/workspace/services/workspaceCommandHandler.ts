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
import { createUndoRedoService } from './undoRedoService'
import { createCommandReverser } from './workspaceCommandReverse'

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
  
  // Create undo/redo service
  const undoRedoService = createUndoRedoService()

  function handleCommand(command: WorkspaceCommandChain): void {
    try {
      // Create reverse command BEFORE executing (to capture current state)
      // For ALL commands (root and children) unless we're in undo/redo mode
      const reverseCommand = commandReverser(command)

      // Record the command BEFORE executing so it appears in correct order
      // (root first, then children)
      undoRedoService.recordCommand(command, reverseCommand)

      // Now execute the command (this changes the state)
      switch (command.type) {
        case 'updateAois': {
          const { aois, stimulusId, applyTo } = command
          updateMultipleAoi(aois, stimulusId, applyTo)
          gridStore.triggerRedraw()
          onSuccess('AOIs updated successfully')
          break
        }

        case 'updateParticipants': {
          updateMultipleParticipants(command.participants)
          gridStore.triggerRedraw()
          onSuccess('Participants updated successfully')
          break
        }

        case 'updateStimuli': {
          updateMultipleStimuli(command.stimuli)
          gridStore.triggerRedraw()
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
          gridStore.triggerRedraw()
          onSuccess('AOI visibility updated')
          break
        }

        case 'updateParticipantsGroups': {
          updateParticipantsGroups(command.groups)
          gridStore.triggerRedraw()
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

          // Only trigger collision resolution for root commands during normal operations
          // Skip during undo/redo because we're already executing the recorded children
          const isUndoRedoOperation = undoRedoService.isProcessingUndoRedo()
          if (command.isRootCommand && !isUndoRedoOperation) {
            const collisionCommands = gridStore.resolveItemPositionCollisions(itemId)
            // Emit each collision resolution command as child commands
            collisionCommands.forEach(collisionCommand => {
              const childCommand = createChildCommand({
                type: 'updateSettings',
                itemId: collisionCommand.itemId,
                settings: collisionCommand.settings
              }, command.chainId)
              handleCommand(childCommand)
            })
          }
          break // Settings changes don't need global redraw
        }

        case 'addGridItem': {
          const { vizType, options } = command
          const newItemId = gridStore.addItem(vizType, options)

          // Store the itemId in the command for potential reversal
          command.itemId = newItemId

          // Only trigger collision resolution for root commands during normal operations
          // Skip during undo/redo because we're already executing the recorded children
          const isUndoRedoOperation = undoRedoService.isProcessingUndoRedo()
          if (command.isRootCommand && !isUndoRedoOperation) {
            const collisionCommands = gridStore.resolveItemPositionCollisions(newItemId)
            // Emit each collision resolution command as child commands
            collisionCommands.forEach(collisionCommand => {
              const childCommand = createChildCommand({
                type: 'updateSettings',
                itemId: collisionCommand.itemId,
                settings: collisionCommand.settings
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
          const isUndoRedoOperation = undoRedoService.isProcessingUndoRedo()
          if (command.isRootCommand && !isUndoRedoOperation) {
            const collisionCommands = gridStore.resolveItemPositionCollisions(newItemId)
            // Emit each collision resolution command as child commands
            collisionCommands.forEach(collisionCommand => {
              const childCommand = createChildCommand({
                type: 'updateSettings',
                itemId: collisionCommand.itemId,
                settings: collisionCommand.settings
              }, command.chainId)
              handleCommand(childCommand)
            })
          }

          break // No success message needed for duplication
        }
      }

      // Finalize the command chain if this is a root command
      // This groups the root + all children together as an atomic operation
      if (command.isRootCommand) {
        undoRedoService.finalizeChain()
        
        // Only end undo/redo operation after root command completes
        // (don't call it for each child command, or flag will be reset too early)
        undoRedoService.endUndoRedo()
      }

      // Notify listeners about the command
      onWorkspaceCommandChain(command)
    } catch (error) {
      // Make sure to end undo/redo processing on error
      undoRedoService.endUndoRedo()
      onError(error as Error)
      throw error
    }
  }

  /**
   * Executes an undo operation.
   * Reverses the most recent command chain and applies all reverse commands.
   * 
   * @returns True if undo was successful, false otherwise
   */
  function undo(): boolean {
    const reversedCommands = undoRedoService.undo()
    if (!reversedCommands || reversedCommands.length === 0) return false

    try {
      // Execute all reverse commands in the chain
      reversedCommands.forEach(cmd => handleCommand(cmd))
      
      // Ensure undo/redo flag is cleared after all commands execute
      undoRedoService.endUndoRedo()
      
      onSuccess('Undo successful')
      return true
    } catch (error) {
      undoRedoService.endUndoRedo()
      onError(error as Error)
      return false
    }
  }

  /**
   * Executes a redo operation.
   * Re-applies the most recently undone command chain.
   * 
   * @returns True if redo was successful, false otherwise
   */
  function redo(): boolean {
    const forwardCommands = undoRedoService.redo()
    if (!forwardCommands || forwardCommands.length === 0) return false

    try {
      // Execute all original commands in the chain
      forwardCommands.forEach(cmd => handleCommand(cmd))
      
      // Ensure undo/redo flag is cleared after all commands execute
      undoRedoService.endUndoRedo()
      
      onSuccess('Redo successful')
      return true
    } catch (error) {
      undoRedoService.endUndoRedo()
      onError(error as Error)
      return false
    }
  }

  return {
    handleCommand,
    undo,
    redo,
    canUndo: undoRedoService.canUndo, // This is now a store
    canRedo: undoRedoService.canRedo, // This is now a store
    clearHistory: undoRedoService.clear,
  }
}

