import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { plotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
import { usePlaybackMembership } from '$lib/plots/shared/playback.svelte'
import type { ScanpathPlotSettings } from '../types'

/**
 * Screen recipe: the PLOT CURSOR, time-scoped to the stimulus, and the
 * PLAYBACK CLOCK membership. Export gets neither and draws every fixation.
 */
export const scanpathScreen: PlotScreenFactory<ScanpathPlotSettings> = ctx => {
  const plotCursor = plotCursorPort(ctx.item.id, {
    timeScope: () => ctx.item.settings.stimulusId,
    stimulus: () => ctx.item.settings.stimulusId,
  })
  const playback = usePlaybackMembership(ctx)
  return { props: () => ({ plotCursor, playback }) }
}
