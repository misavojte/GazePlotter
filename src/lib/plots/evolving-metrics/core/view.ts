import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { plotView, type PlotViewContext } from '$lib/plots/definePlot'
import { getParticipantsMaxEndTime } from '$lib/data/engine'
import { resolveColumnBudget } from '$lib/plots/shared/displayBudget'
import { calculatePlotWidthPx } from '$lib/plots/shared/plotSizeUtility'
import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid/const'
import { evolvingMetricsKit } from './kit'
import { getEvolvingMetricsData } from '.'
import type { EvolvingMetricsSettings } from '../types'

/**
 * What a Metric Timeline draws, screen and export. The display budget comes
 * from the plot's on-screen width (`ctx.itemWidth`), so only ~one window per
 * pixel is evaluated and drawn.
 */
export function evolvingMetricsInput(
  engine: DataEngine,
  settings: EvolvingMetricsSettings,
  ctx?: PlotViewContext
) {
  const timelineMax =
    (settings.timelineEnd ?? 0) > 0
      ? settings.timelineEnd!
      : getParticipantsMaxEndTime(engine, settings, settings.stimulusId)
  const plotWidthPx =
    ctx && ctx.itemWidth > 0 ? calculatePlotWidthPx(ctx.itemWidth, DEFAULT_GRID_CONFIG) : undefined
  const data = getEvolvingMetricsData(engine, {
    ...settings,
    timelineMin: settings.timelineStart ?? 0,
    timelineMax,
    maxColumns: resolveColumnBudget(plotWidthPx),
  })
  return { data, settings }
}

export type EvolvingMetricsInput = ReturnType<typeof evolvingMetricsInput>

export const deriveEvolvingMetricsView = (
  engine: DataEngine,
  settings: EvolvingMetricsSettings,
  ctx?: PlotViewContext
) => plotView(evolvingMetricsKit, evolvingMetricsInput(engine, settings, ctx))
