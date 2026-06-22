import { describe, expect, it } from 'vitest'
import { commonSectionKeys } from '$lib/workspace/pane/bulkSections'
import { computeCommonValue } from '$lib/plots/shared/components/sections/common'

describe('computeCommonValue', () => {
  it('reports the shared value when all agree', () => {
    expect(computeCommonValue([3, 3, 3])).toEqual({ value: 3, mixed: false })
  })
  it('flags mixed when values differ', () => {
    expect(computeCommonValue([1, 2, 1]).mixed).toBe(true)
  })
  it('a single value is never mixed', () => {
    expect(computeCommonValue([7])).toEqual({ value: 7, mixed: false })
  })

  it('compares arrays/tuples structurally, not by reference', () => {
    // metricInstanceIds-like arrays
    expect(
      computeCommonValue([
        ['a', 'b'],
        ['a', 'b'],
      ]).mixed
    ).toBe(false)
    expect(computeCommonValue([['a'], ['b']]).mixed).toBe(true)
    // scaleRange-like tuples
    expect(
      computeCommonValue<[number, number]>([
        [0, 5],
        [0, 5],
      ]).mixed
    ).toBe(false)
    expect(
      computeCommonValue<[number, number]>([
        [0, 5],
        [0, 9],
      ]).mixed
    ).toBe(true)
  })
})

describe('commonSectionKeys (cross-type bulk section intersection)', () => {
  const shared = new Set([
    'stimulus',
    'group',
    'participant',
    'timelineRange',
    'aoi',
    'event',
    'eyeMovement',
  ])

  it('intersects shared keys across types, in the representative order', () => {
    // scarf-like rep + a bar-like type
    const scarf = [
      'stimulus',
      'group',
      'scarf:visualisation',
      'timelineRange',
      'aoi',
      'eyeMovement',
      'event',
    ]
    const bar = [
      'stimulus',
      'group',
      'metric',
      'barPlot:visualisation',
      'timelineRange',
      'aoi',
    ]
    expect(commonSectionKeys(scarf, [scarf, bar], shared)).toEqual([
      'stimulus',
      'group',
      'timelineRange',
      'aoi',
    ])
  })

  it('drops plot-specific keys even when both types happen to share the literal key', () => {
    const a = ['stimulus', 'x:custom', 'aoi']
    const b = ['stimulus', 'x:custom', 'aoi']
    expect(commonSectionKeys(a, [a, b], shared)).toEqual(['stimulus', 'aoi'])
  })

  it('keeps participant when every type has it (recurrence + scanpath)', () => {
    const recurrence = [
      'stimulus',
      'participant',
      'recurrencePlot:method',
      'recurrencePlot:visualisation',
      'timelineRange',
      'aoi',
    ]
    const scanpath = ['stimulus', 'participant', 'scanpath:display', 'aoi']
    expect(commonSectionKeys(recurrence, [recurrence, scanpath], shared)).toEqual([
      'stimulus',
      'participant',
      'aoi',
    ])
  })

  it('group vs participant are disjoint → only the universal sections (scanpath + bar)', () => {
    const scanpath = ['stimulus', 'participant', 'scanpath:display', 'aoi']
    const bar = [
      'stimulus',
      'group',
      'metric',
      'barPlot:visualisation',
      'timelineRange',
      'aoi',
    ]
    expect(commonSectionKeys(scanpath, [scanpath, bar], shared)).toEqual([
      'stimulus',
      'aoi',
    ])
  })

  it('metric is excluded cross-type (not a shared key) even if both types have it', () => {
    const bar = ['stimulus', 'group', 'metric', 'timelineRange', 'aoi']
    const tm = ['stimulus', 'group', 'metric', 'timelineRange', 'aoi']
    expect(commonSectionKeys(bar, [bar, tm], shared)).toEqual([
      'stimulus',
      'group',
      'timelineRange',
      'aoi',
    ])
  })
})
