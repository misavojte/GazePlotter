import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceCommandRegistry } from '$lib/workspace/commands/registry'
import {
  createChainedCommand,
  createMockEngine,
  createMockGridStore,
  createScarfGridItem,
} from './helpers/workspaceCommandFixtures'
import { createCommandHandler } from '$lib/workspace/commands/handler'
import { UndoRedoStateStore } from '$lib/workspace/commands/undoRedoState.svelte'

const engineMocks = vi.hoisted(() => ({
  updateMultipleAoi: vi.fn(),
  updateHiddenAoisWithPropagation: vi.fn(),
  updateMultipleParticipants: vi.fn(),
  updateMultipleStimuli: vi.fn(),
  updateNoAoiTreatment: vi.fn(),
  updateParticipantsGroups: vi.fn(),
  getAois: vi.fn(),
}))

vi.mock('$lib/data/engine', () => ({
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
  })

  it('clears AOI highlights when Scarf stimulus changes via updateSettings', () => {
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
      updates: [{ itemId: 11, settings: { highlights: ['ac7', 'e2'] } }],
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
    expect(gridStore.updateItem).toHaveBeenCalledWith(11, { stimulusId: 2 })
    expect(gridStore.updateItem).toHaveBeenCalledWith(12, { stimulusId: 2 })

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
      updates: [{ itemId: 12, settings: { highlights: ['e2'] } }],
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
          highlights: ['ac7', 'e2'], // only non-AOI highlights
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
      aois: [
        {
          id: 0,
          originalName: 'AOI 0',
          displayedName: 'AOI 1', // causes grouping/merge under ID 1
          color: '#ff0000',
        },
      ],
      stimulusId: 1,
      applyTo: 'this_stimulus',
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
      aois: [
        {
          id: 0,
          originalName: 'AOI 0',
          displayedName: 'Renamed AOI 0', // cosmetic rename
          color: '#ff0000',
        },
      ],
      stimulusId: 1,
      applyTo: 'this_stimulus',
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
        aois: [],
        stimulusId: 1,
        applyTo: 'this_stimulus',
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
        aois: [],
        stimulusId: 1,
        applyTo: 'this_stimulus',
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
    gridStore.updateItem = vi.fn((id, settings) => {
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
    gridStore.updateItem = vi.fn((id, settings) => {
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
