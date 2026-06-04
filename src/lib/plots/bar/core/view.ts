import type { ComponentProps } from 'svelte'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { CanvasExportProps } from '$lib/plots/shared'
import type { PlotView } from '$lib/plots/definePlot'
import { resolveInstance } from '$lib/metrics'
import BarPlotFigure from '../components/BarPlotFigure.svelte'
import { getBarPlotData } from './transformer'
import { getBarPlotAxisLabel } from '../const'
import type { BarPlotSettings } from '../types'

/** The figure's data/config props (everything bar the canvas-sizing props). */
export type BarFigureProps = Omit<ComponentProps<typeof BarPlotFigure>, keyof CanvasExportProps>

export interface BarView {
  props: BarFigureProps
  /** Unsynced data maximum — the on-screen container uses it for value-axis sync. */
  dataMax: number
  /** Metric instance id used as the sync key, or null when sync is off. */
  syncKey: string | null
}

/**
 * Single source of truth for "what a bar plot draws" from (engine, settings).
 * `props.timeline` is the UNSYNCED timeline; the on-screen container may swap in
 * a synced one (export never syncs). Both the screen container and the export
 * modal render from this.
 */
export function getBarView(engine: DataEngine, settings: BarPlotSettings): BarView {
  const result = getBarPlotData(engine, settings)
  const resolvedInstance = resolveInstance(
    engine.metadata?.metricInstances ?? [],
    settings.metricInstanceIds[0] ?? null
  )
  return {
    props: {
      data: result.data,
      timeline: result.timeline,
      axisLabel: getBarPlotAxisLabel(
        resolvedInstance,
        settings.timelineStart,
        settings.timelineEnd,
        settings.statisticalOverlay
      ),
      barPlottingType: settings.barPlottingType,
      barWidth: 200,
      barSpacing: 20,
      onDataHover: () => {},
      statisticalOverlay: settings.statisticalOverlay,
      noMetric: result.noMetric ?? false,
    },
    dataMax: result.dataMax,
    syncKey: resolvedInstance?.id ?? null,
  }
}

/** Export view-model — the `definePlot` contract entry. */
export function deriveBarView(engine: DataEngine, settings: BarPlotSettings): PlotView {
  return {
    component: BarPlotFigure,
    props: getBarView(engine, settings).props as Record<string, unknown>,
  }
}
