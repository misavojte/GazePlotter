import type { MetricInstance } from '$lib/metrics'
import { buildMetricLabel, timeRangeQualifier } from '$lib/plots/shared/labels'
import type { StatisticalOverlayType } from './types'

/**
 * Shared Visualization-pane vocabulary for the plots that draw a distribution
 * (AOI Comparison + Eye-movement Comparison) — one home so the user-visible
 * labels cannot drift between them. The section that arranges these controls is
 * `distributionVisualizationSection`.
 */
const OVERLAYS = [
  // value, pane option, pane-summary abbreviation, the statistic as a mid-dot qualifier (never brackets)
  { value: 'none', label: 'None', summary: 'No overlay', statistic: null },
  { value: 'meanCi95', label: 'Mean ± 95% CI', summary: 'M ± 95% CI', statistic: 'mean ± 95% CI' },
  { value: 'meanSd', label: 'Mean ± SD', summary: 'M ± SD', statistic: 'mean ± SD' },
  { value: 'boxplot', label: 'Boxplot', summary: 'Boxplot', statistic: 'median, IQR' },
] as const
const overlayRow = (overlay: string) => OVERLAYS.find(o => o.value === overlay)
export const OVERLAY_OPTIONS = OVERLAYS.map(({ label, value }) => ({ label, value }))
export const ORIENTATION_OPTIONS = [
  { label: 'Horizontal', value: 'horizontal' },
  { label: 'Vertical', value: 'vertical' },
]
export const DIRECTION_OPTIONS = [
  { label: 'ASC', value: 'asc' },
  { label: 'DESC', value: 'desc' },
]

export const overlaySummaryLabel = (overlay: string): string => overlayRow(overlay)?.summary ?? 'Boxplot'
export const statisticQualifier = (overlay: StatisticalOverlayType): string | null =>
  overlayRow(overlay)?.statistic ?? null

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
