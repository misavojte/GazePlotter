import { describe, expect, it } from 'vitest'
import {
  findOptimalPosition,
  rectanglesOverlap,
  resolveItemPositionCollisions,
} from '$lib/workspace/grid/engine'
import type { GridItemPosition } from '$lib/workspace/grid/types'

type Rect = GridItemPosition

function applyPlan(
  positions: Rect[],
  plan: Array<{ itemId: number; settings: { x?: number; y?: number } }>
): Rect[] {
  const byId = new Map(positions.map(p => [p.id, { ...p }]))
  for (const { itemId, settings } of plan) {
    const p = byId.get(itemId)
    if (!p) continue
    if (settings.x !== undefined) p.x = settings.x
    if (settings.y !== undefined) p.y = settings.y
  }
  return [...byId.values()]
}

function anyOverlap(positions: Rect[]): boolean {
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i]
      const b = positions[j]
      if (rectanglesOverlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h))
        return true
    }
  }
  return false
}

describe('gridEngine', () => {
  it('finds the first available position within explicit available columns', () => {
    const position = findOptimalPosition(
      2,
      2,
      [{ id: 1, x: 0, y: 0, w: 2, h: 2 }],
      6
    )

    expect(position).toEqual({ x: 2, y: 0 })
  })

  it('prefers placement relative to the reference item when space is available', () => {
    const referenceItem = { id: 1, x: 0, y: 0, w: 2, h: 2 }

    const position = findOptimalPosition(
      2,
      2,
      [referenceItem],
      6,
      referenceItem
    )

    expect(position).toEqual({ x: 2, y: 0 })
  })

  it('resolves a single-collider case by shifting the collider out of the way', () => {
    const positions: Rect[] = [
      { id: 1, x: 0, y: 0, w: 2, h: 2 },
      { id: 2, x: 1, y: 0, w: 2, h: 2 },
    ]
    const commands = resolveItemPositionCollisions(
      1,
      positions,
      positions as any,
      6
    )

    expect(commands).toEqual([{ itemId: 2, settings: { x: 2, y: 0 } }])
    expect(anyOverlap(applyPlan(positions, commands))).toBe(false)
  })

  it('resolves multiple simultaneous direct colliders without leaving overlaps', () => {
    // Priority A grows to cover B, C and D. Each needs its own destination
    // that doesn't conflict with the others — the original resolver
    // computed each candidate against the unchanged grid and could hand
    // two colliders the same new cell.
    const positions: Rect[] = [
      { id: 1, x: 0, y: 0, w: 3, h: 3 }, // priority
      { id: 2, x: 2, y: 0, w: 1, h: 1 }, // B: overlapped by A
      { id: 3, x: 0, y: 2, w: 1, h: 1 }, // C: overlapped by A
      { id: 4, x: 2, y: 2, w: 1, h: 1 }, // D: overlapped by A
    ]
    const commands = resolveItemPositionCollisions(
      1,
      positions,
      positions as any,
      6
    )
    const final = applyPlan(positions, commands)

    expect(commands.length).toBeGreaterThanOrEqual(3)
    expect(anyOverlap(final)).toBe(false)
  })

  it('resolves a resize collision that displaces three siblings', () => {
    // Priority resizes from 2x2 at origin to 5x5, swallowing three
    // neighbours arrayed around it.
    const positions: Rect[] = [
      { id: 1, x: 0, y: 0, w: 5, h: 5 }, // priority (new size)
      { id: 2, x: 3, y: 0, w: 2, h: 2 },
      { id: 3, x: 0, y: 3, w: 2, h: 2 },
      { id: 4, x: 3, y: 3, w: 2, h: 2 },
    ]
    const commands = resolveItemPositionCollisions(
      1,
      positions,
      positions as any,
      8
    )
    const final = applyPlan(positions, commands)

    expect(anyOverlap(final)).toBe(false)
    expect(commands.every(c => c.itemId !== 1)).toBe(true)
  })

  it('chains horizontal pushes instead of dropping a middle item to a new row', () => {
    // A, B, C aligned in one row. A moves one cell right so it overlaps B.
    // The sensible resolution is to shove B and C right by one cell each
    // (total shift = 2), not to drop B down into an empty row below
    // (shift = B.h, typically much larger). Keeps the row intact.
    const positions: Rect[] = [
      { id: 1, x: 1, y: 0, w: 2, h: 2 }, // A (priority, already moved from 0,0 → 1,0)
      { id: 2, x: 2, y: 0, w: 2, h: 2 }, // B
      { id: 3, x: 4, y: 0, w: 2, h: 2 }, // C
    ]
    const commands = resolveItemPositionCollisions(
      1,
      positions,
      positions as any,
      8
    )
    const final = applyPlan(positions, commands)

    expect(anyOverlap(final)).toBe(false)
    // Both B and C should have shifted right by one cell, still on row 0.
    const B = final.find(p => p.id === 2) as Rect
    const C = final.find(p => p.id === 3) as Rect
    expect(B).toEqual({ id: 2, x: 3, y: 0, w: 2, h: 2 })
    expect(C).toEqual({ id: 3, x: 5, y: 0, w: 2, h: 2 })
  })

  it('terminates for pathological configurations (iteration cap)', () => {
    // Fully packed 4x4 of 1x1 tiles with the priority over the top-left.
    const positions: Rect[] = []
    let id = 1
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        positions.push({ id: id++, x, y, w: 1, h: 1 })
      }
    }
    // Priority (id=1 at (0,0)) grows to 3x3 — overlaps 9 cells. The
    // planner must terminate rather than loop forever.
    positions[0] = { id: 1, x: 0, y: 0, w: 3, h: 3 }

    const start = Date.now()
    const commands = resolveItemPositionCollisions(
      1,
      positions,
      positions as any,
      4
    )
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(1000)
    // Applying the plan must not leave the priority overlapped. (Items
    // far from the priority may remain overlapped with each other in
    // this deliberately impossible layout — we just require the cascade
    // to exit cleanly.)
    const final = applyPlan(positions, commands)
    const priority = final.find(p => p.id === 1) as Rect
    const collidingWithPriority = final.filter(
      p =>
        p.id !== 1 &&
        rectanglesOverlap(
          priority.x,
          priority.y,
          priority.w,
          priority.h,
          p.x,
          p.y,
          p.w,
          p.h
        )
    )
    expect(collidingWithPriority).toEqual([])
  })

  it('treats every member of a group move as fixed and relocates only outsiders', () => {
    // Two members (1, 2) moved together so they now sit on top of two
    // unrelated items (3, 4). Members must stay put; only 3 and 4 relocate,
    // and members must not be reported as moved.
    const positions: Rect[] = [
      { id: 1, x: 0, y: 0, w: 2, h: 2 }, // group member
      { id: 2, x: 2, y: 0, w: 2, h: 2 }, // group member
      { id: 3, x: 1, y: 1, w: 1, h: 1 }, // outsider overlapped by member 1
      { id: 4, x: 3, y: 1, w: 1, h: 1 }, // outsider overlapped by member 2
    ]
    const commands = resolveItemPositionCollisions(
      [1, 2],
      positions,
      positions as any,
      8
    )
    const final = applyPlan(positions, commands)

    // Neither group member is moved by collision resolution.
    expect(commands.every(c => c.itemId !== 1 && c.itemId !== 2)).toBe(true)
    // Both outsiders are relocated and nothing overlaps afterward.
    expect(commands.map(c => c.itemId).sort()).toEqual([3, 4])
    expect(anyOverlap(final)).toBe(false)
  })

  it('returns no moves for a group move into empty space', () => {
    const positions: Rect[] = [
      { id: 1, x: 0, y: 0, w: 2, h: 2 },
      { id: 2, x: 3, y: 0, w: 2, h: 2 },
      { id: 3, x: 0, y: 5, w: 1, h: 1 }, // far away, untouched
    ]
    expect(
      resolveItemPositionCollisions([1, 2], positions, positions as any, 8)
    ).toEqual([])
  })
})
