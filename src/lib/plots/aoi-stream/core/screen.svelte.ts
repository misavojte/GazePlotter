import type { PlotScreenFactory, PlotView } from '$lib/plots/definePlot'
import { usePlotSync } from '$lib/plots/shared/PlotSyncRegistry.svelte'
import {
  getParticipants,
  getParticipantEndTime,
} from '$lib/data/engine'
import { toggleInArray } from '$lib/plots/shared'
import { plotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
import { computeMTop } from './ridgeline'
import {
  aoiStreamTimelineSync,
  aoiStreamRidgelineSync,
} from './sync.svelte'
import { RIDGELINE_SCALE } from '../const'
import type { AoiStreamPlotResult, AoiStreamPlotSettings } from '../types'

/**
 * Screen recipe: cross-plot timeline sync (same width, fully-auto timeline),
 * ridgeline data-scale sync (same height, scale, series count), the shared PLOT
 * CURSOR and legend highlight toggling. Export renders the raw view — no sync,
 * no cursor, no handlers.
 */
export const aoiStreamScreen: PlotScreenFactory<AoiStreamPlotSettings> = ctx => {
  // x is always absolute ms here, in all four alignments. Retract on destroy: a
  // plot removed under the pointer gets no `mouseleave`.
  const plotCursor = plotCursorPort(ctx.item.id, () => ctx.item.settings.stimulusId)

  // A plot participates in timeline sync only while its timeline is fully
  // auto: no global `timelineEnd` and no per-stimulus limits.
  const isFullyAuto = $derived.by(() => {
    const s = ctx.item.settings
    const limits = s.absoluteStimuliLimits?.[s.stimulusId]
    return (
      (s.timelineEnd ?? 0) === 0 &&
      (limits?.[0] ?? 0) === 0 &&
      (limits?.[1] ?? 0) === 0
    )
  })

  const ownDataMax = $derived.by(() => {
    void ctx.item.redrawTimestamp
    if (!isFullyAuto) return 0
    const s = ctx.item.settings
    let max = 0
    for (const p of getParticipants(ctx.engine, s.groupId, s.stimulusId)) {
      const v = getParticipantEndTime(ctx.engine, s.stimulusId, p.id)
      if (v > max) max = v
    }
    return max
  })

  const timelineSync = aoiStreamTimelineSync()
  const ridgelineSync = aoiStreamRidgelineSync()

  usePlotSync(
    timelineSync,
    () => ctx.item.id,
    () => {
      if (!isFullyAuto || ownDataMax <= 0) return null
      return { w: ctx.item.w, dataMax: ownDataMax }
    }
  )

  // Ridgeline mTop sync: registered from the plot's OWN result; the synced
  // value affects strip rendering only, never the transform (no feedback loop).
  const resultOf = (view: PlotView) => view.props.data as AoiStreamPlotResult
  const scaleOf = () => ctx.item.settings.ridgelineScale ?? RIDGELINE_SCALE
  const ownMTopOf = (view: PlotView): number | null => {
    if (ctx.item.settings.alignment !== 'ridgeline') return null
    const result = resultOf(view)
    if (!result || result.noMetric || result.series.length === 0) return null
    return computeMTop(result, true)
  }

  usePlotSync(
    ridgelineSync,
    () => ctx.item.id,
    () => {
      const view = ctx.view()
      if (!view) return null
      const mTop = ownMTopOf(view)
      if (mTop === null) return null
      return {
        h: ctx.item.h,
        scale: scaleOf(),
        seriesCount: resultOf(view).series.length,
        dataMax: mTop,
      }
    }
  )

  const handleLegendClick = (aoiId: number) => {
    ctx.workspace.updateItemSettings(
      ctx.item.id,
      {
        highlights: toggleInArray(
          ctx.item.settings.highlights ?? [],
          aoiId.toString()
        ),
      },
      createCommandSourcePlotPattern(ctx.item, 'plot')
    )
  }

  return {
    // Screen settings: the synced timeline max merged in. Export derives from
    // the raw item settings and therefore never syncs.
    settings: () => {
      const s = ctx.item.settings
      if (!isFullyAuto) return s
      const syncedMax = timelineSync.getSyncedMax(ctx.item.w)
      if (syncedMax <= ownDataMax) return s
      return { ...s, timelineEnd: syncedMax }
    },
    props: view => {
      const mTop = ownMTopOf(view)
      let syncedMTopOverride: number | null = null
      if (mTop !== null) {
        const synced = ridgelineSync.getSyncedMTop(
          ctx.item.h,
          scaleOf(),
          resultOf(view).series.length
        )
        syncedMTopOverride = synced > mTop ? synced : null
      }
      return {
        highlights: ctx.item.settings.highlights ?? [],
        onLegendClick: handleLegendClick,
        syncedMTopOverride,
        plotCursor,
      }
    },
  }
}
