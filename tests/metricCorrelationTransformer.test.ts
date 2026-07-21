/**
 * Metric-correlation transformer: instance resolution must apply the SAME
 * contract gate as the picker (`instanceMatchesContract` over
 * `METRIC_CORRELATION_CONTRACT`), so a saved instance invalidated after the
 * fact — e.g. an `aggregate-aoi` extreme its metric no longer names — drops
 * from the computation exactly as it drops from every selector, instead of
 * silently computing under a generic label.
 */
import { describe, it, expect } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import { getMetricCorrelationData } from '../src/lib/plots/metric-correlation/core/transformer'
import type { MetricInstance } from '../src/lib/metrics'
import type { MetricCorrelationSettings } from '../src/lib/plots/metric-correlation/types'

const STIM = 0

// Three participants, two AOIs (ids 0/1), plain fixation streams so every
// scalar instance below computes a finite value.
const SEGMENTS = [
  [[0, 100, 0, 0], [100, 300, 0, 1]],
  [[0, 150, 0, 0], [150, 250, 0, 1]],
  [[0, 120, 0, 1], [120, 340, 0, 0]],
]

function instances(): MetricInstance[] {
  return [
    { id: 'a', baseId: 'absoluteTime', params: {}, label: 'A',
      projection: { kind: 'aggregate-aoi', reducer: 'max' } },
    { id: 'b', baseId: 'fixationCount', params: {}, label: 'B',
      projection: { kind: 'aggregate-aoi', reducer: 'max' } },
    // Valid at 1.9.x, invalid now: fixationDuration names no extreme (its
    // Summary `statistic` would double-reduce).
    { id: 'stranded', baseId: 'fixationDuration', params: { statistic: 'mean' }, label: 'S',
      projection: { kind: 'aggregate-aoi', reducer: 'max' } },
  ]
}

function createEngine() {
  return makeTestEngine([SEGMENTS.map(s => s)], {
    aoiData: [[['Nav', 'Nav', 'red'], ['CTA', 'CTA', 'blue']]],
    aoiOrderVector: [[]],
    participants: [['P0', 'P0'], ['P1', 'P1'], ['P2', 'P2']],
    participantsOrderVector: [0, 1, 2],
    stimuli: [['S0', 'S0']],
    stimuliOrderVector: [0],
    metricInstances: instances(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any
}

const settings = (ids: string[]): MetricCorrelationSettings => ({
  stimulusId: STIM,
  groupId: -1,
  view: 'heatmap',
  correlationMethod: 'pearson',
  metricInstanceIds: ids,
})

describe('metric-correlation transformer contract gate', () => {
  it('drops a contract-invalid instance (unnamed aggregate-aoi extreme) from the grid', () => {
    const engine = createEngine()
    const result = getMetricCorrelationData(engine, settings(['a', 'b', 'stranded']))
    const metricIds = result.metrics.map(m => m.id)
    expect(metricIds).toContain('a')
    expect(metricIds).toContain('b')
    expect(metricIds).not.toContain('stranded')
  })

  it('keeps computing with the remaining valid instances', () => {
    const engine = createEngine()
    const result = getMetricCorrelationData(engine, settings(['a', 'b', 'stranded']))
    expect(result.metrics.length).toBe(2)
    expect(result.sampleSize).toBe(3)
    // Every vector value finite: the valid instances compute normally.
    for (const v of result.vectors) {
      expect(v.values.every(Number.isFinite)).toBe(true)
    }
  })

  it('falls to the too-few-metrics empty state when the gate leaves fewer than 2', () => {
    const engine = createEngine()
    const result = getMetricCorrelationData(engine, settings(['a', 'stranded']))
    expect(result.metrics.length).toBeLessThan(2)
  })
})
