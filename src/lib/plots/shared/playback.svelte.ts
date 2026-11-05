/**
 * A PLAYER's end of the playback clock (playbackClock.svelte.ts), for plots
 * that declare `playback` (Scanpath, Fixation Heatmap): the clock
 * the platform holds (`plotHost.svelte.ts`), and the shell-side state (span,
 * rest time, video binding) that `components/PlaybackFigure.svelte` hands its
 * kit. The pane fields live in playbackFields.ts, so plot definitions import
 * no clock code. Export has no clock: it draws the moment saved with the plot
 * (`playTime`), else the rest the screen parks at.
 */
import { untrack } from 'svelte'
import type { StimulusMedia } from '$lib/data/types'
import type { PlotItemContract } from '$lib/plots/definePlot'
import { getGazePlotterSession } from '$lib/session/context'
import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
import type { WorkspaceCommandBus } from '$lib/workspace/commands/bus'
import { usePlaybackClocks, type PlaybackClock } from './playbackClock.svelte'
import type { PlaybackSettings } from './playbackFields'

export interface PlotPlayback {
  /** The plot's own clock. */
  readonly clock: PlaybackClock | null
  readonly plotId: number
  /** Play or pause; a plot of a multi-selection plays with the other selected players. */
  toggle: () => void
  /** A seek from the play bar; a playing run moves with it. */
  seek: (time: number) => void
  /** Persist a trail length dragged on the play bar (one undo step). */
  commitWindow: (ms: number) => void
  /** Save a paused clock's moment (one undo step); a parked one saves none. */
  commitTime: () => void
}

/** Host side: the plot's own clock, opened once for its lifetime. */
export function usePlaybackMembership(ctx: {
  readonly item: PlotItemContract<string, PlaybackSettings>
  workspace: WorkspaceCommandBus
}): PlotPlayback {
  const plotId = ctx.item.id
  const session = getGazePlotterSession()
  const clocks = usePlaybackClocks(session)

  // An effect, not at init: opening a clock writes the registry.
  let clock = $state<PlaybackClock | null>(null)
  $effect(() => {
    const c = untrack(() => clocks.open(plotId, () => ctx.item.settings.stimulusId))
    clock = c
    return () => {
      clock = null
      clocks.close(c)
    }
  })

  /** The other players of a multi-selection this plot belongs to. */
  function mates(): PlaybackClock[] {
    const ids = session.grid.selectedItemIds
    if (!ids.includes(plotId)) return []
    return ids.map(id => clocks.get(id)).filter((c): c is PlaybackClock => !!c && c !== clock)
  }

  /** The paused clocks' moments, in one undo step; a parked one saves none. */
  function save(cs: PlaybackClock[]) {
    const updates = cs
      .filter(c => clocks.get(c.plotId) === c && !c.playing && (c.player?.saved ?? null) !== c.moment)
      .map(c => ({ itemId: c.plotId, settings: { playTime: c.moment ?? undefined } }))
    if (updates.length === 0) return
    ctx.workspace.apply({
      type: 'updateSettings',
      updates,
      source: createCommandSourcePlotPattern(ctx.item, 'plot'),
    })
  }

  // A pause (button, Space, the end, another clock taking the video) saves the
  // moment. A run saves once, when its last clock stops: every member in one step.
  let wasPlaying = false
  $effect(() => {
    const c = clock
    const playing = c?.playing ?? false
    untrack(() => {
      if (c && wasPlaying && !playing) {
        const run = c.run
        const members = run ? run.clocks.filter(m => m.run === run) : [c]
        if (run && !run.saved && members.every(m => !m.playing)) {
          run.saved = true
          save(members)
        } else if (!run) save(members)
      }
      wasPlaying = playing
    })
  })

  return {
    get clock() {
      return clock
    },
    plotId,
    toggle: () => clock?.toggle(mates()),
    seek: t => clock?.scrub(t),
    commitWindow: ms =>
      ctx.workspace.updateItemSettings(
        plotId,
        { trailLength: ms },
        createCommandSourcePlotPattern(ctx.item, 'plot')
      ),
    commitTime: () => clock && save([clock]),
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
  const span = $derived.by(() => {
    if (!opts.hasData()) return { start: 0, end: 0 }
    const start = opts.timelineStart()
    const videoEnd = videoElement ? videoOffset + (videoElement.duration || 0) * 1000 : 0
    const end = opts.timelineEnd() || Math.max(opts.dataEnd(), videoEnd)
    return { start, end: Math.max(start, end) }
  })

  /** A video's idle time: the end of its first trail (All: the end). */
  const rest = $derived.by(() => {
    if (opts.media()?.kind !== 'video' || !(span.end > span.start)) return null
    const trail = opts.trailLength()
    return Math.min(span.end, trail > 0 ? span.start + trail : span.end)
  })

  const playTime = $derived(clock ? clock.time : (opts.savedTime() ?? rest))

  // Untracked writes: setting the player reads the clock's span, which must not re-run us.
  $effect(() => {
    const c = clock
    if (!c) return
    const player = { span: span, speed: opts.speed(), rest, saved: opts.savedTime() }
    untrack(() => c.setPlayer(player))
  })
  $effect(() => {
    const c = clock
    if (!c) return
    const el = videoElement
    const offset = videoOffset
    untrack(() => c.bindVideo(el, offset))
    return () => untrack(() => c.bindVideo(null, 0))
  })

  return {
    get videoElement() { return videoElement },
    get clock() { return clock },
    get playTime() { return playTime },
    get isPlaying() { return isPlaying },
    get span() { return span },
  }
}
