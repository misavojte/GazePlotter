import { afterEach, describe, expect, it, vi } from 'vitest'
import { UndoRedoStateStore, type WorkspaceCommandChain } from '$lib/workspace/commands'

describe('workspaceCommandHistory', () => {
  it('throws a named history error when a child command is recorded without a pending chain', () => {
    const history = new UndoRedoStateStore()
    const childCommand: WorkspaceCommandChain = {
      type: 'updateLayout',
      updates: [{ itemId: 1, layout: { x: 2 } }],
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
      updates: [{ itemId: 1, layout: { x: 1 } }],
      source: 'workspace',
      chainId: 1,
      isRootCommand: true,
    }
    const childCommand: WorkspaceCommandChain = {
      type: 'updateLayout',
      updates: [{ itemId: 1, layout: { x: 2 } }],
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

describe('settings edit coalescing', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  let chainId = 0
  const edit = (
    history: UndoRedoStateStore,
    settings: Record<string, unknown>,
    before: Record<string, unknown>,
    itemId = 1
  ) => {
    chainId += 1
    const command = (s: Record<string, unknown>): WorkspaceCommandChain => ({
      type: 'updateSettings',
      updates: [{ itemId, settings: s }],
      source: 'pane',
      chainId,
      isRootCommand: true,
    })
    history.recordCommand(command(settings), command(before))
    history.finalizeChain()
  }

  const undoSettings = (history: UndoRedoStateStore) => {
    const commands = history.undo()
    history.endUndoRedo()
    return commands?.map(command =>
      command.type === 'updateSettings' ? command.updates[0].settings : null
    )
  }

  it('merges quick keystrokes on one field into one undo step', () => {
    vi.useFakeTimers()
    const history = new UndoRedoStateStore()
    edit(history, { radius: 5 }, { radius: 20 })
    vi.advanceTimersByTime(200)
    edit(history, { radius: 50 }, { radius: 5 })
    vi.advanceTimersByTime(200)
    edit(history, { radius: 500 }, { radius: 50 })

    expect(history.undoStack).toHaveLength(1)
    expect(history.lastUndoCommand).toMatchObject({
      updates: [{ settings: { radius: 500 } }],
    })
    expect(undoSettings(history)).toEqual([{ radius: 20 }])
    expect(history.canUndo).toBe(false)
  })

  it('keeps separate steps after a pause, another field, an undo or a save', () => {
    vi.useFakeTimers()
    const history = new UndoRedoStateStore()
    edit(history, { radius: 5 }, { radius: 20 })
    vi.advanceTimersByTime(1500)
    edit(history, { radius: 50 }, { radius: 5 })
    edit(history, { opacity: 1 }, { opacity: 0.5 })
    edit(history, { radius: 60 }, { radius: 50 }, 2)
    expect(history.undoStack).toHaveLength(4)

    history.markSaved(history.head)
    edit(history, { radius: 70 }, { radius: 60 }, 2)
    expect(history.undoStack).toHaveLength(5)
    expect(history.isDirty).toBe(true)

    undoSettings(history)
    edit(history, { radius: 80 }, { radius: 60 }, 2)
    expect(history.undoStack).toHaveLength(5)
  })
})

describe('layout nudge coalescing', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('merges a quick run of moves of the same plots into one step', () => {
    vi.useFakeTimers()
    const history = new UndoRedoStateStore()
    const move = (chainId: number, x: number, from: number) => {
      const command = (value: number): WorkspaceCommandChain => ({
        type: 'updateLayout',
        updates: [{ itemId: 1, layout: { x: value, y: 0 } }],
        source: 'grid',
        chainId,
        isRootCommand: true,
      })
      history.recordCommand(command(x), command(from))
      history.finalizeChain()
    }
    move(101, 1, 0)
    vi.advanceTimersByTime(150)
    move(102, 2, 1)
    vi.advanceTimersByTime(150)
    move(103, 3, 2)
    expect(history.undoStack).toHaveLength(1)

    const reverse = history.undo()
    history.endUndoRedo()
    expect(reverse).toMatchObject([{ updates: [{ layout: { x: 0 } }] }])
  })
})
