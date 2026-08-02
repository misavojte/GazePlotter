import type { MetricInstance } from '$lib/metrics'
import { buildMetricLabel, timeRangeQualifier } from '$lib/plots/shared'
import type { StatisticalOverlayType } from './types'

/**
 * Shared Visualisation-pane vocabulary for the plots rendering through
 * `DistributionFigure` (AOI Comparison + Eye-movement Comparison) — one home so
 * the user-visible labels cannot drift between them.
 */
export const OVERLAY_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Mean ± 95% CI', value: 'meanCi95' },
  { label: 'Mean ± SD', value: 'meanSd' },
  { label: 'Boxplot', value: 'boxplot' },
]
export const ORIENTATION_OPTIONS = [
  { label: 'Horizontal', value: 'horizontal' },
  { label: 'Vertical', value: 'vertical' },
]
export const DIRECTION_OPTIONS = [
  { label: 'ASC', value: 'asc' },
  { label: 'DESC', value: 'desc' },
]

/** The overlay's pane-summary abbreviation, shared like the options above. */
export function overlaySummaryLabel(overlay: string): string {
  return overlay === 'none'
    ? 'No overlay'
    : overlay === 'meanCi95'
      ? 'M ± 95% CI'
      : overlay === 'meanSd'
        ? 'M ± SD'
        : 'Boxplot'
}

/** The statistic an overlay summarises, as a mid-dot qualifier (never brackets). */
export function statisticQualifier(
  overlay: StatisticalOverlayType
): string | null {
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
 * Value-axis label for a distribution figure, in the shared label grammar:
 * `"<quantity> / <unit> · <statistic> · t ∈ [a, b] ms"`. The quantity is the
 * instance name (carries its projection), the unit comes from the metric, and
 * the statistic + sub-stimulus time range trail as mid-dot qualifiers. The
 * figure has no time axis, so the time range is disclosed here.
 */
export function getDistributionAxisLabel(
  instance: MetricInstance | null | undefined,
  timelineStart = 0,
  timelineEnd = 0,
  overlay: StatisticalOverlayType = 'none'
): string {
  return buildMetricLabel(instance, {
    projection: 'full',
    // This is a distribution plot built on individual values: it pools raw
    // fixations/visits and its overlay states the statistic (mean ± CI /
    // median, IQR). So the cross-participant treatment is disclosed by that
    // overlay, not by a reduction chip implying a point statistic the figure
    // doesn't apply. (The within-participant summary needs no opt-out: the
    // figure consumes the raw vector, which never carries a chosen statistic.)
    includeReduction: false,
    extra: [
      statisticQualifier(overlay),
      timeRangeQualifier(timelineStart, timelineEnd),
    ],
  })
}
