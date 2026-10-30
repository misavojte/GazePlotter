/**
 * A PLAYER's end of the playback clock (playbackClock.svelte.ts), shared by
 * the stimulus-space figures (Scanpath, Fixation Heatmap): the clock
 * membership a screen recipe holds, and the figure-side state (span, rest
 * time, video binding). The pane fields live in playbackFields.ts, so plot
 * definitions import no clock code. Export has no clock and draws everything.
 */
import { untrack } from 'svelte'
import type { StimulusMedia } from '$lib/data/types'
import type { PlotItemContract } from '$lib/plots/definePlot'
import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
import type { WorkspaceCommandBus } from '$lib/workspace/commands/bus'
import { PlaybackClocks, usePlaybackClocks, type PlaybackClock } from './playbackClock.svelte'
import type { PlaybackSettings } from './playbackFields'

export interface PlotPlayback {
  /** The stimulus's shared clock, or a private one. */
  readonly clock: PlaybackClock | null
  readonly plotId: number
  /** Persist a trail length dragged on the play bar (one undo step). */
  commitWindow: (ms: number) => void
}

/**
 * Screen-recipe side: membership of the stimulus's shared clock (or a private
 * one). Joined at once with an empty span, as a memberless clock is dropped
 * before the figure joins with its real one. Only the key drives the effect.
 */
export function usePlaybackMembership(ctx: {
  readonly item: PlotItemContract<string, PlaybackSettings>
  workspace: WorkspaceCommandBus
}): PlotPlayback {
  const plotId = ctx.item.id
  const clocks = usePlaybackClocks()
  const clockKey = $derived(
    ctx.item.settings.syncPlayback === false
      ? PlaybackClocks.privateKey(plotId)
      : PlaybackClocks.sharedKey(ctx.item.settings.stimulusId)
  )

  // An effect, not a derived: making a clock writes the registry.
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

  return {
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
}

/**
 * Figure side: the player's span, rest time and video binding on its clock.
 * `playTime` null shows everything: an image's idle state and exports. A video
 * idles at its first full trail, so the frame and the fixations agree.
 */
export function usePlayer(opts: {
  playback: () => PlotPlayback | null
  media: () => StimulusMedia | null
  mediaElement: () => HTMLImageElement | HTMLVideoElement | null
  hasData: () => boolean
  /** Recording-time end of the plot's data (the last fixation's end). */
  dataEnd: () => number
  timelineStart: () => number
  timelineEnd: () => number
  speed: () => number
  /** The committed trail length (ms); 0 = All. */
  trailLength: () => number
}) {
  const videoElement = $derived(
    opts.media()?.kind === 'video' && opts.mediaElement() instanceof HTMLVideoElement
      ? (opts.mediaElement() as HTMLVideoElement)
      : null
  )
  const videoOffset = $derived(opts.media()?.startOffset ?? 0)
  const clock = $derived(opts.playback()?.clock ?? null)
  const playTime = $derived(clock?.time ?? null)
  const isPlaying = $derived(clock?.playing ?? false)

  /** The time range, else 0 to the data's or the video's end. A ready video
      element already knows its duration. */
  const ownSpan = $derived.by(() => {
    if (!opts.hasData()) return { start: 0, end: 0 }
    const start = opts.timelineStart()
    const videoEnd = videoElement ? videoOffset + (videoElement.duration || 0) * 1000 : 0
    const end = opts.timelineEnd() || Math.max(opts.dataEnd(), videoEnd)
    return { start, end: Math.max(start, end) }
  })

  /** The clock's span (all players' union, so lockstep plots share a rail). */
  const span = $derived(clock?.span ?? ownSpan)

  /** A video's idle time: the end of its first trail (All: the end). */
  const rest = $derived.by(() => {
    if (opts.media()?.kind !== 'video' || !(ownSpan.end > ownSpan.start)) return null
    const trail = opts.trailLength()
    return Math.min(ownSpan.end, trail > 0 ? ownSpan.start + trail : ownSpan.end)
  })

  // Untracked writes: joining reads the clock's span, which must not re-run us.
  $effect(() => {
    const c = clock
    const playback = opts.playback()
    if (!c || !playback) return
    const player = { span: ownSpan, speed: opts.speed(), rest }
    untrack(() => c.join(playback.plotId, player))
  })
  $effect(() => {
    const c = clock
    const playback = opts.playback()
    if (!c || !playback) return
    const el = videoElement
    const offset = videoOffset
    untrack(() => c.bindVideo(playback.plotId, el, offset))
    return () => untrack(() => c.bindVideo(playback.plotId, null, 0))
  })

  return {
    get videoElement() { return videoElement },
    get clock() { return clock },
    get playTime() { return playTime },
    get isPlaying() { return isPlaying },
    get span() { return span },
    get spanMs() { return span.end - span.start },
  }
}
