import type { WorkspaceCommandChain } from './types'

/**
 * Maximum number of command chains to keep in the undo stack
 */
const MAX_UNDO_STACK_SIZE = 50

function createWorkspaceHistoryError(message: string): Error {
  const error = new Error(message)
  error.name = 'WorkspaceHistoryError'
  return error
}

/**
 * Command chain entry - a group of related commands (root + children) that should be undone/redone together
 */
interface CommandChainEntry {
  chainId: number
  commands: Array<{
    original: WorkspaceCommandChain
    reverse: WorkspaceCommandChain
  }>
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

export type { UndoRedoState }

/**
 * Initial state for the undo/redo store
 */
const initialState: UndoRedoState = {
  undoStack: [],
  redoStack: [],
  pendingChain: null,
  isProcessingUndoRedo: false,
}

export class UndoRedoStateStore {
  // --- Core Reactive State ---
  undoStack = $state<CommandChainEntry[]>(initialState.undoStack)
  redoStack = $state<CommandChainEntry[]>(initialState.redoStack)
  pendingChain = $state<CommandChainEntry | null>(initialState.pendingChain)
  isProcessingUndoRedo = $state<boolean>(initialState.isProcessingUndoRedo)

  // --- Derived Calculations (Runes) ---
  canUndo = $derived(this.undoStack.length > 0)
  canRedo = $derived(this.redoStack.length > 0)

  lastUndoCommandType = $derived(
    this.undoStack.length > 0
      ? this.undoStack[this.undoStack.length - 1].commands[0].original.type
      : null
  )

  lastRedoCommandType = $derived(
    this.redoStack.length > 0
      ? this.redoStack[this.redoStack.length - 1].commands[0].original.type
      : null
  )

  // --- Public API Methods ---

  /**
   * Records a command in the undo history with its pre-computed reverse.
   * Groups root commands and their children together into command chains.
   * All commands in a chain will be undone/redone together as an atomic operation.
   *
   * @param original - The command that was just executed
   * @param reverse - The pre-computed reverse command (created BEFORE execution)
   */
  recordCommand(original: WorkspaceCommandChain, reverse: WorkspaceCommandChain | null): void {
    // Skip if no valid reverse command
    if (!reverse) return

    // Skip if we're processing an undo/redo operation
    if (this.isProcessingUndoRedo) return

    // add 'redo.' as prefix to the source
    const changedOriginalSource = 'redo.' + original.source
    // add 'undo.' as prefix to the reverse source
    const changedReverseSource = 'undo.' + reverse.source

    const originalCommand: WorkspaceCommandChain = {
      ...original,
      source: changedOriginalSource,
    }
    const reverseCommand: WorkspaceCommandChain = {
      ...reverse,
      source: changedReverseSource,
    }

    // Start a new chain if this is a root command
    if (original.isRootCommand) {
      // If there's a pending chain, finalize it first
      if (this.pendingChain) {
        this.undoStack = [...this.undoStack, this.pendingChain]
      }

      // Trim undo stack if it exceeds the maximum size
      if (this.undoStack.length >= MAX_UNDO_STACK_SIZE) {
        this.undoStack = this.undoStack.slice(-MAX_UNDO_STACK_SIZE + 1) // Keep space for the new command
      }

      // Start new pending chain with this root command
      this.pendingChain = {
        chainId: original.chainId,
        commands: [{ original: originalCommand, reverse: reverseCommand }],
      }
      this.redoStack = [] // Clear redo stack when new command is recorded
    } else {
      // This is a child command - add it to the pending chain
      if (!this.pendingChain) {
        throw createWorkspaceHistoryError(
          'Child command recorded without a pending chain'
        )
      }

      // Verify it belongs to the current chain
      if (this.pendingChain.chainId !== original.chainId) {
        throw createWorkspaceHistoryError(
          'Child command chainId does not match pending chain'
        )
      }

      // Add to pending chain
      this.pendingChain = {
        ...this.pendingChain,
        commands: [
          ...this.pendingChain.commands,
          { original: originalCommand, reverse: reverseCommand },
        ],
      }
    }
  }

  /**
   * Finalizes the currently pending command chain.
   * Should be called after a root command and all its children have been executed.
   */
  finalizeChain(): void {
    if (!this.pendingChain) return

    this.undoStack = [...this.undoStack, this.pendingChain]
    this.pendingChain = null
  }

  /**
   * Undoes the most recent command chain.
   * Returns all reverse commands in the chain (in reverse order).
   *
   * @returns Array of reversed commands to execute, or null if undo is not possible
   */
  undo(): WorkspaceCommandChain[] | null {
    // Finalize any pending chain first
    if (this.pendingChain) {
      this.undoStack = [...this.undoStack, this.pendingChain]
      this.pendingChain = null
    }

    // Check if there's anything to undo
    if (this.undoStack.length === 0) {
      return null
    }

    // Pop the most recent command chain from undo stack
    const commandChain = this.undoStack[this.undoStack.length - 1]
    this.undoStack = this.undoStack.slice(0, -1)

    // Mark that we're processing an undo/redo
    this.isProcessingUndoRedo = true

    // Move the chain to redo stack so we can redo it later
    this.redoStack = [...this.redoStack, commandChain]

    // Return reverse commands in reverse order (last child first, root last)
    // This ensures children are undone before the root
    return commandChain.commands
      .slice()
      .reverse()
      .map(pair => pair.reverse)
  }

  /**
   * Redoes the most recently undone command chain.
   * Returns all original commands in the chain (in forward order).
   *
   * @returns Array of original commands to execute, or null if redo is not possible
   */
  redo(): WorkspaceCommandChain[] | null {
    // Check if there's anything to redo
    if (this.redoStack.length === 0) {
      return null
    }

    // Pop the most recent command chain from redo stack
    const commandChain = this.redoStack[this.redoStack.length - 1]
    this.redoStack = this.redoStack.slice(0, -1)

    // Mark that we're processing an undo/redo
    this.isProcessingUndoRedo = true

    // Move the chain back to undo stack
    this.undoStack = [...this.undoStack, commandChain]

    // Return original commands in forward order (root first, children after)
    return commandChain.commands.map(pair => pair.original)
  }

  /**
   * Marks the end of an undo/redo operation.
   * Must be called after executing the reversed command.
   */
  endUndoRedo(): void {
    this.isProcessingUndoRedo = false
  }

  /**
   * Clears all undo/redo history.
   * Useful when loading a new file or resetting the workspace.
   */
  clear(): void {
    this.undoStack = initialState.undoStack
    this.redoStack = initialState.redoStack
    this.pendingChain = initialState.pendingChain
    this.isProcessingUndoRedo = initialState.isProcessingUndoRedo
  }

  /**
   * Get current undo/redo state (for debugging or advanced use cases)
   *
   * @returns Current undo/redo state
   */
  getState(): UndoRedoState {
    return {
      undoStack: this.undoStack,
      redoStack: this.redoStack,
      pendingChain: this.pendingChain,
      isProcessingUndoRedo: this.isProcessingUndoRedo,
    }
  }

  /**
   * Subscribe to state changes (for backwards compatibility)
   * Note: With $state runes, reactivity is automatic. This is provided for compatibility.
   *
   * @param callback - Function to call when state changes
   * @returns Unsubscribe function
   */
  subscribe(callback: (state: UndoRedoState) => void): () => void {
    // Simple implementation for compatibility
    // In a real implementation, you might want to use a more sophisticated approach
    const interval = setInterval(() => {
      callback(this.getState())
    }, 100)

    return () => clearInterval(interval)
  }
}

