import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceCommandRegistry } from '$lib/workspace/commands/registry'
import {
  createAoiStreamGridItem,
  createChainedCommand,
  createMockEngine,
  createMockGridStore,
  createScarfGridItem,
} from './helpers/workspaceCommandFixtures'
import { createCommandHandler } from '$lib/workspace/commands/handler'
import { UndoRedoStateStore } from '$lib/workspace/commands/undoRedoState.svelte'
import type { WorkspaceCommandChain } from '$lib/workspace/commands'
import type { GridState } from '$lib/workspace/grid'

const engineMocks = vi.hoisted(() => ({
  updateMultipleParticipants: vi.fn(),
  updateMultipleStimuli: vi.fn(),
  getAois: vi.fn(),
  getEventChannels: vi.fn(),
}))

// Partial mock: keep the real module surface (modal configs evaluate engine
// getters at import time) and override only the updaters the handlers call.
vi.mock('$lib/data/engine', async importOriginal => ({
  ...(await importOriginal<object>()),
  ...engineMocks,
}))

/** The highlight-cleanup command the registry dispatches for one item. */
const highlightCleanup = (itemId: number, highlights: string[], chainId = 42) => ({
  type: 'updateSettings',
  updates: [{ itemId, settings: { highlights } }],
  source: 'plot.onCommand',
  chainId,
  isRootCommand: false,
})

/** One non-undo execution through a fresh registry; returns the dispatch spy. */
function executeOnce(gridStore: GridState, command: WorkspaceCommandChain, engine = createMockEngine()) {
  const dispatch = vi.fn()
  createWorkspaceCommandRegistry(gridStore, engine).execute(command, { isUndoRedoOperation: false, dispatch })
  return dispatch
}

/** A real handler with undo history; `undo` replays one step and returns its commands. */
function withHistory(gridStore: GridState) {
  const history = new UndoRedoStateStore()
  const handleCommand = createCommandHandler(gridStore, createMockEngine(), history, () => {}, () => {}, () => {})
  const undo = () => {
    const undoCommands = history.undo()
    for (const cmd of undoCommands ?? []) handleCommand(cmd)
    history.endUndoRedo()
    return undoCommands
  }
  return { history, handleCommand, undo }
}

describe('workspaceCommandRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default implementation of getAois
    engineMocks.getAois.mockImplementation((engine, stimulusId) => {
      if (stimulusId === 1) {
        return [
          { id: 0, originalName: 'AOI 0', displayedName: 'AOI 0', color: '#ff0000' },
          { id: 1, originalName: 'AOI 1', displayedName: 'AOI 1', color: '#00ff00' },
        ]
      }
      return []
    })
    engineMocks.getEventChannels.mockImplementation((engine, stimulusId) =>
      stimulusId === 1
        ? [{ id: 2, originalName: 'Ch 2', displayedName: 'Ch 2', color: '#0000ff' }]
        : []
    )
  })

  it('clears AOI and event highlights when Scarf stimulus changes via updateSettings', () => {
    const gridStore = createMockGridStore([
      createScarfGridItem({
        id: 11,
        settings: {
          stimulusId: 1,
          groupId: 1,
          highlights: ['a0', 'a1', 'ac7', 'e2'],
        },
      }),
    ])
    const command = createChainedCommand({
      type: 'updateSettings',
      updates: [{ itemId: 11, settings: { stimulusId: 2 } }], // switched stimulus
    }, {
      source: 'scarf.11.pane',
      chainId: 42,
    })

    const dispatch = executeOnce(gridStore, command)

    // AOI and event-channel ids are per stimulus; categories are global.
    expect(dispatch).toHaveBeenCalledWith(highlightCleanup(11, ['ac7']))
  })

  it('applies a multi-item (bulk) updateSettings to every item and reconciles each scarf', () => {
    const gridStore = createMockGridStore([
      createScarfGridItem({
        id: 11,
        settings: { stimulusId: 1, highlights: ['a0', 'ac7'] },
      }),
      createScarfGridItem({
        id: 12,
        settings: { stimulusId: 1, highlights: ['a1', 'e2'] },
      }),
    ])
    const command = createChainedCommand({
      type: 'updateSettings',
      updates: [
        { itemId: 11, settings: { stimulusId: 2 } },
        { itemId: 12, settings: { stimulusId: 2 } },
      ],
    }, {
      source: 'bulk.pane',
      chainId: 7,
    })

    const dispatch = executeOnce(gridStore, command)

    // Every targeted item is updated by the single command.
    expect(gridStore.updateSettings).toHaveBeenCalledWith(11, { stimulusId: 2 })
    expect(gridStore.updateSettings).toHaveBeenCalledWith(12, { stimulusId: 2 })

    // Each scarf's stale AOI highlights are cleared for its own id, sharing
    // the command's chain (so the whole bulk is one atomic undo step).
    expect(dispatch).toHaveBeenCalledWith(highlightCleanup(11, ['ac7'], 7))
    expect(dispatch).toHaveBeenCalledWith(highlightCleanup(12, [], 7))
  })

  it('does not dispatch highlight cleanup on stimulus switch if no highlights are cleared', () => {
    const gridStore = createMockGridStore([
      createScarfGridItem({
        id: 11,
        settings: {
          stimulusId: 1,
          groupId: 1,
          highlights: ['ac7'], // only global (category) highlights
        },
      }),
    ])
    const command = createChainedCommand({
      type: 'updateSettings',
      updates: [{ itemId: 11, settings: { stimulusId: 2 } }],
    }, {
      source: 'scarf.11.pane',
      chainId: 42,
    })

    const dispatch = executeOnce(gridStore, command)

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('clears every AOI Timeline highlight when its stimulus changes', () => {
    const gridStore = createMockGridStore([
      createAoiStreamGridItem({
        id: 21,
        settings: { stimulusId: 1, highlights: ['0', '1'] },
      }),
    ])
    const command = createChainedCommand({
      type: 'updateSettings',
      updates: [{ itemId: 21, settings: { stimulusId: 2 } }],
    }, {
      source: 'aoiStreamPlot.21.pane',
      chainId: 42,
    })

    const dispatch = executeOnce(gridStore, command)

    expect(dispatch).toHaveBeenCalledWith(highlightCleanup(21, []))
  })

  it('prunes AOI Timeline highlights of AOIs merged away by an updateAois', () => {
    const gridStore = createMockGridStore([
      createAoiStreamGridItem({
        id: 21,
        settings: { stimulusId: 1, highlights: ['0', '1'] },
      }),
    ])
    engineMocks.getAois.mockImplementation((engine, stimulusId) =>
      stimulusId === 1
        ? [{ id: 1, originalName: 'AOI 1', displayedName: 'AOI 1', color: '#00ff00' }]
        : []
    )

    const dispatch = executeOnce(
      gridStore,
      createChainedCommand({
        type: 'updateAois',
        updates: [{ stimulusId: 1, aois: [] }],
      }, {
        source: 'aoiStreamPlot.21.modal',
        chainId: 42,
      })
    )

    expect(dispatch).toHaveBeenCalledWith(highlightCleanup(21, ['1']))
  })

  it('prunes Scarf event highlights no channel backs after an event-channel edit', () => {
    const gridStore = createMockGridStore([
      createScarfGridItem({
        id: 11,
        settings: { stimulusId: 1, highlights: ['a0', 'e2', 'e9', 'ac7'] },
      }),
    ])
    const engine = createMockEngine()
    Object.assign(engine, { updateEventChannelsBatch: vi.fn() })

    const dispatch = executeOnce(
      gridStore,
      createChainedCommand({
        type: 'updateEventChannels',
        stimulusId: 1,
        channels: [],
      }, {
        source: 'scarf.11.modal',
        chainId: 42,
      }),
      engine
    )

    expect(dispatch).toHaveBeenCalledWith(highlightCleanup(11, ['a0', 'e2', 'ac7']))
  })

  it('applies every stimulus of an updateAois set in ONE engine batch and one redraw', () => {
    const gridStore = createMockGridStore([])
    const engine = createMockEngine()
    const updates = [
      {
        stimulusId: 0,
        aois: [{ id: 0, originalName: 'A', displayedName: 'A', color: '#00ff00' }],
      },
      {
        stimulusId: 1,
        aois: [
          { id: 0, originalName: 'AOI 0', displayedName: 'AOI 0', color: '#00ff00' },
          { id: 1, originalName: 'AOI 1', displayedName: 'AOI 1', color: '#00ff00' },
        ],
      },
    ]
    executeOnce(
      gridStore,
      createChainedCommand(
        { type: 'updateAois', updates },
        { source: 'aoi.modal', chainId: 7 }
      ),
      engine
    )

    expect(engine.updateAoisBatch).toHaveBeenCalledTimes(1)
    expect(engine.updateAoisBatch).toHaveBeenCalledWith(updates)
    expect(gridStore.triggerRedraw).toHaveBeenCalledTimes(1)
  })

  it('clears stale AOI highlights when grouping changes on active stimulus', () => {
    const gridStore = createMockGridStore([
      createScarfGridItem({
        id: 11,
        settings: {
          stimulusId: 1,
          groupId: 1,
          highlights: ['a0', 'a1', 'ac7'],
        },
      }),
    ])
    const command = createChainedCommand({
      type: 'updateAois',
      updates: [
        {
          stimulusId: 1,
          aois: [
            {
              id: 0,
              originalName: 'AOI 0',
              displayedName: 'AOI 1', // causes grouping/merge under ID 1
              color: '#ff0000',
            },
          ],
        },
      ],
    }, {
      source: 'scarf.11.modal',
      chainId: 42,
    })

    // Simulate the engine's getAois return post-grouping (AOI 0 is merged/gone, only AOI 1 remains)
    engineMocks.getAois.mockImplementation((engine, stimulusId) => {
      if (stimulusId === 1) {
        return [
          { id: 1, originalName: 'AOI 1', displayedName: 'AOI 1', color: '#00ff00' },
        ]
      }
      return []
    })

    const dispatch = executeOnce(gridStore, command)

    // a0 is removed
    expect(dispatch).toHaveBeenCalledWith(highlightCleanup(11, ['a1', 'ac7']))
  })

  it('does NOT clear AOI highlights on cosmetic rename (no grouping change)', () => {
    const gridStore = createMockGridStore([
      createScarfGridItem({
        id: 11,
        settings: {
          stimulusId: 1,
          groupId: 1,
          highlights: ['a0', 'a1', 'ac7'],
        },
      }),
    ])
    const command = createChainedCommand({
      type: 'updateAois',
      updates: [
        {
          stimulusId: 1,
          aois: [
            {
              id: 0,
              originalName: 'AOI 0',
              displayedName: 'Renamed AOI 0', // cosmetic rename
              color: '#ff0000',
            },
          ],
        },
      ],
    }, {
      source: 'scarf.11.modal',
      chainId: 42,
    })

    // Simulate getAois post-rename: both AOIs still exist as separate objects
    engineMocks.getAois.mockImplementation((engine, stimulusId) => {
      if (stimulusId === 1) {
        return [
          { id: 0, originalName: 'AOI 0', displayedName: 'Renamed AOI 0', color: '#ff0000' },
          { id: 1, originalName: 'AOI 1', displayedName: 'AOI 1', color: '#00ff00' },
        ]
      }
      return []
    })

    const dispatch = executeOnce(gridStore, command)

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('does not dispatch highlight cleanup for undo-redo or non-root updates', () => {
    const gridStore = createMockGridStore([
      createScarfGridItem({
        id: 11,
        settings: {
          stimulusId: 1,
          groupId: 1,
          highlights: ['a0'],
        },
      }),
    ])
    const dispatch = vi.fn()
    const registry = createWorkspaceCommandRegistry(gridStore, createMockEngine())

    // 1. Undo-redo operation
    registry.execute(
      createChainedCommand({
        type: 'updateAois',
        updates: [{ stimulusId: 1, aois: [] }],
      }, {
        source: 'undo.scarf.11.modal',
        chainId: 43,
      }),
      {
        isUndoRedoOperation: true,
        dispatch,
      }
    )

    // 2. Non-root command
    registry.execute(
      createChainedCommand({
        type: 'updateAois',
        updates: [{ stimulusId: 1, aois: [] }],
      }, {
        source: 'scarf.11.modal',
        chainId: 44,
        isRootCommand: false,
      }),
      {
        isUndoRedoOperation: false,
        dispatch,
      }
    )

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('undo of stimulus switch restores both stimulus and highlights atomically', () => {
    const initialItem = createScarfGridItem({
      id: 11,
      settings: {
        stimulusId: 1,
        groupId: 1,
        highlights: ['a0', 'ac7'],
      },
    })
    
    const items = [initialItem]
    const gridStore = createMockGridStore(items)
    gridStore.updateSettings = vi.fn((id, settings) => {
      const item = items.find(i => i.id === id)
      if (item) {
        item.settings = { ...item.settings, ...settings }
      }
    })

    const { handleCommand, undo } = withHistory(gridStore)

    // Initial switch stimulus command
    const command = createChainedCommand({
      type: 'updateSettings' as const,
      updates: [{ itemId: 11, settings: { stimulusId: 2 } }],
    }, {
      source: 'scarf.11.pane',
      chainId: 42,
      isRootCommand: true,
    })

    handleCommand(command)

    // Stimulus changed to 2, highlights cleared of a0
    expect(items[0].settings.stimulusId).toBe(2)
    expect(items[0].settings.highlights).toEqual(['ac7'])

    // Execute undo
    expect(undo()).not.toBeNull()

    // Restored back to stimulus 1 and highlights ['a0', 'ac7']
    expect(items[0].settings.stimulusId).toBe(1)
    expect(items[0].settings.highlights).toEqual(['a0', 'ac7'])
  })

  it('undo of a bulk stimulus change restores each item to its OWN prior value in one step', () => {
    const items = [
      createScarfGridItem({ id: 11, settings: { stimulusId: 0 } }),
      createScarfGridItem({ id: 12, settings: { stimulusId: 3 } }),
    ]
    const gridStore = createMockGridStore(items)
    gridStore.updateSettings = vi.fn((id, settings) => {
      const item = items.find(i => i.id === id)
      if (item) item.settings = { ...item.settings, ...settings }
    })

    const { handleCommand, undo } = withHistory(gridStore)

    // Bulk: apply the same stimulus to both items (which start with different
    // stimuli) as a single root command.
    handleCommand(
      createChainedCommand(
        {
          type: 'updateSettings' as const,
          updates: [
            { itemId: 11, settings: { stimulusId: 5 } },
            { itemId: 12, settings: { stimulusId: 5 } },
          ],
        },
        { source: 'bulk.pane', chainId: 99, isRootCommand: true }
      )
    )

    expect(items.map(i => i.settings.stimulusId)).toEqual([5, 5])

    // A single undo reverts the whole bulk, restoring each item's own prior value.
    expect(undo()).not.toBeNull()

    expect(items.map(i => i.settings.stimulusId)).toEqual([0, 3])
  })

  it('duplicating several plots is one undo step that removes every copy', () => {
    const items = [
      createScarfGridItem({ id: 11 }),
      createScarfGridItem({ id: 12 }),
    ]
    const gridStore = createMockGridStore(items)
    gridStore.duplicateItem = vi.fn((item, duplicateId) => {
      items.push(createScarfGridItem({ id: duplicateId ?? 0 }))
      return duplicateId ?? 0
    })
    gridStore.removeItem = vi.fn(id => {
      const idx = items.findIndex(i => i.id === id)
      if (idx >= 0) items.splice(idx, 1)
    })

    const { history, handleCommand, undo } = withHistory(gridStore)

    handleCommand(
      createChainedCommand(
        {
          type: 'duplicateGridItems' as const,
          itemIds: [11, 12],
          duplicateIds: [101, 102],
        },
        { source: 'scarf.11.workspace', chainId: 9, isRootCommand: true }
      )
    )
    expect(items.map(i => i.id)).toEqual([11, 12, 101, 102])

    undo()
    expect(items.map(i => i.id)).toEqual([11, 12])
    expect(history.undo()).toBeNull()
  })

  it('duplicating a group keeps its arrangement, placed as one block', () => {
    // Two plots a column apart and offset down: the pair has a shape, and the
    // copies have to land in that same shape somewhere free.
    const items = [
      createScarfGridItem({ id: 11, x: 0, y: 0, w: 6, h: 8 }),
      createScarfGridItem({ id: 12, x: 8, y: 3, w: 6, h: 8 }),
    ]
    const gridStore = createMockGridStore(items)
    gridStore.duplicateItem = vi.fn((item, duplicateId, position) => {
      const copy = createScarfGridItem({
        id: duplicateId ?? 0,
        x: position?.x ?? 0,
        y: position?.y ?? 0,
        w: item.w,
        h: item.h,
      })
      items.push(copy)
      return copy.id
    })

    const { handleCommand } = withHistory(gridStore)

    handleCommand(
      createChainedCommand(
        {
          type: 'duplicateGridItems' as const,
          itemIds: [11, 12],
          duplicateIds: [101, 102],
        },
        { source: 'scarf.11.workspace', chainId: 11, isRootCommand: true }
      )
    )

    const first = items.find(i => i.id === 101)!
    const second = items.find(i => i.id === 102)!
    expect(second.x - first.x).toBe(8)
    expect(second.y - first.y).toBe(3)
    // Beside what it was copied from, not on top of it: the group spans
    // columns 0..14, so the block starts at its right edge.
    expect(first.x).toBe(14)
    expect(first.y).toBe(0)
  })

  it('removing several plots is one undo step that restores them all', () => {
    const items = [
      createScarfGridItem({ id: 11 }),
      createScarfGridItem({ id: 12 }),
      createScarfGridItem({ id: 13 }),
    ]
    const gridStore = createMockGridStore(items)
    gridStore.removeItem = vi.fn(id => {
      const idx = items.findIndex(i => i.id === id)
      if (idx >= 0) items.splice(idx, 1)
    })
    gridStore.addItem = vi.fn((_type, options) => {
      items.push(createScarfGridItem({ id: options.id }))
      return options.id
    })

    const { history, handleCommand, undo } = withHistory(gridStore)

    handleCommand(
      createChainedCommand(
        { type: 'removeGridItems' as const, itemIds: [11, 12] },
        { source: 'scarf.11.workspace', chainId: 7, isRootCommand: true }
      )
    )
    expect(items.map(i => i.id)).toEqual([13])

    undo()
    expect(items.map(i => i.id).sort()).toEqual([11, 12, 13])
    expect(history.undo()).toBeNull()
  })
})
