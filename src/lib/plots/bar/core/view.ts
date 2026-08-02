import type { ComponentProps } from 'svelte'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { CanvasExportProps } from '$lib/plots/shared'
import type { PlotView } from '$lib/plots/definePlot'
import type { MetricInstance } from '$lib/metrics'
import { resolvePickedInstance } from '$lib/plots/shared'
import BarPlotFigure from '../components/BarPlotFigure.svelte'
import { getBarPlotData } from './transformer'
import { getBarPlotAxisLabel } from '../const'
import type { BarPlotResult, BarPlotSettings } from '../types'

/** The figure's data/config props (everything bar the canvas-sizing props). */
export type BarFigureProps = Omit<ComponentProps<typeof BarPlotFigure>, keyof CanvasExportProps>

/**
 * THE props every `BarPlotFigure` plot renders with — the AOI Comparison and
 * the Eye-movement Comparison. Owns the figure's fixed geometry and,
 * load-bearing, the rule that a PROPORTION metric suppresses the overlay in
 * the axis label: those render as plain proportional bars, so the label must
 * not claim a mean ± CI / SD / boxplot statistic that isn't drawn. `extras`
 * carries the only genuine per-plot differences (tooltip noun, cannot-fit
 * hints, aria label) and is spread last.
 */
export function buildBarFigureProps(
  result: BarPlotResult,
  resolvedInstance: MetricInstance | null | undefined,
  settings: Pick<
    BarPlotSettings,
    'timelineStart' | 'timelineEnd' | 'statisticalOverlay' | 'barPlottingType'
  >,
  extras?: Partial<BarFigureProps>
): BarFigureProps {
  return {
    data: result.data,
    timeline: result.timeline,
    axisLabel: getBarPlotAxisLabel(
      resolvedInstance,
      settings.timelineStart,
      settings.timelineEnd,
      result.proportion ? 'none' : settings.statisticalOverlay
    ),
    barPlottingType: settings.barPlottingType,
    barWidth: 200,
    barSpacing: 20,
    onDataHover: () => {},
    statisticalOverlay: settings.statisticalOverlay,
    noMetric: result.noMetric ?? false,
    proportion: result.proportion ?? false,
    ...extras,
  }
}

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
  const resolvedInstance = resolvePickedInstance(engine, settings.metricInstanceIds)
  return {
    props: buildBarFigureProps(result, resolvedInstance, settings),
    dataMax: result.dataMax,
    syncKey: resolvedInstance?.id ?? null,
  }
}

/** Screen-coordination surface carried on the view for the screen recipe. */
export interface BarViewMeta {
  syncKey: string | null
  dataMax: number
}

/** The `definePlot` view entry — the single derivation for screen and export. */
export function deriveBarView(engine: DataEngine, settings: BarPlotSettings): PlotView {
  const view = getBarView(engine, settings)
  return {
    component: BarPlotFigure,
    props: view.props as Record<string, unknown>,
    meta: { syncKey: view.syncKey, dataMax: view.dataMax } satisfies BarViewMeta,
  }
}
