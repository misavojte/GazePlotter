/**
 * The capability algebra (`core/measurement.ts` + `core/aggregation.ts`): pure,
 * total, declarative functions over a metric's `MeasurementClass`. These are the
 * MCP-enumerable predicates — soundness must be derivable from the class alone,
 * with no projection-shape dependence and no silent between-sound downgrade.
 */
import { describe, it, expect } from 'vitest'
import '../src/lib/metrics/init'
import {
  soundReductions,
  reducesAcrossParticipants,
  distributionStatistics,
  supportedAoiReducers,
  supportedMatrixReducers,
  metricShape,
  effectiveReduction,
  reduceFinite,
  reductionLabel,
  contractReductions,
  contractDistributionStats,
  getMetric,
  type MeasurementClass,
  type PlotMetricContract,
} from '../src/lib/metrics'

const ALL_CLASSES: MeasurementClass[] = ['extensive', 'intensive', 'proportion', 'relational']

describe('soundReductions (cross-participant, by class)', () => {
  it('is a total function over every class', () => {
    expect(soundReductions('extensive')).toEqual(['mean', 'sum'])
    expect(soundReductions('intensive')).toEqual(['mean'])
    expect(soundReductions('proportion')).toEqual(['mean'])
    expect(soundReductions('relational')).toEqual([])
  })
  it('never offers sum unless the quantity is extensive', () => {
    for (const c of ALL_CLASSES) {
      if (c !== 'extensive') expect(soundReductions(c)).not.toContain('sum')
    }
  })
  it('reducesAcrossParticipants is false only for relational', () => {
    expect(reducesAcrossParticipants('relational')).toBe(false)
    expect(reducesAcrossParticipants('extensive')).toBe(true)
    expect(reducesAcrossParticipants('intensive')).toBe(true)
    expect(reducesAcrossParticipants('proportion')).toBe(true)
  })
})

describe('distributionStatistics (plot-layer, by class)', () => {
  it('offers mean/median/spread for extensive + intensive; none for proportion/relational', () => {
    expect(distributionStatistics('extensive')).toEqual(['mean', 'median', 'ci95', 'sd', 'iqr'])
    expect(distributionStatistics('intensive')).toEqual(['mean', 'median', 'ci95', 'sd', 'iqr'])
    expect(distributionStatistics('proportion')).toEqual([])
    expect(distributionStatistics('relational')).toEqual([])
  })
  it('median lives here, never in the cross-participant reduction set', () => {
    for (const c of ALL_CLASSES) {
      expect(soundReductions(c)).not.toContain('median' as never)
    }
    expect(distributionStatistics('intensive')).toContain('median')
  })
})

describe('within-participant reducer tables (by class)', () => {
  it('aggregate-aoi is always max|min, class-independent', () => {
    for (const c of ALL_CLASSES) expect(supportedAoiReducers(c)).toEqual(['max', 'min'])
  })
  it('matrix-aggregate unlocks sum/mean only for extensive', () => {
    expect(supportedMatrixReducers('extensive')).toEqual(['sum', 'mean', 'max', 'min'])
    expect(supportedMatrixReducers('intensive')).toEqual(['max', 'min'])
    expect(supportedMatrixReducers('proportion')).toEqual(['max', 'min'])
  })
})

describe('effectiveReduction (request === result; no silent between-sound downgrade)', () => {
  const extensive = getMetric('absoluteTime')!.meta // default mean
  const sumDefault = getMetric('transitionCount')!.meta // default sum
  const intensive = getMetric('relativeTime')!.meta
  const relational = getMetric('participantPairSimilarity')!.meta

  it('honours a sound request verbatim', () => {
    expect(effectiveReduction(extensive, 'sum')).toBe('sum')
    expect(effectiveReduction(extensive, 'mean')).toBe('mean')
    expect(effectiveReduction(sumDefault, 'mean')).toBe('mean')
  })
  it('falls back to the metric default when no request', () => {
    expect(effectiveReduction(extensive, undefined)).toBe('mean')
    expect(effectiveReduction(sumDefault, undefined)).toBe('sum')
    expect(effectiveReduction(intensive, undefined)).toBe('mean')
  })
  it('clamps an unsound request to the default (intensive cannot sum)', () => {
    expect(effectiveReduction(intensive, 'sum')).toBe('mean')
  })
  it('returns the inert mean for relational metrics', () => {
    expect(effectiveReduction(relational, 'sum')).toBe('mean')
    expect(effectiveReduction(relational, undefined)).toBe('mean')
  })
})

describe('reduceFinite (mean / sum, NaN-dropping)', () => {
  it('means and sums over finite values, skipping NaN/Infinity', () => {
    expect(reduceFinite([2, 4, 6], 'mean')).toBe(4)
    expect(reduceFinite([2, 4, 6], 'sum')).toBe(12)
    expect(reduceFinite([2, NaN, 6, Infinity], 'mean')).toBe(4)
    expect(reduceFinite([2, NaN, 6], 'sum')).toBe(8)
  })
  it('all-non-finite → NaN (absent participants drop, never bias to zero)', () => {
    expect(reduceFinite([NaN, Infinity], 'mean')).toBeNaN()
    expect(reduceFinite([], 'sum')).toBeNaN()
  })
})

describe('reductionLabel (discloses only a cohort sum)', () => {
  it('mean → null (conventional default), sum → "summed"', () => {
    expect(reductionLabel('mean')).toBeNull()
    expect(reductionLabel('sum')).toBe('summed')
  })
})

describe('contract gating (plot capability ∩ metric class)', () => {
  const reduceContract: PlotMetricContract = { outputShape: 'aoi-vector', windowing: 'required', crossParticipant: 'reduce' }
  const distributionContract: PlotMetricContract = { outputShape: 'aoi-vector', windowing: 'forbidden', crossParticipant: 'distribution' }
  const seriesContract: PlotMetricContract = { outputShape: 'scalar', windowing: 'required', crossParticipant: 'per-participant' }

  it('a reduce-mode plot offers the metric sound reductions; no distribution stats', () => {
    expect(contractReductions(reduceContract, getMetric('absoluteTime')!.meta)).toEqual(['mean', 'sum'])
    expect(contractReductions(reduceContract, getMetric('relativeTime')!.meta)).toEqual(['mean'])
    expect(contractDistributionStats(reduceContract, getMetric('absoluteTime')!.meta)).toEqual([])
  })
  it('a distribution-mode plot offers distribution stats (incl. median); no reduction control', () => {
    expect(contractReductions(distributionContract, getMetric('absoluteTime')!.meta)).toEqual([])
    expect(contractDistributionStats(distributionContract, getMetric('absoluteTime')!.meta)).toContain('median')
    // proportion metrics render a single bar — no distribution overlay offered.
    expect(contractDistributionStats(distributionContract, getMetric('fixated')!.meta)).toEqual([])
  })
  it('a per-participant plot offers neither (no cross-participant treatment)', () => {
    expect(contractReductions(seriesContract, getMetric('absoluteTime')!.meta)).toEqual([])
    expect(contractDistributionStats(seriesContract, getMetric('absoluteTime')!.meta)).toEqual([])
  })
})

describe('metricShape (abstract descriptor)', () => {
  it('derives the post-projection shape + class from meta + projection', () => {
    const s = metricShape(getMetric('absoluteTime')!.meta, {
      kind: 'windowed',
      window: { windowSize: 500, stepSize: 500 },
      inner: { kind: 'identity-aoi-vector' },
    })
    expect(s).toMatchObject({
      baseId: 'absoluteTime',
      rawShape: 'aoi-vector',
      outputShape: 'aoi-vector-timeseries',
      measurementClass: 'extensive',
      windowed: true,
      unit: 'ms',
    })
  })
  it('reflects a shape-collapsing projection (aoi-vector → scalar)', () => {
    const s = metricShape(getMetric('absoluteTime')!.meta, { kind: 'pick-any-fixation' })
    expect(s.outputShape).toBe('scalar')
    expect(s.windowed).toBe(false)
  })
})
