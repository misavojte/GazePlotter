import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { ErrorService } from '$lib/errors'
import type { ToastState } from '$lib/toaster/toastState.svelte'
import { GridState } from '$lib/workspace/grid/store.svelte'
import {
  createCommandHandler,
  createRootCommand,
  type UpdateAoisCommand,
  type UpdateEventDataCommand,
  type UpdateEventChannelsCommand,
  type UpdateNoAoiTreatmentCommand,
  type UpdateCategoriesCommand,
  type UpdateParticipantsCommand,
  type UpdateParticipantsGroupsCommand,
  type UpdateStimuliCommand,
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
  ParticipantsGroup,
} from '$lib/data/types'

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

  constructor(deps: WorkspaceServiceDeps) {
    this.errorService = deps.errorService
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
        context: {
          command,
        },
      })
      return false
    }
  }

  apply(command: WorkspaceCommandChain): boolean {
    return this.execute(command)
  }

  applyRoot(command: WorkspaceCommand): boolean {
    return this.execute(createRootCommand(command))
  }

  undo(): boolean {
    const commands = this.history.undo()
    if (!commands) return false

    let success = true

    try {
      for (const command of commands) {
        if (!this.execute(command)) {
          success = false
          break
        }
      }
    } finally {
      this.history.endUndoRedo()
    }

    return success
  }

  redo(): boolean {
    const commands = this.history.redo()
    if (!commands) return false

    let success = true

    try {
      for (const command of commands) {
        if (!this.execute(command)) {
          success = false
          break
        }
      }
    } finally {
      this.history.endUndoRedo()
    }

    return success
  }

  resetLayout(layoutState: GridItemSnapshot[]): boolean {
    return this.applyRoot({
      type: 'setLayoutState',
      layoutState,
      source: 'workspace',
    })
  }

  addVisualization(
    vizType: string,
    source: string,
    itemId?: number,
    position?: { x: number; y: number }
  ): boolean {
    return this.applyRoot({
      type: 'addGridItem',
      vizType: vizType as keyof GridItemMap,
      source,
      itemId: itemId ?? generateUniqueId(),
      ...(position ? { position } : {}),
    })
  }

  updateItemSettings(
    itemId: number,
    settings: Partial<AllPlotSettings>,
    source: string
  ): boolean {
    return this.applyRoot({
      type: 'updateSettings',
      itemId,
      settings,
      source,
    })
  }

  updateItemLayout(
    itemId: number,
    layout: GridItemLayoutUpdate,
    source: string
  ): boolean {
    return this.applyRoot({
      type: 'updateLayout',
      itemId,
      layout,
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
    options: {
      duplicateId?: number
      position?: { x: number; y: number }
    } = {}
  ): boolean {
    return this.applyRoot({
      type: 'duplicateGridItem',
      itemId,
      duplicateId: options.duplicateId ?? generateUniqueId(),
      source,
      ...(options.position ? { position: options.position } : {}),
    })
  }

  updateParticipants(
    participants: BaseInterpretedDataType[],
    source: string
  ): boolean {
    const command: UpdateParticipantsCommand = {
      type: 'updateParticipants',
      participants,
      source,
    }
    return this.applyRoot(command)
  }

  updateStimuli(stimuli: BaseInterpretedDataType[], source: string): boolean {
    const command: UpdateStimuliCommand = {
      type: 'updateStimuli',
      stimuli,
      source,
    }
    return this.applyRoot(command)
  }

  updateParticipantsGroups(
    groups: ParticipantsGroup[],
    source: string
  ): boolean {
    const command: UpdateParticipantsGroupsCommand = {
      type: 'updateParticipantsGroups',
      groups,
      source,
    }
    return this.applyRoot(command)
  }

  updateAois(
    aois: ExtendedInterpretedDataType[],
    stimulusId: number,
    applyTo: UpdateAoisCommand['applyTo'],
    source: string,
    hiddenAois?: number[]
  ): boolean {
    const command: UpdateAoisCommand = {
      type: 'updateAois',
      aois,
      stimulusId,
      applyTo,
      source,
      ...(hiddenAois !== undefined ? { hiddenAois } : {}),
    }
    return this.applyRoot(command)
  }

  updateEventData(
    stimulusId: number,
    channelDefs: string[][],
    eventBuffers: number[][][],
    source: string
  ): boolean {
    const command: UpdateEventDataCommand = {
      type: 'updateEventData',
      stimulusId,
      channelDefs,
      eventBuffers,
      source,
    }
    return this.applyRoot(command)
  }

  updateEventChannels(
    channels: ExtendedInterpretedDataType[],
    stimulusId: number,
    source: string,
    hiddenChannels?: number[]
  ): boolean {
    const command: UpdateEventChannelsCommand = {
      type: 'updateEventChannels',
      channels,
      stimulusId,
      source,
      ...(hiddenChannels !== undefined ? { hiddenChannels } : {}),
    }
    return this.applyRoot(command)
  }

  updateNoAoiTreatment(
    noAoiTreatment: NoAoiTreatmentType,
    source: string
  ): boolean {
    const command: UpdateNoAoiTreatmentCommand = {
      type: 'updateNoAoiTreatment',
      noAoiTreatment,
      source,
    }
    return this.applyRoot(command)
  }

  updateCategories(
    categories: ExtendedInterpretedDataType[],
    source: string,
    hiddenCategories?: number[]
  ): boolean {
    const command: UpdateCategoriesCommand = {
      type: 'updateCategories',
      categories,
      source,
      ...(hiddenCategories !== undefined ? { hiddenCategories } : {}),
    }
    return this.applyRoot(command)
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
    return this.history.lastUndoCommandType
      ? getCommandLabel(this.history.lastUndoCommandType, 'undo')
      : null
  }

  get lastRedoLabel(): string | null {
    return this.history.lastRedoCommandType
      ? getCommandLabel(this.history.lastRedoCommandType, 'redo')
      : null
  }
}
