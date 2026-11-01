/**
 * A PLAYER's end of the playback clock (playbackClock.svelte.ts), for plots
 * that declare `playback` (Scanpath, Fixation Heatmap): the clock membership
 * the platform holds (`plotHost.svelte.ts`), and the shell-side state (span,
 * rest time, video binding) that `components/PlaybackFigure.svelte` hands its
 * kit. The pane fields live in playbackFields.ts, so plot definitions import
 * no clock code. Export has no clock: it draws the moment saved with the plot
 * (`playTime`), else the rest the screen parks at.
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
  /** Save a paused clock's moment with every plot on it (one undo step); a parked one saves none. */
  commitTime: () => void
}

/**
 * Host side: membership of the stimulus's shared clock (or a private
 * one). Joined at once with an empty span, as a memberless clock is dropped
 * before its player joins with its real one. Only the key drives the effect.
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

  function commitTime() {
    const c = clock
    if (!c || c.playing) return
    const moment = c.moment
    if ([...c.players.values()].every(p => (p.saved ?? null) === moment)) return
    ctx.workspace.updateItemsSettings(
      [...c.players.keys()],
      { playTime: moment ?? undefined },
      createCommandSourcePlotPattern(ctx.item, 'plot')
    )
  }

  // A pause (button, Space, the end, another clock taking the video) saves the
  // moment, once per clock: by the player that drove it, else the first.
  let wasPlaying = false
  $effect(() => {
    const c = clock
    const playing = c?.playing ?? false
    untrack(() => {
      if (c && wasPlaying && !playing && (c.driver ?? c.players.keys().next().value) === plotId) commitTime()
      wasPlaying = playing
    })
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
    commitTime,
  }
}

/**
 * Shell side: the player's span, rest time and video binding on its clock.
 * `playTime` null shows everything: an image's idle state. A video idles at its
 * first full trail, so the frame and the fixations agree. Without a clock
 * (export) the plot shows the saved moment, else that same rest.
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
  /** The moment saved with the plot; restores the clock, and is what export draws. */
  savedTime: () => number | null
}) {
  const videoElement = $derived(
    opts.media()?.kind === 'video' && opts.mediaElement() instanceof HTMLVideoElement
      ? (opts.mediaElement() as HTMLVideoElement)
      : null
  )
  const videoOffset = $derived(opts.media()?.startOffset ?? 0)
  const clock = $derived(opts.playback()?.clock ?? null)
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

  const playTime = $derived(clock ? clock.time : (opts.savedTime() ?? rest))

  // Untracked writes: joining reads the clock's span, which must not re-run us.
  $effect(() => {
    const c = clock
    const playback = opts.playback()
    if (!c || !playback) return
    const player = { span: ownSpan, speed: opts.speed(), rest, saved: opts.savedTime() }
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
  }
}
