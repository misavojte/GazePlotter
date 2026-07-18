import { describe, expect, it } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import {
  getAois,
  resolveAoiSelectionVisibleIds,
  getVisibleEventChannels,
  resolveCategorySelectionMemberIds,
} from '../src/lib/data/engine'
import { buildAoiSlots } from '../src/lib/metrics/core/aoiSlots'
import { transformDataToScarfPlot } from '../src/lib/plots/scarf/core/transformer'
import {
  buildRenameMap,
  resolveName,
  effectiveSet,
  commitNameSelections,
  canonicalNameSelections,
} from '../src/lib/modals/modification/shared/nameKeyedSelection'
import type { ScarfPlotSettings } from '../src/lib/plots/scarf/types'
import type { EntitySelection, NameSelection } from '../src/lib/data/types'

// ============================================================================
// Shared Test Fixtures & Engine Builders
// ============================================================================
const STIM = 1
const NO_AOI = { displayedName: 'Outside', color: 'gray' }

const SCARF_SETTINGS: ScarfPlotSettings = {
  stimulusId: STIM,
  groupId: -1,
  timeline: 'absolute',
  absoluteStimuliLimits: [],
  ordinalStimuliLimits: [],
}

/** Stimulus 1, participant 0: fixation on AOI 1, then saccade, then blink. */
const SEGMENTS = [[], [[[0, 100, 0, 1], [100, 150, 1], [150, 200, 2]]]]

const THREE_CATEGORIES = [
  ['Fixation', 'Fixation', '#000000'],
  ['Saccade', 'Saccade', '#111111'],
  ['Blink', 'Blink', '#222222'],
]

// ============================================================================
// 1. AOI Selection Tests (aoiSelection)
// ============================================================================
describe('AOI selection (reduced alphabet)', () => {
  const withSelection = (selections: NameSelection[]) => {
    const engine = makeTestEngine([[], [[[0, 100, 0, 1]], [[0, 100, 0, 2]]]], {
      aoiMapping: 'group',
    })
    ;(engine.metadata.aois as { selections?: NameSelection[] }).selections = selections
    return engine
  }

  it('unset / 0 / unknown returns the base list BY REFERENCE (byte-identical)', () => {
    const engine = withSelection([{ id: 1, name: 'Faces', names: ['AOI 1'] }])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = engine as any
    const base = getAois(e, STIM)
    expect(base.map(a => a.displayedName)).toEqual(['AOI 1', 'AOI 2'])
    expect(getAois(e, STIM, 0)).toBe(base)
    expect(getAois(e, STIM, undefined)).toBe(base)
    expect(getAois(e, STIM, 999)).toBe(base)
  })

  it('a selection narrows getAois to its members (by displayed name)', () => {
    const engine = withSelection([{ id: 1, name: 'Faces', names: ['AOI 1'] }])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const narrowed = getAois(engine as any, STIM, 1)
    expect(narrowed.map(a => a.displayedName)).toEqual(['AOI 1'])
  })

  it('resolveAoiSelectionVisibleIds returns the kept logical ids (null for All)', () => {
    const engine = withSelection([{ id: 1, name: 'Faces', names: ['AOI 1'] }])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = engine as any
    expect(resolveAoiSelectionVisibleIds(e, STIM, 0)).toBeNull()
    const keep = resolveAoiSelectionVisibleIds(e, STIM, 1)!
    expect(keep.has(1)).toBe(true)
    expect(keep.has(2)).toBe(false)
  })

  it('buildAoiSlots drops out-of-selection raw AOIs to slot -1 (→ no-AOI in the scan)', () => {
    const engine = withSelection([{ id: 1, name: 'Faces', names: ['AOI 1'] }])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = engine as any
    const base = buildAoiSlots(e, STIM)!
    expect(base.rawToSlot[1]).toBeGreaterThanOrEqual(0)
    expect(base.rawToSlot[2]).toBeGreaterThanOrEqual(0)

    const narrowed = buildAoiSlots(e, STIM, 1)!
    expect(narrowed.rawToSlot[1]).toBeGreaterThanOrEqual(0)
    expect(narrowed.rawToSlot[2]).toBe(-1)
    expect(narrowed.noAoiSlot).toBe(1)

    expect(buildAoiSlots(e, STIM, 0)).toBe(base)
  })

  it('two selections resolving to the same visible set share one slot layout', () => {
    const engine = withSelection([
      { id: 1, name: 'A', names: ['AOI 1'] },
      { id: 2, name: 'B', names: ['AOI 1'] },
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = engine as any
    expect(getAois(e, STIM, 2)).toBe(getAois(e, STIM, 1))
    expect(buildAoiSlots(e, STIM, 2)).toBe(buildAoiSlots(e, STIM, 1))
  })
})

// ============================================================================
// 2. Eye-Movement Category & Event Selection Tests (categoryEventSelection)
// ============================================================================
const makeScarfEngine = (
  categories: string[][],
  categoriesSelections: EntitySelection[]
) => {
  const engine = makeTestEngine(SEGMENTS, { aoiMapping: 'group', categories })
  ;(engine.metadata as { categoriesSelections?: EntitySelection[] }).categoriesSelections =
    categoriesSelections
  return Object.assign(engine, {
    capabilities: { segmented: true, spatial: false, event: false },
    eventsPerStimulus: [] as boolean[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any
}

const makeEventEngine = (
  hiddenChannels: number[],
  eventsSelections: NameSelection[]
) => {
  const engine = makeTestEngine(SEGMENTS)
  Object.assign(engine.metadata, {
    eventData: {
      data: [
        [],
        [
          ['ch1', 'Channel 1', '#111111'],
          ['ch2', 'Channel 2', '#222222'],
          ['ch3', 'Channel 2', '#333333'],
        ],
      ],
      orderVector: [[], []],
      hiddenChannels: [[], hiddenChannels],
      events: [[], []],
    },
    eventsSelections,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return engine as any
}

describe('eye-movement-type selection (scarf narrowing)', () => {
  it('resolveCategorySelectionMemberIds is null for unset/0/unknown, a Set otherwise', () => {
    const engine = makeScarfEngine(THREE_CATEGORIES, [
      { id: 1, name: 'Saccades', memberIds: [1] },
      { id: 2, name: 'Fixations only', memberIds: [] },
    ])
    expect(resolveCategorySelectionMemberIds(engine, undefined)).toBeNull()
    expect(resolveCategorySelectionMemberIds(engine, 0)).toBeNull()
    expect(resolveCategorySelectionMemberIds(engine, 999)).toBeNull()
    expect(resolveCategorySelectionMemberIds(engine, 1)).toEqual(new Set([1]))
    expect(resolveCategorySelectionMemberIds(engine, 2)).toEqual(new Set())
  })

  it('unset / unknown selection draws every non-fixation category (no narrowing)', () => {
    const engine = makeScarfEngine(THREE_CATEGORIES, [
      { id: 1, name: 'Saccades', memberIds: [1] },
    ])
    for (const categorySelectionId of [undefined, 0, 999]) {
      const data = transformDataToScarfPlot(
        engine, STIM, [0], { ...SCARF_SETTINGS, categorySelectionId }, NO_AOI
      )
      expect(data.stylingAndLegend.category.map(c => c.name)).toEqual([
        'Saccade',
        'Blink',
      ])
      expect(data.gazeSource.hiddenCategoryIds.size).toBe(0)
    }
  })

  it('a selection narrows the legend and hides the other categories from the paint loop', () => {
    const engine = makeScarfEngine(THREE_CATEGORIES, [
      { id: 1, name: 'Saccades', memberIds: [1] },
    ])
    const data = transformDataToScarfPlot(
      engine, STIM, [0], { ...SCARF_SETTINGS, categorySelectionId: 1 }, NO_AOI
    )
    expect(data.stylingAndLegend.category.map(c => c.name)).toEqual(['Saccade'])
    expect(data.gazeSource.hiddenCategoryIds.has(2)).toBe(true)
    expect(data.gazeSource.hiddenCategoryIds.has(1)).toBe(false)
  })

  it('an EMPTY selection is "Fixations only": no category styles, all non-fixations hidden', () => {
    const engine = makeScarfEngine(THREE_CATEGORIES, [
      { id: 1, name: 'Fixations only', memberIds: [] },
    ])
    const data = transformDataToScarfPlot(
      engine, STIM, [0], { ...SCARF_SETTINGS, categorySelectionId: 1 }, NO_AOI
    )
    expect(data.stylingAndLegend.category).toEqual([])
    expect(data.gazeSource.hiddenCategoryIds).toEqual(new Set([1, 2]))
  })

  it('holding ANY member id keeps the whole displayed-name group drawable', () => {
    const engine = makeScarfEngine(
      [
        ['Fixation', 'Fixation', '#000000'],
        ['SaccadeA', 'Saccade', '#111111'],
        ['SaccadeB', 'Saccade', '#222222'],
      ],
      [{ id: 1, name: 'Saccades', memberIds: [1] }]
    )
    const data = transformDataToScarfPlot(
      engine, STIM, [0], { ...SCARF_SETTINGS, categorySelectionId: 1 }, NO_AOI
    )
    expect(data.stylingAndLegend.category.map(c => c.name)).toEqual(['Saccade'])
    expect(data.gazeSource.hiddenCategoryIds.size).toBe(0)
  })
})

describe('event selection (visible channel narrowing)', () => {
  it('unset / 0 / unknown returns every visible channel (no narrowing)', () => {
    const engine = makeEventEngine([], [
      { id: 1, name: 'Focus', names: ['Channel 2'] },
    ])
    for (const id of [undefined, 0, 999]) {
      expect(
        getVisibleEventChannels(engine, STIM, id).map(c => c.displayedName)
      ).toEqual(['Channel 1', 'Channel 2', 'Channel 2'])
    }
  })

  it('a selection narrows by displayed name (both members of a merged channel stay)', () => {
    const engine = makeEventEngine([], [
      { id: 1, name: 'Focus', names: ['Channel 2'] },
    ])
    const narrowed = getVisibleEventChannels(engine, STIM, 1)
    expect(narrowed.map(c => c.id)).toEqual([1, 2])
  })

  it('selections compose with (legacy) hidden channels, and stale names match nothing', () => {
    const engine = makeEventEngine([1], [
      { id: 1, name: 'Focus', names: ['Channel 2'] },
      { id: 2, name: 'Gone', names: ['Renamed away'] },
    ])
    expect(getVisibleEventChannels(engine, STIM, 1).map(c => c.id)).toEqual([2])
    expect(getVisibleEventChannels(engine, STIM, 2)).toEqual([])
  })
})

// ============================================================================
// 3. Name-Keyed Selection Helper Tests (nameKeyedSelection)
// ============================================================================
describe('buildRenameMap', () => {
  const rm = (pairs: [string | undefined, string | undefined][]) =>
    Object.fromEntries(buildRenameMap(pairs))

  it('drops identity mappings (an unrenamed row needs no entry)', () => {
    expect(rm([['a', 'a']])).toEqual({})
  })

  it('records a plain rename', () => {
    expect(rm([['a', 'b']])).toEqual({ a: 'b' })
  })

  it('trims whitespace on both sides', () => {
    expect(rm([[' a ', ' b ']])).toEqual({ a: 'b' })
  })

  it('drops an ambiguous open name (one open renamed two ways) either order', () => {
    expect(rm([['a', 'b'], ['a', 'c']])).toEqual({})
    expect(rm([['a', 'c'], ['a', 'b']])).toEqual({})
  })

  it('allows two different opens renamed to the SAME current (a merge)', () => {
    expect(rm([['a', 'c'], ['b', 'c']])).toEqual({ a: 'c', b: 'c' })
  })

  it('drops the rename when the same open also appears unchanged (split a saved merge)', () => {
    expect(rm([['a', 'a'], ['a', 'b']])).toEqual({})
    expect(rm([['a', 'b'], ['a', 'a']])).toEqual({})
  })

  it('drops an emptied current (mid-typing / backspace)', () => {
    expect(rm([['a', '']])).toEqual({})
    expect(rm([['a', undefined]])).toEqual({})
  })

  it('ignores rows with no open name', () => {
    expect(rm([['', 'b'], [undefined, 'c']])).toEqual({})
  })

  it('resolveName falls back to the (trimmed) input for unmapped names', () => {
    const map = buildRenameMap([['a', 'b']])
    expect(resolveName(map, 'a')).toBe('b')
    expect(resolveName(map, ' a ')).toBe('b')
    expect(resolveName(map, 'z')).toBe('z')
  })
})

describe('effectiveSet / commit / canonical', () => {
  const sel = (id: number, name: string, names: string[]): NameSelection => ({
    id,
    name,
    names,
  })

  it('effectiveSet resolves member names through the rename map and drops empties', () => {
    const map = buildRenameMap([['old', 'new']])
    expect([...effectiveSet(map, sel(1, 'S', ['old', 'keep', '']))].sort()).toEqual([
      'keep',
      'new',
    ])
  })

  it('commitNameSelections resolves, dedupes, sorts, and fills a fallback name', () => {
    const map = buildRenameMap([['old', 'new']])
    const out = commitNameSelections(map, [
      sel(2, '  ', ['old', 'b', 'b', '']),
    ])
    expect(out).toEqual([{ id: 2, name: 'Selection 2', names: ['b', 'new'] }])
  })

  it('canonicalNameSelections is order-insensitive across selections and names', () => {
    const a = canonicalNameSelections([sel(1, 'A ', ['y', 'x']), sel(2, 'B', ['z'])])
    const b = canonicalNameSelections([sel(2, 'B', ['z']), sel(1, 'A', ['x', 'y'])])
    expect(a).toBe(b)
  })
})
