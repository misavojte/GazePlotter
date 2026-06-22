/**
 * Bar plot rendering of a proportion metric (`fixated` → noticed rate). The
 * transformer must flag the result as a proportion and scale the bar value to
 * percent (plain descriptive bars, no confidence band) — while leaving
 * non-proportion metrics (durations) on their native value with no proportion flag.
 */
import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { getBarPlotData } from '../src/lib/plots/bar/core/transformer'
import { getBarView } from '../src/lib/plots/bar/core/view'
import '../src/lib/metrics/init'

const ID = { kind: 'identity-aoi-vector' as const }
const FIXATED = { id: 'fixated', baseId: 'fixated', params: {}, label: 'Was fixated', projection: ID }
const ABSOLUTE = { id: 'absoluteTime', baseId: 'absoluteTime', params: {}, label: 'Dwell', projection: ID }

// AOI A = raw id 0, AOI B = raw id 1. Segment row = [start, end, category, ...aoiIds].
function engineWith(perParticipant: number[][][]) {
  const reader = createReaderFromJson([perParticipant])
  return {
    metadata: {
      isOrdinalOnly: false,
      capabilities: { segmented: true, spatial: false, event: false },
      aois: { data: [[['AOI A', 'AOI A', 'red'], ['AOI B', 'AOI B', 'blue']]], orderVector: [[]], hiddenAois: [[]] },
      categories: { data: [['Fixation', 'Fixation', '#000000']], orderVector: [] },
      participants: { data: perParticipant.map((_, i) => [`P${i}`, `P${i}`]), orderVector: perParticipant.map((_, i) => i) },
      participantsGroups: [],
      stimuli: { data: [['S', 'S']], orderVector: [0] },
      noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
      metricInstances: [FIXATED, ABSOLUTE],
    },
    getReader: () => reader,
    getAoiMapping: (_s: number, r: number) => r,
  }
}

function bar(engine: any, instanceId: string) {
  return getBarPlotData(engine as any, {
    stimulusId: 0, groupId: -1, metricInstanceIds: [instanceId],
    orderBy: 'aoi', orderDirection: 'asc', scaleRange: [0, 0],
  } as any)
}

describe('bar plot — proportion metric (noticed rate)', () => {
  it('flags proportion and scales the bar value to percent', () => {
    // 4 participants: P0,P1 fixate AOI A; P2,P3 fixate AOI B. Each AOI: 2/4 = 50%.
    const result = bar(engineWith([
      [[0, 100, 0, 0]],
      [[0, 100, 0, 0]],
      [[0, 100, 0, 1]],
      [[0, 100, 0, 1]],
    ]), 'fixated')

    expect(result.proportion).toBe(true)
    const aoiA = result.data[0]
    expect(aoiA.label).toBe('AOI A')
    expect(aoiA.value).toBeCloseTo(50, 1) // percent, not 0.5
    expect(result.data[1].value).toBeCloseTo(50, 1) // AOI B also 2/4
  })

  it('100% noticed scales to a value of 100', () => {
    const result = bar(engineWith([[[0, 100, 0, 0]], [[0, 100, 0, 0]]]), 'fixated')
    expect(result.data[0].value).toBeCloseTo(100, 6)
  })

  it('a never-fixated AOI is a finite 0%, kept in the denominator', () => {
    // Only P0 fixates AOI A; nobody fixates AOI B.
    const result = bar(engineWith([
      [[0, 100, 0, 0]],
      [[0, 100, 0, 0]],
    ]), 'fixated')
    const aoiB = result.data[1]
    expect(aoiB.label).toBe('AOI B')
    expect(aoiB.value).toBe(0)
    expect(Number.isFinite(aoiB.value)).toBe(true)
  })

  it('axis label drops the overlay suffix for a proportion metric (no "mean ± CI")', () => {
    const engine = engineWith([[[0, 100, 0, 0]], [[0, 100, 0, 1]]])
    const settings = {
      stimulusId: 0, groupId: -1, barPlottingType: 'horizontal',
      orderBy: 'aoi', orderDirection: 'asc',
      metricInstanceIds: ['fixated'], scaleRange: [0, 0],
      statisticalOverlay: 'meanCi95', // set, but must be ignored for a proportion
    }
    const view = getBarView(engine as any, settings as any)
    // Full params on the plot (reproducible); the point here is NO statistic suffix.
    expect(view.props.axisLabel).toBe('Was fixated / % · Min fixations 1 · Min dwell 0 ms')
    expect(view.props.axisLabel).not.toMatch(/CI|SD|IQR/)
  })

  it('a duration metric keeps its overlay suffix in the axis label', () => {
    const engine = engineWith([[[0, 100, 0, 0]]])
    const settings = {
      stimulusId: 0, groupId: -1, barPlottingType: 'horizontal',
      orderBy: 'aoi', orderDirection: 'asc',
      metricInstanceIds: ['absoluteTime'], scaleRange: [0, 0],
      statisticalOverlay: 'meanCi95',
    }
    const view = getBarView(engine as any, settings as any)
    expect(view.props.axisLabel).toMatch(/95% CI/)
  })

  it('a duration metric is NOT a proportion: native ms value, no scaling, no flag', () => {
    // P0,P1 dwell 100ms on AOI A; P2,P3 none. Mean across 4 participants = 50 ms.
    const result = bar(engineWith([
      [[0, 100, 0, 0]],
      [[0, 100, 0, 0]],
      [[0, 100, 0, 1]],
      [[0, 100, 0, 1]],
    ]), 'absoluteTime')
    expect(result.proportion).toBeFalsy()
    expect(result.data[0].value).toBeCloseTo(50, 1) // 50 ms, not a percent
  })
})
