import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView, PlotViewContext } from '$lib/plots/definePlot'
import { getParticipants, getParticipantEndTime } from '$lib/data/engine'
import AoiStreamPlotFigure from '../components/AoiStreamPlotFigure.svelte'
import { getAoiStreamPlotData } from '.'
import { scanForSynchronizedTimelineMax } from '../sync'
import type { AoiStreamPlotResult, AoiStreamPlotSettings } from '../types'

/**
 * Resolve the timeline window. The max can come from the cross-plot sync scan
 * (when fully auto and host `ctx` is provided), which is why aoi-stream's view
 * depends on host context, not just (engine, settings).
 */
function resolveTimeline(
  engine: DataEngine,
  settings: AoiStreamPlotSettings,
  ctx?: PlotViewContext
): { min: number; max: number } {
  const limits = settings.absoluteStimuliLimits[settings.stimulusId]
  const min = (settings.timelineStart ?? 0) > 0 ? settings.timelineStart! : (limits?.[0] ?? 0)

  if ((settings.timelineEnd ?? 0) > 0) return { min, max: settings.timelineEnd! }
  const absMax = limits?.[1] ?? 0
  if (absMax !== 0) return { min, max: absMax }

  if (ctx) {
    const synced = scanForSynchronizedTimelineMax(
      engine,
      ctx.gridItems as Parameters<typeof scanForSynchronizedTimelineMax>[1],
      ctx.itemWidth,
      settings.stimulusId,
      settings.absoluteStimuliLimits
    )
    if (synced !== null) return { min, max: synced }
  }

  const max = getParticipants(engine, settings.groupId, settings.stimulusId).reduce(
    (m, p) => Math.max(m, getParticipantEndTime(engine, settings.stimulusId, p.id)),
    0
  )
  return { min, max }
}

/**
 * Approximate on-screen pixels per grid unit, used to size the display budget
 * (windows worth evaluating). Matches `DEFAULT_GRID_CONFIG` (cell 40 + gap 10);
 * `ctx.itemWidth` is in grid units. A window finer than a pixel can't be shown,
 * so this caps how many windows are computed. It errs slightly high (no margin
 * subtraction) to avoid ever under-sampling visible detail.
 */
const PX_PER_GRID_UNIT = 50

/** Shared data derivation (cross-plot-sync aware via `ctx`). */
export function computeAoiStreamData(
  engine: DataEngine,
  settings: AoiStreamPlotSettings,
  ctx?: PlotViewContext
): AoiStreamPlotResult {
  const { min, max } = resolveTimeline(engine, settings, ctx)
  const maxColumns =
    ctx && ctx.itemWidth > 0
      ? Math.min(2048, Math.max(256, Math.round(ctx.itemWidth * PX_PER_GRID_UNIT)))
      : undefined
  return getAoiStreamPlotData(engine, {
    ...settings,
    timelineMin: min,
    timelineMax: max,
    ...(maxColumns !== undefined ? { maxColumns } : {}),
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
