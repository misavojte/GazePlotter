/**
 * Eye-movement comparison plot: one bar per type, straight off the library
 * instance's category-vector result (the SAME metric-library flow every
 * metric plot consumes; the contract narrows the library to category-vector
 * recipes, and the bars are the vector on the canonical axis).
 *
 * Pins: hand-computed per-type literals for every family instance, the
 * NaN-drop rule (a participant with no such segments leaves the distribution
 * instead of dragging it), the recipe-side share denominator (bounded range
 * vs recording length via ctx.scopeDurationMs), the noMetric fallback, and
 * the per-plot eye-movement-type SELECTION gate (Fixation is an ordinary member
 * of the axis, so the seeded "Just fixations" row leaves its slot alone — same
 * semantics as scarf).
 */
import { describe, it, expect } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import { getEyeMovementComparisonData } from '../src/lib/plots/eye-movement-comparison'
import { seededCategoriesSelection } from '../src/lib/data/types'

const STIM = 1

const CATEGORIES = [
  ['Fixation', 'Fixation', '#000000'],
  ['Saccade', 'Saccade', '#111111'],
  ['Blink', 'Blink', '#222222'],
]

// P0: fixations ×4, saccades [100,130]+[300,340] (30+40 ms), blink [200,220]
// (20 ms), recording ends 400. P1: fixations ×2, one saccade [100,150] (50 ms),
// no blink, recording ends 250.
const SEGMENTS: number[][][] = [
  [
    [0, 100, 0, 1],
    [100, 130, 1],
    [130, 200, 0, 2],
    [200, 220, 2],
    [220, 300, 0, 1],
    [300, 340, 1],
    [340, 400, 0],
  ],
  [
    [0, 100, 0, 1],
    [100, 150, 1],
    [150, 250, 0, 2],
  ],
]

// Library instances the plot's Metric section would reference — identity
// category-vector projections (the metric IS the per-type vector; none carry
// params — the family has no summary knob, distributions live in the
// pooled individuals + overlay).
const INSTANCES = [
  { id: 'mc', baseId: 'movementCount', params: {}, label: 'Eye-movement count', projection: { kind: 'identity-category-vector' as const } },
  { id: 'md', baseId: 'movementDuration', params: {}, label: '', projection: { kind: 'identity-category-vector' as const } },
  { id: 'mt', baseId: 'movementTime', params: {}, label: '', projection: { kind: 'identity-category-vector' as const } },
  { id: 'share', baseId: 'movementTimeShare', params: {}, label: '', projection: { kind: 'identity-category-vector' as const } },
]

function createEngine() {
  return makeTestEngine([[], SEGMENTS], {
    categories: CATEGORIES,
    participants: [['P0', 'P0'], ['P1', 'P1']],
    metricInstances: INSTANCES,
  })
}

function makeSettings(over: Record<string, unknown> = {}) {
  return {
    stimulusId: STIM,
    groupId: -1,
    metricInstanceIds: ['mc'],
    orderBy: 'type' as const,
    orderDirection: 'asc' as const,
    scaleRange: [0, 0] as [number, number],
    statisticalOverlay: 'meanCi95' as const,
    timelineStart: 0,
    timelineEnd: 0,
    ...over,
  }
}

describe('eye-movement comparison transformer', () => {
  it('count: one bar per type in type order, per-participant dots, mean bar value', () => {
    const result = getEyeMovementComparisonData(createEngine(), makeSettings())
    expect(result.data.map(d => d.label)).toEqual(['Fixation', 'Saccade', 'Blink'])
    expect(result.data[0].individualValues).toEqual([4, 2])
    expect(result.data[1].individualValues).toEqual([2, 1])
    // P1 recorded no blinks: a genuine 0 stays a dot (unlike NaN, which drops).
    expect(result.data[2].individualValues).toEqual([1, 0])
    expect(result.data.map(d => d.value)).toEqual([3, 1.5, 0.5])
    expect(result.data[1].individualParticipantNames).toEqual(['P0', 'P1'])
    expect(result.data[1].color).toBe('#111111')
    expect(result.dataMax).toBe(4)
  })

  it('duration pools every segment into the beeswarm (individuals recipe)', () => {
    const result = getEyeMovementComparisonData(
      createEngine(),
      makeSettings({ metricInstanceIds: ['md'] })
    )
    const saccade = result.data.find(d => d.label === 'Saccade')
    const blink = result.data.find(d => d.label === 'Blink')
    // P0's saccades (30, 40 ms) + P1's (50 ms): every EVENT is a dot, exactly
    // as fixationDuration pools raw fixations on the AOI Comparison.
    expect(saccade?.individualValues).toEqual([30, 40, 50])
    expect(saccade?.individualParticipantNames).toEqual(['P0', 'P0', 'P1'])
    expect(saccade?.value).toBe(40)
    // P1 has no blink segments → no dots from them; P0's single blink remains.
    expect(blink?.individualValues).toEqual([20])
    expect(blink?.individualParticipantNames).toEqual(['P0'])
  })

  it('total time and share of recording (per-participant denominator, distribution kept)', () => {
    const time = getEyeMovementComparisonData(
      createEngine(),
      makeSettings({ metricInstanceIds: ['mt'] })
    )
    expect(time.data.find(d => d.label === 'Saccade')?.individualValues).toEqual([70, 50])
    expect(time.proportion).toBe(false)

    const share = getEyeMovementComparisonData(
      createEngine(),
      makeSettings({ metricInstanceIds: ['share'] })
    )
    // P0: 70 of 400 ms = 17.5 %; P1: 50 of 250 ms = 20 %. The bar value is
    // the display-formatted mean (formatDecimal → one decimal).
    expect(share.data.find(d => d.label === 'Saccade')?.individualValues).toEqual([17.5, 20])
    expect(share.data.find(d => d.label === 'Saccade')?.value).toBe(18.8)
    // movementTimeShare is INTENSIVE, not proportion: a continuous
    // per-participant percentage (like relativeTime), so it keeps its
    // beeswarm and overlay, and the axis scans the DOTS across all types
    // (P1's 80 % fixation share) rather than the largest bar mean (78.75 %).
    // `proportion` is reserved for the 0/1 `fixated` case.
    expect(share.proportion).toBe(false)
    expect(share.dataMax).toBe(80)
  })

  it('bounded time range: values clip and the share denominator is the range', () => {
    const bounded = makeSettings({ timelineStart: 0, timelineEnd: 320 })
    const count = getEyeMovementComparisonData(createEngine(), bounded)
    // P0's second saccade has midpoint 320 → outside [0, 320).
    expect(count.data.find(d => d.label === 'Saccade')?.individualValues).toEqual([1, 1])

    const share = getEyeMovementComparisonData(
      createEngine(),
      makeSettings({ metricInstanceIds: ['share'], timelineStart: 0, timelineEnd: 320 })
    )
    // P0: 30 + 20 (clipped) of 320 ms; P1: 50 of 320 ms.
    expect(share.data.find(d => d.label === 'Saccade')?.individualValues).toEqual([15.625, 15.625])
  })

  it('a missing or contract-rejected instance yields the noMetric fallback', () => {
    const missing = getEyeMovementComparisonData(
      createEngine(),
      makeSettings({ metricInstanceIds: ['nope'] })
    )
    expect(missing.noMetric).toBe(true)
    expect(missing.data).toEqual([])
  })

  it('eye-movement-type SELECTION narrows every type, Fixation included; the seeded row leaves the Fixation slot alone', () => {
    const engine = makeTestEngine([[], SEGMENTS], {
      categories: CATEGORIES,
      participants: [['P0', 'P0'], ['P1', 'P1']],
      metricInstances: INSTANCES,
      categoriesSelections: [
        { id: 5, name: 'Saccades only', memberIds: [1] },
        { id: 6, name: 'Fix + saccades', memberIds: [0, 1] },
        seededCategoriesSelection(7),
        { id: 8, name: 'Nothing', memberIds: [] },
      ],
    })
    // Fixation is a full SELECTION-domain member: a selection without id 0
    // hides the Fixation bar.
    const noFixation = getEyeMovementComparisonData(
      engine,
      makeSettings({ categorySelectionId: 5 })
    )
    expect(noFixation.data.map(d => d.label)).toEqual(['Saccade'])

    const withFixation = getEyeMovementComparisonData(
      engine,
      makeSettings({ categorySelectionId: 6 })
    )
    expect(withFixation.data.map(d => d.label)).toEqual(['Fixation', 'Saccade'])

    // The seeded row holds id 0 alone: exactly one slot, and it is Fixation.
    const justFixations = getEyeMovementComparisonData(
      engine,
      makeSettings({ categorySelectionId: 7 })
    )
    expect(justFixations.data.map(d => d.label)).toEqual(['Fixation'])
    expect(justFixations.data[0].individualValues).toEqual([4, 2])

    // An emptied row is the only way to an empty plot now.
    const nothing = getEyeMovementComparisonData(
      engine,
      makeSettings({ categorySelectionId: 8 })
    )
    expect(nothing.data).toEqual([])
  })

  it('orderBy value sorts bars by their mean', () => {
    const result = getEyeMovementComparisonData(
      createEngine(),
      makeSettings({ orderBy: 'value', orderDirection: 'asc' })
    )
    expect(result.data.map(d => d.label)).toEqual(['Blink', 'Saccade', 'Fixation'])
  })

})
