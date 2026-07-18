import type { ComponentProps } from 'svelte'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { MatrixPlotFigure, type CanvasExportProps } from '$lib/plots/shared'
import type { PlotView } from '$lib/plots/definePlot'
import { getMetric, resolveInstance } from '$lib/metrics'
import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
import { getTransitionMatrixData } from './transformer'
import { colorScaleToKey } from './sync.svelte'
import { getLegendTitle, TRANSITION_MATRIX_DEFAULTS } from '../const'
import type { TransitionMatrixPlotSettings } from '../types'

export type TransitionFigureProps = Omit<
  ComponentProps<typeof MatrixPlotFigure>,
  keyof CanvasExportProps
>

export interface TransitionView {
  props: TransitionFigureProps
  /** Unsynced data maximum — the on-screen container uses it for color sync. */
  ownDataMax: number
  syncGroupKey: string
  colorScaleKey: string
  isDefaultColorRange: boolean
  currentStimulusColorRange: [number, number]
}

const formatCellValue = (v: number) =>
  Number.isInteger(v) ? v.toString() : v.toFixed(1)

/**
 * Single source of truth for "what a transition matrix draws". `props.colorValueRange`
 * is the UNSYNCED per-stimulus range; the on-screen container may swap in a
 * synced range (export never syncs).
 */
export function getTransitionView(
  engine: DataEngine,
  settings: TransitionMatrixPlotSettings
): TransitionView {
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

  const resolvedInstance = resolveInstance(
    engine.metadata?.metricInstances ?? [],
    settings.metricInstanceIds[0] ?? null
  )
  const resolvedMetric = resolvedInstance ? getMetric(resolvedInstance.baseId) : undefined
  const effectiveColorScale = settings.colorScale ?? []
  const currentStimulusColorRange: [number, number] =
    settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0]
  const belowMinColor = settings.belowMinColor ?? TRANSITION_MATRIX_DEFAULTS.inactiveColor

  let ownDataMax = 0
  for (let i = 0; i < matrix.length; i++) if (matrix[i] > ownDataMax) ownDataMax = matrix[i]
  ownDataMax = Math.ceil(ownDataMax)

  return {
    props: {
      matrix,
      labels: aoiLabels,
      xAxisTitle: TRANSITION_MATRIX_DEFAULTS.xLabel,
      yAxisTitle: TRANSITION_MATRIX_DEFAULTS.yLabel,
      colorScale: effectiveColorScale,
      colorValueRange: currentStimulusColorRange,
      autoMaxDecimals: 0,
      belowMinColor,
      aboveMaxColor: settings.aboveMaxColor ?? TRANSITION_MATRIX_DEFAULTS.inactiveColor,
      // Non-finite marks an undefined cell (e.g. transitionProbability with no
      // outgoing transitions) — render out-of-bounds, distinct from a real zero.
      nonFiniteColor: belowMinColor,
      showBelowMinLabels: settings.showBelowMinLabels ?? false,
      showAboveMaxLabels: settings.showAboveMaxLabels ?? false,
      hasLastRowSentinel: true,
      formatCellValue,
      legendTitle: getLegendTitle(
        resolvedInstance,
        resolvedMetric,
        settings.hideNoAoi ?? false,
        settings.timelineStart ?? 0,
        settings.timelineEnd ?? 0
      ),
      placeholder: noMetric
        ? METRIC_MISSING_MESSAGE
        : aoiLabels.length === 0
          ? 'No AOI data available'
          : null,
      fitSteps: ['Merge some AOIs in Plot Settings > Areas of Interest'],
      tooltipId: 'transition-matrix-tooltip',
      tooltipWidth: 150,
      getCellTooltip: (row, col) => {
        const value = matrix[row * aoiLabels.length + col] ?? 0
        return [
          { key: 'From', value: aoiLabels[row] },
          { key: 'To', value: aoiLabels[col] },
          { key: 'Value', value: Number.isFinite(value) ? value.toString() : '—' },
        ]
      },
    },
    ownDataMax,
    syncGroupKey: String(resolvedInstance?.id ?? 'none'),
    colorScaleKey: colorScaleToKey(effectiveColorScale),
    isDefaultColorRange:
      currentStimulusColorRange[0] === 0 && currentStimulusColorRange[1] === 0,
    currentStimulusColorRange,
  }
}

/** Screen-coordination surface carried on the view for the screen recipe. */
export interface TransitionViewMeta {
  ownDataMax: number
  syncGroupKey: string
  colorScaleKey: string
  isDefaultColorRange: boolean
  currentStimulusColorRange: [number, number]
}

/** The `definePlot` view entry — the single derivation for screen and export. */
export function deriveTransitionMatrixView(
  engine: DataEngine,
  settings: TransitionMatrixPlotSettings
): PlotView {
  const view = getTransitionView(engine, settings)
  return {
    component: MatrixPlotFigure,
    props: view.props as Record<string, unknown>,
    meta: {
      ownDataMax: view.ownDataMax,
      syncGroupKey: view.syncGroupKey,
      colorScaleKey: view.colorScaleKey,
      isDefaultColorRange: view.isDefaultColorRange,
      currentStimulusColorRange: view.currentStimulusColorRange,
    } satisfies TransitionViewMeta,
  }
}
