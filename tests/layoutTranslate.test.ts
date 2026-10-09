/**
 * A plot dropped above or left of the grid origin shifts the whole layout back
 * to non-negative cells (`translateLayout`), as part of the same undo step, and
 * the listener sees the shift (and its inverse on undo) so the view can follow.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceCommandBus } from '../src/lib/workspace/commands/bus'
import { DataEngine } from '../src/lib/data/engine/dataEngine.svelte'
import { GridState } from '../src/lib/workspace/grid'
import type { WorkspaceCommandChain } from '../src/lib/workspace/commands'
import {
  createAoiComparisonGridItem,
  createScarfGridItem,
} from './helpers/workspaceCommandFixtures'

describe('translateLayout', () => {
  let grid: GridState
  let ws: WorkspaceCommandBus
  let shifts: { dx: number; dy: number }[]

  beforeEach(() => {
    grid = new GridState({ getAvailableColumns: () => 24 })
    // Scarf at (0,0) 6×8, AOI comparison at (6,0) 6×8.
    grid.items = [createScarfGridItem(), createAoiComparisonGridItem()]
    ws = new WorkspaceCommandBus({
      engine: new DataEngine(),
      errorService: { report: vi.fn() },
      grid,
      toastState: { addSuccess: vi.fn() },
    })
    shifts = []
    ws.setCommandListener((command: WorkspaceCommandChain) => {
      if (command.type === 'translateLayout')
        shifts.push({ dx: command.dx, dy: command.dy })
    })
  })

  const positions = () =>
    [...grid.items]
      .sort((a, b) => a.id - b.id)
      .map(({ id, x, y }) => ({ id, x, y }))

  it('shifts every plot so a drop past the origin lands at 0', () => {
    ws.apply({
      type: 'updateLayout',
      updates: [{ itemId: 2, layout: { x: -8, y: -2 } }],
      source: 'test',
    })

    expect(positions()).toEqual([
      { id: 1, x: 8, y: 2 },
      { id: 2, x: 0, y: 0 },
    ])
    expect(shifts).toEqual([{ dx: 8, dy: 2 }])
  })

  it('undoes the move and the shift as one step, and redoes both', () => {
    const before = positions()
    ws.apply({
      type: 'updateLayout',
      updates: [{ itemId: 2, layout: { x: -8, y: -2 } }],
      source: 'test',
    })
    const after = positions()

    ws.undo()
    expect(positions()).toEqual(before)
    expect(shifts.at(-1)).toEqual({ dx: -8, dy: -2 })

    ws.redo()
    expect(positions()).toEqual(after)
    expect(shifts.at(-1)).toEqual({ dx: 8, dy: 2 })
  })

  it('leaves a layout that stays on the grid alone', () => {
    ws.apply({
      type: 'updateLayout',
      updates: [{ itemId: 2, layout: { x: 0, y: 9 } }],
      source: 'test',
    })

    expect(positions()).toEqual([
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 0, y: 9 },
    ])
    expect(shifts).toEqual([])
  })
})
