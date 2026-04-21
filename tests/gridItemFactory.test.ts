import { describe, expect, it } from 'vitest'
import {
  createGridItem,
  duplicateGridItem,
} from '$lib/workspace/grid/itemFactory'

describe('gridItemFactory', () => {
  it('creates a grid item with merged defaults from the plot registry', () => {
    const item = createGridItem('barPlot', {
      type: 'barPlot',
      id: 42,
      settings: {
        stimulusId: 3,
      },
    })

    expect(item).toMatchObject({
      id: 42,
      type: 'barPlot',
      x: 0,
      y: 0,
      w: 12,
      h: 12,
      min: { w: 11, h: 10 },
    })
    expect(item.settings).toMatchObject({
      stimulusId: 3,
      groupId: -1,
      metricInstanceId: null,
    })
  })

  it('duplicates an item with a new id and cloned settings', () => {
    const original = createGridItem('scarf', {
      type: 'scarf',
      id: 7,
      settings: {
        stimulusId: 2,
        highlights: ['aoi-1'],
      } as any,
    })

    const duplicate = duplicateGridItem(original, 99)

    expect(duplicate.id).toBe(99)
    expect(duplicate.settings).toEqual(original.settings)
    expect(duplicate.settings).not.toBe(original.settings)
  })
})
