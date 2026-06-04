import type { ComponentProps } from 'svelte'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { CanvasExportProps } from '$lib/plots/shared'
import type { PlotView } from '$lib/plots/definePlot'
import { getMetric, resolveInstance } from '$lib/metrics'
import TransitionMatrixPlotFigure from '../components/TransitionMatrixPlotFigure.svelte'
import { getTransitionMatrixData } from './transformer'
import { colorScaleToKey } from './sync.svelte'
import { getLegendTitle } from '../const'
import type { TransitionMatrixPlotSettings } from '../types'

export type TransitionFigureProps = Omit<
  ComponentProps<typeof TransitionMatrixPlotFigure>,
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
    settings.hideNoAoi ?? false
  )
  const { matrix, aoiLabels } = transitionData

  const resolvedInstance = resolveInstance(
    engine.metadata?.metricInstances ?? [],
    settings.metricInstanceIds[0] ?? null
  )
  const resolvedMetric = resolvedInstance ? getMetric(resolvedInstance.baseId) : undefined
  const effectiveColorScale = settings.colorScale ?? []
  const currentStimulusColorRange: [number, number] =
    settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0]

  let ownDataMax = 0
  for (let i = 0; i < matrix.length; i++) if (matrix[i] > ownDataMax) ownDataMax = matrix[i]
  ownDataMax = Math.ceil(ownDataMax)

  return {
    props: {
      TransitionMatrix: matrix,
      aoiLabels,
      colorScale: effectiveColorScale,
      xLabel: 'To AOI',
      yLabel: 'From AOI',
      legendTitle: getLegendTitle(
        resolvedInstance?.label ?? resolvedMetric?.meta.label ?? '',
        resolvedMetric?.meta.unit ?? ''
      ),
      colorValueRange: currentStimulusColorRange,
      belowMinColor: settings.belowMinColor,
      aboveMaxColor: settings.aboveMaxColor,
      showBelowMinLabels: settings.showBelowMinLabels,
      showAboveMaxLabels: settings.showAboveMaxLabels,
      noMetric: transitionData.noMetric ?? false,
    },
    ownDataMax,
    syncGroupKey: String(resolvedInstance?.id ?? 'none'),
    colorScaleKey: colorScaleToKey(effectiveColorScale),
    isDefaultColorRange:
      currentStimulusColorRange[0] === 0 && currentStimulusColorRange[1] === 0,
    currentStimulusColorRange,
  }
}

export function deriveTransitionMatrixView(
  engine: DataEngine,
  settings: TransitionMatrixPlotSettings
): PlotView {
  return {
    component: TransitionMatrixPlotFigure,
    props: getTransitionView(engine, settings).props as Record<string, unknown>,
  }
}
