import { describe, expect, test } from 'vitest'
import {
  computeFlatLegendGeometry,
  LEGEND_CONFIG,
  type LegendItem,
} from '$lib/plots/shared'

// In the vitest `node` environment there is no `document`, so estimateTextWidth
// uses its deterministic char-count fallback (length * fontSize * 0.55). All
// column widths below are therefore stable across machines.

const CFG = LEGEND_CONFIG

function items(names: string[], type: LegendItem['type']): LegendItem[] {
  return names.map((name, i) => ({
    identifier: `item:${i}`,
    name,
    color: '#3366cc',
    type,
  }))
}

// 4-char names: text width 4 * 12 * 0.55 = 26.4, column = 20 + 8 + 26.4 = 54.4
const FOUR = items(['AAAA', 'BBBB', 'CCCC', 'DDDD'], 'fixation')

describe('computeFlatLegendGeometry — grid placement', () => {
  test('fills column-first into fixed-width columns', () => {
    const geo = computeFlatLegendGeometry(FOUR, CFG, 0, 0, 600, 2)

    // 2 columns x 2 rows; items 0,1 fill the first column top-down.
    const colX = 54.4 + CFG.itemSpacing
    expect(geo.items.map(i => i.x)).toEqual([0, 0, expect.closeTo(colX), expect.closeTo(colX)])
    expect(geo.items.map(i => i.y)).toEqual([0, CFG.itemHeight + CFG.rowPadding, 0, CFG.itemHeight + CFG.rowPadding])
    expect(geo.items.every(i => Math.abs(i.width - 54.4) < 1e-6)).toBe(true)
    expect(geo.itemsPerRow).toBe(2)
  })

  test('totalHeight sums row heights plus inner padding only', () => {
    const geo = computeFlatLegendGeometry(FOUR, CFG, 0, 0, 600, 2)
    // 2 fixation rows of itemHeight 15 with one 8px gap between them.
    expect(geo.totalHeight).toBe(2 * CFG.itemHeight + CFG.rowPadding)
  })

  test('columns reflow with available width', () => {
    // Full item width 69.4: 600px fits all 4 in one row, 100px forces 1 per row.
    const oneRow = computeFlatLegendGeometry(FOUR, CFG, 0, 0, 600)
    const oneCol = computeFlatLegendGeometry(FOUR, CFG, 0, 0, 100)
    expect(oneRow.itemsPerRow).toBe(4)
    expect(oneRow.totalHeight).toBe(CFG.itemHeight)
    expect(oneCol.itemsPerRow).toBe(1)
    expect(oneCol.totalHeight).toBe(4 * CFG.itemHeight + 3 * CFG.rowPadding)
  })

  test('column width is capped for readability', () => {
    const long = items(['A'.repeat(60)], 'fixation')
    const geo = computeFlatLegendGeometry(long, CFG, 0, 0, 600)
    expect(geo.items[0].width).toBe(250)
  })
})

describe('computeFlatLegendGeometry — row heights', () => {
  test('nonFixation rows still reserve text height', () => {
    const geo = computeFlatLegendGeometry(items(['Saccade'], 'nonFixation'), CFG, 0, 0, 600)
    // Icon is the thin 4px bar, but the row must fit the 12px label.
    expect(geo.items[0].height).toBe(CFG.nonFixationHeight)
    expect(geo.items[0].rowHeight).toBe(CFG.fontSize)
    expect(geo.totalHeight).toBe(CFG.fontSize)
  })

  test('a row shared by fixation and nonFixation takes the taller height', () => {
    const mixed = [...items(['Map'], 'fixation'), ...items(['Saccade'], 'nonFixation')]
    const geo = computeFlatLegendGeometry(mixed, CFG, 0, 0, 600, 2)
    expect(geo.items.map(i => i.rowHeight)).toEqual([CFG.itemHeight, CFG.itemHeight])
    expect(geo.totalHeight).toBe(CFG.itemHeight)
  })
})

describe('computeFlatLegendGeometry — empty input', () => {
  test('reports zero height and no geometry', () => {
    const geo = computeFlatLegendGeometry([], CFG, 0, 0, 600)
    expect(geo.items).toEqual([])
    expect(geo.groupTitles).toEqual([])
    expect(geo.totalHeight).toBe(0)
  })
})
