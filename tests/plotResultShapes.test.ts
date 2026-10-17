import { describe, it, expect } from 'vitest'
import { asShape } from '../src/lib/plots/shared/resultShapes'
import type { MetricProvenance, MetricResult } from '../src/lib/metrics'

const provenance: MetricProvenance = {
  baseId: 'absoluteTime',
  params: {},
  projection: { kind: 'identity-aoi-vector' },
}

const slots = { totalSlots: 3, noAoiSlot: 2, anyFixationSlot: 1 }

const scalar:                  MetricResult = { shape: 'scalar', metricId: 'm', unit: 'ms', value: 42, isFinite: true, provenance }
const aoiVector:               MetricResult = { shape: 'aoi-vector', metricId: 'm', unit: 'ms', values: [1, 2, 3], slots, provenance }
const aoiPairMatrix:           MetricResult = { shape: 'aoi-pair-matrix', metricId: 'm', unit: 'count', matrix: [0, 1, 2, 3], size: 2, provenance }
const participantPairMatrix:   MetricResult = { shape: 'participant-pair-matrix', metricId: 'm', unit: '%', matrix: [0, 0.5, 0.5, 0], size: 2, participantIds: [1, 2], provenance }
const scalarTimeseries:        MetricResult = { shape: 'scalar-timeseries', metricId: 'm', unit: 'ms', values: [1, 2], timeline: [0, 100], provenance }
const aoiVectorTimeseries:     MetricResult = { shape: 'aoi-vector-timeseries', metricId: 'm', unit: 'ms', vectors: [[1, 2], [3, 4]], timeline: [0, 100], slots, provenance }

describe('asShape: happy path', () => {
  it('narrows a scalar result and preserves fields', () => {
    const r = asShape(scalar, 'scalar')
    expect(r).not.toBeNull()
    expect(r!.value).toBe(42)
    expect(r!.isFinite).toBe(true)
  })
  it('aoi-vector preserves values and slots', () => {
    const r = asShape(aoiVector, 'aoi-vector')
    expect(r).not.toBeNull()
    expect(r!.values).toEqual([1, 2, 3])
    expect(r!.slots).toEqual(slots)
  })
  it('aoi-pair-matrix preserves matrix and size', () => {
    const r = asShape(aoiPairMatrix, 'aoi-pair-matrix')
    expect(r).not.toBeNull()
    expect(r!.matrix).toEqual([0, 1, 2, 3])
    expect(r!.size).toBe(2)
  })
  it('participant-pair-matrix preserves matrix and participantIds', () => {
    const r = asShape(participantPairMatrix, 'participant-pair-matrix')
    expect(r).not.toBeNull()
    expect(r!.participantIds).toEqual([1, 2])
    expect(r!.size).toBe(2)
  })
  it('scalar-timeseries preserves values and timeline', () => {
    const r = asShape(scalarTimeseries, 'scalar-timeseries')
    expect(r).not.toBeNull()
    expect(r!.values).toEqual([1, 2])
    expect(r!.timeline).toEqual([0, 100])
  })
  it('aoi-vector-timeseries preserves vectors, timeline, and slots', () => {
    const r = asShape(aoiVectorTimeseries, 'aoi-vector-timeseries')
    expect(r).not.toBeNull()
    expect(r!.vectors).toEqual([[1, 2], [3, 4]])
    expect(r!.timeline).toEqual([0, 100])
    expect(r!.slots).toEqual(slots)
  })
})

describe('asShape: rejection paths', () => {
  const everything: MetricResult[] = [
    scalar, aoiVector, aoiPairMatrix, participantPairMatrix, scalarTimeseries, aoiVectorTimeseries,
  ]
  it('returns null for every other shape', () => {
    for (const target of everything) {
      for (const r of everything) {
        if (r === target) continue
        expect(asShape(r, target.shape)).toBeNull()
      }
    }
  })
})
