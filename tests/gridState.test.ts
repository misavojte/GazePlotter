import { describe, expect, it } from 'vitest'
import { GridState } from '$lib/workspace/grid/store.svelte'

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
