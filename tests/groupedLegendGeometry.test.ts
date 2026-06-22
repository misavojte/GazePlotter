import { describe, expect, test } from 'vitest'
import {
  computeGroupedLegendGeometry,
  SCARF_LEGEND_CONFIG,
  type LegendGroup,
  type LegendItem,
} from '$lib/plots/shared'

// In the vitest `node` environment there is no `document`, so estimateTextWidth
// uses its deterministic char-count fallback (length * fontSize * 0.55). All the
// gutter / column maths below are therefore stable across machines.

const CFG = SCARF_LEGEND_CONFIG

function group(
  title: string,
  names: string[],
  type: LegendItem['type']
): LegendGroup {
  return {
    title,
    items: names.map((name, i) => ({
      identifier: `${title}:${i}`,
      name,
      color: '#3366cc',
      type,
    })),
  }
}

// Realistic scarf legend: a sizeable AOI group, the tiny non-fixation pair, and
// a handful of event channels — the shape this layout actually has to serve.
const REALISTIC: LegendGroup[] = [
  group(
    'Fixations',
    [
      'Map',
      'Search bar',
      'Results list',
      'Navigation',
      'Header',
      'Footer',
      'Sidebar',
      '(no AOI)',
    ],
    'fixation'
  ),
  group('Non-fixations', ['Saccade', 'Other'], 'nonFixation'),
  group('Event Channels', ['Visibility', 'Blink', 'Cursor click'], 'fixation'),
]

const WIDE = 600
const NARROW = 150

describe('computeGroupedLegendGeometry — inline title gutter', () => {
  test('items sit in a gutter-offset grid; titles align in one left column', () => {
    const geo = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, WIDE)

    // Every group title shares the legend's left edge — one aligned column.
    expect(geo.groupTitles.every(t => t.x === 0)).toBe(true)

    // Items begin to the right of the title gutter (offset applied).
    const minItemX = Math.min(...geo.items.map(i => i.x))
    expect(minItemX).toBeGreaterThan(0)

    // The first group's first item sits at the band top — no dedicated title
    // line is consumed above it (that's the reclaimed vertical space).
    expect(geo.items[0].y).toBe(0)
  })

  test('each group title is vertically centered on its first item row', () => {
    const geo = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, WIDE)

    for (const t of geo.groupTitles) {
      const groupItems = geo.items.filter(i => i.groupTitle === t.title)
      const firstRowY = Math.min(...groupItems.map(i => i.y))
      const firstRow = groupItems.find(i => i.y === firstRowY)
      expect(firstRow).toBeDefined()
      // Title baseline (drawn 'top') falls within the first row band.
      expect(t.y).toBeGreaterThanOrEqual(firstRowY - 0.001)
      expect(t.y).toBeLessThanOrEqual(firstRowY + firstRow!.rowHeight)
    }
  })

  test('reclaims exactly the stacked title lines (column count held fixed)', () => {
    // Pin the column count with the override so both layouts share an identical
    // row structure; the only remaining height difference is the dedicated title
    // line that the stacked layout adds per group and the inline layout reclaims.
    const cols = 4
    const inline = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, WIDE, cols)
    const stacked = computeGroupedLegendGeometry(
      REALISTIC,
      CFG,
      0,
      0,
      NARROW,
      cols
    )

    const reclaimedPerGroup = CFG.titleHeight + CFG.groupTitleSpacing
    expect(stacked.totalHeight - inline.totalHeight).toBe(3 * reclaimedPerGroup)
    expect(inline.totalHeight).toBeLessThan(stacked.totalHeight)
  })

  test('column count is balanced for the largest group (no orphan rows)', () => {
    // At WIDE the AOI group's 8 items could greedily pack ~6 per row (6+2);
    // balancing instead evens them to 4+4 at the same minimum row count.
    const geo = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, 900)
    expect(geo.itemsPerRow).toBe(4)
  })

  test('columns reflow with available width', () => {
    const narrow = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, 320)
    const wide = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, 900)
    expect(wide.itemsPerRow).toBeGreaterThan(narrow.itemsPerRow)
  })
})

describe('computeGroupedLegendGeometry — narrow-width fallback', () => {
  test('reverts to the stacked title-above layout when the gutter would starve items', () => {
    const geo = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, NARROW)

    // No gutter offset: the first column sits on the left edge.
    expect(Math.min(...geo.items.map(i => i.x))).toBe(0)

    // First title on its own line, first item below it.
    expect(geo.groupTitles[0].y).toBe(0)
    expect(geo.items[0].y).toBe(CFG.titleHeight + CFG.groupTitleSpacing)
  })
})
