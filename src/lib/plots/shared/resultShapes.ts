import type { MetricResult } from '$lib/metrics'

export type ScalarResult                = Extract<MetricResult, { shape: 'scalar' }>
export type AoiVectorResult             = Extract<MetricResult, { shape: 'aoi-vector' }>
export type AoiPairMatrixResult         = Extract<MetricResult, { shape: 'aoi-pair-matrix' }>
export type ParticipantPairMatrixResult = Extract<MetricResult, { shape: 'participant-pair-matrix' }>
export type ScalarTimeseriesResult      = Extract<MetricResult, { shape: 'scalar-timeseries' }>
export type AoiVectorTimeseriesResult   = Extract<MetricResult, { shape: 'aoi-vector-timeseries' }>

export function asScalar(r: MetricResult): ScalarResult | null {
  return r.shape === 'scalar' ? r : null
}

export function asAoiVector(r: MetricResult): AoiVectorResult | null {
  return r.shape === 'aoi-vector' ? r : null
}

export function asAoiPairMatrix(r: MetricResult): AoiPairMatrixResult | null {
  return r.shape === 'aoi-pair-matrix' ? r : null
}

export function asParticipantPairMatrix(r: MetricResult): ParticipantPairMatrixResult | null {
  return r.shape === 'participant-pair-matrix' ? r : null
}

export function asScalarTimeseries(r: MetricResult): ScalarTimeseriesResult | null {
  return r.shape === 'scalar-timeseries' ? r : null
}

export function asAoiVectorTimeseries(r: MetricResult): AoiVectorTimeseriesResult | null {
  return r.shape === 'aoi-vector-timeseries' ? r : null
}
