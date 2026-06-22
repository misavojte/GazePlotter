import { describe, expect, it } from 'vitest'
import { GridState } from '$lib/workspace/grid/gridState.svelte'

describe('GridState', () => {
  it('uses the injected available-column strategy for deterministic placement', () => {
    const grid = new GridState({
      getAvailableColumns: () => 6,
    })

    const firstId = grid.addItem('barPlot', {
      type: 'barPlot',
      id: 1,
    })
    const secondId = grid.addItem('barPlot', {
      type: 'barPlot',
      id: 2,
    })

    expect(firstId).toBe(1)
    expect(secondId).toBe(2)
    expect(
      grid.items.map(item => ({
        id: item.id,
        x: item.x,
        y: item.y,
      }))
    ).toEqual([
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 0, y: 12 },
    ])
  })
})

describe('GridState selection set', () => {
  function gridWithItems(): GridState {
    const grid = new GridState({ getAvailableColumns: () => 12 })
    grid.addItem('barPlot', { type: 'barPlot', id: 1 })
    grid.addItem('barPlot', { type: 'barPlot', id: 2 })
    grid.addItem('barPlot', { type: 'barPlot', id: 3 })
    return grid
  }

  it('selectOnly replaces the selection; selectedItemId is single-only', () => {
    const grid = gridWithItems()

    grid.selectOnly(1)
    expect(grid.selectedItemIds).toEqual([1])
    expect(grid.selectedItemId).toBe(1)
    expect(grid.selectedCount).toBe(1)

    grid.selectOnly(2)
    expect(grid.selectedItemIds).toEqual([2])
    expect(grid.selectedItemId).toBe(2)
  })

  it('toggleInSelection adds/removes; selectedItemId is null when many are selected', () => {
    const grid = gridWithItems()

    grid.selectOnly(1)
    grid.toggleInSelection(2)
    expect(grid.selectedItemIds).toEqual([1, 2])
    expect(grid.selectedCount).toBe(2)
    expect(grid.selectedItemId).toBeNull()
    expect(grid.selectedItems.map(i => i.id)).toEqual([1, 2])

    grid.toggleInSelection(1)
    expect(grid.selectedItemIds).toEqual([2])
    expect(grid.selectedItemId).toBe(2)
  })

  it('toggleInSelection that empties the set also closes the pane', () => {
    const grid = gridWithItems()
    grid.selectOnly(1)
    grid.openPane(1)
    expect(grid.paneOpenId).toBe(1)

    grid.toggleInSelection(1)
    expect(grid.selectedItemIds).toEqual([])
    expect(grid.paneOpenId).toBeNull()
  })

  it('toggleInSelection down to a lone item syncs the single pane to it', () => {
    const grid = gridWithItems()
    grid.selectOnly(1)
    grid.openPane(1)
    grid.toggleInSelection(2) // [1, 2] — bulk; paneOpenId untouched
    expect(grid.paneOpenId).toBe(1)

    grid.toggleInSelection(1) // back to a lone [2]; pane follows to item 2
    expect(grid.selectedItemIds).toEqual([2])
    expect(grid.paneOpenId).toBe(2)
  })

  it('clearSelection and setSelectedItem(null) clear both selection and pane', () => {
    const grid = gridWithItems()
    grid.selectOnly(1)
    grid.openPane(1)
    grid.toggleInSelection(2)

    grid.clearSelection()
    expect(grid.selectedItemIds).toEqual([])
    expect(grid.paneOpenId).toBeNull()

    grid.selectOnly(3)
    grid.setSelectedItem(null)
    expect(grid.selectedItemIds).toEqual([])
  })

  it('removeItem drops only that item from the selection', () => {
    const grid = gridWithItems()
    grid.selectOnly(1)
    grid.toggleInSelection(2)
    grid.toggleInSelection(3)

    grid.removeItem(2)
    expect(grid.items.map(i => i.id)).toEqual([1, 3])
    expect(grid.selectedItemIds).toEqual([1, 3])
  })

  it('reassigns the selection array (no in-place mutation)', () => {
    const grid = gridWithItems()
    grid.selectOnly(1)
    const before = grid.selectedItemIds
    grid.toggleInSelection(2)
    expect(grid.selectedItemIds).not.toBe(before)
  })
})
