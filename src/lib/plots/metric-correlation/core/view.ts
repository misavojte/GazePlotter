import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import {
  MatrixPlotFigure,
  MIN_LEGIBLE_SPLOM_CELL_SIZE,
  withQualifiers,
  timeRangeQualifier,
} from '$lib/plots/shared'
import { METRIC_MISSING_MULTI_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
import { getMetricCorrelationData } from './transformer'
import { createSplomCellRenderer } from './splom'
import type { MetricCorrelationResult, MetricCorrelationSettings } from '../types'

const HEATMAP_COLOR_SCALE = ['#2166ac', '#ffffff', '#ca0020']

/**
 * Legend N is the group's participant count, but cells with missing data rest
 * on fewer complete pairs. Surface the smallest pairwise n among shown
 * (off-diagonal, non-null) cells so the figure — and its static export —
 * doesn't claim more support than any cell actually has.
 */
function buildLegendTitle(result: MetricCorrelationResult): string {
  const method =
    result.correlationMethod === 'spearman' ? 'Spearman' : 'Pearson'
  const baseN = result.sampleSize
  const size = result.metrics.length
  let minN = baseN
  for (let i = 0; i < result.cells.length; i++) {
    if (Math.floor(i / size) === i % size) continue // skip diagonal
    const c = result.cells[i]
    if (c.r !== null && c.n < minN) minN = c.n
  }
  return withQualifiers(
    `${method} correlation coefficient`,
    `N = ${baseN}`,
    minN < baseN ? `min pairwise n = ${minN}` : null,
    timeRangeQualifier(result.timelineStart ?? 0, result.timelineEnd ?? 0)
  )
}

/**
 * Single source of truth for "what a metric-correlation plot draws" — the
 * heatmap and SPLOM are both `MatrixPlotFigure` specs; `settings.view` picks
 * which. Both screen and export render it.
 */
export function deriveMetricCorrelationView(
  engine: DataEngine,
  settings: MetricCorrelationSettings
): PlotView {
  const isSplom = settings.view === 'splom'
  const result = getMetricCorrelationData(engine, settings, { includePoints: isSplom })
  const labels = result.metrics.map(m => m.label)
  const methodLabel = result.correlationMethod === 'spearman' ? 'ρ' : 'r'

  const shared = {
    labels,
    xAxisTitle: 'Metric',
    yAxisTitle: 'Metric',
    placeholder:
      result.noMetric || labels.length < 2 ? METRIC_MISSING_MULTI_MESSAGE : null,
    fitSteps: ['Select fewer metrics in Plot Settings > Metrics'],
    tooltipId: 'metric-correlation-tooltip',
    getCellTooltip: (row: number, col: number) => {
      const cell = result.cells[row * labels.length + col]
      return [
        { key: 'Row', value: labels[row] },
        { key: 'Col', value: labels[col] },
        { key: methodLabel, value: cell.r === null ? '—' : cell.r.toFixed(4) },
        { key: 'n', value: String(cell.n) },
      ]
    },
  }

  if (isSplom) {
    return {
      component: MatrixPlotFigure,
      props: {
        ...shared,
        matrix: new Float64Array(0),
        legendTitle: null,
        minLegibleCellSize: MIN_LEGIBLE_SPLOM_CELL_SIZE,
        tooltipWidth: 220,
        drawCells: createSplomCellRenderer(result),
      },
    }
  }

  // Flat row-major matrix of r values. NaN marks "undefined" (null r) so the
  // shared figure's numeric path handles both uniformly (gray fill, '—' text).
  const n = labels.length
  const flatMatrix = new Float64Array(n * n)
  for (let i = 0; i < result.cells.length; i++) {
    const c = result.cells[i]
    flatMatrix[i] = c.r === null ? Number.NaN : c.r
  }
  return {
    component: MatrixPlotFigure,
    props: {
      ...shared,
      matrix: flatMatrix,
      colorScale: HEATMAP_COLOR_SCALE,
      colorValueRange: [-1, 1] as [number, number],
      nonFiniteColor: '#f2f2f2',
      legendTitle: buildLegendTitle(result),
      tooltipWidth: 200,
    },
  }
}
