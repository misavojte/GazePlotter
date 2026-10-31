import type {
  SelectionsAxis,
  WorkspaceCommand,
  WorkspaceCommandChain,
} from './types'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { createChildCommand } from './utils'
import { mergeParticipants as computeParticipantMerge } from '$lib/data/merge/mergeParticipants'
import { mergeStimuli as computeStimulusMerge } from '$lib/data/merge/mergeStimuli'
import { resolvePlotDefinition } from '$lib/plots/registry'
import { GridState } from '$lib/workspace/grid'
import {
  updateMultipleParticipants,
  updateMultipleStimuli,
  updateCategories,
  getDefaultCategoryColor,
  getDefaultColor,
  getDefaultEventChannelColor,
  interpretBaseRows,
  interpretOrdered,
} from '$lib/data/engine'
import type {
  GridItemMap,
  AllPlotSettings,
  GridItemLayoutUpdate,
  GridItemSnapshot,
} from '..'
import type {
  EntitySelection,
  NameSelection,
  ParticipantsSelection,
} from '$lib/data/types'

export type WorkspaceCommandDispatcher = (
  command: WorkspaceCommandChain
) => void

export type WorkspaceCommandExecutionContext = {
  isUndoRedoOperation: boolean
  dispatch: WorkspaceCommandDispatcher
}

// Define a type for handlers that maps the command 'type' to its specific interface
type CommandHandlers = {
  [T in WorkspaceCommand['type']]: (
    command: Extract<WorkspaceCommandChain, { type: T }>,
    context: WorkspaceCommandExecutionContext
  ) => void
}

/** A reverse command before `reverse()` stamps the forward's chain meta on. */
type ReverseCommand = {
  [T in WorkspaceCommand['type']]: Omit<Extract<WorkspaceCommand, { type: T }>, 'source'>
}[WorkspaceCommand['type']]

type ReverseHandlers = {
  [T in WorkspaceCommand['type']]: (
    command: Extract<WorkspaceCommandChain, { type: T }>
  ) => ReverseCommand | null
}

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
  const requireMetadata = () => {
    const meta = engine.metadata
    if (!meta) throw new Error('Data engine metadata not available for command reversal')
    return meta
  }

  // One row per SELECTIONS axis: how to apply an update, and how to read the
  // current array for the inverse snapshot. Both handlers dispatch through
  // this table, so adding an axis touches one place. The payload type follows
  // the axis (see UpdateSelectionsCommand).
  const selectionsAxes = {
    participant: {
      set: (s: ParticipantsSelection[]) => engine.setParticipantsSelections(s),
      current: m => m.participantsSelections ?? [],
    },
    stimulus: {
      set: (s: EntitySelection[]) => engine.setStimuliSelections(s),
      current: m => m.stimuliSelections ?? [],
    },
    category: {
      set: (s: EntitySelection[]) => engine.setCategoriesSelections(s),
      current: m => m.categoriesSelections ?? [],
    },
    event: {
      set: (s: NameSelection[]) => engine.setEventsSelections(s),
      current: m => m.eventsSelections ?? [],
    },
    aoi: {
      set: (s: NameSelection[]) => engine.setAoiSelections(s),
      current: m => m.aois.selections ?? [],
    },
  } satisfies Record<
    SelectionsAxis,
    {
      set: (selections: never) => void
      current: (meta: ReturnType<typeof requireMetadata>) => unknown
    }
  >

  // Find a grid item by id or throw. The throw is load-bearing on the reverse
  // path: a missing item makes the reverse handler throw, which the bus turns
  // into "no inverse -> no execution" (reverse-before-execute).
  const requireItem = (id: number, message: string) => {
    const item = gridStore.items.find(i => i.id === id)
    if (!item) throw new Error(message)
    return item
  }

  // The reverse of a partial update is the same-shaped partial holding the
  // CURRENT values of the keys the patch touches.
  const pickCurrent = <T extends object>(
    source: T,
    keys: string[]
  ): Partial<T> =>
    Object.fromEntries(keys.map(k => [k, source[k as keyof T]])) as Partial<T>

  // A grid item as a re-addable snapshot: everything but the transient
  // redrawTimestamp, settings shallow-copied.
  const toSnapshot = (item: (typeof gridStore.items)[number]): GridItemSnapshot => {
    const { redrawTimestamp, ...rest } = item
    return { ...rest, settings: { ...item.settings } } as GridItemSnapshot
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

  // Engine-data handlers: apply, then bump every plot's redraw epoch.
  const redrawing = <C>(apply: (command: C) => void) => (command: C) => {
    apply(command)
    gridStore.triggerRedraw()
  }

  const handlers: CommandHandlers = {
    updateAois: redrawing(command => engine.updateAoisBatch(command.updates)),

    updateEntities: redrawing(command => {
      if (command.axis === 'participant')
        updateMultipleParticipants(engine, command.items)
      else updateMultipleStimuli(engine, command.items)
    }),

    updateEventData: redrawing(command => {
      const { stimulusId, channelDefs, eventBuffers, orderVector } = command
      engine.updateEventDataBatch([
        {
          stimulusId,
          channelDefs,
          eventBuffers,
          ...(orderVector !== undefined ? { orderVector } : {}),
        },
      ])
    }),

    updateEventChannels: redrawing(command =>
      engine.updateEventChannelsBatch([
        { stimulusId: command.stimulusId, channels: command.channels },
      ])
    ),

    updateSelections: command => {
      // The command ties axis to payload; the indexed lookup can't carry that
      // correlation, so one cast re-asserts it.
      selectionsAxes[command.axis].set(command.selections as never)
      // Only participant and AOI selections feed plot transforms directly;
      // the other axes narrow via reactive selectors, so no epoch bump.
      if (command.axis === 'participant' || command.axis === 'aoi')
        gridStore.triggerRedraw()
    },

    mergeEntities: redrawing(command => {
      const { axis, representativeId, memberIds, at } = command
      engine.mergeEntities(axis, representativeId, memberIds, at)
    }),

    unmergeEntities: redrawing(command => engine.unmergeEntities(command.entry)),

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

    updateStimulusMedia: redrawing(command => {
      for (const u of command.updates) {
        engine.setStimulusMedia(u.stimulusId, u.media, u.blob)
      }
    }),

    updateNoAoiTreatment: redrawing(cmd => engine.setNoAoiTreatment(cmd.noAoiTreatment)),

    updateCategories: redrawing(cmd => updateCategories(engine, cmd.categories)),

    updateMetricInstances: redrawing(cmd => engine.setMetricInstances(cmd.instances)),

    updateSettings: command => {
      for (const { itemId, settings } of command.updates) {
        requireItem(itemId, `Grid item ${itemId} not found`)

        gridStore.updateSettings(itemId, settings)
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
        // A plot dropped above or left of the origin: shift the whole layout
        // back to non-negative cells first, so collision resolution (and
        // everything stored) only ever sees the grid it expects.
        let minX = 0
        let minY = 0
        for (const item of gridStore.items) {
          minX = Math.min(minX, item.x)
          minY = Math.min(minY, item.y)
        }
        if (minX < 0 || minY < 0) {
          context.dispatch(
            createChildCommand(
              {
                type: 'translateLayout',
                dx: -minX,
                dy: -minY,
                source: command.source,
              },
              command.chainId
            )
          )
        }

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

    removeGridItems: (command, context) => {
      if (context.isUndoRedoOperation) return
      for (const itemId of command.itemIds) {
        context.dispatch(
          createChildCommand(
            { type: 'removeGridItem', itemId, source: command.source },
            command.chainId
          )
        )
      }
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

    duplicateGridItems: (command, context) => {
      if (context.isUndoRedoOperation) return
      const items = command.itemIds.map(itemId =>
        requireItem(itemId, `Grid item ${itemId} not found`)
      )

      // The group keeps the shape it has at this moment: one free area the
      // size of its bounding box, then every copy at its own offset inside
      // it. Placing each copy on its own would scatter the arrangement the
      // selection was made of.
      const left = Math.min(...items.map(item => item.x))
      const top = Math.min(...items.map(item => item.y))
      const width = Math.max(...items.map(item => item.x + item.w)) - left
      const height = Math.max(...items.map(item => item.y + item.h)) - top
      const origin = gridStore.findOptimalPosition(width, height, {
        id: -1,
        x: left,
        y: top,
        w: width,
        h: height,
      })

      items.forEach((item, index) => {
        context.dispatch(
          createChildCommand(
            {
              type: 'duplicateGridItem',
              itemId: item.id,
              duplicateId: command.duplicateIds[index],
              position: {
                x: origin.x + (item.x - left),
                y: origin.y + (item.y - top),
              },
              source: command.source,
            },
            command.chainId
          )
        )
      })
    },

    translateLayout: command => {
      for (const item of gridStore.items) {
        gridStore.updateLayout(item.id, {
          x: item.x + command.dx,
          y: item.y + command.dy,
        })
      }
    },

    setLayoutState: command => {
      gridStore.reset(command.layoutState)
    },
  }

  const reverseHandlers: ReverseHandlers = {
    // One entry per stimulus the forward touches: its CURRENT rows in display
    // order (id-gap null rows skipped, never resurrected as ghost AOIs) plus
    // the order vector verbatim, so undo restores a custom order and stays
    // byte-exact even for an empty (identity) vector.
    updateAois: cmd => {
      const dataMeta = requireMetadata()
      return {
        type: 'updateAois',
        updates: cmd.updates.map(({ stimulusId }) => {
          const order = dataMeta.aois.orderVector?.[stimulusId] ?? []
          return {
            stimulusId,
            aois: interpretOrdered(
              dataMeta.aois.data[stimulusId] ?? [],
              order,
              getDefaultColor
            ),
            orderVector: [...order],
          }
        }),
      }
    },

    updateEntities: cmd => {
      const dataMeta = requireMetadata()
      const table = cmd.axis === 'participant' ? dataMeta.participants : dataMeta.stimuli
      // Rows in CURRENT display order: the forward derives the order vector
      // from the item sequence, so this is what restores a sort on undo.
      const rows = interpretBaseRows(table.data || [])
      const order = table.orderVector ?? []
      return {
        type: 'updateEntities',
        axis: cmd.axis,
        items: order.length > 0 ? order.flatMap(id => rows[id] ?? []) : rows,
      }
    },

    updateEventData: cmd => {
      const dataMeta = requireMetadata()
      const ed = dataMeta.eventData
      const currentDefs = ed.data[cmd.stimulusId] ?? []
      const currentBuffers = engine.getEventReader().getStimulusJson(cmd.stimulusId)
      // Applying the command resets the order vector (the engine owns that
      // invariant), so the inverse must always carry it — not only when the
      // forward command set it.
      const order = ed.orderVector?.[cmd.stimulusId] ?? []
      return {
        type: 'updateEventData',
        stimulusId: cmd.stimulusId,
        channelDefs: currentDefs.map(d => [...d]),
        eventBuffers: currentBuffers.map(ch =>
          ch.map(p => [...p])
        ),
        ...(order.length > 0 ? { orderVector: [...order] } : {}),
      }
    },

    updateEventChannels: cmd => {
      const dataMeta = requireMetadata()
      const ed = dataMeta.eventData
      const channels = interpretOrdered(
        ed.data[cmd.stimulusId] ?? [],
        ed.orderVector?.[cmd.stimulusId] ?? [],
        getDefaultEventChannelColor
      )
      return {
        type: 'updateEventChannels',
        stimulusId: cmd.stimulusId,
        channels,
      }
    },

    // Reverse = snapshot of the axis' current selections array.
    updateSelections: cmd => ({
      type: 'updateSelections',
      axis: cmd.axis,
      selections: selectionsAxes[cmd.axis].current(requireMetadata()),
    }),

    // Reverse-before-execute: the merge log entry is a pure function of the
    // current (pre-merge) dataset, so we precompute it here — dry-running the
    // fold for the command's axis — and return the un-merge that inverts it. If
    // the merge is not disjoint the fold throws, which the handler surfaces as
    // "no inverse -> no execution", refusing the merge before any mutation.
    // (The axis picks the fold; both share a signature, so `mergeCommand.test.ts`
    // pins BOTH axes to guard against a mis-routed dry-run.)
    mergeEntities: cmd => {
      const data = engine.toDataType()
      if (!data) return null
      const fold =
        cmd.axis === 'participant' ? computeParticipantMerge : computeStimulusMerge
      const merged = fold(data, cmd.representativeId, cmd.memberIds, cmd.at)
      const entry = merged.merges?.[merged.merges.length - 1]
      if (!entry) return null
      return { type: 'unmergeEntities', axis: cmd.axis, entry }
    },

    unmergeEntities: cmd => ({
      type: 'mergeEntities',
      axis: cmd.axis,
      representativeId: cmd.entry.representativeId,
      memberIds: cmd.entry.members.map(m => m.id),
      at: cmd.entry.at,
    }),

    // The orchestrator itself mutates nothing; its child commands carry the
    // real reverses. A noop keeps the bus's reverse-before-execute contract.
    reconcileMerges: () => ({ type: 'noop' }),

    noop: () => ({ type: 'noop' }),

    // Reverse = snapshot of each stimulus's current media + blob (blob-by-
    // reference — no byte copy), or a remove when none is set.
    updateStimulusMedia: cmd => {
      const dataMeta = requireMetadata()
      return {
        type: 'updateStimulusMedia',
        updates: cmd.updates.map(({ stimulusId }) => {
          const current = dataMeta.stimuliMedia?.[stimulusId] ?? null
          return {
            stimulusId,
            media: current,
            blob: current ? engine.media.getBlob(stimulusId) : null,
          }
        }),
      }
    },

    updateMetricInstances: () => {
      const dataMeta = requireMetadata()
      const currentInstances = dataMeta.metricInstances ?? []
      return { type: 'updateMetricInstances', instances: [...currentInstances] }
    },

    updateNoAoiTreatment: () => {
      const dataMeta = requireMetadata()
      const currentNoAoiTreatment = dataMeta.noAoiTreatment
      return {
        type: 'updateNoAoiTreatment',
        noAoiTreatment: currentNoAoiTreatment,
      }
    },

    updateCategories: () => {
      const dataMeta = requireMetadata()
      const categories = interpretOrdered(
        dataMeta.categories.data || [],
        dataMeta.categories.orderVector || [],
        getDefaultCategoryColor
      )
      return { type: 'updateCategories', categories }
    },

    updateSettings: cmd => {
      const reverseUpdates = cmd.updates.map(({ itemId, settings }) => {
        const currentItem = requireItem(
          itemId,
          `Cannot reverse updateSettings: item ${itemId} not found`
        )
        return {
          itemId,
          settings: pickCurrent(
            currentItem.settings as AllPlotSettings,
            Object.keys(settings)
          ),
        }
      })
      return { type: 'updateSettings', updates: reverseUpdates }
    },

    updateLayout: cmd => {
      const reverseUpdates = cmd.updates.map(({ itemId, layout }) => {
        const currentItem = requireItem(
          itemId,
          `Cannot reverse updateLayout: item ${itemId} not found`
        )
        // Layout values live flat on the item itself.
        return {
          itemId,
          layout: pickCurrent(currentItem, Object.keys(layout)) as GridItemLayoutUpdate,
        }
      })

      return { type: 'updateLayout', updates: reverseUpdates }
    },

    translateLayout: cmd => ({ type: 'translateLayout', dx: -cmd.dx, dy: -cmd.dy }),

    addGridItem: cmd => ({ type: 'removeGridItem', itemId: cmd.itemId }),

    removeGridItems: () => ({ type: 'noop' }),

    removeGridItem: cmd => {
      const removedItem = requireItem(
        cmd.itemId,
        `Cannot reverse removeGridItem: item ${cmd.itemId} not found in current state`
      )
      return {
        type: 'addGridItem',
        vizType: removedItem.type,
        itemId: removedItem.id,
        options: toSnapshot(removedItem),
      }
    },

    duplicateGridItem: cmd => {
      if (!cmd.duplicateId) {
        throw new Error(
          `Cannot reverse duplicateGridItem: duplicateId not found in command`
        )
      }
      return { type: 'removeGridItem', itemId: cmd.duplicateId }
    },

    duplicateGridItems: () => ({ type: 'noop' }),

    setLayoutState: () => ({
      type: 'setLayoutState',
      layoutState: gridStore.items.map(toSnapshot),
    }),
  }

  // `command.type` picks the matching handler, but TS can't correlate a union
  // member with its handler through an index, so each lookup re-asserts the
  // pairing (correct by construction).

  function execute(
    command: WorkspaceCommandChain,
    context: WorkspaceCommandExecutionContext
  ): void {
    const handler = handlers[command.type] as (
      command: WorkspaceCommandChain,
      context: WorkspaceCommandExecutionContext
    ) => void
    handler(command, context)
    if (command.isRootCommand && !context.isUndoRedoOperation) {
      invokeOnCommandHooks(command, context)
    }
  }

  function reverse(
    command: WorkspaceCommandChain
  ): WorkspaceCommandChain | null {
    try {
      const handler = reverseHandlers[command.type] as (
        command: WorkspaceCommandChain
      ) => ReverseCommand | null
      const base = handler(command)
      if (!base) return null
      const { source, chainId, isRootCommand } = command
      return { ...base, source, chainId, isRootCommand } as WorkspaceCommandChain
    } catch (error) {
      onError?.(error, { phase: 'reverse', command })
      return null
    }
  }

  return { execute, reverse }
}
