import { describe, expect, test } from 'vitest'
import {
  computeGroupedLegendGeometry,
  LEGEND_CONFIG,
  type LegendGroup,
  type LegendItem,
} from '$lib/plots/shared'

// In the vitest `node` environment there is no `document`, so estimateTextWidth
// uses its deterministic char-count fallback (length * fontSize * 0.55). All the
// column maths below are therefore stable across machines.

const CFG = LEGEND_CONFIG
const TITLE_BAND = CFG.titleHeight + CFG.groupTitleSpacing

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
  group('AOIs', ['Map', 'Search', 'Results', 'Navbar', 'Header', 'Footer'], 'fixation'),
  group('Categories', ['Saccade', 'Other'], 'nonFixation'),
  group('Events', ['Blink', 'Click'], 'fixation'),
]

const WIDE = 900

const titleOf = (geo: ReturnType<typeof computeGroupedLegendGeometry>, title: string) =>
  geo.groupTitles.find(t => t.title === title)!
const itemsOf = (geo: ReturnType<typeof computeGroupedLegendGeometry>, title: string) =>
  geo.items.filter(i => i.groupTitle === title)

const GROUP_GAP = 2 * CFG.itemSpacing
const columnWidth = (names: string[]) =>
  Math.ceil(CFG.iconWidth + CFG.textPadding + Math.max(...names.map(n => n.length * CFG.fontSize * 0.55)))
const right = (geo: ReturnType<typeof computeGroupedLegendGeometry>, title: string) =>
  Math.max(...itemsOf(geo, title).map(i => i.x + i.width))

const xsOf = (geo: ReturnType<typeof computeGroupedLegendGeometry>, title: string) => [
  ...new Set(itemsOf(geo, title).map(i => i.x)),
]
const columnCounts = (geo: ReturnType<typeof computeGroupedLegendGeometry>, title: string) =>
  xsOf(geo, title).map(x => itemsOf(geo, title).filter(i => i.x === x).length)

describe('computeGroupedLegendGeometry — blocks', () => {
  test('each column is as wide as its own widest label', () => {
    const narrow = [group('AOIs', ['Map', 'Navigation bar', 'Footer', 'Results list'], 'fixation')]
    const geo = computeGroupedLegendGeometry(narrow, CFG, 0, 0, 260)
    const [first, second] = xsOf(geo, 'AOIs')
    expect(geo.items.filter(i => i.x === first).every(i => i.width === columnWidth(['Map', 'Navigation bar']))).toBe(true)
    expect(geo.items.filter(i => i.x === second).every(i => i.width === columnWidth(['Footer', 'Results list']))).toBe(true)
  })

  test('columns are balanced, longer first, never a lone item over empty cells', () => {
    const seven = [group('AOIs', ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'], 'fixation')]
    // 3 columns fit at this width, 4 do not: 3 rows, filled 3/2/2 rather than 3/3/1.
    const geo = computeGroupedLegendGeometry(seven, CFG, 0, 0, 230)
    expect(columnCounts(geo, 'AOIs')).toEqual([3, 2, 2])
  })

  test('groups sit side by side in reading order, a group gap apart, titles on one baseline', () => {
    const geo = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, WIDE)
    expect(new Set(geo.groupTitles.map(t => t.y)).size).toBe(1)
    expect(titleOf(geo, 'Categories').x).toBe(right(geo, 'AOIs') + GROUP_GAP)
    expect(titleOf(geo, 'Events').x).toBe(right(geo, 'Categories') + GROUP_GAP)
    // A thin category swatch and an event swatch share the row's baseline.
    expect(itemsOf(geo, 'Events')[0].y).toBe(itemsOf(geo, 'Categories')[0].y)
  })

  test('each title sits above its group, on its first column', () => {
    const geo = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, WIDE)
    for (const t of geo.groupTitles) {
      const items = itemsOf(geo, t.title)
      expect(t.x).toBe(Math.min(...items.map(i => i.x)))
      expect(Math.min(...items.map(i => i.y))).toBe(t.y + TITLE_BAND)
    }
  })

  test('every group fills the band rows column-major', () => {
    // The 8 AOIs need 2 rows; the 3 categories fill those 2 rows too (2/1), not one row of 3.
    const groups = [
      group('AOIs', ['Area one', 'Area two', 'Area three', 'Area four', 'Area five', 'Area six', 'Area seven', 'Area eight'], 'fixation'),
      group('Categories', ['Saccade', 'Blink', 'Other'], 'nonFixation'),
    ]
    const geo = computeGroupedLegendGeometry(groups, CFG, 0, 0, 750)
    expect(new Set(itemsOf(geo, 'AOIs').map(i => i.y)).size).toBe(2)
    expect(columnCounts(geo, 'Categories')).toEqual([2, 1])
  })

  test('a band under another is wholly on its column lines, or not at all', () => {
    for (const width of [200, 250, 300, 350]) {
      const geo = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, width)
      const firstBand = Math.min(...geo.groupTitles.map(t => t.y))
      const above = new Set(geo.items.filter(i => titleOf(geo, i.groupTitle!).y === firstBand).map(i => i.x))
      const below = geo.items.filter(i => titleOf(geo, i.groupTitle!).y > firstBand)
      // The band's first column always shares the left edge; past it, all on the lines or none.
      const inner = below.filter(i => i.x !== 0)
      const onLines = inner.filter(i => above.has(i.x)).length
      expect(onLines === 0 || onLines === inner.length).toBe(true)
    }
  })

  test('a lower band never nearly meets a swatch or label line above', () => {
    const groups = [
      group('AOIs', ['Cartography', 'GIS', 'Eye-tracking', 'Surveying', 'UAS', 'Remote sensing', 'No AOI'], 'fixation'),
      group('Categories', ['Saccade', 'EyesNotFound', 'Unclassified'], 'nonFixation'),
      group('Events', ['Cartography visible', 'GIS visible', 'Eye-tracking visible', 'Surveying visible'], 'event'),
    ]
    for (let width = 300; width <= 900; width += 25) {
      const geo = computeGroupedLegendGeometry(groups, CFG, 0, 0, width)
      const bands = [...new Set(geo.groupTitles.map(t => t.y))].sort((p, q) => p - q)
      for (const [b, bandY] of bands.entries()) {
        if (b === 0) continue
        const inBand = (y: number) => (i: (typeof geo.items)[number]) => titleOf(geo, i.groupTitle!).y === y
        const above = geo.items.filter(i => bands.slice(0, b).some(y => inBand(y)(i))).map(i => i.x)
        const lines = above.flatMap(x => [x, x + CFG.iconWidth + CFG.textPadding])
        for (const i of geo.items.filter(inBand(bandY))) {
          const d = Math.min(...lines.map(l => Math.abs(l - i.x)))
          expect(d === 0 || d >= 12).toBe(true)
        }
      }
    }
  })

  test('a packed band nearly reaching the right edge ends flush with it', () => {
    const plain = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, WIDE)
    const end = right(plain, 'Events')
    const geo = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, end + 20)
    expect(right(geo, 'Events')).toBe(end + 20)
    // The slack goes to the group gaps, evenly.
    const gapOne = titleOf(geo, 'Categories').x - right(geo, 'AOIs')
    const gapTwo = titleOf(geo, 'Events').x - right(geo, 'Categories')
    expect(Math.abs(gapOne - gapTwo)).toBeLessThanOrEqual(1)
  })

  test('a band a little too wide tightens its group gaps rather than add a row', () => {
    const plain = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, WIDE)
    const end = right(plain, 'Events')
    const geo = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, end - 10)
    expect(new Set(geo.groupTitles.map(t => t.y)).size).toBe(1)
    expect(geo.totalHeight).toBe(plain.totalHeight)
    const gaps = [titleOf(geo, 'Categories').x - right(geo, 'AOIs'), titleOf(geo, 'Events').x - right(geo, 'Categories')]
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(Math.round(1.6 * CFG.itemSpacing))
  })

  test('the legend reflows lower as it widens', () => {
    const narrow = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, 320)
    const wide = computeGroupedLegendGeometry(REALISTIC, CFG, 0, 0, WIDE)
    expect(wide.totalHeight).toBeLessThan(narrow.totalHeight)
  })

  test('swatches land on whole pixels from a fractional origin', () => {
    const geo = computeGroupedLegendGeometry(REALISTIC, CFG, 10.4, 20.6, WIDE)
    expect(geo.items.every(i => Number.isInteger(i.x) && Number.isInteger(i.y))).toBe(true)
  })

  test('event and non-fixation swatches are the thin bar; fixations the full block', () => {
    const groups = [group('AOIs', ['Map'], 'fixation'), group('Categories', ['Saccade'], 'nonFixation'), group('Events', ['Blink'], 'event')]
    const geo = computeGroupedLegendGeometry(groups, CFG, 0, 0, WIDE)
    expect(itemsOf(geo, 'AOIs')[0].height).toBe(CFG.itemHeight)
    expect(itemsOf(geo, 'Categories')[0].height).toBe(CFG.nonFixationHeight)
    expect(itemsOf(geo, 'Events')[0].height).toBe(CFG.nonFixationHeight)
  })
})

describe('computeGroupedLegendGeometry — empty input', () => {
  test('all-empty groups report zero height, not a negative one', () => {
    const empty: LegendGroup[] = [group('AOIs', [], 'fixation')]
    for (const groups of [[], empty]) {
      const geo = computeGroupedLegendGeometry(groups, CFG, 0, 0, WIDE)
      expect(geo.items).toEqual([])
      expect(geo.groupTitles).toEqual([])
      expect(geo.totalHeight).toBe(0)
    }
  })
})
