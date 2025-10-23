import { writable, derived, get } from 'svelte/store'
import type { WorkspaceCommandChain } from '$lib/shared/types/workspaceInstructions'

/**
 * Maximum number of command chains to keep in the undo stack
 */
const MAX_UNDO_STACK_SIZE = 50

/**
 * Command chain entry - a group of related commands (root + children) that should be undone/redone together
 */
interface CommandChainEntry {
  chainId: number
  commands: Array<{ original: WorkspaceCommandChain; reverse: WorkspaceCommandChain }>
}

/**
 * Undo/Redo state interface with pre-computed reverse commands
 */
interface UndoRedoState {
  /** Stack of command chains that can be undone (most recent at the end) */
  undoStack: CommandChainEntry[]
  /** Stack of command chains that can be redone (most recent at the end) */
  redoStack: CommandChainEntry[]
  /** Currently building command chain (for grouping root + child commands) */
  pendingChain: CommandChainEntry | null
  /** Flag to indicate if we're currently processing an undo/redo operation */
  isProcessingUndoRedo: boolean
}

/**
 * Initial state for the undo/redo store
 */
const initialState: UndoRedoState = {
  undoStack: [],
  redoStack: [],
  pendingChain: null,
  isProcessingUndoRedo: false,
}

/**
 * Core undo/redo state store
 * 
 * This store maintains two stacks of command chains:
 * - undoStack: Command chains that have been executed and can be undone
 * - redoStack: Command chains that have been undone and can be redone
 * 
 * Each command chain contains a root command and all its child commands (e.g., collision resolutions).
 * All commands in a chain are undone/redone together as a single atomic operation.
 * 
 * Reverse commands are computed BEFORE execution to capture the correct "before" state.
 */
const undoRedoState = writable<UndoRedoState>(initialState)

/**
 * Derived store that indicates whether undo is possible
 * 
 * @returns true if there are commands that can be undone, false otherwise
 */
export const canUndo = derived(undoRedoState, $state => $state.undoStack.length > 0)

/**
 * Derived store that indicates whether redo is possible
 * 
 * @returns true if there are commands that can be redone, false otherwise
 */
export const canRedo = derived(undoRedoState, $state => $state.redoStack.length > 0)

/**
 * Records a command in the undo history with its pre-computed reverse.
 * Groups root commands and their children together into command chains.
 * All commands in a chain will be undone/redone together as an atomic operation.
 * 
 * @param original - The command that was just executed
 * @param reverse - The pre-computed reverse command (created BEFORE execution)
 */
export const recordCommand = (original: WorkspaceCommandChain, reverse: WorkspaceCommandChain | null): void => {

  // Skip if no valid reverse command
  if (!reverse) return

  const originalCommand: WorkspaceCommandChain = {...original, history: 'redo'}
  const reverseCommand: WorkspaceCommandChain = {...reverse, history: 'undo'}

  undoRedoState.update($state => {
    // Skip if we're processing an undo/redo operation
    if ($state.isProcessingUndoRedo) return $state

    // Start a new chain if this is a root command
    if (original.isRootCommand) {
      // If there's a pending chain, finalize it first
      const newUndoStack = $state.pendingChain 
        ? [...$state.undoStack, $state.pendingChain]
        : $state.undoStack

      // Trim undo stack if it exceeds the maximum size
      const trimmedUndoStack = newUndoStack.length >= MAX_UNDO_STACK_SIZE
        ? newUndoStack.slice(-MAX_UNDO_STACK_SIZE + 1) // Keep space for the new command
        : newUndoStack

      // Start new pending chain with this root command
      return {
        ...$state,
        undoStack: trimmedUndoStack,
        pendingChain: {
          chainId: original.chainId,
          commands: [{ original: originalCommand, reverse: reverseCommand }]
        },
        redoStack: [] // Clear redo stack when new command is recorded
      }
    } else {
      // This is a child command - add it to the pending chain
      if (!$state.pendingChain) {
        console.warn('Child command recorded without a pending chain')
        return $state
      }

      // Verify it belongs to the current chain
      if ($state.pendingChain.chainId !== original.chainId) {
        console.warn('Child command chainId does not match pending chain')
        return $state
      }

      // Add to pending chain
      return {
        ...$state,
        pendingChain: {
          ...$state.pendingChain,
          commands: [...$state.pendingChain.commands, { original, reverse }]
        }
      }
    }
  })
}

/**
 * Finalizes the currently pending command chain.
 * Should be called after a root command and all its children have been executed.
 */
export const finalizeChain = (): void => {
  undoRedoState.update($state => {
    if (!$state.pendingChain) return $state

    return {
      ...$state,
      undoStack: [...$state.undoStack, $state.pendingChain],
      pendingChain: null
    }
  })
}

/**
 * Undoes the most recent command chain.
 * Returns all reverse commands in the chain (in reverse order).
 * 
 * @returns Array of reversed commands to execute, or null if undo is not possible
 */
export const undo = (): WorkspaceCommandChain[] | null => {
  let result: WorkspaceCommandChain[] | null = null

  undoRedoState.update($state => {
    // Finalize any pending chain first
    const finalState = $state.pendingChain 
      ? {
          ...$state,
          undoStack: [...$state.undoStack, $state.pendingChain],
          pendingChain: null
        }
      : $state

    // Check if there's anything to undo
    if (finalState.undoStack.length === 0) {
      result = null
      return finalState
    }

    // Pop the most recent command chain from undo stack
    const commandChain = finalState.undoStack[finalState.undoStack.length - 1]
    const newUndoStack = finalState.undoStack.slice(0, -1)

    // Return reverse commands in reverse order (last child first, root last)
    // This ensures children are undone before the root
    result = commandChain.commands
      .slice()
      .reverse()
      .map(pair => pair.reverse)

    // Mark that we're processing an undo/redo and update stacks
    // Move the chain to redo stack so we can redo it later
    return {
      ...finalState,
      undoStack: newUndoStack,
      redoStack: [...finalState.redoStack, commandChain],
      isProcessingUndoRedo: true
    }
  })

  return result
}

/**
 * Redoes the most recently undone command chain.
 * Returns all original commands in the chain (in forward order).
 * 
 * @returns Array of original commands to execute, or null if redo is not possible
 */
export const redo = (): WorkspaceCommandChain[] | null => {
  let result: WorkspaceCommandChain[] | null = null

  undoRedoState.update($state => {
    // Check if there's anything to redo
    if ($state.redoStack.length === 0) {
      result = null
      return $state
    }

    // Pop the most recent command chain from redo stack
    const commandChain = $state.redoStack[$state.redoStack.length - 1]
    const newRedoStack = $state.redoStack.slice(0, -1)

    // Return original commands in forward order (root first, children after)
    result = commandChain.commands.map(pair => pair.original)

    // Mark that we're processing an undo/redo and update stacks
    // Move the chain back to undo stack
    return {
      ...$state,
      undoStack: [...$state.undoStack, commandChain],
      redoStack: newRedoStack,
      isProcessingUndoRedo: true
    }
  })

  return result
}

/**
 * Marks the end of an undo/redo operation.
 * Must be called after executing the reversed command.
 */
export const endUndoRedo = (): void => {
  undoRedoState.update($state => ({
    ...$state,
    isProcessingUndoRedo: false
  }))
}

/**
 * Checks if currently processing an undo/redo operation.
 * Used to skip collision resolution during undo/redo.
 * 
 * @returns True if currently processing undo/redo
 */
export const isProcessingUndoRedo = (): boolean => {
  const state = get(undoRedoState)
  return state.isProcessingUndoRedo
}

/**
 * Clears all undo/redo history.
 * Useful when loading a new file or resetting the workspace.
 */
export const clear = (): void => {
  undoRedoState.set(initialState)
}

/**
 * Subscribe to the undo/redo state for advanced use cases
 * 
 * @param callback - Function to call when state changes
 * @returns Unsubscribe function
 */
export const subscribe = undoRedoState.subscribe

/**
 * Get current undo/redo state (for debugging or advanced use cases)
 * 
 * @returns Current undo/redo state
 */
export const getState = (): UndoRedoState => get(undoRedoState)


/** 
 * Readable derived of the type of the last command in the undo stack
 */
export const lastUndoCommandType = derived(undoRedoState, $state => {
  return $state.undoStack.length > 0 ? $state.undoStack[$state.undoStack.length - 1].commands[0].original.type : null
})

/**
 * Readable derived of the type of the last command in the redo stack
 */
export const lastRedoCommandType = derived(undoRedoState, $state => {
  return $state.redoStack.length > 0 ? $state.redoStack[$state.redoStack.length - 1].commands[0].original.type : null
})