/**
 * THE PLAYBACK CLOCK: one playhead per stimulus.
 *
 * Scanpath plots are PLAYERS: each joins its stimulus's clock with its play
 * span, so all of them show the same moment. Time-axis plots read the clock
 * through their plot cursor port: while it plays, its time joins the port's
 * time channel and they draw their usual time guide. They never move it, as
 * playback is not an undoable command.
 *
 * Time is recording ms, the cursor's basis. A reference video is slaved to
 * the clock: inside its span it plays and leads (frames never drift from the
 * fixations), outside it the clock runs on animation frames.
 *
 * A player can opt out into a private clock nobody reads. Clocks of one
 * stimulus share its video element, so starting one pauses the others.
 */
import { SvelteMap } from 'svelte/reactivity'
import { sessionScoped } from '$lib/session/context'

type Player = { span: { start: number; end: number }; speed: number }

type VideoBinding = { el: HTMLVideoElement; offset: number }

export class PlaybackClock {
  /** Recording ms; null = parked, players show everything. */
  time = $state<number | null>(null)
  playing = $state(false)
  /** Repaint signal: a seeked video frame was decoded. */
  frame = $state(0)
  /** The player that last played or seeked; its speed is the clock's. */
  driver = $state<number | null>(null)
  readonly players = new SvelteMap<number, Player>()

  /** Per player; all bindings of one clock are the same element. */
  private videos = new Map<number, VideoBinding>()
  private raf = 0
  private lastAt = 0
  /** play() was refused (autoplay policy): don't retry every frame. */
  private videoBlocked = false
  private readonly owner: PlaybackClocks

  constructor(owner: PlaybackClocks) {
    this.owner = owner
  }

  /** Union of the players' spans; an empty span (a placeholder) adds nothing. */
  get span(): { start: number; end: number } {
    let start = Infinity
    let end = -Infinity
    for (const { span } of this.players.values()) {
      if (!(span.end > span.start)) continue
      start = Math.min(start, span.start)
      end = Math.max(end, span.end)
    }
    return end > start ? { start, end } : { start: 0, end: 0 }
  }

  get speed(): number {
    const driven = this.driver !== null ? this.players.get(this.driver) : undefined
    return (driven ?? this.players.values().next().value)?.speed ?? 1
  }

  get video(): VideoBinding | null {
    return this.videos.values().next().value ?? null
  }

  join(plotId: number, player: Player): void {
    this.players.set(plotId, player)
    // A shrunken span must not strand the playhead outside it.
    const { start, end } = this.span
    if (this.time !== null && (this.time < start || this.time > end)) this.seek(this.time)
  }

  leave(plotId: number): void {
    this.players.delete(plotId)
    this.bindVideo(plotId, null, 0)
    if (this.driver === plotId) this.driver = null
    if (this.players.size === 0) this.reset()
  }

  bindVideo(plotId: number, el: HTMLVideoElement | null, offset: number): void {
    const before = this.video?.el
    if (el) this.videos.set(plotId, { el, offset })
    else this.videos.delete(plotId)
    const after = this.video?.el
    if (before === after) return
    if (before) {
      before.removeEventListener('seeked', this.onVideoSeeked)
      // Only our own run: another clock may be playing the element.
      if (this.playing) before.pause()
    }
    if (after) {
      after.addEventListener('seeked', this.onVideoSeeked)
      if (this.time !== null) this.parkVideo(this.time)
    }
  }

  private onVideoSeeked = () => {
    this.frame++
  }

  play(plotId: number | null): void {
    const { start, end } = this.span
    if (end <= start) return
    if (plotId !== null) this.driver = plotId
    if (this.time === null || this.time >= end - 1) this.time = start
    this.owner.claim(this)
    this.playing = true
    this.videoBlocked = false
    this.lastAt = performance.now()
    this.stopTicking()
    this.raf = requestAnimationFrame(this.tick)
  }

  pause(): void {
    // Only our own run: another clock may be playing the element.
    if (this.playing) this.video?.el.pause()
    this.playing = false
    this.stopTicking()
  }

  toggle(plotId: number | null): void {
    if (this.playing) this.pause()
    else this.play(plotId)
  }

  /** Clamped to the span; keeps playing if it was. */
  seek(time: number, plotId: number | null = null): void {
    const { start, end } = this.span
    if (plotId !== null) this.driver = plotId
    this.time = Math.min(Math.max(time, start), Math.max(start, end))
    this.lastAt = performance.now()
    const v = this.video
    if (v && this.playing) this.syncVideo(v, this.time, true)
    else if (v) this.parkVideo(this.time)
  }

  /** Stop and show everything again. */
  reset(): void {
    this.pause()
    this.time = null
  }

  /** No frame request exists outside a browser, so only cancel a real one. */
  private stopTicking(): void {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private tick = (now: number) => {
    this.raf = 0
    if (!this.playing || this.time === null) return
    const dt = now - this.lastAt
    this.lastAt = now
    const v = this.video
    let t = this.time + dt * this.speed
    if (v) {
      if (v.el.playbackRate !== this.speed) v.el.playbackRate = this.speed
      // A playing video leads; one still seeking holds the clock.
      if (!v.el.paused) {
        const ready = !v.el.seeking && v.el.readyState >= 2
        t = ready ? v.el.currentTime * 1000 + v.offset : this.time
      }
      this.syncVideo(v, t, false)
    }
    const { end } = this.span
    // At the end, hold the last frame until the bar's reset.
    this.time = Math.min(t, end)
    if (t >= end) this.pause()
    else this.raf = requestAnimationFrame(this.tick)
  }

  /** Inside the video's span the video plays; outside it rests. */
  private syncVideo(v: VideoBinding, t: number, force: boolean): void {
    const local = t - v.offset
    if (!(local >= 0 && local < durationMs(v.el))) {
      v.el.pause()
      if (force) this.parkVideo(t)
      return
    }
    if (!force && !v.el.paused) return
    if (force || Math.abs(v.el.currentTime * 1000 - local) > 50) v.el.currentTime = local / 1000
    if (v.el.paused && !this.videoBlocked) {
      v.el.playbackRate = this.speed
      v.el.play().catch(() => (this.videoBlocked = true))
    }
  }

  /** Show the frame for `t`, or the edge frame outside the video's span. */
  private parkVideo(t: number): void {
    const v = this.video
    if (!v) return
    v.el.pause()
    const local = Math.min(Math.max(t - v.offset, 0), Math.max(0, durationMs(v.el) - 1))
    v.el.currentTime = Math.max(local / 1000, 0.001)
  }
}

const durationMs = (el: HTMLVideoElement) =>
  Number.isFinite(el.duration) ? el.duration * 1000 : 0

/** A session's clocks: one shared per stimulus, plus private ones. */
export class PlaybackClocks {
  private clocks = new SvelteMap<string, PlaybackClock>()

  static sharedKey = (stimulusId: number) => `stimulus:${stimulusId}`
  static privateKey = (plotId: number) => `plot:${plotId}`

  /** Created on first use. */
  clock(key: string): PlaybackClock {
    let c = this.clocks.get(key)
    if (!c) this.clocks.set(key, (c = new PlaybackClock(this)))
    return c
  }

  /** The clock goes with its last player. */
  leave(key: string, plotId: number): void {
    const c = this.clocks.get(key)
    c?.leave(plotId)
    if (c?.players.size === 0) this.clocks.delete(key)
  }

  /** The stimulus's shared clock time while it plays, else null. */
  playingTime(stimulusId: number): number | null {
    const c = this.clocks.get(PlaybackClocks.sharedKey(stimulusId))
    return c?.playing ? c.time : null
  }

  /** Starting a clock pauses any other one on the same video. */
  claim(clock: PlaybackClock): void {
    const el = clock.video?.el
    if (!el) return
    for (const other of this.clocks.values()) {
      if (other !== clock && other.playing && other.video?.el === el) other.pause()
    }
  }
}

/** This session's clocks; resolve at component init. */
export const usePlaybackClocks = sessionScoped(() => new PlaybackClocks())
