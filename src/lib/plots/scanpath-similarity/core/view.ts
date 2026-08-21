import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import {
  MatrixPlotFigure,
  buildMetricLabel,
  formatInstanceLabel,
  resolvePickedInstance,
  timeRangeQualifier,
} from '$lib/plots/shared'
import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
import ScangraphFigure from '../components/ScangraphFigure.svelte'
import {
  similarityDataFor,
  buildScangraphData,
  cliquesOfMinSize,
  scangraphCliques,
} from './transformer'
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
  const similarityData = similarityDataFor(engine, settings)
  const noMetric = similarityData.noMetric ?? false
  const hasData = similarityData.size > 0 || noMetric

  if (settings.view === 'scangraph') {
    const threshold = settings.threshold ?? SCANPATH_SIMILARITY_DEFAULTS.threshold
    const scangraphData =
      similarityData.size === 0 ? null : buildScangraphData(similarityData, threshold)
    // Same min-members floor as the picker, so a selection the pane reads as
    // 'none' never silently keeps highlighting.
    const cliqueKey = settings.selectedClique ?? 'none'
    const clique =
      cliqueKey === 'none'
        ? undefined
        : (
            cliquesOfMinSize(
              scangraphCliques(similarityData, threshold),
              settings.minCliqueSize ?? 2
            ) ?? []
          ).find(c => c.key === cliqueKey)
    // Manual highlights are stored as participant IDS; the figure works in
    // node indices. Ids outside the current graph drop out here.
    const nodeIndexByPid = new Map(
      similarityData.participantIds.map((pid, i) => [pid, i])
    )
    const manual = (settings.highlightedParticipants ?? [])
      .map(pid => nodeIndexByPid.get(pid))
      .filter((i): i is number => i !== undefined)
    return {
      component: ScangraphFigure,
      props: {
        data: scangraphData ?? { nodes: [], links: [] },
        noMetric,
        threshold,
        highlights: manual,
        cliqueMembers: clique?.nodeIndices ?? [],
        // Node index -> participant id, for the PLOT CURSOR's ring.
        participantIds: similarityData.participantIds,
        onNodeClick: opts.onNodeClick,
      },
      hasData,
    }
  }

  const resolvedInstance = resolvePickedInstance(engine, settings.metricInstanceIds)
  const { matrix, labels } = similarityData
  // Bare quantity (no qualifiers) for the per-cell tooltip key.
  const valueLabel = formatInstanceLabel(resolvedInstance, 'Similarity')
  return {
    component: MatrixPlotFigure,
    props: {
      matrix,
      labels,
      // Both axes are participants, so the PLOT CURSOR marks a row AND a column.
      rowParticipantIds: similarityData.participantIds,
      colParticipantIds: similarityData.participantIds,
      xAxisTitle: 'Participant',
      yAxisTitle: 'Participant',
      colorScale: settings.colorScale ?? [],
      colorValueRange: settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0],
      formatCellValue: (v: number) => v.toFixed(2),
      // Similarity is a dimensionless [0,1] score — no unit, exactly like the
      // (dimensionless) correlation coefficient. The 0/1 bounds are shown by the
      // colorbar's end ticks; we don't fabricate a "%" or a "0–1" pseudo-unit.
      legendTitle: buildMetricLabel(resolvedInstance, {
        fallback: 'Similarity',
        projection: 'full',
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
      tooltipWidth: 160,
      getCellTooltip: (row: number, col: number) => {
        const v = matrix[row * labels.length + col]
        return [
          { key: 'Row', value: labels[row] },
          { key: 'Column', value: labels[col] },
          // NaN = both scanpaths empty: no data to compare, not a score.
          { key: valueLabel, value: Number.isFinite(v) ? v.toFixed(3) : '—' },
        ]
      },
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
