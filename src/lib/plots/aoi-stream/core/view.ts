import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView, PlotViewContext } from '$lib/plots/definePlot'
import { getParticipants, getParticipantEndTime } from '$lib/data/engine'
import { resolveColumnBudget } from '$lib/plots/shared/displayBudget'
import { calculatePlotWidthPx } from '$lib/plots/shared/plotSizeUtility'
import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid/const'
import AoiStreamPlotFigure from '../components/AoiStreamPlotFigure.svelte'
import { getAoiStreamPlotData } from '.'
import type { AoiStreamPlotResult, AoiStreamPlotSettings } from '../types'

/**
 * Resolve the timeline window from settings alone. Cross-plot timeline sync
 * is the container's concern: the on-screen container merges the synced max
 * into `timelineEnd` before deriving (via `aoiStreamTimelineSync`), so this
 * function — and therefore the export view — is a pure function of
 * (engine, settings). Export never syncs, like bar/transition-matrix.
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

  const max = getParticipants(engine, settings.groupId, settings.stimulusId).reduce(
    (m, p) => Math.max(m, getParticipantEndTime(engine, settings.stimulusId, p.id)),
    0
  )
  return { min, max }
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

export function deriveAoiStreamView(
  engine: DataEngine,
  settings: AoiStreamPlotSettings,
  ctx?: PlotViewContext
): PlotView {
  return {
    component: AoiStreamPlotFigure,
    props: {
      data: computeAoiStreamData(engine, settings, ctx),
      alignment: settings.alignment ?? 'stream',
      highlights: settings.highlights ?? [],
      ridgelineScale: settings.ridgelineScale,
      colorScale: settings.colorScale,
    },
  }
}
