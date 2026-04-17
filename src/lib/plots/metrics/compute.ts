import type { ParticipantBarMetrics } from '$lib/plots/bar/types'
import { perParticipantScalar } from '$lib/plots/metric-correlation/core/perParticipantScalar'
import type { MetricInstance } from './types'

export interface ParticipantScalarContext {
  participantMetrics: ParticipantBarMetrics
  aoiIndex: number
}

/**
 * Dispatches a metric instance to its participant-scalar compute. For v1
 * (no parametric families shipped) every instance maps 1:1 to the legacy
 * per-baseId switch in `perParticipantScalar`. When RQA etc. are added, this
 * grows a per-baseId switch that uses `instance.params`.
 */
export function computeParticipantScalar(
  instance: MetricInstance,
  ctx: ParticipantScalarContext
): number {
  return perParticipantScalar(
    ctx.participantMetrics,
    instance.baseId,
    ctx.aoiIndex
  )
}
