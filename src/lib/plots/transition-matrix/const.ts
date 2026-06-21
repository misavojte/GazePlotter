import { INACTIVE_COLOR, PRESET_PALETTES } from '$lib/color'

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
 * Legend title derived from the selected metric. Labels come straight from the
 * metric's `meta.label` + `meta.unit` — no plot-side display switch needed now
 * that transforms live on the metric.
 */
export function getLegendTitle(
  metricLabel: string,
  metricUnit: string,
  hideNoAoi = false
): string {
  const base = !metricLabel
    ? 'Transition value'
    : metricUnit
      ? `${metricLabel} [${metricUnit}]`
      : metricLabel
  // Disclose that the No-AOI (Outside) row/column is hidden: for normalised
  // metrics the visible rows then exclude that mass and may not sum to 100%.
  return hideNoAoi ? `${base} (No AOI hidden)` : base
}
