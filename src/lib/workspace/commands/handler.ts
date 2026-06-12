import type { WorkspaceCommandChain } from './types'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { isHistoryCommand } from './utils'
import { GridState } from '$lib/workspace/grid'
import {
  createWorkspaceCommandRegistry,
  type WorkspaceCommandRegistryErrorContext,
} from './registry'
import { UndoRedoStateStore } from './undoRedoState.svelte'
import { getCommandLabel } from './labels'

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
 * @returns Object containing the handler function and undo/redo service
 */
export function createCommandHandler(
  gridStore: GridState,
  engine: DataEngine,
  history: UndoRedoStateStore,
  onSuccess: (message: string) => void,
  onWorkspaceCommandChain: (command: WorkspaceCommandChain) => void,
  onRegistryError?: (
    error: unknown,
    context: WorkspaceCommandRegistryErrorContext
  ) => void
) {
  const commandRegistry = createWorkspaceCommandRegistry(
    gridStore,
    engine,
    onRegistryError
  )

  const isNormalRootCommand = (
    command: WorkspaceCommandChain,
    isUndoRedoOperation: boolean
  ) => command.isRootCommand && !isUndoRedoOperation

  const shouldShowSuccessToast = (
    command: WorkspaceCommandChain,
    isUndoRedoOperation: boolean
  ) => {
    if (!isNormalRootCommand(command, isUndoRedoOperation)) return false

    // Ignore layout updates as they are frequent and don't need notifications
    if (command.type === 'updateLayout' || command.type === 'setLayoutState') {
      return false
    }

    // Ignore updateSettings unless it's clearly user-triggered from a modal.
    if (command.type === 'updateSettings') {
      return command.source.endsWith('.modal')
    }

    return true
  }

  function handleCommand(command: WorkspaceCommandChain): void {
    try {
      const isUndoRedoOperation = isHistoryCommand(command.source)

      if (!isUndoRedoOperation) {
        // Create reverse command BEFORE executing (to capture current state)
        // For ALL commands (root and children) unless we're in undo/redo mode
        const reverseCommand = commandRegistry.reverse(command)

        // Record the command BEFORE executing so it appears in correct order
        // (root first, then children)
        history.recordCommand(command, reverseCommand)
      }

      commandRegistry.execute(command, {
        isUndoRedoOperation,
        dispatch: handleCommand,
      })

      // Finalize the command chain if this is a root command
      // This groups the root + all children together as an atomic operation
      if (isNormalRootCommand(command, isUndoRedoOperation)) {
        history.finalizeChain()
      }

      if (shouldShowSuccessToast(command, isUndoRedoOperation)) {
        const message = getCommandLabel(command.type, command.history)
        if (message) onSuccess(message)
      }

      // Notify listeners about the command
      onWorkspaceCommandChain(command)
    } catch (error) {
      // Make sure to end undo/redo processing on error
      history.endUndoRedo()
      throw error
    }
  }
  return handleCommand
}
