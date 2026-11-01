import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { plotView, type PlotView, type PlotViewContext } from '$lib/plots/definePlot'
import { getParticipantsMaxEndTime } from '$lib/data/engine'
import { resolveColumnBudget } from '$lib/plots/shared/displayBudget'
import { calculatePlotWidthPx } from '$lib/plots/shared/plotSizeUtility'
import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid/const'
import { getAoiStreamPlotData } from '.'
import { aoiStreamKit } from './kit'
import type { AoiStreamPlotSettings } from '../types'

/**
 * The timeline window from settings alone: the timeline sync merges the group
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

/**
 * True while the timeline is fully auto (no global end, no per-stimulus
 * limits): only then does it join the timeline sync.
 */
export function isAutoTimeline(settings: AoiStreamPlotSettings): boolean {
  const limits = settings.absoluteStimuliLimits?.[settings.stimulusId]
  return (
    (settings.timelineEnd ?? 0) === 0 && (limits?.[0] ?? 0) === 0 && (limits?.[1] ?? 0) === 0
  )
}

/** What an AOI Timeline draws, screen and export; `ctx.itemWidth` drives the display budget. */
export function aoiStreamInput(
  engine: DataEngine,
  settings: AoiStreamPlotSettings,
  ctx?: PlotViewContext
) {
  const { min, max } = resolveTimeline(engine, settings)
  const plotWidthPx =
    ctx && ctx.itemWidth > 0 ? calculatePlotWidthPx(ctx.itemWidth, DEFAULT_GRID_CONFIG) : undefined
  const data = getAoiStreamPlotData(engine, {
    ...settings,
    timelineMin: min,
    timelineMax: max,
    maxColumns: resolveColumnBudget(plotWidthPx),
  })
  return {
    data,
    settings,
    /** Heatmap gradient `[min, max]` of this stimulus; `max === 0` means auto (data max). */
    colorValueRange: settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0],
  }
}

/** Plus what the platform overlays: `highlights` (`view.viewOnly`) and the ridgeline sync's mTop. */
export type AoiStreamInput = ReturnType<typeof aoiStreamInput> & {
  highlights?: readonly string[]
  syncedMTopOverride?: number | null
}
export type AoiStreamView = PlotView<AoiStreamInput>

export const deriveAoiStreamView = (
  engine: DataEngine,
  settings: AoiStreamPlotSettings,
  ctx?: PlotViewContext
): AoiStreamView => plotView(aoiStreamKit, aoiStreamInput(engine, settings, ctx))
