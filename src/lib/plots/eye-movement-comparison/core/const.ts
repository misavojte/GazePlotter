import { statisticQualifier } from '$lib/plots/bar/const'
import type { StatisticalOverlayType } from '$lib/plots/bar/types'
import {
  formatQuantity,
  timeRangeQualifier,
  withQualifiers,
} from '$lib/plots/shared'
import { getMetric } from '$lib/metrics'
import type { EyeMovementMetric } from '../types'

/**
 * Which recipe computes each metric option, and with which fixed params (the
 * `eyeMovementType` param itself is filled per type at query time). The one
 * table every metric surface — instances, pane labels, axis quantity — keys
 * off.
 */
export const METRIC_SOURCE: Record<
  EyeMovementMetric,
  { baseId: string; params?: Record<string, unknown> }
> = {
  count: { baseId: 'movementCount' },
  meanDuration: { baseId: 'movementDuration', params: { statistic: 'mean' } },
  totalTime: { baseId: 'movementTime' },
  timeShare: { baseId: 'movementTime' },
}

/** Pane option labels — single source for the field and its summary. */
export const METRIC_LABELS: Record<EyeMovementMetric, string> = {
  count: 'Count',
  meanDuration: 'Mean duration',
  totalTime: 'Total time',
  timeShare: 'Share of recording',
}

/**
 * Axis quantity: the backing recipe's own label/unit wherever one exists, so
 * a recipe rename cannot desync this axis from the metric library's naming.
 * `timeShare` is computed plot-side (the scan cannot see the denominator)
 * and carries its own quantity.
 */
function metricQuantity(metric: EyeMovementMetric): string {
  if (metric === 'timeShare') return 'Share of recording / %'
  const meta = getMetric(METRIC_SOURCE[metric].baseId)?.meta
  return meta ? formatQuantity(meta.label, meta.unit) : METRIC_LABELS[metric]
}

/**
 * Value-axis label in the shared grammar (`withQualifiers`): the quantity,
 * then the overlay's statistic and the sub-stimulus time range as mid-dot
 * qualifiers (this plot has no time axis, so the range is disclosed here).
 */
export function getComparisonAxisLabel(
  metric: EyeMovementMetric,
  timelineStart = 0,
  timelineEnd = 0,
  overlay: StatisticalOverlayType = 'none'
): string {
  return withQualifiers(
    metricQuantity(metric),
    // Each dot is one participant's mean segment duration — the
    // within-participant collapse, disclosed like bar instance labels do.
    metric === 'meanDuration' && 'participant mean',
    statisticQualifier(overlay),
    timeRangeQualifier(timelineStart, timelineEnd)
  )
}
