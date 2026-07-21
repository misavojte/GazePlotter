import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { ErrorService } from '$lib/errors'
import type { ToastState } from '$lib/toaster/toastState.svelte'
import { GridState } from '$lib/workspace/grid/gridState.svelte'
import {
  createCommandHandler,
  createRootCommand,
  type UpdateAoisCommand,
  type ReconcileMergesCommand,
  type SelectionsAxis,
  type SelectionsByAxis,
  type WorkspaceCommand,
  type WorkspaceCommandChain,
  UndoRedoStateStore,
} from '$lib/workspace/commands'
import { getCommandLabel } from '$lib/workspace/commands/labels'
import { generateUniqueId } from '$lib/shared/utils/idUtils'
import type {
  AllPlotSettings,
  GridItemMap,
  GridItemSnapshot,
  GridItemLayoutUpdate,
} from '$lib/workspace'
import type {
  BaseInterpretedDataType,
  ExtendedInterpretedDataType,
  NoAoiTreatmentType,
} from '$lib/data/types'
import type { MetricInstance } from '$lib/metrics'

function isWorkspaceHistoryError(error: unknown): boolean {
  return error instanceof Error && error.name === 'WorkspaceHistoryError'
}

type WorkspaceServiceDeps = {
  engine: DataEngine
  errorService: Pick<ErrorService, 'report'>
  grid: GridState
  toastState: Pick<ToastState, 'addSuccess'>
}

export class WorkspaceService {
  readonly history = new UndoRedoStateStore()

  private onCommandApplied: (command: WorkspaceCommandChain) => void = () => {}

  private readonly handleCommand: (command: WorkspaceCommandChain) => void
  private readonly errorService: Pick<ErrorService, 'report'>
  private readonly grid: GridState

  constructor(deps: WorkspaceServiceDeps) {
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

  applyRoot(command: WorkspaceCommand): boolean {
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

  resetLayout(layoutState: GridItemSnapshot[]): boolean {
    return this.applyRoot({
      type: 'setLayoutState',
      layoutState,
      source: 'workspace',
    })
  }

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
    return this.resetLayout(initialLayoutState)
  }

  addVisualization(vizType: string, source: string, itemId?: number): boolean {
    return this.applyRoot({
      type: 'addGridItem',
      vizType: vizType as keyof GridItemMap,
      source,
      itemId: itemId ?? generateUniqueId(),
    })
  }

  updateItemSettings(
    itemId: number,
    settings: Partial<AllPlotSettings>,
    source: string
  ): boolean {
    return this.applyRoot({
      type: 'updateSettings',
      updates: [{ itemId, settings }],
      source,
    })
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
    return this.applyRoot({
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
    return this.applyRoot({ type: 'updateSettings', updates, source })
  }

  updateItemLayout(
    itemId: number,
    layout: GridItemLayoutUpdate,
    source: string
  ): boolean {
    return this.applyRoot({
      type: 'updateLayout',
      updates: [{ itemId, layout }],
      source,
    })
  }

  /**
   * Moves/resizes several items as ONE atomic command (single undo step) —
   * used by group move. A single-item layout change is just `updateItemLayout`
   * (a set of one); same command, same code path.
   */
  updateItemsLayout(
    updates: { itemId: number; layout: GridItemLayoutUpdate }[],
    source: string
  ): boolean {
    if (updates.length === 0) return true
    return this.applyRoot({
      type: 'updateLayout',
      updates,
      source,
    })
  }

  removeVisualization(itemId: number, source: string): boolean {
    return this.applyRoot({
      type: 'removeGridItem',
      itemId,
      source,
    })
  }

  duplicateVisualization(
    itemId: number,
    source: string,
    options: { duplicateId?: number } = {}
  ): boolean {
    return this.applyRoot({
      type: 'duplicateGridItem',
      itemId,
      duplicateId: options.duplicateId ?? generateUniqueId(),
      source,
    })
  }

  /**
   * Commit the entity modification modal for one merge axis as ONE atomic step
   * (PLANMERGE.md M2 UX): edited names + order plus the desired merge groups,
   * reconciled against the current merges in a single chain so rename, merge
   * and un-merge undo together. See {@link ReconcileMergesCommand}.
   */
  reconcileMerges(
    axis: 'participant' | 'stimulus',
    items: BaseInterpretedDataType[],
    groups: ReconcileMergesCommand['groups'],
    source: string
  ): boolean {
    return this.applyRoot({
      type: 'reconcileMerges',
      axis,
      items,
      groups,
      source,
    })
  }

  /**
   * Replace one axis' SELECTIONS wholesale (create/rename/delete/edit are all
   * deltas of the same array). One undoable step; metadata-only.
   */
  updateSelections<A extends SelectionsAxis>(
    axis: A,
    selections: SelectionsByAxis[A],
    source: string
  ): boolean {
    return this.applyRoot({
      type: 'updateSelections',
      axis,
      selections,
      source,
    } as WorkspaceCommand)
  }

  /**
   * Replaces the metric library wholesale (rename/create/delete/replace/
   * reorder are all deltas of the same array). The ONLY mutation path for
   * `metadata.metricInstances` — going through the command bus gives metric
   * edits undo/redo and the workspace-wide redraw epoch bump.
   */
  updateMetricInstances(
    instances: MetricInstance[],
    source: string
  ): boolean {
    return this.applyRoot({ type: 'updateMetricInstances', instances, source })
  }

  updateAois(
    aois: ExtendedInterpretedDataType[],
    stimulusId: number,
    applyTo: UpdateAoisCommand['applyTo'],
    source: string
  ): boolean {
    return this.applyRoot({
      type: 'updateAois',
      aois,
      stimulusId,
      applyTo,
      source,
    })
  }

  updateEventData(
    stimulusId: number,
    channelDefs: string[][],
    eventBuffers: number[][][],
    source: string
  ): boolean {
    return this.applyRoot({
      type: 'updateEventData',
      stimulusId,
      channelDefs,
      eventBuffers,
      source,
    })
  }

  updateEventChannels(
    channels: ExtendedInterpretedDataType[],
    stimulusId: number,
    source: string
  ): boolean {
    return this.applyRoot({
      type: 'updateEventChannels',
      channels,
      stimulusId,
      source,
    })
  }

  updateNoAoiTreatment(
    noAoiTreatment: NoAoiTreatmentType,
    source: string
  ): boolean {
    return this.applyRoot({
      type: 'updateNoAoiTreatment',
      noAoiTreatment,
      source,
    })
  }

  updateCategories(
    categories: ExtendedInterpretedDataType[],
    source: string
  ): boolean {
    return this.applyRoot({ type: 'updateCategories', categories, source })
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
