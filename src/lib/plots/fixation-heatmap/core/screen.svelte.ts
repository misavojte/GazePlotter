import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { plotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
import { usePlotSync } from '$lib/plots/shared/PlotSyncRegistry.svelte'
import { fixationHeatmapColorSync } from './sync.svelte'
import type { FixationHeatmapViewMeta } from './view'
import type { FixationHeatmapPlotSettings } from '../types'

/** Screen recipe: the PLOT CURSOR and color-scale sync (export renders the unsynced view). */
export const fixationHeatmapScreen: PlotScreenFactory<FixationHeatmapPlotSettings> = ctx => {
  const plotCursor = plotCursorPort(ctx.item.id)
  const colorSync = fixationHeatmapColorSync()

  usePlotSync(
    colorSync,
    () => ctx.item.id,
    () => {
      const meta = (ctx.view()?.meta ?? null) as FixationHeatmapViewMeta | null
      if (!meta) return null
      return { groupKey: meta.syncGroupKey, w: ctx.item.w, h: ctx.item.h, dataMax: meta.ownScaleTop }
    }
  )

  return {
    props: view => {
      const meta = view.meta as FixationHeatmapViewMeta | undefined
      if (!meta) return { plotCursor }
      const synced = colorSync.getSyncedMax(meta.syncGroupKey, ctx.item.w, ctx.item.h)
      return synced > meta.ownScaleTop ? { plotCursor, scaleTop: synced } : { plotCursor }
    },
  }
}
