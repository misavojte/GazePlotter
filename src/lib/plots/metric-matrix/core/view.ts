import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import { MatrixPlotFigure } from '$lib/plots/shared'
import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
import { resolvePickedInstance } from '$lib/plots/shared'
import { INACTIVE_COLOR } from '$lib/color/palettes'
import { getMetricMatrixData } from './transformer'
import { getMetricMatrixLegendTitle, METRIC_MATRIX_DEFAULTS } from '../const'
import type { CellState, MetricMatrixData, MetricMatrixPlotSettings } from '../types'

/** Tooltip status text per NA bucket (the exact, honest reason). */
const STATE_LABEL: Record<Exclude<CellState, null>, string> = {
  absent: 'No recording',
  'no-fixations': 'Recording present, no fixations (capture failure)',
  'aoi-not-present': 'AOI not defined on this stimulus',
  'not-computable': 'Present with fixations, value not computable',
}

/** Legend value formatting: integers bare, else one decimal. */
const formatCellValue = (v: number): string =>
  Number.isInteger(v) ? String(v) : v.toFixed(1)

/**
 * Single source of truth for "what a metric matrix draws" — a `MatrixPlotFigure`
 * spec. Rows = participants, columns = stimuli. Every NA bucket stores NaN, so
 * the shared figure paints it via `nonFiniteColor` and suppresses the cell
 * value; the tooltip (`STATE_LABEL`) still discloses the exact NA reason.
 */
export function deriveMetricMatrixView(
  engine: DataEngine,
  settings: MetricMatrixPlotSettings
): PlotView {
  const data = getMetricMatrixData(engine, settings)
  const rowLabels = data.rows.map(r => r.label)
  const colLabels = data.cols.map(c => c.label)

  const placeholder = data.noMetric
    ? METRIC_MISSING_MESSAGE
    : data.empty === 'no-cols'
      ? 'No stimuli available'
      : data.empty === 'no-rows'
        ? 'No participants in this selection'
        : data.empty === 'all-na'
          ? 'No usable data for this metric'
          : null

  const instance = resolvePickedInstance(engine, settings.metricInstanceIds)

  // [min, max]; max 0 = auto (the figure derives the finite data max itself).
  const colorValueRange: [number, number] = settings.scaleRange ?? [0, 0]
  const colorScale = settings.colorScale ?? []

  return {
    component: MatrixPlotFigure,
    props: {
      matrix: data.values,
      rowLabels,
      colLabels,
      xAxisTitle: METRIC_MATRIX_DEFAULTS.xAxisTitle,
      yAxisTitle: METRIC_MATRIX_DEFAULTS.yAxisTitle,
      colorScale,
      colorValueRange,
      // NA buckets (state !== null) store NaN — never the scale minimum: a
      // missing recording must not read as a low value.
      nonFiniteColor: INACTIVE_COLOR,
      legendTitle: placeholder ? null : getMetricMatrixLegendTitle(instance),
      // The grid width varies with the stimulus count; pin the gradient legend
      // to one fixed length centered under the figure (no dynamic shortening).
      legendFixedWidth: true,
      placeholder,
      fitSteps: [
        'Reduce the number of participants or stimuli shown',
        'Or extend the plot',
      ],
      tooltipId: 'metric-matrix-tooltip',
      tooltipWidth: 240,
      formatCellValue,
      getCellTooltip: (row: number, col: number) => buildTooltip(data, row, col),
    },
  }
}

function buildTooltip(
  data: MetricMatrixData,
  row: number,
  col: number
): Array<{ key: string; value: string }> {
  const i = row * data.cols.length + col
  const st = data.state[i]
  const rows = [
    { key: 'Participant', value: data.rows[row]?.label ?? '' },
    { key: 'Stimulus', value: data.cols[col]?.label ?? '' },
    st === null
      ? { key: 'Value', value: formatValueWithUnit(data.values[i], data.unit) }
      : { key: 'Status', value: STATE_LABEL[st] },
  ]
  // Sample size behind the value: how many fixations the metric collapsed. The
  // trust signal a single number hides (a mean over 1 fixation vs 500). Shown
  // whenever there is a recording (`-1` marks an absent one).
  const n = data.fixations[i]
  if (n >= 0) rows.push({ key: 'Fixations', value: String(n) })
  return rows
}

function formatValueWithUnit(v: number, unit: string): string {
  const num = formatCellValue(v)
  return unit ? `${num} ${unit}` : num
}
