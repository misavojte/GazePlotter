import { describe, expect, it, vi } from 'vitest'
import { createGridItem } from '$lib/workspace/grid/itemFactory'
import {
  commitGridItemDuplication,
  commitGridItemMove,
  commitGridItemRemoval,
  commitGridItemResize,
  getGridItemCommandSource,
  getGridItemMinimumSize,
} from '$lib/workspace/grid/itemCommands'
import type { GridConfig } from '$lib/workspace/grid/types'

const gridConfig: GridConfig = {
  cellSize: { width: 40, height: 40 },
  gap: 10,
  minWidth: 3,
  minHeight: 3,
}

function createWorkspacePort() {
  return {
    updateItemLayout: vi.fn(() => true),
    removeVisualization: vi.fn(() => true),
    duplicateVisualization: vi.fn(() => true),
  }
}

describe('gridItemCommands', () => {
  it('builds the workspace command source from the grid item identity', () => {
    expect(
      getGridItemCommandSource({
        id: 17,
        type: 'barPlot',
      })
    ).toBe('barPlot.17.workspace')
  })

  it('resolves the minimum size from item-specific bounds and grid config', () => {
    const item = createGridItem('barPlot', { type: 'barPlot', id: 9 })

    expect(getGridItemMinimumSize(item, gridConfig)).toEqual({ w: 11, h: 10 })
  })

  it('commits move, resize, remove, and duplicate operations through the workspace service', () => {
    const workspace = createWorkspacePort()
    const item = createGridItem('barPlot', { type: 'barPlot', id: 21 })
    const items = [item]

    expect(
      commitGridItemMove(workspace, items, { id: 21, x: 7, y: 5 })
    ).toBe(true)
    expect(workspace.updateItemLayout).toHaveBeenNthCalledWith(
      1,
      21,
      { x: 7, y: 5 },
      'barPlot.21.workspace'
    )

    expect(
      commitGridItemResize(workspace, items, gridConfig, {
        id: 21,
        x: 3,
        y: 4,
        w: 2,
        h: 1,
      })
    ).toBe(true)
    expect(workspace.updateItemLayout).toHaveBeenNthCalledWith(
      2,
      21,
      { x: 3, y: 4, w: 11, h: 10 },
      'barPlot.21.workspace'
    )

    expect(commitGridItemRemoval(workspace, items, { id: 21 })).toBe(true)
    expect(workspace.removeVisualization).toHaveBeenCalledWith(
      21,
      'barPlot.21.workspace'
    )

    expect(commitGridItemDuplication(workspace, items, { id: 21 })).toBe(true)
    expect(workspace.duplicateVisualization).toHaveBeenCalledWith(
      21,
      'barPlot.21.workspace'
    )
  })

  it('returns false when the target item is missing', () => {
    const workspace = createWorkspacePort()

    expect(
      commitGridItemMove(workspace, [], { id: 999, x: 1, y: 2 })
    ).toBe(false)
    expect(
      commitGridItemResize(workspace, [], gridConfig, {
        id: 999,
        x: 0,
        y: 0,
        w: 5,
        h: 5,
      })
    ).toBe(false)
    expect(commitGridItemRemoval(workspace, [], { id: 999 })).toBe(false)
    expect(commitGridItemDuplication(workspace, [], { id: 999 })).toBe(false)

    expect(workspace.updateItemLayout).not.toHaveBeenCalled()
    expect(workspace.removeVisualization).not.toHaveBeenCalled()
    expect(workspace.duplicateVisualization).not.toHaveBeenCalled()
  })
})
