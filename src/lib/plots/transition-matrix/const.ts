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
export function getLegendTitle(metricLabel: string, metricUnit: string): string {
  if (!metricLabel) return 'Transition value'
  return metricUnit ? `${metricLabel} [${metricUnit}]` : metricLabel
}
