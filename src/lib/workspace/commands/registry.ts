import type {
  WorkspaceCommand,
  WorkspaceCommandChain,
} from '$lib/workspace/commands'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { createChildCommand } from '$lib/workspace/commands'
import { SCARF_IDENTIFIERS } from '$lib/plots/scarf'
import { GridState } from '$lib/workspace/grid'
import {
  updateHiddenAoisWithPropagation,
  updateMultipleAoi,
  updateMultipleAoiVisibility,
  updateMultipleParticipants,
  updateMultipleStimuli,
  updateNoAoiTreatment,
  updateParticipantsGroups,
} from '$lib/data/engine'
import type {
  GridItemMap,
  AllPlotSettings,
  GridItemLayoutUpdate,
  GridItemSnapshot,
} from '$lib/workspace'
import type {
  ExtendedInterpretedDataType,
  BaseInterpretedDataType,
} from '$lib/data/types'

const DEFAULT_AOI_COLORS = [
  '#66c5cc',
  '#f6cf71',
  '#f89c74',
  '#dcb0f2',
  '#87c55f',
]

export type WorkspaceCommandDispatcher = (
  command: WorkspaceCommandChain
) => void

export type WorkspaceCommandExecutionContext = {
  isUndoRedoOperation: boolean
  dispatch: WorkspaceCommandDispatcher
}

type CommandMeta = Pick<
  WorkspaceCommandChain,
  'source' | 'chainId' | 'isRootCommand'
>

// Define a type for handlers that maps the command 'type' to its specific interface
type CommandHandlers = {
  [T in WorkspaceCommand['type']]: (
    command: Extract<WorkspaceCommandChain, { type: T }>,
    context: WorkspaceCommandExecutionContext
  ) => void
}

type ReverseHandlers = {
  [T in WorkspaceCommand['type']]: (
    command: Extract<WorkspaceCommandChain, { type: T }>,
    meta: CommandMeta
  ) => WorkspaceCommandChain | null
}

type CommandType = WorkspaceCommandChain['type']
type CommandOfType<TType extends CommandType> = Extract<
  WorkspaceCommandChain,
  { type: TType }
>

export type WorkspaceCommandRegistry = {
  execute: (
    command: WorkspaceCommandChain,
    context: WorkspaceCommandExecutionContext
  ) => void
  reverse: (command: WorkspaceCommandChain) => WorkspaceCommandChain | null
}

export type WorkspaceCommandRegistryErrorContext = {
  phase: 'reverse'
  command: WorkspaceCommandChain
}

export function createWorkspaceCommandRegistry(
  gridStore: GridState,
  engine: DataEngine,
  onError?: (
    error: unknown,
    context: WorkspaceCommandRegistryErrorContext
  ) => void
): WorkspaceCommandRegistry {
  const withMeta = (base: object, meta: CommandMeta): WorkspaceCommandChain => {
    return { ...base, ...meta } as unknown as WorkspaceCommandChain
  }

  function emitCollisionResolutionChildren(
    priorityItemId: number,
    chainId: number,
    context: WorkspaceCommandExecutionContext
  ): void {
    const collisionCommands =
      gridStore.resolveItemPositionCollisions(priorityItemId)
    collisionCommands.forEach(collisionCommand => {
      context.dispatch(
        createChildCommand(
          {
            type: 'updateLayout',
            itemId: collisionCommand.itemId,
            layout: collisionCommand.settings,
            source: 'collision',
          },
          chainId
        )
      )
    })
  }

  type AoiLike = { id: string | number }

  function sanitizeScarfHighlightsAfterAoiRename(
    command: Extract<WorkspaceCommandChain, { type: 'updateAois' }>,
    context: WorkspaceCommandExecutionContext
  ) {
    if (!command.isRootCommand || context.isUndoRedoOperation) return

    const renamedAois = (command.aois || []) as AoiLike[]
    const affectedIdentifiers = new Set<string>(
      renamedAois.map(a => `${SCARF_IDENTIFIERS.AOI}${a.id}`)
    )

    gridStore.items.forEach(item => {
      if (item.type !== 'scarf') return
      const highlights = item.settings.highlights ?? []
      const hasMatch = highlights.some(h => affectedIdentifiers.has(h))
      if (!hasMatch) return

      const newHighlights = highlights.filter(h => !affectedIdentifiers.has(h))
      if (newHighlights.length === highlights.length) return

      context.dispatch(
        createChildCommand(
          {
            type: 'updateSettings',
            itemId: item.id,
            settings: { highlights: newHighlights },
            source: 'aoi.rename',
          },
          command.chainId
        )
      )
    })
  }

  const handlers: CommandHandlers = {
    updateAois: (command, context) => {
      const { aois, stimulusId, applyTo, hiddenAois } = command
      updateMultipleAoi(engine, aois, stimulusId, applyTo)
      if (hiddenAois !== undefined) {
        updateHiddenAoisWithPropagation(engine, stimulusId, hiddenAois, applyTo)
      }
      gridStore.triggerRedraw()
      sanitizeScarfHighlightsAfterAoiRename(command, context)
    },

    updateParticipants: command => {
      updateMultipleParticipants(engine, command.participants)
      gridStore.triggerRedraw()
    },

    updateStimuli: command => {
      updateMultipleStimuli(engine, command.stimuli)
      gridStore.triggerRedraw()
    },

    updateAoiVisibility: command => {
      const { stimulusId, aoiNames, visibilityArr, participantId } = command
      updateMultipleAoiVisibility(
        engine,
        stimulusId,
        aoiNames,
        visibilityArr,
        participantId
      )
      gridStore.triggerRedraw()
    },

    updateParticipantsGroups: command => {
      updateParticipantsGroups(engine, command.groups)
      gridStore.triggerRedraw()
    },

    updateNoAoiTreatment: command => {
      updateNoAoiTreatment(engine, command.noAoiTreatment)
      gridStore.triggerRedraw()
    },

    updateSettings: (command, context) => {
      const { itemId, settings } = command
      const currentItem = gridStore.items.find(item => item.id === itemId)
      if (!currentItem) throw new Error(`Grid item ${itemId} not found`)

      gridStore.updateItem(itemId, settings)
      gridStore.updateLayout(itemId, {
        redrawTimestamp: Date.now(),
      })

      if (command.isRootCommand && !context.isUndoRedoOperation) {
        emitCollisionResolutionChildren(itemId, command.chainId, context)
      }
    },

    updateLayout: (command, context) => {
      const { itemId, layout } = command
      const currentItem = gridStore.items.find(item => item.id === itemId)
      if (!currentItem) throw new Error(`Grid item ${itemId} not found`)

      gridStore.updateLayout(itemId, {
        ...layout,
        redrawTimestamp: Date.now(),
      })

      if (command.isRootCommand && !context.isUndoRedoOperation) {
        emitCollisionResolutionChildren(itemId, command.chainId, context)
      }
    },

    addGridItem: (command, context) => {
      const { vizType, options, itemId } = command
      // cmd.vizType is now type-checked against GridItemMap keys
      const createdId = gridStore.addItem(vizType as keyof GridItemMap, {
        ...options,
        id: itemId,
        type: vizType as keyof GridItemMap,
      })
      if (command.isRootCommand && !context.isUndoRedoOperation) {
        emitCollisionResolutionChildren(createdId, command.chainId, context)
      }
    },

    removeGridItem: command => {
      gridStore.removeItem(command.itemId)
    },

    duplicateGridItem: (command, context) => {
      const currentItem = gridStore.items.find(
        item => item.id === command.itemId
      )
      if (!currentItem) throw new Error(`Grid item ${command.itemId} not found`)

      const createdId = gridStore.duplicateItem(
        currentItem,
        command.duplicateId
      )
      if (command.isRootCommand && !context.isUndoRedoOperation) {
        emitCollisionResolutionChildren(createdId, command.chainId, context)
      }
    },

    setLayoutState: command => {
      gridStore.setLayoutState(command.layoutState)
    },
  }

  const reverseHandlers: ReverseHandlers = {
    updateAois: (cmd, meta) => {
      const dataMeta = engine.metadata
      if (!dataMeta)
        throw new Error(
          'Data engine metadata not available for command reversal'
        )
      const stimulusId = cmd.stimulusId
      const currentAois = dataMeta.aois.data[stimulusId] || []
      const affectedAois: ExtendedInterpretedDataType[] = []
      for (let aoiIndex = 0; aoiIndex < currentAois.length; aoiIndex++) {
        const aoiRow = currentAois[aoiIndex]
        const originalName = aoiRow?.[0] ?? ''
        const displayedName = aoiRow?.[1] ?? originalName
        const color =
          aoiRow?.[2] ??
          DEFAULT_AOI_COLORS[aoiIndex % DEFAULT_AOI_COLORS.length]
        affectedAois.push({
          id: aoiIndex,
          originalName,
          displayedName,
          color,
        })
      }
      const shouldIncludeHiddenAois = cmd.hiddenAois !== undefined
      const hiddenAois = dataMeta?.aois?.hiddenAois?.[stimulusId] ?? []
      return withMeta(
        {
          type: 'updateAois',
          aois: affectedAois,
          stimulusId,
          applyTo: cmd.applyTo,
          ...(shouldIncludeHiddenAois ? { hiddenAois: [...hiddenAois] } : {}),
        },
        meta
      )
    },

    updateParticipants: (_cmd, meta) => {
      const dataMeta = engine.metadata
      if (!dataMeta)
        throw new Error(
          'Data engine metadata not available for command reversal'
        )
      const currentParticipants = dataMeta.participants.data || []
      const participants: BaseInterpretedDataType[] = currentParticipants.map(
        ([originalName, displayedName]: string[], index: number) => ({
          id: index,
          originalName,
          displayedName,
        })
      )
      return withMeta({ type: 'updateParticipants', participants }, meta)
    },

    updateStimuli: (_cmd, meta) => {
      const dataMeta = engine.metadata
      if (!dataMeta)
        throw new Error(
          'Data engine metadata not available for command reversal'
        )
      const currentStimuli = dataMeta.stimuli.data || []
      const stimuli: BaseInterpretedDataType[] = currentStimuli.map(
        ([originalName, displayedName]: string[], index: number) => ({
          id: index,
          originalName,
          displayedName,
        })
      )
      return withMeta({ type: 'updateStimuli', stimuli }, meta)
    },

    updateAoiVisibility: (cmd, meta) => {
      const dataMeta = engine.metadata
      if (!dataMeta)
        throw new Error(
          'Data engine metadata not available for command reversal'
        )
      const currentAoiVisibility = dataMeta.aois.dynamicVisibility || {}
      const affectedVisibility: {
        aoiName: string
        visibilityArr: number[]
      }[] = []

      Object.entries(currentAoiVisibility).forEach(([key, visibilityArr]) => {
        const [stimulusIdStr, aoiIdStr, participantIdStr] = key.split('_')
        const stimulusId = parseInt(stimulusIdStr, 10)
        const participantId = parseInt(participantIdStr, 10)
        if (
          stimulusId === cmd.stimulusId &&
          (cmd.participantId == null || participantId === cmd.participantId)
        ) {
          const aoiData =
            dataMeta?.aois?.data?.[stimulusId]?.[parseInt(aoiIdStr, 10)]
          const aoiName = aoiData?.[1] || `AOI_${aoiIdStr}`
          affectedVisibility.push({
            aoiName,
            visibilityArr: visibilityArr as number[],
          })
        }
      })

      if (affectedVisibility.length === 0) {
        throw new Error(
          `Cannot reverse updateAoiVisibility: no visibility data found for stimulus ${cmd.stimulusId}`
        )
      }

      const visibilityArr = affectedVisibility.map(v => v.visibilityArr)
      const aoiNames = affectedVisibility.map(v => v.aoiName)
      return withMeta(
        {
          type: 'updateAoiVisibility',
          stimulusId: cmd.stimulusId,
          aoiNames,
          visibilityArr,
          participantId: cmd.participantId,
        },
        meta
      )
    },

    updateParticipantsGroups: (_cmd, meta) => {
      const dataMeta = engine.metadata
      if (!dataMeta)
        throw new Error(
          'Data engine metadata not available for command reversal'
        )
      const currentGroups = dataMeta.participantsGroups || []
      return withMeta(
        { type: 'updateParticipantsGroups', groups: currentGroups },
        meta
      )
    },

    updateNoAoiTreatment: (_cmd, meta) => {
      const dataMeta = engine.metadata
      if (!dataMeta)
        throw new Error(
          'Data engine metadata not available for command reversal'
        )
      const currentNoAoiTreatment = dataMeta.noAoiTreatment
      return withMeta(
        {
          type: 'updateNoAoiTreatment',
          noAoiTreatment: currentNoAoiTreatment,
        },
        meta
      )
    },

    updateSettings: (cmd, meta) => {
      const currentItems = gridStore.items
      const currentItem = currentItems.find(item => item.id === cmd.itemId)
      if (!currentItem) {
        throw new Error(
          `Cannot reverse updateSettings: item ${cmd.itemId} not found`
        )
      }
      const reverseSettings: Partial<AllPlotSettings> = {}
      Object.keys(cmd.settings).forEach(key => {
        const typedKey = key as keyof typeof currentItem.settings
        Object.assign(reverseSettings, {
          [typedKey]: currentItem.settings[typedKey],
        })
      })
      return withMeta(
        {
          type: 'updateSettings',
          itemId: cmd.itemId,
          settings: reverseSettings,
        },
        meta
      )
    },

    updateLayout: (cmd, meta) => {
      const currentItems = gridStore.items
      const currentItem = currentItems.find(item => item.id === cmd.itemId)
      if (!currentItem) {
        throw new Error(
          `Cannot reverse updateLayout: item ${cmd.itemId} not found`
        )
      }

      const reverseLayout: GridItemLayoutUpdate = {}
      Object.keys(cmd.layout).forEach(key => {
        const typedKey = key as keyof GridItemLayoutUpdate
        Object.assign(reverseLayout, {
          [typedKey]: currentItem[typedKey as keyof typeof currentItem],
        })
      })

      return withMeta(
        {
          type: 'updateLayout',
          itemId: cmd.itemId,
          layout: reverseLayout,
        },
        meta
      )
    },

    addGridItem: (cmd, meta) =>
      withMeta({ type: 'removeGridItem', itemId: cmd.itemId }, meta),

    removeGridItem: (cmd, meta) => {
      const currentItems = gridStore.items
      const removedItem = currentItems.find(item => item.id === cmd.itemId)
      if (!removedItem) {
        throw new Error(
          `Cannot reverse removeGridItem: item ${cmd.itemId} not found in current state`
        )
      }
      const { id, type, redrawTimestamp, ...options } = removedItem
      return withMeta(
        {
          type: 'addGridItem',
          vizType: removedItem.type,
          itemId: removedItem.id,
          options: {
            ...options,
            id: removedItem.id,
            settings: { ...removedItem.settings },
          },
        },
        meta
      )
    },

    duplicateGridItem: (cmd, meta) => {
      if (!cmd.duplicateId) {
        throw new Error(
          `Cannot reverse duplicateGridItem: duplicateId not found in command`
        )
      }
      return withMeta({ type: 'removeGridItem', itemId: cmd.duplicateId }, meta)
    },

    setLayoutState: (_cmd, meta) => {
      const currentItems = gridStore.items
      const currentLayoutState = currentItems.map(item => {
        const { redrawTimestamp, ...itemData } = item
        return {
          ...itemData,
          settings: { ...item.settings },
        } as GridItemSnapshot
      })
      return withMeta(
        { type: 'setLayoutState', layoutState: currentLayoutState },
        meta
      )
    },
  }

  function execute(
    command: WorkspaceCommandChain,
    context: WorkspaceCommandExecutionContext
  ): void {
    executeTypedCommand(command, context)
  }

  function executeTypedCommand<TType extends CommandType>(
    command: CommandOfType<TType>,
    context: WorkspaceCommandExecutionContext
  ): void {
    const handler = handlers[command.type]
    handler(command, context)
  }

  function reverse(
    command: WorkspaceCommandChain
  ): WorkspaceCommandChain | null {
    try {
      const meta: CommandMeta = {
        source: command.source,
        chainId: command.chainId,
        isRootCommand: command.isRootCommand,
      }

      return reverseTypedCommand(command, meta)
    } catch (error) {
      onError?.(error, { phase: 'reverse', command })
      return null
    }
  }

  function reverseTypedCommand<TType extends CommandType>(
    command: CommandOfType<TType>,
    meta: CommandMeta
  ): WorkspaceCommandChain | null {
    const handler = reverseHandlers[command.type]
    return handler(command, meta)
  }

  return { execute, reverse }
}
