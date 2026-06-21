import { getMetric, type MetricInstance } from '$lib/metrics'
import { buildMetricLabel, timeRangeQualifier } from '$lib/plots/shared'
import type { StatisticalOverlayType } from './types'

/** The statistic an overlay summarises, as a mid-dot qualifier (never brackets). */
function statisticQualifier(overlay: StatisticalOverlayType): string | null {
  switch (overlay) {
    case 'meanSd':
      return 'mean ± SD'
    case 'meanCi95':
      return 'mean ± 95% CI'
    case 'boxplot':
      return 'median, IQR'
    default:
      return null
  }
}

/**
 * Value-axis label for the bar plot, in the shared label grammar:
 * `"<quantity> / <unit> · <statistic> · t ∈ [a, b] ms"`. The quantity is the
 * instance name (carries its projection), the unit comes from the metric, and
 * the statistic + sub-stimulus time range trail as mid-dot qualifiers. The bar
 * plot has no time axis, so the time range is disclosed here.
 */
export function getBarPlotAxisLabel(
  instance: MetricInstance | null | undefined,
  timelineStart = 0,
  timelineEnd = 0,
  overlay: StatisticalOverlayType = 'none'
): string {
  return buildMetricLabel(instance, instance ? getMetric(instance.baseId) : undefined, {
    includeProjection: true,
    extra: [statisticQualifier(overlay), timeRangeQualifier(timelineStart, timelineEnd)],
  })
}
