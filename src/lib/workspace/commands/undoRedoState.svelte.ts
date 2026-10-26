import type { WorkspaceCommandChain } from './types'

/**
 * Maximum number of command chains to keep in the undo stack
 */
const MAX_UNDO_STACK_SIZE = 50

/** Edits to the same settings or layout closer together than this are one undo step. */
const COALESCE_WINDOW_MS = 1000

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

/** Type, items and keys of a lone settings or layout edit; null for anything else. */
function editSignature(chain: CommandChainEntry): string | null {
  if (chain.commands.length !== 1) return null
  const command = chain.commands[0].original
  if (command.type === 'updateSettings') {
    return `settings ${command.updates
      .map(({ itemId, settings }) => `${itemId}:${Object.keys(settings).sort()}`)
      .join('|')}`
  }
  // Arrow-key nudges: a quick run of them is one move.
  if (command.type === 'updateLayout') {
    return `layout ${command.updates
      .map(({ itemId, layout }) => `${itemId}:${Object.keys(layout).sort()}`)
      .join('|')}`
  }
  return null
}

export class UndoRedoStateStore {
  // --- Core Reactive State ---
  // `$state.raw`: the stacks are only ever reassigned immutably, and chain
  // entries can carry large command payloads (event buffers, AOI tables) —
  // deep-proxying them buys nothing.
  undoStack = $state.raw<CommandChainEntry[]>([])
  redoStack = $state.raw<CommandChainEntry[]>([])
  pendingChain = $state.raw<CommandChainEntry | null>(null)
  isProcessingUndoRedo = $state<boolean>(false)
  // Newest chain dropped by the stack cap: the history's floor once trimmed.
  private trimmedBase = $state<number | null>(null)
  private savedHead = $state<number | null>(null)
  // The top chain while it may still absorb the next keystroke's edit.
  private openEdit: { signature: string; at: number } | null = null

  // --- Derived Calculations (Runes) ---
  canUndo = $derived(this.undoStack.length > 0)
  canRedo = $derived(this.redoStack.length > 0)

  /** Identity of the current history position (chain ids are unique). */
  head = $derived(
    this.pendingChain?.chainId ??
      this.undoStack.at(-1)?.chainId ??
      this.trimmedBase
  )
  /** The workspace differs from the last saved (or loaded) position. */
  isDirty = $derived(this.head !== this.savedHead)

  /** The root command of the chain the next undo/redo would replay (labels). */
  lastUndoCommand = $derived(this.undoStack.at(-1)?.commands[0].original ?? null)
  lastRedoCommand = $derived(this.redoStack.at(-1)?.commands[0].original ?? null)

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
        this.push(this.pendingChain)
        this.openEdit = null
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
    const chain = this.pendingChain
    if (!chain) return
    this.pendingChain = null

    // Typing "5000" is one edit, not four: a quick follow-up to the same
    // settings (or layout) keeps the first reverse and the newest original.
    const signature = editSignature(chain)
    const now = Date.now()
    const top = this.undoStack.at(-1)
    if (
      top &&
      signature !== null &&
      this.openEdit?.signature === signature &&
      now - this.openEdit.at < COALESCE_WINDOW_MS
    ) {
      const merged: CommandChainEntry = {
        chainId: chain.chainId,
        commands: [
          { original: chain.commands[0].original, reverse: top.commands[0].reverse },
        ],
      }
      this.undoStack = [...this.undoStack.slice(0, -1), merged]
    } else {
      this.push(chain)
    }
    this.openEdit = signature === null ? null : { signature, at: now }
  }

  /** Adds a chain, dropping the oldest past the cap (a coalesced edit adds none, so drops none). */
  private push(chain: CommandChainEntry): void {
    const stack = [...this.undoStack, chain]
    const drop = stack.length - MAX_UNDO_STACK_SIZE
    if (drop > 0) this.trimmedBase = stack[drop - 1].chainId
    this.undoStack = drop > 0 ? stack.slice(drop) : stack
  }

  /**
   * Undoes the most recent command chain.
   * Returns all reverse commands in the chain (in reverse order).
   *
   * @returns Array of reversed commands to execute, or null if undo is not possible
   */
  undo(): WorkspaceCommandChain[] | null {
    // Finalize any pending chain first
    this.finalizeChain()
    // Last child first, root last, so children are undone before the root.
    const chain = this.transfer('undoStack')
    return chain ? chain.commands.slice().reverse().map(pair => pair.reverse) : null
  }

  /**
   * Redoes the most recently undone command chain.
   * Returns all original commands in the chain (in forward order).
   *
   * @returns Array of original commands to execute, or null if redo is not possible
   */
  redo(): WorkspaceCommandChain[] | null {
    // Root first, children after.
    return this.transfer('redoStack')?.commands.map(pair => pair.original) ?? null
  }

  /** Pops the newest chain off `from` onto the other stack, entering undo/redo. */
  private transfer(from: 'undoStack' | 'redoStack'): CommandChainEntry | null {
    const chain = this[from].at(-1)
    if (!chain) return null
    this.openEdit = null
    this[from] = this[from].slice(0, -1)
    this.isProcessingUndoRedo = true
    const to = from === 'undoStack' ? 'redoStack' : 'undoStack'
    this[to] = [...this[to], chain]
    return chain
  }

  /**
   * Marks the end of an undo/redo operation.
   * Must be called after executing the reversed command.
   */
  endUndoRedo(): void {
    this.isProcessingUndoRedo = false
  }

  /** The current position is what was just saved. */
  markSaved(head: number | null): void {
    // Undo must still be able to land on the saved state.
    this.openEdit = null
    this.savedHead = head
  }

  /**
   * Clears all undo/redo history; the cleared state counts as saved.
   * Useful when loading a new file or resetting the workspace.
   */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.pendingChain = null
    this.isProcessingUndoRedo = false
    this.trimmedBase = null
    this.savedHead = null
    this.openEdit = null
  }
}

