import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceCommandRegistry } from '../src/lib/workspace/commands/registry'
import type { WorkspaceCommandChain } from '../src/lib/workspace/commands'
import type { GridState } from '../src/lib/workspace/grid'
import {
  createAoiComparisonGridItem,
  createChainedCommand,
  createEmptyMockMetadata,
  createMockEngine,
  createMockGridStore,
  createMockMetadata,
  createScarfGridItem,
  setMockEngineMetadata,
  type MockEngine,
} from './helpers/workspaceCommandFixtures'

describe('Workspace Command Reversal', () => {
  let mockGridStore: GridState
  let mockEngine: MockEngine
  let reverseCommand: (
    command: WorkspaceCommandChain
  ) => WorkspaceCommandChain | null

  beforeEach(() => {
    vi.clearAllMocks()
    mockEngine = createMockEngine()
    mockGridStore = createMockGridStore([
      createScarfGridItem(),
      createAoiComparisonGridItem(),
    ])
    reverseCommand = createWorkspaceCommandRegistry(
      mockGridStore,
      mockEngine
    ).reverse
  })

  // ============================================================================
  // 1. General Behavior & Error Cases
  // ============================================================================
  describe('General registry behavior', () => {
    it('returns null for unknown command types', () => {
      const unknownCommand = {
        type: 'unknownCommand',
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      } as unknown as WorkspaceCommandChain

      expect(reverseCommand(unknownCommand)).toBeNull()
    })

    it('reports updateSettings reversal failures through the registry error callback', () => {
      const onRegistryError = vi.fn()
      const reverseWithErrorHandler = createWorkspaceCommandRegistry(
        mockGridStore,
        mockEngine,
        onRegistryError
      ).reverse

      const result = reverseWithErrorHandler(
        createChainedCommand({
          type: 'updateSettings',
          updates: [{ itemId: 999, settings: { timeline: 'relative' } }],
        })
      )

      expect(result).toBeNull()
      expect(onRegistryError).toHaveBeenCalledTimes(1)
      expect(onRegistryError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          phase: 'reverse',
          command: expect.objectContaining({
            type: 'updateSettings',
            updates: [{ itemId: 999, settings: { timeline: 'relative' } }],
          }),
        })
      )
    })

    it('reports unexpected metadata access failures and still returns null', () => {
      const onRegistryError = vi.fn()
      const reverseWithErrorHandler = createWorkspaceCommandRegistry(
        mockGridStore,
        mockEngine,
        onRegistryError
      ).reverse

      Object.defineProperty(mockEngine, 'metadata', {
        get: () => {
          throw new Error('Data store error')
        },
        configurable: true,
      })

      const result = reverseWithErrorHandler(
        createChainedCommand({
          type: 'updateEntities',
          axis: 'participant',
          items: [],
        })
      )

      expect(result).toBeNull()
      expect(onRegistryError).toHaveBeenCalledTimes(1)
      expect(onRegistryError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          phase: 'reverse',
          command: expect.objectContaining({
            type: 'updateEntities',
          }),
        })
      )
    })

    it('does not mutate the command passed to reverse()', () => {
      const command = createChainedCommand({
        type: 'updateSettings',
        updates: [{ itemId: 1, settings: { timeline: 'relative' } }],
      })
      const snapshot = JSON.parse(JSON.stringify(command))

      reverseCommand(command)
      expect(command).toEqual(snapshot)
    })
  })

  // ============================================================================
  // 2. Grid Commands (from workspaceCommandReverse.grid.test.ts)
  // ============================================================================
  describe('Grid layout commands', () => {
    it('reverses addGridItem into removeGridItem', () => {
      const command = createChainedCommand({
        type: 'addGridItem',
        vizType: 'scarf',
        itemId: 123,
      })

      expect(reverseCommand(command)).toEqual(
        createChainedCommand({
          type: 'removeGridItem',
          itemId: 123,
        })
      )
    })

    it('reverses removeGridItem into addGridItem with the current snapshot', () => {
      const command = createChainedCommand({
        type: 'removeGridItem',
        itemId: 1,
      })

      expect(reverseCommand(command)).toEqual({
        type: 'addGridItem',
        vizType: 'scarf',
        itemId: 1,
        options: {
          id: 1,
          type: 'scarf',
          x: 0,
          y: 0,
          w: 6,
          h: 8,
          min: { w: 4, h: 4 },
          settings: {
            stimulusId: 1,
            groupId: -1,
            timeline: 'absolute',
            absoluteStimuliLimits: [],
            ordinalStimuliLimits: [],
            hideNoAoi: false,
          },
        },
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })

    it('returns null when reversing a removed item that no longer exists', () => {
      expect(
        reverseCommand(
          createChainedCommand({
            type: 'removeGridItem',
            itemId: 999,
          })
        )
      ).toBeNull()
    })

    it.each([
      {
        label: 'when the original item still exists',
        items: [createScarfGridItem({ id: 1 }), createScarfGridItem({ id: 2 })],
        command: createChainedCommand({
          type: 'duplicateGridItem',
          itemId: 1,
          duplicateId: 2,
        }),
        expected: createChainedCommand({
          type: 'removeGridItem',
          itemId: 2,
        }),
      },
      {
        label: 'when only the duplicate id matters',
        items: [createScarfGridItem({ id: 1 }), createScarfGridItem({ id: 2 })],
        command: createChainedCommand({
          type: 'duplicateGridItem',
          itemId: 999,
          duplicateId: 998,
        }),
        expected: createChainedCommand({
          type: 'removeGridItem',
          itemId: 998,
        }),
      },
    ])('reverses duplicateGridItem $label', ({ items, command, expected }) => {
      mockGridStore.items = items
      expect(reverseCommand(command)).toEqual(expected)
    })

    it('returns null when duplicateGridItem is missing duplicateId', () => {
      const invalidCommand = createChainedCommand({
        type: 'duplicateGridItem',
        itemId: 1,
      } as unknown as WorkspaceCommandChain)

      expect(reverseCommand(invalidCommand)).toBeNull()
    })

    it.each([
      {
        label: 'updateLayout',
        command: createChainedCommand({
          type: 'updateLayout',
          updates: [{ itemId: 1, layout: { x: 10, y: 20, w: 8 } }],
        }),
        expected: createChainedCommand({
          type: 'updateLayout',
          updates: [{ itemId: 1, layout: { x: 0, y: 0, w: 6 } }],
        }),
      },
      {
        label: 'updateSettings',
        command: createChainedCommand({
          type: 'updateSettings',
          updates: [
            {
              itemId: 1,
              settings: { timeline: 'relative', timelineStart: 100 },
            },
          ],
        }),
        expected: createChainedCommand({
          type: 'updateSettings',
          updates: [
            {
              itemId: 1,
              settings: { timeline: 'absolute', timelineStart: undefined },
            },
          ],
        }),
      },
    ])('reverses $label using the current item state', ({ command, expected }) => {
      expect(reverseCommand(command)).toEqual(expected)
    })

    it('returns null when reversing updateLayout for a missing item', () => {
      expect(
        reverseCommand(
          createChainedCommand({
            type: 'updateLayout',
            updates: [{ itemId: 999, layout: { x: 10, y: 20 } }],
          })
        )
      ).toBeNull()
    })
  })

  // ============================================================================
  // 3. Metadata & Document Commands (from workspaceCommandReverse.metadata.test.ts)
  // ============================================================================
  describe('Metadata and document commands', () => {
    beforeEach(() => {
      // For metadata reversal, default mockGridStore can be empty.
      mockGridStore = createMockGridStore()
      reverseCommand = createWorkspaceCommandRegistry(
        mockGridStore,
        mockEngine
      ).reverse
    })

    it.each([
      {
        label: 'updateAois',
        command: createChainedCommand({
          type: 'updateAois',
          aois: [],
          stimulusId: 1,
          applyTo: 'this_stimulus',
        }),
        expected: createChainedCommand({
          type: 'updateAois',
          aois: [
            {
              id: 0,
              originalName: 'AOI1',
              displayedName: 'AOI 1',
              color: '#FF0000',
            },
            {
              id: 1,
              originalName: 'AOI2',
              displayedName: 'AOI 2',
              color: '#00FF00',
            },
          ],
          stimulusId: 1,
          applyTo: 'this_stimulus',
        }),
      },
      {
        label: 'updateEntities (participant)',
        command: createChainedCommand({
          type: 'updateEntities',
          axis: 'participant',
          items: [],
        }),
        expected: createChainedCommand({
          type: 'updateEntities',
          axis: 'participant',
          items: [
            {
              id: 0,
              originalName: 'Participant1',
              displayedName: 'Participant 1',
            },
            {
              id: 1,
              originalName: 'Participant2',
              displayedName: 'Participant 2',
            },
          ],
        }),
      },
      {
        label: 'updateEntities (stimulus)',
        command: createChainedCommand({
          type: 'updateEntities',
          axis: 'stimulus',
          items: [],
        }),
        expected: createChainedCommand({
          type: 'updateEntities',
          axis: 'stimulus',
          items: [
            { id: 0, originalName: 'Stimulus1', displayedName: 'Stimulus 1' },
            { id: 1, originalName: 'Stimulus2', displayedName: 'Stimulus 2' },
          ],
        }),
      },
      {
        label: 'updateSelections (participant)',
        command: createChainedCommand({
          type: 'updateSelections',
          axis: 'participant',
          selections: [],
        }),
        expected: createChainedCommand({
          type: 'updateSelections',
          axis: 'participant',
          selections: [
            {
              id: 1,
              name: 'Group 1',
              participantsIds: [1, 2],
            },
          ],
        }),
      },
    ])('reverses $label using the current metadata snapshot', ({ command, expected }) => {
      expect(reverseCommand(command)).toEqual(expected)
    })

    it('reverses updateEventData restoring defs and order', () => {
      setMockEngineMetadata(
        mockEngine,
        createMockMetadata({
          eventData: {
            data: [
              [
                ['X', 'X', '#111111'],
                ['Y', 'Y', '#222222'],
              ],
            ],
            events: [[[[10, 0]], [[20, 0]]]],
            orderVector: [[1, 0]],
          },
        })
      )

      expect(
        reverseCommand(
          createChainedCommand({
            type: 'updateEventData',
            stimulusId: 0,
            channelDefs: [],
            eventBuffers: [],
          })
        )
      ).toEqual(
        createChainedCommand({
          type: 'updateEventData',
          stimulusId: 0,
          channelDefs: [
            ['X', 'X', '#111111'],
            ['Y', 'Y', '#222222'],
          ],
          eventBuffers: [[[10, 0]], [[20, 0]]],
          orderVector: [1, 0],
        })
      )
    })

    it('returns an empty AOI list when the target stimulus has no AOIs', () => {
      expect(
        reverseCommand(
          createChainedCommand({
            type: 'updateAois',
            aois: [],
            stimulusId: 999,
            applyTo: 'this_stimulus',
          })
        )
      ).toEqual(
        createChainedCommand({
          type: 'updateAois',
          aois: [],
          stimulusId: 999,
          applyTo: 'this_stimulus',
        })
      )
    })

    it.each([
      {
        label: 'participants',
        command: createChainedCommand({
          type: 'updateEntities',
          axis: 'participant',
          items: [],
        }),
        expected: createChainedCommand({
          type: 'updateEntities',
          axis: 'participant',
          items: [],
        }),
      },
      {
        label: 'stimuli',
        command: createChainedCommand({
          type: 'updateEntities',
          axis: 'stimulus',
          items: [],
        }),
        expected: createChainedCommand({
          type: 'updateEntities',
          axis: 'stimulus',
          items: [],
        }),
      },
      {
        label: 'participant selections',
        command: createChainedCommand({
          type: 'updateSelections',
          axis: 'participant',
          selections: [],
        }),
        expected: createChainedCommand({
          type: 'updateSelections',
          axis: 'participant',
          selections: [],
        }),
      },
    ])('returns an empty list for $label when metadata is empty', ({ command, expected }) => {
      setMockEngineMetadata(mockEngine, createEmptyMockMetadata())
      expect(reverseCommand(command)).toEqual(expected)
    })

    it.each([null, undefined] as const)(
      'returns null for updateEntities when metadata is %s',
      metadata => {
        setMockEngineMetadata(mockEngine, metadata)

        expect(
          reverseCommand(
            createChainedCommand({
              type: 'updateEntities',
              axis: 'participant',
              items: [],
            })
          )
        ).toBeNull()
      }
    )
  })
})
