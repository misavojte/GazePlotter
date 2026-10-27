/**
 * THE PLAYBACK CLOCK: one shared playhead per stimulus.
 *
 * Scanpath plots are the PLAYERS: each joins the clock of its stimulus with
 * its own play span and trail length, and every player of that stimulus
 * shows the same moment (participants in lockstep). Time-axis plots of the
 * stimulus (scarf in absolute mode, AOI Timeline, Evolving Metrics) are
 * READERS through their plot cursor port (see `plotCursor.svelte.ts`): while
 * the clock plays, its time joins the port's time channel, so they draw it
 * with their usual time guide. They never move it: playback is not an
 * undoable command, so a click on a plot must not change it. The port's time
 * scope gates them exactly like the hover cursor.
 *
 * Time is recording ms from the participant's first sample on the stimulus,
 * the same basis as the cursor's time channel. A reference video is slaved
 * to the clock: while the playhead is inside the video's span the video
 * plays and IS the clock (its frames and the fixations never drift); outside
 * it the clock runs on animation frames. `StimulusMedia.startOffset` maps
 * one onto the other.
 *
 * A player may opt out of the shared clock: it then gets a private clock
 * nobody else reads. Private and shared clocks of one stimulus share its
 * single video element, so starting one pauses whichever other clock holds
 * the element.
 */
import { SvelteMap } from 'svelte/reactivity'
import { sessionScoped } from '$lib/session/context'

export type PlaybackSpan = { start: number; end: number }

type Player = {
  span: PlaybackSpan
  /** Playback rate relative to recording time (1 = real time). */
  speed: number
}

type VideoBinding = { el: HTMLVideoElement; offset: number }

export class PlaybackClock {
  /** Playhead in recording ms; null = parked, every player shows all. */
  time = $state<number | null>(null)
  playing = $state(false)
  /** Repaint signal: bumps on every tick and when a seeked video frame is decoded. */
  frame = $state(0)
  /** The player that last played or seeked: its speed is the clock's. */
  driver = $state<number | null>(null)
  readonly players = new SvelteMap<number, Player>()

  private videos = new Map<number, VideoBinding>()
  private raf = 0
  private lastAt = 0
  /** The video refused to play (autoplay policy): don't retry every frame. */
  private videoBlocked = false
  private readonly owner: PlaybackClocks

  constructor(owner: PlaybackClocks) {
    this.owner = owner
  }

  /** The union of the players' spans (a player with nothing to play, such
      as one showing a placeholder, adds nothing). */
  get span(): PlaybackSpan {
    let start = Infinity
    let end = -Infinity
    for (const p of this.players.values()) {
      if (!(p.span.end > p.span.start)) continue
      if (p.span.start < start) start = p.span.start
      if (p.span.end > end) end = p.span.end
    }
    return Number.isFinite(start) && end > start ? { start, end } : { start: 0, end: 0 }
  }

  /** The driver's speed, else the first player's. */
  get speed(): number {
    const driven = this.driver !== null ? this.players.get(this.driver) : undefined
    return (driven ?? this.players.values().next().value)?.speed ?? 1
  }

  /** The bound video, if any (every binding of one clock is the same element). */
  get video(): VideoBinding | null {
    return this.videos.values().next().value ?? null
  }

  bindVideo(plotId: number, el: HTMLVideoElement | null, offset: number): void {
    const before = this.video?.el
    if (el) this.videos.set(plotId, { el, offset })
    else this.videos.delete(plotId)
    const after = this.video?.el
    if (before && before !== after) {
      before.removeEventListener('seeked', this.onVideoSeeked)
      // Only this clock's own run: another clock may be playing the element.
      if (this.playing && !before.paused) before.pause()
    }
    if (after && after !== before) {
      after.addEventListener('seeked', this.onVideoSeeked)
      after.playbackRate = this.speed
      // A paused playhead shows its frame on the new element too.
      if (this.time !== null) this.parkVideo(this.time)
    }
  }

  private onVideoSeeked = () => {
    this.frame++
  }

  play(plotId: number | null = this.driver): void {
    const { start, end } = this.span
    if (end <= start) return
    if (plotId !== null) this.driver = plotId
    // From the top when parked or at the end.
    if (this.time === null || this.time >= end - 1 || this.time < start) {
      this.time = start
    }
    this.owner.claim(this)
    this.playing = true
    this.videoBlocked = false
    this.lastAt = performance.now()
    this.stopTicking()
    this.raf = requestAnimationFrame(this.tick)
    this.frame++
  }

  /** Only a running clock holds a frame request (none exists outside a browser). */
  private stopTicking(): void {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  pause(): void {
    this.playing = false
    this.stopTicking()
    const v = this.video
    if (v && !v.el.paused) v.el.pause()
    this.frame++
  }

  toggle(plotId: number | null): void {
    if (this.playing) this.pause()
    else this.play(plotId)
  }

  /** Move the playhead (clamped to the span); keeps playing if it was. */
  seek(time: number, plotId: number | null = null): void {
    const { start, end } = this.span
    const t = Math.min(Math.max(time, start), Math.max(start, end))
    if (plotId !== null) this.driver = plotId
    this.time = t
    this.lastAt = performance.now()
    const v = this.video
    if (v) {
      if (this.playing) this.syncVideo(v, t, true)
      else this.parkVideo(t)
    }
    this.frame++
  }

  /** Stop and park on the full picture. */
  reset(): void {
    this.pause()
    this.time = null
    this.frame++
  }

  join(plotId: number, player: Player): void {
    this.players.set(plotId, player)
    // A shrunken span must not strand the playhead outside it.
    if (this.time !== null) {
      const { start, end } = this.span
      if (this.time > end || this.time < start) this.seek(this.time)
    }
  }

  leave(plotId: number): void {
    this.players.delete(plotId)
    this.bindVideo(plotId, null, 0)
    if (this.driver === plotId) this.driver = null
    if (this.players.size === 0) this.reset()
  }

  dispose(): void {
    this.reset()
    for (const id of [...this.videos.keys()]) this.bindVideo(id, null, 0)
  }

  private tick = (now: number) => {
    if (!this.playing || this.time === null) return
    const dt = now - this.lastAt
    this.lastAt = now
    const { end } = this.span
    const v = this.video
    if (v && v.el.playbackRate !== this.speed) v.el.playbackRate = this.speed
    const videoRunning = v && !v.el.paused && !v.el.seeking && v.el.readyState >= 2
    let t = videoRunning ? v.el.currentTime * 1000 + v.offset : this.time + dt * this.speed
    // A video still decoding its first frame after the seek holds the clock.
    if (v && !v.el.paused && !videoRunning) t = this.time
    if (v) this.syncVideo(v, t, false)
    if (t >= end) {
      // Hold the last frame; the bar's reset returns to the full picture.
      this.raf = 0
      this.time = end
      this.pause()
      return
    }
    this.time = t
    this.frame++
    this.raf = requestAnimationFrame(this.tick)
  }

  /** Inside the video's span the video plays (and leads); outside, it rests. */
  private syncVideo(v: VideoBinding, t: number, force: boolean): void {
    const durationMs = Number.isFinite(v.el.duration) ? v.el.duration * 1000 : 0
    const local = t - v.offset
    const inside = local >= 0 && local < durationMs
    if (!inside) {
      if (!v.el.paused) v.el.pause()
      if (force) this.parkVideo(t)
      return
    }
    if (force || v.el.paused) {
      if (force || Math.abs(v.el.currentTime * 1000 - local) > 50) {
        v.el.currentTime = local / 1000
      }
      if (v.el.paused && !this.videoBlocked) {
        v.el.playbackRate = this.speed
        v.el.play().catch(() => {
          this.videoBlocked = true
        })
      }
    }
  }

  /** Show the frame for `t` on a paused element (edge frames outside its span). */
  private parkVideo(t: number): void {
    const v = this.video
    if (!v) return
    if (!v.el.paused) v.el.pause()
    const durationMs = Number.isFinite(v.el.duration) ? v.el.duration * 1000 : 0
    const local = Math.min(Math.max(t - v.offset, 0), Math.max(0, durationMs - 1))
    v.el.currentTime = Math.max(local / 1000, 0.001)
  }
}

/** Every clock of a session: one shared per stimulus, plus private ones. */
export class PlaybackClocks {
  private clocks = new SvelteMap<string, PlaybackClock>()

  static sharedKey(stimulusId: number): string {
    return `stimulus:${stimulusId}`
  }

  static privateKey(plotId: number): string {
    return `plot:${plotId}`
  }

  /** The clock for `key`, created on first use. */
  clock(key: string): PlaybackClock {
    let c = this.clocks.get(key)
    if (!c) {
      c = new PlaybackClock(this)
      this.clocks.set(key, c)
    }
    return c
  }

  /** Drop a player; the clock goes with its last player. */
  leave(key: string, plotId: number): void {
    const c = this.clocks.get(key)
    if (!c) return
    c.leave(plotId)
    if (c.players.size === 0) {
      c.dispose()
      this.clocks.delete(key)
    }
  }

  /** The shared clock of a stimulus, only while a player has something to play. */
  shared(stimulusId: number): PlaybackClock | null {
    const c = this.clocks.get(PlaybackClocks.sharedKey(stimulusId))
    if (!c) return null
    const { start, end } = c.span
    return end > start ? c : null
  }

  /** The shared clock's time while it PLAYS; null when paused, parked or absent. */
  playingTime(stimulusId: number): number | null {
    const c = this.shared(stimulusId)
    return c?.playing && c.time !== null ? c.time : null
  }

  /** A clock starting playback pauses any other clock using the same video. */
  claim(clock: PlaybackClock): void {
    for (const other of this.clocks.values()) {
      if (other !== clock && other.playing && sharesVideo(other, clock)) other.pause()
    }
  }
}

function sharesVideo(a: PlaybackClock, b: PlaybackClock): boolean {
  const el = a.video?.el
  return !!el && el === b.video?.el
}

/** This session's clocks; resolve at component init. */
export const usePlaybackClocks = sessionScoped(() => new PlaybackClocks())
