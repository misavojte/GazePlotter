import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { ExtendedInterpretedDataType, MetricInstance } from '$lib/data/types'
import { collectMetricData } from './collector'
import { getMetricDef } from './registry'
import { computeWindowedScalar } from './windowed'
import type { MetricData } from './types'

export interface MetricQueryContext {
  stimulusId: number
  participantId: number
  aoiIndex: number
  timeStart?: number
  timeEnd?: number
}

export function queryMetric(
  engine: DataEngine,
  instance: MetricInstance,
  ctx: MetricQueryContext,
  aois: ExtendedInterpretedDataType[],
  cachedData?: MetricData
): number {
  const def = getMetricDef(instance.baseId)
  if (!def) return Number.NaN

  if (instance.windowing) {
    const data = cachedData
      ?? collectMetricData(engine, ctx.stimulusId, [ctx.participantId], aois)[0]
    return computeWindowedScalar(
      instance, data, ctx.aoiIndex,
      ctx.timeStart ?? 0, ctx.timeEnd ?? 0,
      engine, ctx.stimulusId, ctx.participantId, aois
    )
  }

  const data = cachedData
    ?? collectMetricData(
        engine, ctx.stimulusId, [ctx.participantId], aois,
        ctx.timeStart ?? 0, ctx.timeEnd ?? 0
      )[0]
  if (!data) return Number.NaN
  return def.compute(data, ctx.aoiIndex, instance)
}

/** Backward-compat shim used by existing callers. */
export function computeParticipantScalar(
  instance: MetricInstance,
  ctx: { participantMetrics: MetricData; aoiIndex: number }
): number {
  const def = getMetricDef(instance.baseId)
  if (!def) return Number.NaN
  return def.compute(ctx.participantMetrics, ctx.aoiIndex, instance)
}
