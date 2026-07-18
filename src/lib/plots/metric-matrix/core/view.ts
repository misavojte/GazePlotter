import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import { MatrixPlotFigure } from '$lib/plots/shared'
import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
import { resolveInstance } from '$lib/metrics'
import { getMetricMatrixData } from './transformer'
import { createMetricMatrixCellRenderer } from './cellPainter'
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
 * Auto colorbar max — the finite data max ceiled to 2 decimals (matching the
 * shared figure's `autoMaxDecimals` default). 0 when there is no positive
 * finite value, which the shared figure renders as the scale minimum.
 */
function niceAutoMax(dataMax: number): number {
  if (!(dataMax > 0)) return 0
  return Math.ceil(dataMax * 100) / 100
}

/**
 * Single source of truth for "what a metric matrix draws" — a `MatrixPlotFigure`
 * spec. Rows = participants, columns = stimuli, cells painted via the
 * `drawCells` seam so grid, axis/row/col labels, hover crosshair, tooltip,
 * fit-guard, gradient legend and PNG/JPG export are all inherited for free.
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

  const instance = resolveInstance(
    engine.metadata?.metricInstances ?? [],
    settings.metricInstanceIds?.[0] ?? null
  )

  // Resolve the shared value range once and hand the SAME [min, max] to both
  // the painter and the figure (as an explicit range), so the gradient legend
  // and the painted cells map values identically.
  const rawRange = settings.scaleRange ?? [0, 0]
  const resolvedMax = rawRange[1] !== 0 ? rawRange[1] : niceAutoMax(data.dataMax)
  const colorValueRange: [number, number] = [rawRange[0], resolvedMax]
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
      drawCells: createMetricMatrixCellRenderer(
        data,
        colorScale,
        colorValueRange,
        formatCellValue
      ),
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
