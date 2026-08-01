import { statisticQualifier } from '$lib/plots/bar/const'
import type { StatisticalOverlayType } from '$lib/plots/bar/types'
import { timeRangeQualifier } from '$lib/plots/shared'
import type { EyeMovementMetric } from '../types'

/**
 * Value-axis quantity per metric, in the shared label grammar
 * (`"<quantity> / <unit>"` with mid-dot qualifiers appended). `meanDuration`
 * discloses the within-participant collapse — each dot is one participant's
 * mean segment duration — the way bar-plot instance labels carry theirs.
 */
const METRIC_QUANTITY: Record<EyeMovementMetric, string> = {
  count: 'Eye-movement count / count',
  meanDuration: 'Eye-movement duration / ms · participant mean',
  totalTime: 'Eye-movement time / ms',
  timeShare: 'Share of recording / %',
}

/** Pane option labels — single source for the field and its summary. */
export const METRIC_LABELS: Record<EyeMovementMetric, string> = {
  count: 'Count',
  meanDuration: 'Mean duration',
  totalTime: 'Total time',
  timeShare: 'Share of recording',
}

/**
 * Value-axis label, mirroring `getBarPlotAxisLabel`'s grammar: the quantity,
 * then the overlay's statistic and the sub-stimulus time range as mid-dot
 * qualifiers (this plot has no time axis, so the range is disclosed here).
 */
export function getComparisonAxisLabel(
  metric: EyeMovementMetric,
  timelineStart = 0,
  timelineEnd = 0,
  overlay: StatisticalOverlayType = 'none'
): string {
  const parts = [METRIC_QUANTITY[metric]]
  const stat = statisticQualifier(overlay)
  if (stat) parts.push(stat)
  const range = timeRangeQualifier(timelineStart, timelineEnd)
  if (range) parts.push(range)
  return parts.join(' · ')
}
