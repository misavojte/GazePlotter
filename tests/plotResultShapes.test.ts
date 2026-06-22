import { describe, it, expect } from 'vitest'
import {
  asScalar,
  asAoiVector,
  asAoiPairMatrix,
  asParticipantPairMatrix,
  asScalarTimeseries,
  asAoiVectorTimeseries,
} from '../src/lib/plots/shared/resultShapes'
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

describe('resultShapes extractors — happy path', () => {
  it('asScalar narrows a scalar result and preserves fields', () => {
    const r = asScalar(scalar)
    expect(r).not.toBeNull()
    expect(r!.value).toBe(42)
    expect(r!.isFinite).toBe(true)
  })
  it('asAoiVector preserves values and slots', () => {
    const r = asAoiVector(aoiVector)
    expect(r).not.toBeNull()
    expect(r!.values).toEqual([1, 2, 3])
    expect(r!.slots).toEqual(slots)
  })
  it('asAoiPairMatrix preserves matrix and size', () => {
    const r = asAoiPairMatrix(aoiPairMatrix)
    expect(r).not.toBeNull()
    expect(r!.matrix).toEqual([0, 1, 2, 3])
    expect(r!.size).toBe(2)
  })
  it('asParticipantPairMatrix preserves matrix and participantIds', () => {
    const r = asParticipantPairMatrix(participantPairMatrix)
    expect(r).not.toBeNull()
    expect(r!.participantIds).toEqual([1, 2])
    expect(r!.size).toBe(2)
  })
  it('asScalarTimeseries preserves values and timeline', () => {
    const r = asScalarTimeseries(scalarTimeseries)
    expect(r).not.toBeNull()
    expect(r!.values).toEqual([1, 2])
    expect(r!.timeline).toEqual([0, 100])
  })
  it('asAoiVectorTimeseries preserves vectors, timeline, and slots', () => {
    const r = asAoiVectorTimeseries(aoiVectorTimeseries)
    expect(r).not.toBeNull()
    expect(r!.vectors).toEqual([[1, 2], [3, 4]])
    expect(r!.timeline).toEqual([0, 100])
    expect(r!.slots).toEqual(slots)
  })
})

describe('resultShapes extractors — rejection paths', () => {
  const everything: MetricResult[] = [
    scalar, aoiVector, aoiPairMatrix, participantPairMatrix, scalarTimeseries, aoiVectorTimeseries,
  ]
  it('asScalar returns null for any non-scalar shape', () => {
    for (const r of everything) {
      if (r.shape === 'scalar') continue
      expect(asScalar(r)).toBeNull()
    }
  })
  it('asAoiVector returns null for any non-aoi-vector shape', () => {
    for (const r of everything) {
      if (r.shape === 'aoi-vector') continue
      expect(asAoiVector(r)).toBeNull()
    }
  })
  it('asAoiPairMatrix returns null for any non-aoi-pair-matrix shape', () => {
    for (const r of everything) {
      if (r.shape === 'aoi-pair-matrix') continue
      expect(asAoiPairMatrix(r)).toBeNull()
    }
  })
  it('asParticipantPairMatrix returns null for any non-participant-pair-matrix shape', () => {
    for (const r of everything) {
      if (r.shape === 'participant-pair-matrix') continue
      expect(asParticipantPairMatrix(r)).toBeNull()
    }
  })
  it('asScalarTimeseries returns null for any non-scalar-timeseries shape', () => {
    for (const r of everything) {
      if (r.shape === 'scalar-timeseries') continue
      expect(asScalarTimeseries(r)).toBeNull()
    }
  })
  it('asAoiVectorTimeseries returns null for any non-aoi-vector-timeseries shape', () => {
    for (const r of everything) {
      if (r.shape === 'aoi-vector-timeseries') continue
      expect(asAoiVectorTimeseries(r)).toBeNull()
    }
  })
})
