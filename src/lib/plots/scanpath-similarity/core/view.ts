import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import { getMetric, resolveInstance } from '$lib/metrics'
import {
  MatrixPlotFigure,
  buildMetricLabel,
  formatInstanceLabel,
  timeRangeQualifier,
} from '$lib/plots/shared'
import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
import ScangraphFigure from '../components/ScangraphFigure.svelte'
import { getScanpathSimilarityData, buildScangraphData } from './transformer'
import { SCANPATH_SIMILARITY_DEFAULTS } from '../const'
import type { ScanpathSimilaritySettings } from '../types'

interface ScanpathSimilarityView extends PlotView {
  /** Whether the on-screen container should show the figure (vs a placeholder). */
  hasData: boolean
}

/**
 * Single source of truth for "what a scanpath-similarity plot draws" — picks the
 * matrix or scangraph figure by `settings.view`. `onNodeClick` is screen-only
 * (the export passes none). The scangraph `threshold` is included here so screen
 * and export style links identically (export previously fell back to the default).
 */
function getScanpathSimilarityView(
  engine: DataEngine,
  settings: ScanpathSimilaritySettings,
  opts: { onNodeClick?: (nodeIndex: number) => void } = {}
): ScanpathSimilarityView {
  const similarityData = getScanpathSimilarityData(
    engine,
    settings.stimulusId,
    settings.groupId,
    settings.metricInstanceIds[0] ?? null,
    settings.timelineStart ?? 0,
    settings.timelineEnd ?? 0,
    settings.aoiSelectionId
  )
  const noMetric = similarityData.noMetric ?? false
  const hasData = similarityData.size > 0 || noMetric

  if (settings.view === 'scangraph') {
    const threshold = settings.threshold ?? SCANPATH_SIMILARITY_DEFAULTS.threshold
    const scangraphData =
      similarityData.size === 0 ? null : buildScangraphData(similarityData, threshold)
    return {
      component: ScangraphFigure,
      props: {
        data: scangraphData ?? { nodes: [], links: [] },
        noMetric,
        threshold,
        highlights: settings.participantHighlights ?? [],
        onNodeClick: opts.onNodeClick,
      },
      hasData,
    }
  }

  const resolvedInstance = resolveInstance(
    engine.metadata?.metricInstances ?? [],
    settings.metricInstanceIds[0] ?? null
  )
  const resolvedMetric = resolvedInstance ? getMetric(resolvedInstance.baseId) : undefined
  const { matrix, labels } = similarityData
  // Bare quantity (no qualifiers) for the per-cell tooltip key.
  const valueLabel = formatInstanceLabel(resolvedInstance, resolvedMetric, 'Similarity')
  return {
    component: MatrixPlotFigure,
    props: {
      matrix,
      labels,
      xAxisTitle: 'Participant',
      yAxisTitle: 'Participant',
      colorScale: settings.colorScale ?? [],
      colorValueRange: settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0],
      formatCellValue: (v: number) => v.toFixed(2),
      // Similarity is a dimensionless [0,1] score — no unit, exactly like the
      // (dimensionless) correlation coefficient. The 0/1 bounds are shown by the
      // colorbar's end ticks; we don't fabricate a "%" or a "0–1" pseudo-unit.
      legendTitle: buildMetricLabel(resolvedInstance, resolvedMetric, {
        fallback: 'Similarity',
        includeProjection: true,
        extra: [timeRangeQualifier(settings.timelineStart ?? 0, settings.timelineEnd ?? 0)],
      }),
      placeholder: noMetric
        ? METRIC_MISSING_MESSAGE
        : labels.length === 0
          ? 'No participant data available'
          : null,
      fitSteps: [
        'Reduce the number of participants in Plot Settings > Participants',
      ],
      tooltipId: 'similarity-matrix-tooltip',
      tooltipWidth: 160,
      getCellTooltip: (row: number, col: number) => [
        { key: 'Row', value: labels[row] },
        { key: 'Column', value: labels[col] },
        { key: valueLabel, value: (matrix[row * labels.length + col] ?? 0).toFixed(3) },
      ],
    },
    hasData,
  }
}

export function deriveScanpathSimilarityView(
  engine: DataEngine,
  settings: ScanpathSimilaritySettings
): PlotView {
  const v = getScanpathSimilarityView(engine, settings)
  return { component: v.component, props: v.props, hasData: v.hasData }
}
