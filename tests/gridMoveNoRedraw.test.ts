/**
 * A layout change (move, push, OR resize) must NOT bump `redrawTimestamp`.
 * `redrawTimestamp` means "engine data changed, re-derive" (what `triggerRedraw`
 * uses it for; the scarf's size-independent rect-bucket transform keys off it).
 * A move repositions the existing canvas via CSS transform; a resize repaints
 * reactively on its measured width/height (usePlot) — neither changes the data,
 * so neither should force a re-transform. Guards `registry.ts` `updateLayout`.
 */
import { describe, expect, it } from 'vitest'
import { createWorkspaceCommandRegistry } from '$lib/workspace/commands/registry'
import {
  createChainedCommand,
  createMockEngine,
  createMockGridStore,
  createScarfGridItem,
} from './helpers/workspaceCommandFixtures'

function runLayout(layout: Record<string, number>) {
  // Scarf item defaults: w=6, h=8, redrawTimestamp=1.
  const gridStore = createMockGridStore([createScarfGridItem({ id: 1 })])
  const command = createChainedCommand(
    { type: 'updateLayout', updates: [{ itemId: 1, layout }] },
    { isRootCommand: false },
  )
  createWorkspaceCommandRegistry(gridStore, createMockEngine()).execute(command, {
    isUndoRedoOperation: false,
    dispatch: () => {},
  })
  // The 2nd arg passed to gridStore.updateLayout.
  return (gridStore.updateLayout as unknown as { mock: { calls: any[][] } }).mock.calls[0][1]
}

describe('updateLayout redraw policy', () => {
  it('a pure move (x/y) does NOT bump redrawTimestamp', () => {
    const applied = runLayout({ x: 5, y: 3 })
    expect(applied).toEqual({ x: 5, y: 3 })
    expect('redrawTimestamp' in applied).toBe(false)
  })

  it('a same-size update does NOT bump redrawTimestamp', () => {
    const applied = runLayout({ w: 6, h: 8 }) // equal to current
    expect('redrawTimestamp' in applied).toBe(false)
  })

  it('a resize (w or h changes) does NOT bump redrawTimestamp (repaints via width, not re-transform)', () => {
    const applied = runLayout({ w: 10 })
    expect(applied.w).toBe(10)
    expect('redrawTimestamp' in applied).toBe(false)
  })
})
