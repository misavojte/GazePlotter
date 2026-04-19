import type { ParticipantBarMetrics } from '$lib/plots/bar/types'
import { perParticipantScalar } from '$lib/plots/metric-correlation/core/perParticipantScalar'
import { computeRqaAoiScalar } from './rqaAoiCompute'
import type { MetricInstance } from './types'

export interface ParticipantScalarContext {
  participantMetrics: ParticipantBarMetrics
  aoiIndex: number
}

export function computeParticipantScalar(
  instance: MetricInstance,
  ctx: ParticipantScalarContext
): number {
  switch (instance.baseId) {
    case 'rqaRec':
    case 'rqaDet':
    case 'rqaLam':
      return computeRqaAoiScalar(instance, ctx.participantMetrics)
    default:
      return perParticipantScalar(
        ctx.participantMetrics,
        instance.baseId,
        ctx.aoiIndex
      )
  }
}
