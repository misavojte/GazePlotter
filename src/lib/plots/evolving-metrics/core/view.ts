import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView, PlotViewContext } from '$lib/plots/definePlot'
import { getParticipants, getParticipantEndTime } from '$lib/data/engine'
import { resolveColumnBudget } from '$lib/plots/shared/displayBudget'
import { calculatePlotWidthPx } from '$lib/plots/shared/plotSizeUtility'
import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid/const'
import EvolvingMetricsPlotFigure from '../components/EvolvingMetricsPlotFigure.svelte'
import { getEvolvingMetricsData } from '.'
import type { EvolvingMetricsResult } from '../types'
import type { EvolvingMetricsSettings } from '../types'

/**
 * Shared data derivation: resolves the timeline max from participant end-times,
 * derives a display budget from the plot's on-screen width (`ctx.itemWidth`, so
 * only ~one window per pixel is evaluated/drawn), then transforms. Both the
 * on-screen container and the export view-model call this so they can't drift.
 */
export function computeEvolvingData(
  engine: DataEngine,
  settings: EvolvingMetricsSettings,
  ctx?: PlotViewContext
): EvolvingMetricsResult {
  const timelineMax =
    (settings.timelineEnd ?? 0) > 0
      ? settings.timelineEnd!
      : getParticipants(engine, settings.groupId, settings.stimulusId).reduce(
          (max, p) => Math.max(max, getParticipantEndTime(engine, settings.stimulusId, p.id)),
          0
        )
  const plotWidthPx =
    ctx && ctx.itemWidth > 0
      ? calculatePlotWidthPx(ctx.itemWidth, DEFAULT_GRID_CONFIG)
      : undefined
  return getEvolvingMetricsData(engine, {
    ...settings,
    timelineMin: settings.timelineStart ?? 0,
    timelineMax,
    maxColumns: resolveColumnBudget(plotWidthPx),
  })
}

export function deriveEvolvingMetricsView(
  engine: DataEngine,
  settings: EvolvingMetricsSettings,
  ctx?: PlotViewContext
): PlotView {
  return {
    component: EvolvingMetricsPlotFigure,
    props: {
      data: computeEvolvingData(engine, settings, ctx),
      alignment: settings.presentation ?? 'heatmap',
      colorScale: settings.colorScale,
    },
  }
}
