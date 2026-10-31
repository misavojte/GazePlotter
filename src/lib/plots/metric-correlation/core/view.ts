import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { figureView, type PlotView } from '$lib/plots/definePlot'
import { INACTIVE_COLOR } from '$lib/color'
import {
  MatrixPlotFigure,
  MIN_LEGIBLE_SPLOM_CELL_SIZE,
  withQualifiers,
  timeRangeQualifier,
} from '$lib/plots/shared'
import { METRIC_MISSING_MULTI_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
import { getMetricCorrelationData } from './transformer'
import { createSplomCellRenderer, createSplomCursorRing } from './splom'
import { MIN_CORRELATION_SAMPLES } from '../const'
import type { MetricCorrelationResult, MetricCorrelationSettings } from '../types'

const HEATMAP_COLOR_SCALE = ['#2166ac', '#ffffff', '#ca0020']

/**
 * Cells with missing data rest on fewer pairs than the selection's N, so the
 * title also names the smallest pairwise n among shown cells.
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
    getCellTooltip: (row: number, col: number) => {
      const cell = result.cells[row * labels.length + col]
      return [
        { key: 'Row', value: labels[row] },
        { key: 'Col', value: labels[col] },
        {
          key: methodLabel,
          // r is undefined for two reasons with different remedies.
          value:
            cell.r !== null
              ? cell.r.toFixed(4)
              : cell.n < MIN_CORRELATION_SAMPLES
                ? `Too few pairs (n < ${MIN_CORRELATION_SAMPLES})`
                : 'Undefined: a metric is constant',
        },
        { key: 'Pairs (n)', value: String(cell.n) },
      ]
    },
  }

  if (isSplom) {
    return figureView(MatrixPlotFigure, {
      ...shared,
      matrix: new Float64Array(0),
      legendTitle: null,
      minLegibleCellSize: MIN_LEGIBLE_SPLOM_CELL_SIZE,
      tooltipWidth: 220,
      drawCells: createSplomCellRenderer(result),
      drawCellsCursor: createSplomCursorRing(result),
    })
  }

  // Flat row-major matrix of r values. NaN marks "undefined" (null r) so the
  // shared figure's numeric path handles both uniformly (gray fill, '—' text).
  const n = labels.length
  const flatMatrix = new Float64Array(n * n)
  for (let i = 0; i < result.cells.length; i++) {
    const c = result.cells[i]
    flatMatrix[i] = c.r === null ? Number.NaN : c.r
  }
  return figureView(MatrixPlotFigure, {
    ...shared,
    matrix: flatMatrix,
    colorScale: HEATMAP_COLOR_SCALE,
    colorValueRange: [-1, 1],
    nonFiniteColor: INACTIVE_COLOR,
    legendTitle: buildLegendTitle(result),
    tooltipWidth: 200,
  })
}
