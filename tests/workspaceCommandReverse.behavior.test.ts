import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceCommandRegistry } from '$lib/workspace/commands/registry'
import type { WorkspaceCommandChain } from '$lib/workspace/commands'
import type { GridState } from '$lib/workspace/grid'
import {
  createChainedCommand,
  createMockEngine,
  createMockGridStore,
  type MockEngine,
} from './helpers/workspaceCommandFixtures'

describe('workspaceCommandReverse behavior', () => {
  let mockGridStore: GridState
  let mockEngine: MockEngine
  let reverseCommand: (
    command: WorkspaceCommandChain
  ) => WorkspaceCommandChain | null

  beforeEach(() => {
    vi.clearAllMocks()
    mockEngine = createMockEngine()
    mockGridStore = createMockGridStore()
    reverseCommand = createWorkspaceCommandRegistry(
      mockGridStore,
      mockEngine
    ).reverse
  })

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
        type: 'updateParticipants',
        participants: [],
      })
    )

    expect(result).toBeNull()
    expect(onRegistryError).toHaveBeenCalledTimes(1)
    expect(onRegistryError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        phase: 'reverse',
        command: expect.objectContaining({
          type: 'updateParticipants',
        }),
      })
    )
  })
})
