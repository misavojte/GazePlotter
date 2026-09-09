import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { ErrorService } from '../src/lib/errors'
import { createWorkspaceCommandRegistry } from '../src/lib/workspace/commands/registry'
import { WorkspaceCommandBus } from '../src/lib/workspace/commands/bus'
import { DataEngine } from '../src/lib/data/engine/dataEngine.svelte'
import type {
  WorkspaceCommand,
  WorkspaceCommandChain,
} from '../src/lib/workspace/commands'
import { GridState } from '../src/lib/workspace/grid'
import { makeDataType, normalizeSegments } from './helpers/dataTypeFixtures'
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

      const reversed = reverseCommand(command)
      if (reversed?.type !== 'addGridItem')
        throw new Error('expected an addGridItem reverse')
      expect(reversed).toMatchObject({
        vizType: 'scarf',
        itemId: 1,
        source: 'source',
      })
      // The snapshot IS the store's current item minus the transient
      // redrawTimestamp (registry's toSnapshot); comparing against the store
      // keeps this an undo test, so a new scarf default setting rides along
      // instead of breaking a transcribed literal here.
      const { redrawTimestamp: _transient, ...persisted } =
        mockGridStore.items[0]
      expect(reversed.options).toEqual(persisted)
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
          updates: [{ stimulusId: 1, aois: [] }],
        }),
        // The inverse carries the (empty = identity) order vector verbatim.
        expected: createChainedCommand({
          type: 'updateAois',
          updates: [
            {
              stimulusId: 1,
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
              orderVector: [],
            },
          ],
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
            updates: [{ stimulusId: 999, aois: [] }],
          })
        )
      ).toEqual(
        createChainedCommand({
          type: 'updateAois',
          updates: [{ stimulusId: 999, aois: [], orderVector: [] }],
        })
      )
    })

    // The all-stimuli scope sends one entry per stimulus; the inverse must
    // snapshot EVERY listed stimulus in its own display order (undo restores a
    // custom order), skip id-gap null rows (never resurrected as ghost AOIs),
    // and carry each order vector verbatim.
    it('snapshots every listed stimulus in display order, skipping null rows', () => {
      setMockEngineMetadata(
        mockEngine,
        createMockMetadata({
          aois: {
            data: [
              [
                ['X', 'X', '#111111'],
                ['Y', 'Y', '#222222'],
              ],
              [null, ['P', 'P', '#333333'], ['Q', 'Q', '#444444']],
            ] as unknown as string[][][],
            orderVector: [[1, 0], []],
          },
        })
      )
      expect(
        reverseCommand(
          createChainedCommand({
            type: 'updateAois',
            updates: [
              { stimulusId: 0, aois: [] },
              { stimulusId: 1, aois: [] },
            ],
          })
        )
      ).toEqual(
        createChainedCommand({
          type: 'updateAois',
          updates: [
            {
              stimulusId: 0,
              aois: [
                { id: 1, originalName: 'Y', displayedName: 'Y', color: '#222222' },
                { id: 0, originalName: 'X', displayedName: 'X', color: '#111111' },
              ],
              orderVector: [1, 0],
            },
            {
              stimulusId: 1,
              aois: [
                { id: 1, originalName: 'P', displayedName: 'P', color: '#333333' },
                { id: 2, originalName: 'Q', displayedName: 'Q', color: '#444444' },
              ],
              orderVector: [],
            },
          ],
        })
      )
    })

    it('follows a stale (shorter) order vector rather than appending orphans', () => {
      setMockEngineMetadata(
        mockEngine,
        createMockMetadata({
          aois: {
            data: [
              [
                ['X', 'X', '#111111'],
                ['Y', 'Y', '#222222'],
              ],
            ],
            orderVector: [[1]],
          },
        })
      )
      expect(
        reverseCommand(
          createChainedCommand({
            type: 'updateAois',
            updates: [{ stimulusId: 0, aois: [] }],
          })
        )
      ).toEqual(
        createChainedCommand({
          type: 'updateAois',
          updates: [
            {
              stimulusId: 0,
              aois: [
                { id: 1, originalName: 'Y', displayedName: 'Y', color: '#222222' },
              ],
              orderVector: [1],
            },
          ],
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

// ============================================================================
// 4. Undo round-trip through the bus (real engine + real grid)
// ============================================================================
// The user contract: apply -> undo restores the workspace exactly. One table
// row per command type; mergeEntities/unmergeEntities/reconcileMerges have
// their own round-trips in mergeCommand.test.ts.
describe('Undo round-trip through the command bus', () => {
  // Every axis carries a non-empty saved selection and stimulus 0 carries two
  // event channels, so each command in the table has real state to restore.
  const makeRoundTripData = () =>
    makeDataType(
      [
        [[[0, 100, 0, 0]], [[0, 50, 0, 0]]],
        [[[10, 20, 0, 0]], []],
      ],
      {
        capabilities: { segmented: true, spatial: false, event: true },
        // Fixation's displayed name is locked (categoryUpdaters), so the
        // updateCategories row renames Saccade instead.
        categories: {
          data: [
            ['Fixation', 'Fixation', '#000000'],
            ['Saccade', 'Saccade', '#ff00ff'],
          ],
          orderVector: [0, 1],
        },
        participantsSelections: [{ id: 1, name: 'G', participantsIds: [0, 1] }],
        stimuliSelections: [{ id: 1, name: 'SG', memberIds: [0] }],
        categoriesSelections: [{ id: 1, name: 'CG', memberIds: [0] }],
        eventsSelections: [{ id: 1, name: 'EG', names: ['X'] }],
        aois: {
          data: [[['A', 'A', '#ff0000']], [['A', 'A', '#ff0000']]],
          orderVector: [[0], [0]],
          selections: [{ id: 1, name: 'AG', names: ['A'] }],
        },
        eventData: {
          data: [
            [
              ['X', 'X', '#111111'],
              ['Y', 'Y', '#222222'],
            ],
            [],
          ],
          orderVector: [[0, 1], []],
          events: [[[[10, 0]], [[20, 0]]], []],
        },
      }
    )

  let engine: DataEngine
  let grid: GridState
  let ws: WorkspaceCommandBus
  let report: Mock<ErrorService['report']>

  beforeEach(() => {
    engine = new DataEngine()
    engine.loadDataset(makeRoundTripData())
    grid = new GridState({ getAvailableColumns: () => 24 })
    grid.items = [createScarfGridItem(), createAoiComparisonGridItem()]
    report = vi.fn<ErrorService['report']>()
    ws = new WorkspaceCommandBus({
      engine,
      errorService: { report },
      grid,
      toastState: { addSuccess: vi.fn() },
    })
  })

  // Everything the command set can mutate, minus the transient
  // redrawTimestamp; items sorted by id because undoing a removal re-appends.
  const snapshot = () =>
    JSON.parse(
      JSON.stringify({
        data: normalizeSegments(engine.toDataType()!),
        items: [...grid.items]
          .sort((a, b) => a.id - b.id)
          .map(({ redrawTimestamp: _t, ...rest }) => rest),
      })
    )

  const source = 'test.roundTrip'
  const rows: {
    label: string
    command: () => WorkspaceCommand
    mutates?: boolean
  }[] = [
    {
      label: 'updateAois',
      command: () => ({
        type: 'updateAois',
        updates: [
          {
            stimulusId: 0,
            aois: [
              { id: 0, originalName: 'A', displayedName: 'A renamed', color: '#00ff00' },
            ],
          },
        ],
        source,
      }),
    },
    {
      // The all-stimuli scope: one command, several stimuli, ONE undo step.
      label: 'updateAois (two stimuli)',
      command: () => ({
        type: 'updateAois',
        updates: [
          {
            stimulusId: 0,
            aois: [{ id: 0, originalName: 'A', displayedName: 'A', color: '#00ff00' }],
          },
          {
            stimulusId: 1,
            aois: [{ id: 0, originalName: 'A', displayedName: 'A', color: '#0000ff' }],
          },
        ],
        source,
      }),
    },
    {
      label: 'updateEntities (participant)',
      command: () => ({
        type: 'updateEntities',
        axis: 'participant',
        items: [
          { id: 0, originalName: 'P0', displayedName: 'P0 renamed' },
          { id: 1, originalName: 'P1', displayedName: 'P1' },
        ],
        source,
      }),
    },
    {
      label: 'updateEntities (stimulus)',
      command: () => ({
        type: 'updateEntities',
        axis: 'stimulus',
        items: [
          { id: 0, originalName: 'S0', displayedName: 'S0 renamed' },
          { id: 1, originalName: 'S1', displayedName: 'S1' },
        ],
        source,
      }),
    },
    {
      label: 'updateEventData',
      command: () => ({
        type: 'updateEventData',
        stimulusId: 0,
        channelDefs: [['Z', 'Z', '#333333']],
        eventBuffers: [[[5, 0]]],
        source,
      }),
    },
    {
      label: 'updateEventChannels (rename + reorder)',
      command: () => ({
        type: 'updateEventChannels',
        stimulusId: 0,
        channels: [
          { id: 1, originalName: 'Y', displayedName: 'Y', color: '#222222' },
          { id: 0, originalName: 'X', displayedName: 'X renamed', color: '#111111' },
        ],
        source,
      }),
    },
    {
      label: 'updateSelections (participant)',
      command: () => ({
        type: 'updateSelections',
        axis: 'participant',
        selections: [{ id: 1, name: 'G renamed', participantsIds: [0] }],
        source,
      }),
    },
    {
      label: 'updateSelections (stimulus)',
      command: () => ({
        type: 'updateSelections',
        axis: 'stimulus',
        selections: [
          { id: 1, name: 'SG', memberIds: [0] },
          { id: 2, name: 'SG2', memberIds: [1] },
        ],
        source,
      }),
    },
    {
      label: 'updateSelections (category, cleared)',
      command: () => ({
        type: 'updateSelections',
        axis: 'category',
        selections: [],
        source,
      }),
    },
    {
      label: 'updateSelections (event)',
      command: () => ({
        type: 'updateSelections',
        axis: 'event',
        selections: [{ id: 1, name: 'EG', names: ['X', 'Y'] }],
        source,
      }),
    },
    {
      label: 'updateSelections (aoi)',
      command: () => ({
        type: 'updateSelections',
        axis: 'aoi',
        selections: [{ id: 1, name: 'AG renamed', names: ['A'] }],
        source,
      }),
    },
    {
      label: 'updateNoAoiTreatment',
      command: () => ({
        type: 'updateNoAoiTreatment',
        noAoiTreatment: { displayedName: 'Background', color: '#123456' },
        source,
      }),
    },
    {
      label: 'updateCategories',
      command: () => ({
        type: 'updateCategories',
        categories: [
          {
            id: 0,
            originalName: 'Fixation',
            displayedName: 'Fixation',
            color: '#000000',
          },
          {
            id: 1,
            originalName: 'Saccade',
            displayedName: 'Saccade renamed',
            color: '#00ffff',
          },
        ],
        source,
      }),
    },
    {
      label: 'updateMetricInstances (cleared)',
      command: () => ({ type: 'updateMetricInstances', instances: [], source }),
    },
    {
      label: 'updateSettings',
      command: () => ({
        type: 'updateSettings',
        updates: [{ itemId: 1, settings: { timeline: 'relative' } }],
        source,
      }),
    },
    {
      // Moves item 1 onto item 2, so the chain includes a collision child;
      // undo must replay the whole chain in reverse.
      label: 'updateLayout (with collision child)',
      command: () => ({
        type: 'updateLayout',
        updates: [{ itemId: 1, layout: { x: 10, y: 6 } }],
        source,
      }),
    },
    {
      label: 'addGridItem',
      command: () => ({ type: 'addGridItem', vizType: 'scarf', itemId: 77, source }),
    },
    {
      label: 'removeGridItem',
      command: () => ({ type: 'removeGridItem', itemId: 2, source }),
    },
    {
      label: 'duplicateGridItem',
      command: () => ({
        type: 'duplicateGridItem',
        itemId: 1,
        duplicateId: 55,
        source,
      }),
    },
    {
      label: 'setLayoutState',
      command: () => ({
        type: 'setLayoutState',
        layoutState: grid.items.map(({ redrawTimestamp: _t, ...rest }) => ({
          ...rest,
          y: rest.y + 10,
        })),
        source,
      }),
    },
    {
      label: 'noop',
      command: () => ({ type: 'noop', source }),
      mutates: false,
    },
  ]

  it.each(rows)('$label: undo restores the exact prior state', row => {
    const before = snapshot()

    expect(ws.apply(row.command())).toBe(true)
    const after = snapshot()
    if (row.mutates !== false) expect(after).not.toEqual(before)

    expect(ws.undo()).toBe(true)
    expect(snapshot()).toEqual(before)
    expect(report).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 5. Many stimuli in one command (the AOI modal's "All stimuli" scope)
// ============================================================================
// The reported bug: on a large dataset a bulk recolor used to be one root
// command PER stimulus, so a single Undo reverted one stimulus and, past the
// undo cap (50 chains), the oldest stimuli could never be reverted at all.
describe('updateAois over many stimuli', () => {
  const N = 60 // deliberately above MAX_UNDO_STACK_SIZE
  const colorOf = (i: number) =>
    `#${(0x100000 + i * 7919).toString(16).slice(-6).padStart(6, '0')}`
  const makeManyStimuli = () =>
    makeDataType(
      Array.from({ length: N }, () => [[[0, 100, 0, 0]]]),
      {
        aois: {
          data: Array.from({ length: N }, (_, i) => [['A', 'A', colorOf(i)]]),
          orderVector: Array.from({ length: N }, () => [0]),
        },
      }
    )

  it('recolors every stimulus in one command that is ONE undo step restoring all', () => {
    const engine = new DataEngine()
    engine.loadDataset(makeManyStimuli())
    const grid = new GridState({ getAvailableColumns: () => 24 })
    grid.items = [createScarfGridItem()]
    const report = vi.fn<ErrorService['report']>()
    const ws = new WorkspaceCommandBus({
      engine,
      errorService: { report },
      grid,
      toastState: { addSuccess: vi.fn() },
    })
    const snapshot = () =>
      JSON.parse(JSON.stringify(normalizeSegments(engine.toDataType()!)))
    const before = snapshot()

    const updates = Array.from({ length: N }, (_, stimulusId) => ({
      stimulusId,
      aois: [{ id: 0, originalName: 'A', displayedName: 'A', color: '#00ff00' }],
    }))
    expect(ws.apply({ type: 'updateAois', updates, source: 'test.many' })).toBe(true)

    for (let s = 0; s < N; s++) {
      expect(engine.metadata!.aois.data[s][0][2]).toBe('#00ff00')
    }
    expect(ws.history.undoStack.length).toBe(1)

    expect(ws.undo()).toBe(true)
    expect(snapshot()).toEqual(before)
    for (let s = 0; s < N; s++) {
      expect(engine.metadata!.aois.data[s][0][2]).toBe(colorOf(s))
    }
    expect(report).not.toHaveBeenCalled()
  })
})
