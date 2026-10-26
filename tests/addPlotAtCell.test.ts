import { describe, expect, it } from 'vitest'
import { createGazePlotterSession } from '$lib/session'
import type { GridItemSnapshot } from '$lib/workspace'

// The canvas right-click menu adds a plot at the clicked cell.
describe('adding a plot at a cell', () => {
  const session = () => {
    const defaultLayout: GridItemSnapshot[] = [{ type: 'scarf', x: 0, y: 0 }]
    const s = createGazePlotterSession({ defaultLayout })
    s.ingest.applyEmpty()
    return s
  }

  it('lands on a free cell, and redo puts it back there', () => {
    const s = session()
    expect(s.workspace.addGridItem('scarf', 'controls', 7, undefined, { x: 60, y: 40 })).toBe(true)
    const added = () => s.grid.items.find(item => item.id === 7)
    expect(added()).toMatchObject({ x: 60, y: 40 })
    s.workspace.undo()
    expect(added()).toBeUndefined()
    s.workspace.redo()
    expect(added()).toMatchObject({ x: 60, y: 40 })
  })

  it('takes the nearest free spot when the cell is taken', () => {
    const s = session()
    const first = s.grid.items[0]
    s.workspace.addGridItem('scarf', 'controls', 7, undefined, { x: 2, y: 1 })
    const added = s.grid.items.find(item => item.id === 7)!
    // Right of or below the plot it would overlap, whichever is closer.
    const candidates = [
      { x: first.x + first.w, y: 1 },
      { x: 2, y: first.y + first.h },
    ]
    const distance = (p: { x: number; y: number }) => (p.x - 2) ** 2 + (p.y - 1) ** 2
    const nearest = candidates.sort((a, b) => distance(a) - distance(b))[0]
    expect({ x: added.x, y: added.y }).toEqual(nearest)
  })
})
