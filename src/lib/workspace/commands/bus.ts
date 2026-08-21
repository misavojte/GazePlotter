import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { ErrorService } from '$lib/errors'
import type { ToastState } from '$lib/toaster/toastState.svelte'
import { GridState } from '../grid/gridState.svelte'
import { createCommandHandler } from './handler'
import { createRootCommand } from './utils'
import { getCommandLabel } from './labels'
import { UndoRedoStateStore } from './undoRedoState.svelte'
import type { WorkspaceCommand, WorkspaceCommandChain } from './types'
import { generateUniqueId } from '$lib/shared/utils/idUtils'
// From the owning module, not the `$lib/workspace` barrel, which also
// re-exports this file's own consumers.
import type {
  AllPlotSettings,
  GridItemSnapshot,
  PlotType,
} from '../grid/types'

function isWorkspaceHistoryError(error: unknown): boolean {
  return error instanceof Error && error.name === 'WorkspaceHistoryError'
}

type CommandBusDeps = {
  engine: DataEngine
  errorService: Pick<ErrorService, 'report'>
  grid: GridState
  toastState: Pick<ToastState, 'addSuccess'>
}

/**
 * The command bus's public face: what the UI calls to change the workspace.
 * Dispatch lives in {@link createCommandHandler}, per-command execute/reverse in
 * the registry, the stack in {@link UndoRedoStateStore}. This owns the entry
 * point, the error boundary around it, and the history verbs.
 */
export class WorkspaceCommandBus {
  readonly history = new UndoRedoStateStore()

  private onCommandApplied: (command: WorkspaceCommandChain) => void = () => {}

  private readonly handleCommand: (command: WorkspaceCommandChain) => void
  private readonly errorService: Pick<ErrorService, 'report'>
  private readonly grid: GridState

  constructor(deps: CommandBusDeps) {
    this.errorService = deps.errorService
    this.grid = deps.grid
    this.handleCommand = createCommandHandler(
      deps.grid,
      deps.engine,
      this.history,
      message => deps.toastState.addSuccess(message),
      command => this.onCommandApplied(command),
      (error, context) => {
        this.errorService.report({
          origin: 'workspace',
          severity: 'recoverable',
          userMessage:
            'Undo/redo history could not be recorded for this change.',
          cause: error,
          context: {
            phase: context.phase,
            commandType: context.command.type,
            source: context.command.source,
            chainId: context.command.chainId,
            isRootCommand: context.command.isRootCommand,
          },
        })
      }
    )
  }

  setCommandListener(listener: (command: WorkspaceCommandChain) => void): void {
    this.onCommandApplied = listener
  }

  private execute(command: WorkspaceCommandChain): boolean {
    try {
      this.handleCommand(command)
      return true
    } catch (error) {
      this.errorService.report({
        origin: 'workspace',
        severity: 'recoverable',
        userMessage: isWorkspaceHistoryError(error)
          ? 'Undo/redo history could not be recorded for this change.'
          : 'Error applying changes. See console for details.',
        cause: error,
        // Identity only — the full command can carry megabytes of payload
        // (event buffers) that the error ring would retain for the session.
        context: {
          commandType: command.type,
          source: command.source,
          chainId: command.chainId,
        },
      })
      return false
    }
  }

  /**
   * Apply one command as a root (a new undo step). This is the workspace's
   * mutation verb: the {@link WorkspaceCommand} union already names and types
   * every operation, so a per-command forwarding method would only restate it.
   * Methods on this class exist where they add something the command cannot
   * carry: an id to default, a payload to compute, a precondition to report.
   */
  apply(command: WorkspaceCommand): boolean {
    return this.execute(createRootCommand(command))
  }

  /** Replay one popped undo/redo chain; `endUndoRedo` must run even on failure. */
  private replay(commands: WorkspaceCommandChain[] | null): boolean {
    if (!commands) return false
    try {
      for (const command of commands) {
        if (!this.execute(command)) return false
      }
      return true
    } finally {
      this.history.endUndoRedo()
    }
  }

  undo(): boolean {
    return this.replay(this.history.undo())
  }

  redo(): boolean {
    return this.replay(this.history.redo())
  }

  /** Reset guarded by the precondition its callers cannot express in a command. */
  resetLayoutGuarded(
    initialLayoutState: GridItemSnapshot[] | null,
    componentName: string
  ): boolean {
    if (!initialLayoutState) {
      this.errorService.report({
        origin: 'workspace',
        severity: 'recoverable',
        userMessage: 'The initial workspace layout is unavailable.',
        cause: new Error(
          'Cannot reset layout: no initial layout state provided'
        ),
        context: {
          component: componentName,
        },
      })
      return false
    }
    return this.apply({
      type: 'setLayoutState',
      layoutState: initialLayoutState,
      source: 'workspace',
    })
  }

  addGridItem(vizType: PlotType, source: string, itemId?: number): boolean {
    return this.apply({
      type: 'addGridItem',
      vizType,
      source,
      itemId: itemId ?? generateUniqueId(),
    })
  }

  updateItemSettings(
    itemId: number,
    settings: Partial<AllPlotSettings>,
    source: string
  ): boolean {
    return this.updateItemsSettings([itemId], settings, source)
  }

  /**
   * Applies the same settings patch to several items as ONE atomic command
   * (single undo step). Single-item edits are just `updateItemSettings`
   * (a set of one) — same command, same code path.
   */
  updateItemsSettings(
    itemIds: number[],
    settings: Partial<AllPlotSettings>,
    source: string
  ): boolean {
    if (itemIds.length === 0) return true
    return this.apply({
      type: 'updateSettings',
      updates: itemIds.map(itemId => ({ itemId, settings })),
      source,
    })
  }

  /**
   * Applies a patch computed PER ITEM from that item's own current settings,
   * as one atomic command. Use this for read-modify-write edits (e.g. a
   * per-stimulus range keyed by each plot's own stimulusId) where broadcasting
   * one item's merged value would clobber the others. `computePatch` returns
   * null to skip an item. Single-item edits are just a set of one — same path.
   */
  updateEachItemSettings(
    itemIds: number[],
    computePatch: (settings: AllPlotSettings) => Partial<AllPlotSettings> | null,
    source: string
  ): boolean {
    const updates: { itemId: number; settings: Partial<AllPlotSettings> }[] = []
    for (const itemId of itemIds) {
      const item = this.grid.items.find(i => i.id === itemId)
      if (!item) continue
      const patch = computePatch(item.settings as AllPlotSettings)
      if (patch && Object.keys(patch).length > 0) {
        updates.push({ itemId, settings: patch })
      }
    }
    if (updates.length === 0) return true
    return this.apply({ type: 'updateSettings', updates, source })
  }

  duplicateGridItem(
    itemId: number,
    source: string,
    options: { duplicateId?: number } = {}
  ): boolean {
    return this.apply({
      type: 'duplicateGridItem',
      itemId,
      duplicateId: options.duplicateId ?? generateUniqueId(),
      source,
    })
  }

  clearHistory(): void {
    this.history.clear()
  }

  get canUndo() {
    return this.history.canUndo
  }

  get canRedo() {
    return this.history.canRedo
  }

  get lastUndoLabel(): string | null {
    return this.history.lastUndoCommand
      ? getCommandLabel(this.history.lastUndoCommand, 'undo')
      : null
  }

  get lastRedoLabel(): string | null {
    return this.history.lastRedoCommand
      ? getCommandLabel(this.history.lastRedoCommand, 'redo')
      : null
  }
}
