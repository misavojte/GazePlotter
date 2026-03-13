import { describe, expect, it } from 'vitest'
import { UndoRedoStateStore, type WorkspaceCommandChain } from '$lib/workspace/commands'

describe('workspaceCommandHistory', () => {
  it('throws a named history error when a child command is recorded without a pending chain', () => {
    const history = new UndoRedoStateStore()
    const childCommand: WorkspaceCommandChain = {
      type: 'updateLayout',
      itemId: 1,
      layout: { x: 2 },
      source: 'workspace',
      chainId: 1,
      isRootCommand: false,
    }

    try {
      history.recordCommand(childCommand, childCommand)
      throw new Error('Expected recordCommand to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).name).toBe('WorkspaceHistoryError')
      expect((error as Error).message).toBe(
        'Child command recorded without a pending chain'
      )
    }
  })

  it('throws a named history error when a child command chain does not match the pending chain', () => {
    const history = new UndoRedoStateStore()
    const rootCommand: WorkspaceCommandChain = {
      type: 'updateLayout',
      itemId: 1,
      layout: { x: 1 },
      source: 'workspace',
      chainId: 1,
      isRootCommand: true,
    }
    const childCommand: WorkspaceCommandChain = {
      type: 'updateLayout',
      itemId: 1,
      layout: { x: 2 },
      source: 'workspace',
      chainId: 2,
      isRootCommand: false,
    }

    history.recordCommand(rootCommand, rootCommand)

    try {
      history.recordCommand(childCommand, childCommand)
      throw new Error('Expected recordCommand to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).name).toBe('WorkspaceHistoryError')
      expect((error as Error).message).toBe(
        'Child command chainId does not match pending chain'
      )
    }
  })
})
