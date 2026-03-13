import { describe, expect, it } from 'vitest'
import {
  findOptimalPosition,
  resolveItemPositionCollisions,
} from '$lib/workspace/grid/engine'

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

  it('resolves collisions without reading viewport globals', () => {
    const commands = resolveItemPositionCollisions(
      1,
      [
        { id: 1, x: 0, y: 0, w: 2, h: 2 },
        { id: 2, x: 1, y: 0, w: 2, h: 2 },
      ],
      [
        { id: 1, x: 0, y: 0, w: 2, h: 2 },
        { id: 2, x: 1, y: 0, w: 2, h: 2 },
      ] as any,
      6
    )

    expect(commands).toEqual([
      {
        itemId: 2,
        settings: { x: 2, y: 0 },
      },
    ])
  })
})
