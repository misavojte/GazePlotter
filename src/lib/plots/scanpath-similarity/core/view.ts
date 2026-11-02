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
import { scangraphKit } from './kit'
import {
  similarityDataFor,
  buildScangraphData,
  cliquesOfMinSize,
  scangraphCliques,
} from './transformer'
import { SCANPATH_SIMILARITY_DEFAULTS } from '../const'
import type { ScanpathSimilarityData, ScanpathSimilaritySettings } from '../types'

/** The scangraph's input; the graph is built at the settings' threshold, which the kit styles links by. */
export function scangraphInput(settings: ScanpathSimilaritySettings, similarityData: ScanpathSimilarityData) {
  const threshold = settings.threshold ?? SCANPATH_SIMILARITY_DEFAULTS.threshold
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
  const { matrix, labels } = similarityData
  // Bare quantity (no qualifiers) for the per-cell tooltip key.
  const valueLabel = formatInstanceLabel(resolvedInstance, 'Similarity')
  return plotView(
    matrixKit,
    {
      matrix,
      labels,
      // Both axes are participants, so the PLOT CURSOR marks a row AND a column.
      rowParticipantIds: similarityData.participantIds,
      colParticipantIds: similarityData.participantIds,
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
          // NaN = both scanpaths empty: no data to compare, not a score.
          { key: valueLabel, value: Number.isFinite(v) ? v.toFixed(3) : 'No data: both scanpaths empty' },
        ]
      },
    },
    { hasData }
  )
}
