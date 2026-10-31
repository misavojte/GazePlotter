import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import {
  figureView,
  type FigureProps,
  type PlotView,
  type PlotViewContext,
} from '$lib/plots/definePlot'
import { getParticipantsMaxEndTime } from '$lib/data/engine'
import { resolveColumnBudget } from '$lib/plots/shared/displayBudget'
import { calculatePlotWidthPx } from '$lib/plots/shared/plotSizeUtility'
import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid/const'
import AoiStreamPlotFigure from '../components/AoiStreamPlotFigure.svelte'
import { getAoiStreamPlotData } from '.'
import type { AoiStreamPlotResult, AoiStreamPlotSettings } from '../types'

/**
 * The timeline window from settings alone: the screen recipe merges the synced
 * max into `timelineEnd` before deriving, so export never syncs.
 */
function resolveTimeline(
  engine: DataEngine,
  settings: AoiStreamPlotSettings
): { min: number; max: number } {
  const limits = settings.absoluteStimuliLimits[settings.stimulusId]
  const min = (settings.timelineStart ?? 0) > 0 ? settings.timelineStart! : (limits?.[0] ?? 0)

  if ((settings.timelineEnd ?? 0) > 0) return { min, max: settings.timelineEnd! }
  const absMax = limits?.[1] ?? 0
  if (absMax !== 0) return { min, max: absMax }
  return { min, max: getParticipantsMaxEndTime(engine, settings, settings.stimulusId) }
}

/** Shared data derivation; `ctx.itemWidth` drives the display budget. */
function computeAoiStreamData(
  engine: DataEngine,
  settings: AoiStreamPlotSettings,
  ctx?: PlotViewContext
): AoiStreamPlotResult {
  const { min, max } = resolveTimeline(engine, settings)
  const plotWidthPx =
    ctx && ctx.itemWidth > 0
      ? calculatePlotWidthPx(ctx.itemWidth, DEFAULT_GRID_CONFIG)
      : undefined
  return getAoiStreamPlotData(engine, {
    ...settings,
    timelineMin: min,
    timelineMax: max,
    maxColumns: resolveColumnBudget(plotWidthPx),
  })
}

export type AoiStreamView = PlotView<FigureProps<typeof AoiStreamPlotFigure>>

export function deriveAoiStreamView(
  engine: DataEngine,
  settings: AoiStreamPlotSettings,
  ctx?: PlotViewContext
): AoiStreamView {
  return figureView(AoiStreamPlotFigure, {
    data: computeAoiStreamData(engine, settings, ctx),
    alignment: settings.alignment ?? 'stream',
    highlights: settings.highlights ?? [],
    ridgelineScale: settings.ridgelineScale,
    colorScale: settings.colorScale,
    colorValueRange: settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0],
    belowMinColor: settings.belowMinColor,
    aboveMaxColor: settings.aboveMaxColor,
  })
}
