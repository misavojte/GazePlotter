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

  it('falls back to the usual free spot when the cell is taken', () => {
    const s = session()
    s.workspace.addGridItem('scarf', 'controls', 7, undefined, { x: 0, y: 0 })
    const added = s.grid.items.find(item => item.id === 7)!
    expect(added.x !== 0 || added.y !== 0).toBe(true)
  })
})
