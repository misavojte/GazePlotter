import type { ComponentProps } from 'svelte'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { formatCompact, MatrixPlotFigure, resolvePickedInstance, type CanvasExportProps } from '$lib/plots/shared'
import type { PlotView } from '$lib/plots/definePlot'
import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
import { getTransitionMatrixData } from './transformer'
import { colorScaleToKey } from './sync.svelte'
import { getLegendTitle, TRANSITION_MATRIX_DEFAULTS } from '../const'
import type { TransitionMatrixPlotSettings } from '../types'

/** Screen-coordination surface carried on the view for the screen recipe. */
export type TransitionViewMeta = {
  /** Unsynced data maximum: the on-screen container uses it for color sync. */
  ownDataMax: number
  syncGroupKey: string
  colorScaleKey: string
  isDefaultColorRange: boolean
}

/**
 * Single source of truth for "what a transition matrix draws", screen and export.
 * `props.colorValueRange` is the UNSYNCED per-stimulus range; the on-screen
 * container may swap in a synced range (export never syncs).
 */
export function deriveTransitionMatrixView(
  engine: DataEngine,
  settings: TransitionMatrixPlotSettings
): PlotView {
  const transitionData = getTransitionMatrixData(
    engine,
    settings.stimulusId,
    settings.groupId,
    settings.metricInstanceIds[0] ?? null,
    settings.timelineStart ?? 0,
    settings.timelineEnd ?? 0,
    settings.hideNoAoi ?? false,
    settings.aoiSelectionId
  )
  const { matrix, aoiLabels } = transitionData
  const noMetric = transitionData.noMetric ?? false

  const resolvedInstance = resolvePickedInstance(engine, settings.metricInstanceIds)
  const effectiveColorScale = settings.colorScale ?? []
  const currentStimulusColorRange: [number, number] =
    settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0]
  let ownDataMax = 0
  for (let i = 0; i < matrix.length; i++) if (matrix[i] > ownDataMax) ownDataMax = matrix[i]
  ownDataMax = Math.ceil(ownDataMax)

  return {
    component: MatrixPlotFigure,
    props: {
      matrix,
      labels: aoiLabels,
      xAxisTitle: TRANSITION_MATRIX_DEFAULTS.xLabel,
      yAxisTitle: TRANSITION_MATRIX_DEFAULTS.yLabel,
      colorScale: effectiveColorScale,
      colorValueRange: currentStimulusColorRange,
      autoMaxDecimals: 0,
      belowMinColor: settings.belowMinColor,
      aboveMaxColor: settings.aboveMaxColor,
      // Non-finite marks an undefined cell (e.g. transitionProbability with no
      // outgoing transitions) — render out-of-bounds, distinct from a real zero.
      nonFiniteColor: settings.belowMinColor,
      showBelowMinLabels: settings.showBelowMinLabels,
      showAboveMaxLabels: settings.showAboveMaxLabels,
      hasLastRowSentinel: true,
      formatCellValue: formatCompact,
      legendTitle: getLegendTitle(
        resolvedInstance,
        settings.hideNoAoi ?? false,
        settings.timelineStart ?? 0,
        settings.timelineEnd ?? 0
      ),
      placeholder: noMetric
        ? METRIC_MISSING_MESSAGE
        : aoiLabels.length === 0
          ? {
              message: 'No AOIs for this stimulus and AOI selection.',
              steps: ['Pick another Stimulus or a selection in Areas of Interest'],
            }
          : null,
      fitSteps: ['Merge some AOIs in Plot Settings > Areas of Interest'],
      tooltipWidth: 150,
      getCellTooltip: (row, col) => {
        const value = matrix[row * aoiLabels.length + col] ?? 0
        return [
          { key: 'From', value: aoiLabels[row] },
          { key: 'To', value: aoiLabels[col] },
          { key: 'Value', value: Number.isFinite(value) ? value.toString() : '—' },
        ]
      },
    } satisfies Omit<ComponentProps<typeof MatrixPlotFigure>, keyof CanvasExportProps>,
    meta: {
      ownDataMax,
      syncGroupKey: String(resolvedInstance?.id ?? 'none'),
      colorScaleKey: colorScaleToKey(effectiveColorScale),
      isDefaultColorRange:
        currentStimulusColorRange[0] === 0 && currentStimulusColorRange[1] === 0,
    } satisfies TransitionViewMeta,
  }
}
