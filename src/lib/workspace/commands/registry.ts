import type {
  WorkspaceCommand,
  WorkspaceCommandChain,
} from './types'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { createChildCommand } from './utils'
import { resolvePlotDefinition } from '$lib/plots/registry'
import { GridState } from '$lib/workspace/grid'
import {
  updateHiddenAoisWithPropagation,
  updateMultipleAoi,
  updateMultipleParticipants,
  updateMultipleStimuli,
  updateNoAoiTreatment,
  updateParticipantsGroups,
  updateEventData,
  updateEventChannels,
  updateHiddenEventChannels,
  updateCategories,
  getDefaultCategoryColor,
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

  const requireMetadata = () => {
    const meta = engine.metadata
    if (!meta) throw new Error('Data engine metadata not available for command reversal')
    return meta
  }

  function emitCollisionResolutionChildren(
    priorityItemIds: number | number[],
    chainId: number,
    context: WorkspaceCommandExecutionContext
  ): void {
    const collisionCommands =
      gridStore.resolveItemPositionCollisions(priorityItemIds)
    collisionCommands.forEach(collisionCommand => {
      context.dispatch(
        createChildCommand(
          {
            type: 'updateLayout',
            updates: [
              {
                itemId: collisionCommand.itemId,
                layout: collisionCommand.settings,
              },
            ],
            source: 'collision',
          },
          chainId
        )
      )
    })
  }

  function invokeOnCommandHooks(
    command: WorkspaceCommandChain,
    context: WorkspaceCommandExecutionContext
  ) {
    gridStore.items.forEach(item => {
      const def = resolvePlotDefinition(item.type)
      if (!def.onCommand) return

      def.onCommand(command, item as any, engine, (childCmd) => {
        context.dispatch(
          createChildCommand(childCmd, command.chainId)
        )
      })
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
    },

    updateParticipants: command => {
      updateMultipleParticipants(engine, command.participants)
      gridStore.triggerRedraw()
    },

    updateStimuli: command => {
      updateMultipleStimuli(engine, command.stimuli)
      gridStore.triggerRedraw()
    },

    updateEventData: command => {
      const { stimulusId, channelDefs, eventBuffers, hiddenChannels, orderVector } =
        command
      updateEventData(engine, stimulusId, channelDefs, eventBuffers, orderVector)
      if (hiddenChannels !== undefined) {
        updateHiddenEventChannels(engine, stimulusId, hiddenChannels)
      }
      gridStore.triggerRedraw()
    },

    updateEventChannels: command => {
      const { channels, stimulusId, hiddenChannels } = command
      updateEventChannels(engine, channels, stimulusId)
      if (hiddenChannels !== undefined) {
        updateHiddenEventChannels(engine, stimulusId, hiddenChannels)
      }
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

    updateCategories: command => {
      const { categories, hiddenCategories } = command
      updateCategories(engine, categories, hiddenCategories)
      gridStore.triggerRedraw()
    },

    updateSettings: command => {
      for (const { itemId, settings } of command.updates) {
        const currentItem = gridStore.items.find(item => item.id === itemId)
        if (!currentItem) throw new Error(`Grid item ${itemId} not found`)

        gridStore.updateItem(itemId, settings)
        gridStore.updateLayout(itemId, {
          redrawTimestamp: Date.now(),
        })
      }

      // No collision resolution here: settings patches never touch x/y/w/h, so
      // a settings change can't introduce overlaps (unlike updateLayout).
    },

    updateLayout: (command, context) => {
      for (const { itemId, layout } of command.updates) {
        const currentItem = gridStore.items.find(item => item.id === itemId)
        if (!currentItem) throw new Error(`Grid item ${itemId} not found`)

        gridStore.updateLayout(itemId, {
          ...layout,
          redrawTimestamp: Date.now(),
        })
      }

      if (command.isRootCommand && !context.isUndoRedoOperation) {
        // All moved items are priority (fixed) for collision resolution, so
        // a group move pushes only non-members aside — members keep their
        // relative layout.
        emitCollisionResolutionChildren(
          command.updates.map(u => u.itemId),
          command.chainId,
          context
        )
      }
    },

    addGridItem: (command, context) => {
      const { vizType, options, itemId, position } = command
      // cmd.vizType is now type-checked against GridItemMap keys
      const createdId = gridStore.addItem(
        vizType as keyof GridItemMap,
        {
          ...options,
          id: itemId,
          type: vizType as keyof GridItemMap,
        },
        position
      )
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
        command.duplicateId,
        command.position
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
      const dataMeta = requireMetadata()
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
      const dataMeta = requireMetadata()
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
      const dataMeta = requireMetadata()
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

    updateEventData: (cmd, meta) => {
      const dataMeta = requireMetadata()
      const ed = dataMeta.eventData
      const currentDefs = ed.data[cmd.stimulusId] ?? []
      const currentBuffers = ed.events[cmd.stimulusId] ?? []
      // Applying the command resets the hidden list and the order vector
      // (the engine owns that invariant), so the inverse must always carry
      // both — not only when the forward command set them.
      const hidden = ed.hiddenChannels?.[cmd.stimulusId] ?? []
      const order = ed.orderVector?.[cmd.stimulusId] ?? []
      return withMeta(
        {
          type: 'updateEventData',
          stimulusId: cmd.stimulusId,
          channelDefs: currentDefs.map(d => [...d]),
          eventBuffers: currentBuffers.map(ch =>
            ch.map(p => [...p])
          ),
          hiddenChannels: [...hidden],
          ...(order.length > 0 ? { orderVector: [...order] } : {}),
        },
        meta
      )
    },

    updateEventChannels: (cmd, meta) => {
      const dataMeta = requireMetadata()
      const ed = dataMeta.eventData
      const currentDefs = ed.data[cmd.stimulusId] ?? []
      const order = ed.orderVector?.[cmd.stimulusId] ?? []
      const ids =
        order.length > 0
          ? order
          : Array.from({ length: currentDefs.length }, (_, i) => i)

      const channels: ExtendedInterpretedDataType[] = ids.map(id => {
        const ch = currentDefs[id]
        return {
          id,
          originalName: ch?.[0] ?? '',
          displayedName: ch?.[1] ?? ch?.[0] ?? '',
          color: ch?.[2] ?? '#888888',
        }
      })

      const shouldIncludeHidden = cmd.hiddenChannels !== undefined
      const hidden = ed.hiddenChannels?.[cmd.stimulusId] ?? []
      return withMeta(
        {
          type: 'updateEventChannels',
          stimulusId: cmd.stimulusId,
          channels,
          ...(shouldIncludeHidden ? { hiddenChannels: [...hidden] } : {}),
        },
        meta
      )
    },

    updateParticipantsGroups: (_cmd, meta) => {
      const dataMeta = requireMetadata()
      const currentGroups = dataMeta.participantsGroups || []
      return withMeta(
        { type: 'updateParticipantsGroups', groups: currentGroups },
        meta
      )
    },

    updateNoAoiTreatment: (_cmd, meta) => {
      const dataMeta = requireMetadata()
      const currentNoAoiTreatment = dataMeta.noAoiTreatment
      return withMeta(
        {
          type: 'updateNoAoiTreatment',
          noAoiTreatment: currentNoAoiTreatment,
        },
        meta
      )
    },

    updateCategories: (cmd, meta) => {
      const dataMeta = requireMetadata()
      const currentDefs = dataMeta.categories.data || []
      const order = dataMeta.categories.orderVector || []
      const ids =
        order.length > 0
          ? order
          : Array.from({ length: currentDefs.length }, (_, i) => i)

      const categories: ExtendedInterpretedDataType[] = ids.map(id => {
        const c = currentDefs[id]
        return {
          id,
          originalName: c?.[0] ?? '',
          displayedName: c?.[1] ?? c?.[0] ?? '',
          color: c?.[2] ?? getDefaultCategoryColor(id),
        }
      })

      const shouldIncludeHidden = cmd.hiddenCategories !== undefined
      const hidden = dataMeta.categories.hiddenCategories ?? []
      return withMeta(
        {
          type: 'updateCategories',
          categories,
          ...(shouldIncludeHidden ? { hiddenCategories: [...hidden] } : {}),
        },
        meta
      )
    },

    updateSettings: (cmd, meta) => {
      const currentItems = gridStore.items
      const reverseUpdates = cmd.updates.map(({ itemId, settings }) => {
        const currentItem = currentItems.find(item => item.id === itemId)
        if (!currentItem) {
          throw new Error(
            `Cannot reverse updateSettings: item ${itemId} not found`
          )
        }
        const reverseSettings: Partial<AllPlotSettings> = {}
        Object.keys(settings).forEach(key => {
          const typedKey = key as keyof typeof currentItem.settings
          Object.assign(reverseSettings, {
            [typedKey]: currentItem.settings[typedKey],
          })
        })
        return { itemId, settings: reverseSettings }
      })
      return withMeta(
        {
          type: 'updateSettings',
          updates: reverseUpdates,
        },
        meta
      )
    },

    updateLayout: (cmd, meta) => {
      const currentItems = gridStore.items
      const reverseUpdates = cmd.updates.map(({ itemId, layout }) => {
        const currentItem = currentItems.find(item => item.id === itemId)
        if (!currentItem) {
          throw new Error(
            `Cannot reverse updateLayout: item ${itemId} not found`
          )
        }
        const reverseLayout: GridItemLayoutUpdate = {}
        Object.keys(layout).forEach(key => {
          const typedKey = key as keyof GridItemLayoutUpdate
          Object.assign(reverseLayout, {
            [typedKey]: currentItem[typedKey as keyof typeof currentItem],
          })
        })
        return { itemId, layout: reverseLayout }
      })

      return withMeta(
        {
          type: 'updateLayout',
          updates: reverseUpdates,
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
    if (command.isRootCommand && !context.isUndoRedoOperation) {
      invokeOnCommandHooks(command, context)
    }
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
