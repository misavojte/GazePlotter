import type {
  WorkspaceCommand,
  WorkspaceCommandChain,
} from './types'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { createChildCommand } from './utils'
import { mergeParticipants as computeParticipantMerge } from '$lib/data/merge/deriveMergedDataset'
import { mergeStimuli as computeStimulusMerge } from '$lib/data/merge/mergeStimuli'
import { resolvePlotDefinition } from '$lib/plots/registry'
import { GridState } from '$lib/workspace/grid'
import {
  updateHiddenAoisWithPropagation,
  updateMultipleAoi,
  updateMultipleParticipants,
  updateMultipleStimuli,
  updateNoAoiTreatment,
  updateEventData,
  updateEventChannels,
  updateHiddenEventChannels,
  updateCategories,
  getDefaultCategoryColor,
  getDefaultColor,
  getDefaultEventChannelColor,
  interpretRow,
  interpretBaseRows,
  interpretOrdered,
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

  // Find a grid item by id or throw. The throw is load-bearing on the reverse
  // path: a missing item makes the reverse handler throw, which the bus turns
  // into "no inverse -> no execution" (reverse-before-execute).
  const requireItem = (id: number, message: string) => {
    const item = gridStore.items.find(i => i.id === id)
    if (!item) throw new Error(message)
    return item
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
    updateAois: command => {
      const { aois, stimulusId, applyTo, hiddenAois } = command
      updateMultipleAoi(engine, aois, stimulusId, applyTo)
      if (hiddenAois !== undefined) {
        updateHiddenAoisWithPropagation(engine, stimulusId, hiddenAois, applyTo)
      }
      gridStore.triggerRedraw()
    },

    updateEntities: command => {
      if (command.axis === 'participant')
        updateMultipleParticipants(engine, command.items)
      else updateMultipleStimuli(engine, command.items)
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

    updateStimuliSelections: command => {
      engine.setStimuliSelections(command.selections)
    },

    updateCategoriesSelections: command => {
      engine.setCategoriesSelections(command.selections)
    },

    updateEventsSelections: command => {
      engine.setEventsSelections(command.selections)
    },

    updateParticipantsSelections: command => {
      engine.setParticipantsSelections(command.selections)
      gridStore.triggerRedraw()
    },

    updateAoiSelections: command => {
      engine.setAoiSelections(command.selections)
      gridStore.triggerRedraw()
    },

    mergeEntities: command => {
      const { axis, representativeId, memberIds, at } = command
      if (axis === 'participant')
        engine.mergeParticipants(representativeId, memberIds, at)
      else engine.mergeStimuli(representativeId, memberIds, at)
      gridStore.triggerRedraw()
    },

    unmergeEntities: command => {
      if (command.axis === 'participant')
        engine.unmergeParticipants(command.entry)
      else engine.unmergeStimuli(command.entry)
      gridStore.triggerRedraw()
    },

    // Pure orchestrator: replays the modal's merge intent as ONE chain. On a
    // normal run it emits child commands (guarded from re-running during
    // undo/redo, when the recorded children replay directly, exactly like
    // addGridItem's collision children). Sequence: unmerge everything active
    // on the axis (reverse-chronological, giving a clean un-tombstoned order),
    // commit the edited names + full order, then merge the desired groups.
    reconcileMerges: (command, context) => {
      if (context.isUndoRedoOperation) return

      const { axis, chainId, source } = command
      const dispatchChild = (cmd: WorkspaceCommand) =>
        context.dispatch(createChildCommand(cmd, chainId))

      // Every child is axis-tagged, so the axis is a pure passthrough here.
      const active = (engine.metadata?.merges ?? []).filter(e => e.axis === axis)
      for (const entry of [...active].reverse()) {
        dispatchChild({ type: 'unmergeEntities', axis, entry, source })
      }

      dispatchChild({ type: 'updateEntities', axis, items: command.items, source })

      for (const g of command.groups) {
        dispatchChild({
          type: 'mergeEntities',
          axis,
          representativeId: g.representativeId,
          memberIds: g.memberIds,
          at: g.at,
          source,
        })
      }
    },

    noop: () => {},

    updateNoAoiTreatment: command => {
      updateNoAoiTreatment(engine, command.noAoiTreatment)
      gridStore.triggerRedraw()
    },

    updateCategories: command => {
      const { categories, hiddenCategories } = command
      updateCategories(engine, categories, hiddenCategories)
      gridStore.triggerRedraw()
    },

    updateMetricInstances: command => {
      engine.setMetricInstances(command.instances)
      gridStore.triggerRedraw()
    },

    updateSettings: command => {
      for (const { itemId, settings } of command.updates) {
        requireItem(itemId, `Grid item ${itemId} not found`)

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
        requireItem(itemId, `Grid item ${itemId} not found`)

        // A layout change (move OR resize) never bumps redrawTimestamp.
        // `redrawTimestamp` means "engine data changed, re-derive" — that is what
        // `triggerRedraw` uses it for, and the scarf data transform (normalized,
        // size-independent rect buckets) keys off it. A resize must repaint but
        // NOT re-transform: the canvas already repaints reactively on its measured
        // width/height (usePlot's width/height effect), and a move just
        // repositions the existing canvas via CSS transform. Bumping here forced
        // every resized plot to rebuild all rect buckets (the dominant scarf
        // manipulation cost) for output that doesn't depend on size.
        gridStore.updateLayout(itemId, layout)
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
      const currentItem = requireItem(
        command.itemId,
        `Grid item ${command.itemId} not found`
      )

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
      const affectedAois: ExtendedInterpretedDataType[] = currentAois.map(
        (aoiRow, aoiIndex) => interpretRow(aoiRow, aoiIndex, getDefaultColor)
      )
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

    updateEntities: (cmd, meta) => {
      const dataMeta = requireMetadata()
      const table = cmd.axis === 'participant' ? dataMeta.participants : dataMeta.stimuli
      return withMeta(
        {
          type: 'updateEntities',
          axis: cmd.axis,
          items: interpretBaseRows(table.data || []),
        },
        meta
      )
    },

    updateEventData: (cmd, meta) => {
      const dataMeta = requireMetadata()
      const ed = dataMeta.eventData
      const currentDefs = ed.data[cmd.stimulusId] ?? []
      const currentBuffers = engine.getEventReader().getStimulusJson(cmd.stimulusId)
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
      const channels = interpretOrdered(
        ed.data[cmd.stimulusId] ?? [],
        ed.orderVector?.[cmd.stimulusId] ?? [],
        getDefaultEventChannelColor
      )

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

    updateParticipantsSelections: (_cmd, meta) => {
      const dataMeta = requireMetadata()
      const currentSelections = dataMeta.participantsSelections || []
      return withMeta(
        { type: 'updateParticipantsSelections', selections: currentSelections },
        meta
      )
    },

    updateStimuliSelections: (_cmd, meta) => {
      const dataMeta = requireMetadata()
      return withMeta(
        { type: 'updateStimuliSelections', selections: dataMeta.stimuliSelections ?? [] },
        meta
      )
    },

    updateCategoriesSelections: (_cmd, meta) => {
      const dataMeta = requireMetadata()
      return withMeta(
        { type: 'updateCategoriesSelections', selections: dataMeta.categoriesSelections ?? [] },
        meta
      )
    },

    updateEventsSelections: (_cmd, meta) => {
      const dataMeta = requireMetadata()
      return withMeta(
        { type: 'updateEventsSelections', selections: dataMeta.eventsSelections ?? [] },
        meta
      )
    },

    updateAoiSelections: (_cmd, meta) => {
      const dataMeta = requireMetadata()
      const currentSelections = dataMeta.aois.selections ?? []
      return withMeta(
        { type: 'updateAoiSelections', selections: currentSelections },
        meta
      )
    },

    // Reverse-before-execute: the merge log entry is a pure function of the
    // current (pre-merge) dataset, so we precompute it here — dry-running the
    // fold for the command's axis — and return the un-merge that inverts it. If
    // the merge is not disjoint the fold throws, which the handler surfaces as
    // "no inverse -> no execution", refusing the merge before any mutation.
    // (The axis picks the fold; both share a signature, so `mergeCommand.test.ts`
    // pins BOTH axes to guard against a mis-routed dry-run.)
    mergeEntities: (cmd, meta) => {
      const data = engine.toDataType()
      if (!data) return null
      const fold =
        cmd.axis === 'participant' ? computeParticipantMerge : computeStimulusMerge
      const merged = fold(data, cmd.representativeId, cmd.memberIds, cmd.at)
      const entry = merged.merges?.[merged.merges.length - 1]
      if (!entry) return null
      return withMeta({ type: 'unmergeEntities', axis: cmd.axis, entry }, meta)
    },

    unmergeEntities: (cmd, meta) =>
      withMeta(
        {
          type: 'mergeEntities',
          axis: cmd.axis,
          representativeId: cmd.entry.representativeId,
          memberIds: cmd.entry.members.map(m => m.id),
          at: cmd.entry.at,
        },
        meta
      ),

    // The orchestrator itself mutates nothing; its child commands carry the
    // real reverses. A noop keeps the bus's reverse-before-execute contract.
    reconcileMerges: (_cmd, meta) => withMeta({ type: 'noop' }, meta),

    noop: (_cmd, meta) => withMeta({ type: 'noop' }, meta),

    updateMetricInstances: (_cmd, meta) => {
      const dataMeta = requireMetadata()
      const currentInstances = dataMeta.metricInstances ?? []
      return withMeta(
        { type: 'updateMetricInstances', instances: [...currentInstances] },
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
      const categories = interpretOrdered(
        dataMeta.categories.data || [],
        dataMeta.categories.orderVector || [],
        getDefaultCategoryColor
      )

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
      const reverseUpdates = cmd.updates.map(({ itemId, settings }) => {
        const currentItem = requireItem(
          itemId,
          `Cannot reverse updateSettings: item ${itemId} not found`
        )
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
      const reverseUpdates = cmd.updates.map(({ itemId, layout }) => {
        const currentItem = requireItem(
          itemId,
          `Cannot reverse updateLayout: item ${itemId} not found`
        )
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
      const removedItem = requireItem(
        cmd.itemId,
        `Cannot reverse removeGridItem: item ${cmd.itemId} not found in current state`
      )
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
