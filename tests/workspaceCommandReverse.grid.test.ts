import { beforeEach, describe, expect, it } from 'vitest'
import { createWorkspaceCommandRegistry } from '$lib/workspace/commands/registry'
import type { WorkspaceCommandChain } from '$lib/workspace/commands'
import type { GridState } from '$lib/workspace/grid'
import {
  createBarPlotGridItem,
  createChainedCommand,
  createMockEngine,
  createMockGridStore,
  createScarfGridItem,
  type MockEngine,
} from './helpers/workspaceCommandFixtures'

describe('workspaceCommandReverse grid commands', () => {
  let mockGridStore: GridState
  let mockEngine: MockEngine
  let reverseCommand: (
    command: WorkspaceCommandChain
  ) => WorkspaceCommandChain | null

  beforeEach(() => {
    mockEngine = createMockEngine()
    mockGridStore = createMockGridStore([
      createScarfGridItem(),
      createBarPlotGridItem(),
    ])
    reverseCommand = createWorkspaceCommandRegistry(
      mockGridStore,
      mockEngine
    ).reverse
  })

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
          dynamicAOI: true,
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
            settings: { timeline: 'relative', hideNonFixations: true },
          },
        ],
      }),
      expected: createChainedCommand({
        type: 'updateSettings',
        updates: [
          {
            itemId: 1,
            settings: { timeline: 'absolute', hideNonFixations: undefined },
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

  it('does not mutate the command passed to reverse()', () => {
    const command = createChainedCommand({
      type: 'updateSettings',
      updates: [{ itemId: 1, settings: { timeline: 'relative' } }],
    })
    const snapshot = JSON.parse(JSON.stringify(command))

    reverseCommand(command)

    expect(command).toEqual(snapshot)
  })

  it('returns the same reverse command for the same input', () => {
    const command = createChainedCommand({
      type: 'removeGridItem',
      itemId: 1,
    })

    expect(reverseCommand(command)).toEqual(reverseCommand(command))
  })
})
