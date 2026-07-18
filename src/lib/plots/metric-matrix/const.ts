import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import { buildMetricLabel, getParticipantsSelectionOptions } from '$lib/plots/shared'
import {
  getMetric,
  type MetricInstance,
  type PlotMetricContract,
} from '$lib/metrics'
import { INACTIVE_COLOR, PRESET_PALETTES } from '$lib/color/palettes'
import type { MetricMatrixPlotSettings } from './types'

/**
 * The metric contract — ONE const, referenced by both the transformer
 * (`resolveMetric`) and `definition.consumesMetrics`, so the pane picker filter
 * and the value resolution can never disagree.
 *
 *   - `outputShape: 'scalar'`      one number per (participant, stimulus).
 *   - `windowing: 'forbidden'`     a cell is a whole-recording scalar.
 *   - `crossParticipant`           `per-participant`: each cell is ONE
 *     participant via `query()`, so cross-participant `reduction` is inert.
 *   - `multiSelect: false`         a single metric drives the whole grid.
 */
export const METRIC_MATRIX_CONTRACT = {
  outputShape: 'scalar',
  windowing: 'forbidden',
  crossParticipant: 'per-participant',
  multiSelect: false,
} as const satisfies PlotMetricContract

export const METRIC_MATRIX_DEFAULTS = {
  xAxisTitle: 'Stimulus',
  yAxisTitle: 'Participant',
  /**
   * Default value ramp: a cool 3-stop sequential (BLUE). Intensive/proportion
   * metrics are non-negative and unipolar, and a cool ramp leaves the warm
   * capture-flag off-ramp maximally distinct.
   */
  colorScale: [...PRESET_PALETTES.BLUE.colors] as string[],
  /**
   * Intensive default: per-participant normalised, so comparable across stimuli
   * on the shared scale (an extensive count would read a long stimulus uniformly
   * high from duration alone — see the extensive caveat).
   */
  defaultMetricId: 'fixationDuration-any',
} as const

/**
 * NA / not-usable off-ramp fills — derived in the view, never persisted.
 * Painted using the standard inactive gray to align with other matrix plots.
 */
export const METRIC_MATRIX_NA_NEUTRAL_COLOR = INACTIVE_COLOR
export const METRIC_MATRIX_NA_FLAG_COLOR = INACTIVE_COLOR

/**
 * Colorbar title for the selected metric, in the shared IUPAC label grammar
 * (`"<quantity> / <unit> · <qualifier> · …"`) — the SAME grammar the transition
 * matrix and correlation legends use, so panel and figure agree and exports
 * self-document. Only the metric's own derived qualifiers (params, the summary
 * statistic, projection) trail behind — no editorial commentary.
 */
export function getMetricMatrixLegendTitle(
  instance: MetricInstance | null | undefined
): string {
  const metric = instance ? getMetric(instance.baseId) : undefined
  return buildMetricLabel(instance, metric, {
    fallback: 'Metric value',
    includeProjection: true,
  })
}

/**
 * Group-only grid-header subtitle. The metric matrix spans every stimulus, so
 * (unlike `stimulusGroupSubtitle`) it names only the participant group.
 */
export function metricMatrixSubtitle(params: {
  item: { settings: MetricMatrixPlotSettings }
  engine: DataEngine
}): PlotSubtitleParts | undefined {
  const { item, engine } = params
  const group = getParticipantsSelectionOptions(engine, true, 0).find(
    o => o.value === String(item.settings.groupId)
  )
  return group?.label ? [{ label: 'Participants', value: group.label }] : undefined
}
