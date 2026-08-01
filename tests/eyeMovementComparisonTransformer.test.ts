/**
 * Eye-movement comparison plot: one bar per type, computed through the pinned
 * eye-movement metric recipes, in the BarPlotFigure data shape.
 *
 * Pins: hand-computed per-type literals for every statistic, the NaN-drop rule
 * (a participant with no such segments leaves the distribution instead of
 * dragging it), the plot-side share denominator (bounded range vs recording
 * length), and the per-plot eye-movement-type SELECTION gate (None =
 * fixations only, same semantics as scarf).
 */
import { describe, it, expect } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import { getEyeMovementComparisonData } from '../src/lib/plots/eye-movement-comparison'
import { NONE_SELECTION_ID } from '../src/lib/data/types'

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

function createEngine() {
  return makeTestEngine([[], SEGMENTS], {
    categories: CATEGORIES,
    participants: [['P0', 'P0'], ['P1', 'P1']],
  })
}

function makeSettings(over: Record<string, unknown> = {}) {
  return {
    stimulusId: STIM,
    groupId: -1,
    metric: 'count' as const,
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
    const result = getEyeMovementComparisonData(createEngine() as any, makeSettings())
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

  it('mean duration: NaN participants drop from the distribution', () => {
    const result = getEyeMovementComparisonData(
      createEngine() as any,
      makeSettings({ metric: 'meanDuration' })
    )
    const saccade = result.data.find(d => d.label === 'Saccade')
    const blink = result.data.find(d => d.label === 'Blink')
    expect(saccade?.individualValues).toEqual([35, 50])
    expect(saccade?.value).toBe(42.5)
    // P1 has no blink segments → NaN → dropped, only P0's dot remains.
    expect(blink?.individualValues).toEqual([20])
    expect(blink?.individualParticipantNames).toEqual(['P0'])
  })

  it('total time and share of recording (per-participant denominator)', () => {
    const time = getEyeMovementComparisonData(
      createEngine() as any,
      makeSettings({ metric: 'totalTime' })
    )
    expect(time.data.find(d => d.label === 'Saccade')?.individualValues).toEqual([70, 50])

    const share = getEyeMovementComparisonData(
      createEngine() as any,
      makeSettings({ metric: 'timeShare' })
    )
    // P0: 70 of 400 ms = 17.5 %; P1: 50 of 250 ms = 20 %. The bar value is
    // the display-formatted mean (formatDecimal → one decimal).
    expect(share.data.find(d => d.label === 'Saccade')?.individualValues).toEqual([17.5, 20])
    expect(share.data.find(d => d.label === 'Saccade')?.value).toBe(18.8)
  })

  it('bounded time range: values clip and the share denominator is the range', () => {
    const bounded = makeSettings({ timelineStart: 0, timelineEnd: 320 })
    const count = getEyeMovementComparisonData(createEngine() as any, bounded)
    // P0's second saccade has midpoint 320 → outside [0, 320).
    expect(count.data.find(d => d.label === 'Saccade')?.individualValues).toEqual([1, 1])

    const share = getEyeMovementComparisonData(
      createEngine() as any,
      makeSettings({ metric: 'timeShare', timelineStart: 0, timelineEnd: 320 })
    )
    // P0: 30 + 20 (clipped) of 320 ms; P1: 50 of 320 ms.
    expect(share.data.find(d => d.label === 'Saccade')?.individualValues).toEqual([15.625, 15.625])
  })

  it('eye-movement-type SELECTION narrows the non-fixation bars; None = fixations only', () => {
    const engine = createEngine()
    // The test-engine metadata literal doesn't type the optional field.
    ;(engine.metadata as { categoriesSelections?: unknown }).categoriesSelections = [
      { id: 5, name: 'Saccades only', memberIds: [1] },
    ]
    const narrowed = getEyeMovementComparisonData(
      engine as any,
      makeSettings({ categorySelectionId: 5 })
    )
    expect(narrowed.data.map(d => d.label)).toEqual(['Fixation', 'Saccade'])

    const none = getEyeMovementComparisonData(
      engine as any,
      makeSettings({ categorySelectionId: NONE_SELECTION_ID })
    )
    expect(none.data.map(d => d.label)).toEqual(['Fixation'])
  })

  it('orderBy value sorts bars by their mean', () => {
    const result = getEyeMovementComparisonData(
      createEngine() as any,
      makeSettings({ orderBy: 'value', orderDirection: 'asc' })
    )
    expect(result.data.map(d => d.label)).toEqual(['Blink', 'Saccade', 'Fixation'])
  })

})
