import { INACTIVE_COLOR, PRESET_PALETTES } from '$lib/color'
import { buildMetricLabel, timeRangeQualifier } from '$lib/plots/shared'
import type { Metric, MetricInstance } from '$lib/metrics'

export { MATRIX_LAYOUT as TRANSITION_MATRIX_LAYOUT } from '$lib/plots/shared'

export const TRANSITION_MATRIX_DEFAULTS = {
  width: 500,
  height: 500,
  inactiveColor: INACTIVE_COLOR,
  colorScale: [...PRESET_PALETTES.BLUE.colors],
  xLabel: 'To AOI',
  yLabel: 'From AOI',
} as const

/**
 * Colorbar title for the selected metric, in the shared label grammar:
 * `"<quantity> / <unit> · <qualifier> · …"`. The quantity + unit come from the
 * instance/metric; the instance's derived param qualifiers (mode, k-step, …)
 * and the plot-level facts trail as mid-dot qualifiers — never brackets or
 * parentheticals, and always derived so a rename can't drop them.
 *
 *   - `"No-AOI excluded"` discloses that the No-AOI (Outside) row/column is
 *     hidden: for normalised metrics the visible rows then exclude that mass
 *     and may not sum to 100%.
 *   - the time-range qualifier signals a sub-stimulus extent — the matrix has
 *     no time axis, so the range would otherwise be invisible.
 */
export function getLegendTitle(
  instance: MetricInstance | null | undefined,
  metric: Metric | null | undefined,
  hideNoAoi = false,
  timelineStart = 0,
  timelineEnd = 0
): string {
  return buildMetricLabel(instance, metric, {
    fallback: 'Transition value',
    includeProjection: true,
    extra: [hideNoAoi && 'No-AOI excluded', timeRangeQualifier(timelineStart, timelineEnd)],
  })
}
