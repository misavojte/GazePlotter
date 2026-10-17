import type { MetricResult } from '$lib/metrics'

type ShapedResult<S extends MetricResult['shape']> = Extract<MetricResult, { shape: S }>

/** `r` narrowed to `shape`, or null. */
export const asShape = <S extends MetricResult['shape']>(r: MetricResult, shape: S): ShapedResult<S> | null =>
  r.shape === shape ? (r as ShapedResult<S>) : null

