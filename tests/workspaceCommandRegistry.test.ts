import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceCommandRegistry } from '$lib/workspace/commands/registry'
import {
  createChainedCommand,
  createMockEngine,
  createMockGridStore,
  createScarfGridItem,
} from './helpers/workspaceCommandFixtures'

const engineMocks = vi.hoisted(() => ({
  updateMultipleAoi: vi.fn(),
  updateHiddenAoisWithPropagation: vi.fn(),
  updateMultipleAoiVisibility: vi.fn(),
  updateMultipleParticipants: vi.fn(),
  updateMultipleStimuli: vi.fn(),
  updateNoAoiTreatment: vi.fn(),
  updateParticipantsGroups: vi.fn(),
}))

vi.mock('$lib/data/engine', () => ({
  ...engineMocks,
}))

describe('workspaceCommandRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes renamed AOI highlights from scarf items during root AOI updates', () => {
    const gridStore = createMockGridStore([
      createScarfGridItem({
        id: 11,
        settings: {
          stimulusId: 3,
          groupId: 1,
          highlights: ['a0', 'ac7'],
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
          displayedName: 'Renamed AOI 0',
          color: '#ff0000',
        },
      ],
      stimulusId: 3,
      applyTo: 'this_stimulus',
    }, {
      source: 'scarf.11.modal',
      chainId: 42,
    })

    createWorkspaceCommandRegistry(gridStore, createMockEngine()).execute(command, {
      isUndoRedoOperation: false,
      dispatch,
    })

    expect(engineMocks.updateMultipleAoi).toHaveBeenCalledWith(
      expect.anything(),
      command.aois,
      3,
      'this_stimulus'
    )
    expect(gridStore.triggerRedraw).toHaveBeenCalledOnce()
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateSettings',
      itemId: 11,
      settings: { highlights: ['ac7'] },
      source: 'aoi.rename',
      chainId: 42,
      isRootCommand: false,
    })
  })

  it('does not dispatch scarf highlight cleanup for undo-redo or non-root updates', () => {
    const gridStore = createMockGridStore([
      createScarfGridItem({
        id: 11,
        settings: {
          stimulusId: 3,
          groupId: 1,
          highlights: ['a0'],
        },
      }),
    ])
    const dispatch = vi.fn()
    const registry = createWorkspaceCommandRegistry(gridStore, createMockEngine())

    registry.execute(
      createChainedCommand({
        type: 'updateAois',
        aois: [
          {
            id: 0,
            originalName: 'AOI 0',
            displayedName: 'Renamed AOI 0',
            color: '#ff0000',
          },
        ],
        stimulusId: 3,
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

    registry.execute(
      createChainedCommand({
        type: 'updateAois',
        aois: [
          {
            id: 0,
            originalName: 'AOI 0',
            displayedName: 'Renamed AOI 0',
            color: '#ff0000',
          },
        ],
        stimulusId: 3,
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
})
