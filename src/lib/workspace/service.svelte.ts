import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { ToastState } from '$lib/toaster/toastState.svelte'
import { GridState } from '$lib/workspace/grid/store.svelte'
import {
  createCommandHandler,
  createRootCommand,
  type UpdateAoiVisibilityCommand,
  type UpdateAoisCommand,
  type UpdateNoAoiTreatmentCommand,
  type UpdateParticipantsCommand,
  type UpdateParticipantsGroupsCommand,
  type UpdateStimuliCommand,
  type WorkspaceCommand,
  type WorkspaceCommandChain,
  UndoRedoStateStore,
} from '$lib/workspace/commands'
import { getCommandLabel } from '$lib/workspace/commands/labels'
import { generateUniqueId } from '$lib/shared/utils/idUtils'
import type { AllGridTypes, GridItemMap } from '$lib/workspace/type/gridType'
import type {
  BaseInterpretedDataType,
  ExtendedInterpretedDataType,
  NoAoiTreatmentType,
  ParticipantsGroup,
} from '$lib/data/types'

type WorkspaceServiceDeps = {
  engine: DataEngine
  grid: GridState
  toastState: Pick<ToastState, 'addSuccess' | 'addError'>
}

export class WorkspaceService {
  readonly history = new UndoRedoStateStore()

  private onCommandApplied: (command: WorkspaceCommandChain) => void = () => {}

  private readonly handleCommand: (command: WorkspaceCommandChain) => void

  constructor(deps: WorkspaceServiceDeps) {
    this.handleCommand = createCommandHandler(
      deps.grid,
      deps.engine,
      this.history,
      message => deps.toastState.addSuccess(message),
      error => {
        console.error('Command error:', error)
        deps.toastState.addError(
          'Error applying changes. See console for details.'
        )
      },
      command => this.onCommandApplied(command)
    )
  }

  setCommandListener(listener: (command: WorkspaceCommandChain) => void): void {
    this.onCommandApplied = listener
  }

  apply(command: WorkspaceCommandChain): void {
    this.handleCommand(command)
  }

  applyRoot(command: WorkspaceCommand): void {
    this.handleCommand(createRootCommand(command))
  }

  undo(): void {
    const commands = this.history.undo()
    if (!commands) return
    try {
      commands.forEach(command => this.handleCommand(command))
    } finally {
      this.history.endUndoRedo()
    }
  }

  redo(): void {
    const commands = this.history.redo()
    if (!commands) return
    try {
      commands.forEach(command => this.handleCommand(command))
    } finally {
      this.history.endUndoRedo()
    }
  }

  resetLayout(
    layoutState: Array<Partial<AllGridTypes> & { type: string }>
  ): void {
    this.applyRoot({
      type: 'setLayoutState',
      layoutState,
      source: 'workspace',
    })
  }

  addVisualization(vizType: string, source: string, itemId?: number): void {
    this.applyRoot({
      type: 'addGridItem',
      vizType: vizType as keyof GridItemMap,
      source,
      itemId: itemId ?? generateUniqueId(),
    })
  }

  updateItemSettings(
    itemId: number,
    settings: Partial<AllGridTypes>,
    source: string
  ): void {
    this.applyRoot({
      type: 'updateSettings',
      itemId,
      settings,
      source,
    })
  }

  removeVisualization(itemId: number, source: string): void {
    this.applyRoot({
      type: 'removeGridItem',
      itemId,
      source,
    })
  }

  duplicateVisualization(
    itemId: number,
    source: string,
    duplicateId?: number
  ): void {
    this.applyRoot({
      type: 'duplicateGridItem',
      itemId,
      duplicateId: duplicateId ?? generateUniqueId(),
      source,
    })
  }

  updateParticipants(
    participants: BaseInterpretedDataType[],
    source: string
  ): void {
    const command: UpdateParticipantsCommand = {
      type: 'updateParticipants',
      participants,
      source,
    }
    this.applyRoot(command)
  }

  updateStimuli(stimuli: BaseInterpretedDataType[], source: string): void {
    const command: UpdateStimuliCommand = {
      type: 'updateStimuli',
      stimuli,
      source,
    }
    this.applyRoot(command)
  }

  updateParticipantsGroups(groups: ParticipantsGroup[], source: string): void {
    const command: UpdateParticipantsGroupsCommand = {
      type: 'updateParticipantsGroups',
      groups,
      source,
    }
    this.applyRoot(command)
  }

  updateAois(
    aois: ExtendedInterpretedDataType[],
    stimulusId: number,
    applyTo: UpdateAoisCommand['applyTo'],
    source: string,
    hiddenAois?: number[]
  ): void {
    const command: UpdateAoisCommand = {
      type: 'updateAois',
      aois,
      stimulusId,
      applyTo,
      source,
      ...(hiddenAois !== undefined ? { hiddenAois } : {}),
    }
    this.applyRoot(command)
  }

  updateAoiVisibility(
    stimulusId: number,
    aoiNames: string[],
    visibilityArr: number[][],
    source: string,
    participantId?: number | null
  ): void {
    const command: UpdateAoiVisibilityCommand = {
      type: 'updateAoiVisibility',
      stimulusId,
      aoiNames,
      visibilityArr,
      source,
      participantId,
    }
    this.applyRoot(command)
  }

  updateNoAoiTreatment(
    noAoiTreatment: NoAoiTreatmentType,
    source: string
  ): void {
    const command: UpdateNoAoiTreatmentCommand = {
      type: 'updateNoAoiTreatment',
      noAoiTreatment,
      source,
    }
    this.applyRoot(command)
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
