import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { plotView, type PlotView } from '$lib/plots/definePlot'
import { matrixKit, type MatrixInput } from '$lib/plots/shared/matrixKit'
import {
  buildMetricLabel,
  formatInstanceLabel,
  resolvePickedInstance,
  timeRangeQualifier,
} from '$lib/plots/shared'
import {
  METRIC_MISSING_MESSAGE,
  NO_PARTICIPANTS_MESSAGE,
} from '$lib/plots/shared/drawCanvasPlaceholder'
import { memoByRef } from '$lib/plots/shared/kit'
import { scangraphKit } from './kit'
import { reorderSimilarity, similarityOrder } from './order'
import {
  similarityDataFor,
  buildScangraphData,
  cliquesOfMinSize,
  resolvedThreshold,
  scangraphCliques,
} from './transformer'
import type { ScanpathSimilarityData, ScanpathSimilaritySettings } from '../types'

/** The scangraph's input; the graph is built at the resolved threshold (Auto included), which the kit styles links by. */
export function scangraphInput(settings: ScanpathSimilaritySettings, similarityData: ScanpathSimilarityData) {
  const threshold = resolvedThreshold(similarityData, settings)
  // Same min-members floor as the picker, so a selection the pane reads as
  // 'none' never silently keeps highlighting.
  const cliqueKey = settings.selectedClique ?? 'none'
  const clique =
    cliqueKey === 'none'
      ? undefined
      : (
          cliquesOfMinSize(scangraphCliques(similarityData, threshold), settings.minCliqueSize ?? 2) ?? []
        ).find(c => c.key === cliqueKey)
  return {
    settings,
    /** The resolved p (Auto included): links clear it, their width encodes the excess. */
    threshold,
    data: buildScangraphData(similarityData, threshold),
    noMetric: similarityData.noMetric ?? false,
    /** The selected clique's nodes (indices): members and their intra-clique edges pop, everything else dims. */
    cliqueMembers: clique?.nodeIndices ?? [],
    /** Participant id per node index: the PLOT CURSOR's participant channel and what a node click toggles. */
    participantIds: similarityData.participantIds,
  }
}

/** Plus `highlightedParticipants` (`view.viewOnly`): clicked nodes' participant ids; ids off the graph mark nothing. */
export type ScangraphInput = ReturnType<typeof scangraphInput> & {
  highlightedParticipants?: readonly number[]
}

export type ScanpathSimilarityView = PlotView<ScangraphInput> | PlotView<MatrixInput>

/** The clustering order, once per cached matrix: an edit that keeps the matrix (colours, a rename) does not recluster. */
const orderOf = memoByRef((matrix: ArrayLike<number>) => similarityOrder(matrix, Math.round(Math.sqrt(matrix.length))))

/** The matrix or scangraph figure, by `settings.view`. */
export function deriveScanpathSimilarityView(
  engine: DataEngine,
  settings: ScanpathSimilaritySettings
): ScanpathSimilarityView {
  const similarityData = similarityDataFor(engine, settings)
  const noMetric = similarityData.noMetric ?? false
  const hasData = similarityData.size > 0 || noMetric
  if (settings.view === 'scangraph') {
    return plotView(scangraphKit, scangraphInput(settings, similarityData), { hasData })
  }

  const resolvedInstance = resolvePickedInstance(engine, settings.metricInstanceIds)
  const ordered =
    settings.orderBy === 'similarity'
      ? reorderSimilarity(similarityData, orderOf(similarityData.matrix))
      : similarityData
  const { matrix, labels } = ordered
  // Bare quantity (no qualifiers) for the per-cell tooltip key.
  const valueLabel = formatInstanceLabel(resolvedInstance, 'Similarity')
  return plotView(
    matrixKit,
    {
      matrix,
      labels,
      // Both axes are participants, so the PLOT CURSOR marks a row AND a column.
      rowParticipantIds: ordered.participantIds,
      colParticipantIds: ordered.participantIds,
      xAxisTitle: 'Participant',
      yAxisTitle: 'Participant',
      colorScale: settings.colorScale ?? [],
      colorValueRange: settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0],
      belowMinColor: settings.belowMinColor,
      aboveMaxColor: settings.aboveMaxColor,
      showBelowMinLabels: settings.showBelowMinLabels,
      showAboveMaxLabels: settings.showAboveMaxLabels,
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
          ? NO_PARTICIPANTS_MESSAGE
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
          // NaN = no data to compare (both scanpaths empty, or no located fixation), not a score.
          { key: valueLabel, value: Number.isFinite(v) ? v.toFixed(3) : 'No data to compare' },
        ]
      },
    },
    { hasData }
  )
}
