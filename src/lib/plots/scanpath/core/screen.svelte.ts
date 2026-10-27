import { untrack } from 'svelte'
import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { plotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
import {
  PlaybackClocks,
  usePlaybackClocks,
  type PlaybackClock,
} from '$lib/plots/shared/playbackClock.svelte'
import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
import type { ScanpathPlotSettings } from '../types'

/** The screen-only playback surface a scanpath figure drives. */
export interface ScanpathPlayback {
  /** The clock this plot plays on (the stimulus's shared one, or private). */
  readonly clock: PlaybackClock | null
  readonly plotId: number
  /** Persist a trail length dragged on the play bar (one undo step). */
  commitWindow: (ms: number) => void
}

/**
 * Screen recipe: the shared PLOT CURSOR (time-scoped to the stimulus, so a
 * fixation hover marks the time-axis plots and their hover marks this one)
 * and the PLAYBACK CLOCK membership. Export renders without either, so it
 * always draws the full parked scanpath.
 */
export const scanpathScreen: PlotScreenFactory<ScanpathPlotSettings> = ctx => {
  const plotId = ctx.item.id
  const plotCursor = plotCursorPort(plotId, () => ctx.item.settings.stimulusId)
  const clocks = usePlaybackClocks()

  const clockKey = $derived(
    ctx.item.settings.syncPlayback === false
      ? PlaybackClocks.privateKey(plotId)
      : PlaybackClocks.sharedKey(ctx.item.settings.stimulusId)
  )

  // Created in an effect, never a derived: making a clock writes the registry.
  // Joined at once with an empty span, so the clock is never memberless (a
  // memberless clock is dropped) before the figure joins with its real span.
  // Leaving happens here, so a stimulus switch or the sync toggle moves the
  // plot between clocks cleanly. Untracked: only the key drives this.
  let clock = $state<PlaybackClock | null>(null)
  $effect(() => {
    const key = clockKey
    untrack(() => {
      const c = clocks.clock(key)
      if (!c.players.has(plotId)) c.join(plotId, { span: { start: 0, end: 0 }, speed: 1 })
      clock = c
    })
    return () => {
      clock = null
      clocks.leave(key, plotId)
    }
  })

  const playback: ScanpathPlayback = {
    get clock() {
      return clock
    },
    plotId,
    commitWindow(ms) {
      ctx.workspace.updateItemSettings(
        plotId,
        { playbackWindow: ms },
        createCommandSourcePlotPattern(ctx.item, 'plot')
      )
    },
  }

  return { props: () => ({ plotCursor, playback }) }
}
