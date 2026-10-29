import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { plotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
import { useSyncedMax } from '$lib/plots/shared/plotSync.svelte'
import type { FixationHeatmapViewMeta } from './view'
import type { FixationHeatmapPlotSettings } from '../types'

/**
 * Screen recipe: the PLOT CURSOR and color-scale sync. Auto-scaled maps of the
 * same measure (accumulate, normalization, R, color scale) and grid footprint
 * share the largest scale top, so their colors compare; a set Scale max opts a
 * plot out (its view carries no meta). Export renders the unsynced view.
 */
export const fixationHeatmapScreen: PlotScreenFactory<FixationHeatmapPlotSettings> = ctx => {
  // A cell's set is "who looked HERE", meaningless on another stimulus.
  const plotCursor = plotCursorPort(ctx.item.id, {
    stimulus: () => ctx.item.settings.stimulusId,
    publishes: 'stimulus',
  })
  const syncedTop = useSyncedMax(ctx, 'fixation-heatmap-color', () => {
    const meta = ctx.view()?.meta as FixationHeatmapViewMeta | undefined
    return meta ? { key: [meta.syncGroupKey, ctx.item.w, ctx.item.h], own: meta.ownScaleTop } : null
  })

  return {
    props: () => {
      const top = syncedTop()
      return top === null ? { plotCursor } : { plotCursor, scaleTop: top }
    },
  }
}
