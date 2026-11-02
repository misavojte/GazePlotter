import { getMetric, type MetricInstance } from '$lib/metrics'
import { getDistributionAxisLabel } from '../labels'
import type { DistributionResult, StatisticalOverlayType } from '../types'
import type { BeeswarmInput } from './kit'

/** The settings this view reads, declared here so the shared layer depends on no consumer's settings type. */
export interface BeeswarmViewSettings {
  timelineStart?: number
  timelineEnd?: number
  statisticalOverlay: StatisticalOverlayType
  orientation: 'vertical' | 'horizontal'
}

/**
 * THE input every `beeswarmKit` plot renders with. Load-bearing: a PROPORTION
 * metric suppresses the overlay in the axis label, since it renders as plain
 * proportional bars and the label must not claim a mean ± CI / SD / boxplot
 * statistic that isn't drawn. `extras` carries the per-plot disclosure strings
 * and is spread last.
 */
export function buildBeeswarmInput(
  result: DistributionResult,
  resolvedInstance: MetricInstance | null | undefined,
  settings: BeeswarmViewSettings,
  extras?: Partial<BeeswarmInput>
): BeeswarmInput {
  return {
    data: result.data,
    timeline: result.timeline,
    axisLabel: getDistributionAxisLabel(
      resolvedInstance,
      settings.timelineStart,
      settings.timelineEnd,
      result.proportion ? 'none' : settings.statisticalOverlay
    ),
    orientation: settings.orientation,
    statisticalOverlay: settings.statisticalOverlay,
    noMetric: result.noMetric ?? false,
    noParticipants: result.noParticipants ?? false,
    proportion: result.proportion ?? false,
    unit: resolvedInstance ? (getMetric(resolvedInstance.baseId)?.meta.unit ?? '') : '',
    ...extras,
  }
}
