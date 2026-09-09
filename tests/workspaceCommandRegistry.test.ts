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
    const dispatch = vi.fn()
    const command = createChainedCommand({
      type: 'updateSettings',
      updates: [{ itemId: 11, settings: { stimulusId: 2 } }], // switched stimulus
    }, {
      source: 'scarf.11.pane',
      chainId: 42,
    })

    createWorkspaceCommandRegistry(gridStore, createMockEngine()).execute(command, {
      isUndoRedoOperation: false,
      dispatch,
    })

    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateSettings',
      // AOI and event-channel ids are per stimulus; categories are global.
      updates: [{ itemId: 11, settings: { highlights: ['ac7'] } }],
      source: 'plot.onCommand',
      chainId: 42,
      isRootCommand: false,
    })
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
    const dispatch = vi.fn()
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

    createWorkspaceCommandRegistry(gridStore, createMockEngine()).execute(command, {
      isUndoRedoOperation: false,
      dispatch,
    })

    // Every targeted item is updated by the single command.
    expect(gridStore.updateSettings).toHaveBeenCalledWith(11, { stimulusId: 2 })
    expect(gridStore.updateSettings).toHaveBeenCalledWith(12, { stimulusId: 2 })

    // Each scarf's stale AOI highlights are cleared for its own id, sharing
    // the command's chain (so the whole bulk is one atomic undo step).
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateSettings',
      updates: [{ itemId: 11, settings: { highlights: ['ac7'] } }],
      source: 'plot.onCommand',
      chainId: 7,
      isRootCommand: false,
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateSettings',
      updates: [{ itemId: 12, settings: { highlights: [] } }],
      source: 'plot.onCommand',
      chainId: 7,
      isRootCommand: false,
    })
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
    const dispatch = vi.fn()
    const command = createChainedCommand({
      type: 'updateSettings',
      updates: [{ itemId: 11, settings: { stimulusId: 2 } }],
    }, {
      source: 'scarf.11.pane',
      chainId: 42,
    })

    createWorkspaceCommandRegistry(gridStore, createMockEngine()).execute(command, {
      isUndoRedoOperation: false,
      dispatch,
    })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('clears every AOI Timeline highlight when its stimulus changes', () => {
    const gridStore = createMockGridStore([
      createAoiStreamGridItem({
        id: 21,
        settings: { stimulusId: 1, highlights: ['0', '1'] },
      }),
    ])
    const dispatch = vi.fn()
    const command = createChainedCommand({
      type: 'updateSettings',
      updates: [{ itemId: 21, settings: { stimulusId: 2 } }],
    }, {
      source: 'aoiStreamPlot.21.pane',
      chainId: 42,
    })

    createWorkspaceCommandRegistry(gridStore, createMockEngine()).execute(command, {
      isUndoRedoOperation: false,
      dispatch,
    })

    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateSettings',
      updates: [{ itemId: 21, settings: { highlights: [] } }],
      source: 'plot.onCommand',
      chainId: 42,
      isRootCommand: false,
    })
  })

  it('prunes AOI Timeline highlights of AOIs merged away by an updateAois', () => {
    const gridStore = createMockGridStore([
      createAoiStreamGridItem({
        id: 21,
        settings: { stimulusId: 1, highlights: ['0', '1'] },
      }),
    ])
    const dispatch = vi.fn()
    engineMocks.getAois.mockImplementation((engine, stimulusId) =>
      stimulusId === 1
        ? [{ id: 1, originalName: 'AOI 1', displayedName: 'AOI 1', color: '#00ff00' }]
        : []
    )

    createWorkspaceCommandRegistry(gridStore, createMockEngine()).execute(
      createChainedCommand({
        type: 'updateAois',
        updates: [{ stimulusId: 1, aois: [] }],
      }, {
        source: 'aoiStreamPlot.21.modal',
        chainId: 42,
      }),
      { isUndoRedoOperation: false, dispatch }
    )

    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateSettings',
      updates: [{ itemId: 21, settings: { highlights: ['1'] } }],
      source: 'plot.onCommand',
      chainId: 42,
      isRootCommand: false,
    })
  })

  it('prunes Scarf event highlights no channel backs after an event-channel edit', () => {
    const gridStore = createMockGridStore([
      createScarfGridItem({
        id: 11,
        settings: { stimulusId: 1, highlights: ['a0', 'e2', 'e9', 'ac7'] },
      }),
    ])
    const dispatch = vi.fn()
    const engine = createMockEngine()
    Object.assign(engine, { updateEventChannelsBatch: vi.fn() })

    createWorkspaceCommandRegistry(gridStore, engine).execute(
      createChainedCommand({
        type: 'updateEventChannels',
        stimulusId: 1,
        channels: [],
      }, {
        source: 'scarf.11.modal',
        chainId: 42,
      }),
      { isUndoRedoOperation: false, dispatch }
    )

    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateSettings',
      updates: [{ itemId: 11, settings: { highlights: ['a0', 'e2', 'ac7'] } }],
      source: 'plot.onCommand',
      chainId: 42,
      isRootCommand: false,
    })
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
    createWorkspaceCommandRegistry(gridStore, engine).execute(
      createChainedCommand(
        { type: 'updateAois', updates },
        { source: 'aoi.modal', chainId: 7 }
      ),
      { isUndoRedoOperation: false, dispatch: vi.fn() }
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
    const dispatch = vi.fn()
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

    createWorkspaceCommandRegistry(gridStore, createMockEngine()).execute(command, {
      isUndoRedoOperation: false,
      dispatch,
    })

    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateSettings',
      updates: [{ itemId: 11, settings: { highlights: ['a1', 'ac7'] } }], // a0 is removed
      source: 'plot.onCommand',
      chainId: 42,
      isRootCommand: false,
    })
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
    const dispatch = vi.fn()
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

    createWorkspaceCommandRegistry(gridStore, createMockEngine()).execute(command, {
      isUndoRedoOperation: false,
      dispatch,
    })

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

    const engine = createMockEngine()
    const history = new UndoRedoStateStore()
    
    const handleCommand = createCommandHandler(
      gridStore,
      engine,
      history,
      () => {},
      () => {},
      () => {}
    )

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
    const undoCommands = history.undo()
    expect(undoCommands).not.toBeNull()
    
    if (undoCommands) {
      for (const cmd of undoCommands) {
        handleCommand(cmd)
      }
    }
    history.endUndoRedo()

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

    const history = new UndoRedoStateStore()
    const handleCommand = createCommandHandler(
      gridStore,
      createMockEngine(),
      history,
      () => {},
      () => {},
      () => {}
    )

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
    const undoCommands = history.undo()
    expect(undoCommands).not.toBeNull()
    for (const cmd of undoCommands ?? []) handleCommand(cmd)
    history.endUndoRedo()

    expect(items.map(i => i.settings.stimulusId)).toEqual([0, 3])
  })
})
