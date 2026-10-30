import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { plotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
import { useSyncedMax } from '$lib/plots/shared/plotSync.svelte'
import { usePlaybackMembership } from '$lib/plots/shared/playback.svelte'
import type { FixationHeatmapView } from './view'
import type { FixationHeatmapPlotSettings } from '../types'

/**
 * Screen recipe: the PLOT CURSOR, color-scale sync and the PLAYBACK CLOCK
 * membership. Auto-scaled maps of the same measure (accumulate, normalization,
 * R, color scale) and grid footprint share the largest scale top, so their
 * colors compare; a set Scale max opts a plot out (its view carries no meta).
 * Export renders the unsynced, parked view.
 */
export const fixationHeatmapScreen: PlotScreenFactory<
  FixationHeatmapPlotSettings,
  FixationHeatmapView
> = ctx => {
  // A cell's set is "who looked HERE", meaningless on another stimulus. The
  // play bar's rail publishes times, scoped to the stimulus like the scanpath's.
  const plotCursor = plotCursorPort(ctx.item.id, {
    timeScope: () => ctx.item.settings.stimulusId,
    stimulus: () => ctx.item.settings.stimulusId,
    publishes: 'stimulus',
  })
  const syncedTop = useSyncedMax(ctx, 'fixation-heatmap-color', () => {
    const meta = ctx.view()?.meta
    return meta ? { key: [meta.syncGroupKey, ctx.item.w, ctx.item.h], own: meta.ownScaleTop } : null
  })
  const playback = usePlaybackMembership(ctx)

  return {
    props: () => {
      const top = syncedTop()
      return top === null ? { plotCursor, playback } : { plotCursor, playback, scaleTop: top }
    },
  }
}
