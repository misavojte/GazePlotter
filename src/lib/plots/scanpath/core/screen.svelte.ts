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

export interface ScanpathPlayback {
  /** The stimulus's shared clock, or a private one. */
  readonly clock: PlaybackClock | null
  readonly plotId: number
  /** Persist a trail length dragged on the play bar (one undo step). */
  commitWindow: (ms: number) => void
}

/**
 * Screen recipe: the PLOT CURSOR, time-scoped to the stimulus, and the
 * PLAYBACK CLOCK membership. Export gets neither and draws every fixation.
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

  // An effect, not a derived: making a clock writes the registry. Joined at
  // once with an empty span, as a memberless clock is dropped before the
  // figure joins with its real one. Only the key drives this.
  let clock = $state<PlaybackClock | null>(null)
  $effect(() => {
    const key = clockKey
    untrack(() => {
      clock = clocks.clock(key)
      if (!clock.players.has(plotId)) clock.join(plotId, { span: { start: 0, end: 0 }, speed: 1 })
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
    commitWindow: ms =>
      ctx.workspace.updateItemSettings(
        plotId,
        { trailLength: ms },
        createCommandSourcePlotPattern(ctx.item, 'plot')
      ),
  }

  return { props: () => ({ plotCursor, playback }) }
}
