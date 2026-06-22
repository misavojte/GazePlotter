import { describe, expect, it } from 'vitest'
import type { GridConfig } from '$lib/workspace/grid'
import {
  mergePreviewPosition,
  startMoveSession,
  startResizeSession,
  updateMoveSession,
  updateResizeSession,
} from '$lib/workspace/grid/interaction/model'

const gridConfig: GridConfig = {
  cellSize: { width: 40, height: 40 },
  gap: 10,
  minWidth: 3,
  minHeight: 3,
}

describe('gridInteractionModel', () => {
  it('applies pointer and scroll deltas when moving an item preview', () => {
    const session = startMoveSession(
      [{ id: 7, x: 2, y: 3, w: 4, h: 5 }],
      { x: 100, y: 120 },
      { x: 20, y: 40 }
    )

    const updated = updateMoveSession(
      session,
      { x: 175, y: 60 },
      { x: 70, y: 90 },
      gridConfig
    )

    expect(updated.members[0].preview).toEqual({
      id: 7,
      x: 5,
      y: 3,
      w: 4,
      h: 5,
    })
  })

  it('moves every member of a group by the same clamped delta', () => {
    const session = startMoveSession(
      [
        { id: 1, x: 2, y: 1, w: 3, h: 3 },
        { id: 2, x: 6, y: 4, w: 3, h: 3 },
      ],
      { x: 100, y: 100 },
      { x: 0, y: 0 }
    )

    // Drag far up-left: raw delta would push id 1 negative, so the shared
    // delta clamps to keep the group's relative layout intact.
    const updated = updateMoveSession(
      session,
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      gridConfig
    )

    expect(updated.members.map(m => m.preview)).toEqual([
      { id: 1, x: 0, y: 0, w: 3, h: 3 },
      { id: 2, x: 4, y: 3, w: 3, h: 3 },
    ])
  })

  it('clamps resize previews to the configured minimum size', () => {
    const session = startResizeSession(
      { id: 9, x: 1, y: 1, w: 6, h: 4 },
      { w: 4, h: 3 },
      { x: 200, y: 200 },
      { x: 0, y: 0 }
    )

    const updated = updateResizeSession(
      session,
      { x: 50, y: 30 },
      { x: 0, y: 0 },
      gridConfig
    )

    expect(updated.preview).toEqual({
      id: 9,
      x: 1,
      y: 1,
      w: 4,
      h: 3,
    })
  })

  it('replaces matching items with their preview rects when merging preview positions', () => {
    const merged = mergePreviewPosition(
      [
        { id: 1, x: 0, y: 0, w: 3, h: 3 },
        { id: 2, x: 4, y: 0, w: 3, h: 3 },
      ],
      [{ id: 2, x: 6, y: 2, w: 5, h: 4 }]
    )

    expect(merged).toEqual([
      { id: 1, x: 0, y: 0, w: 3, h: 3 },
      { id: 2, x: 6, y: 2, w: 5, h: 4 },
    ])
  })

  it('merges multiple preview rects at once (group move)', () => {
    const merged = mergePreviewPosition(
      [
        { id: 1, x: 0, y: 0, w: 3, h: 3 },
        { id: 2, x: 4, y: 0, w: 3, h: 3 },
      ],
      [
        { id: 1, x: 1, y: 1, w: 3, h: 3 },
        { id: 2, x: 5, y: 1, w: 3, h: 3 },
      ]
    )

    expect(merged).toEqual([
      { id: 1, x: 1, y: 1, w: 3, h: 3 },
      { id: 2, x: 5, y: 1, w: 3, h: 3 },
    ])
  })

  it('adds preview rects that do not already exist in the position list', () => {
    const merged = mergePreviewPosition(
      [{ id: 1, x: 0, y: 0, w: 3, h: 3 }],
      [{ id: 2, x: 8, y: 1, w: 2, h: 2 }]
    )

    expect(merged).toEqual([
      { id: 1, x: 0, y: 0, w: 3, h: 3 },
      { id: 2, x: 8, y: 1, w: 2, h: 2 },
    ])
  })
})
