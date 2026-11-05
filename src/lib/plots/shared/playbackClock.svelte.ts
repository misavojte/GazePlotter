/**
 * One playhead per player (Scanpath, Fixation Heatmap), in recording ms, on the
 * player's own span. Plots selected together start, pause and seek together (a
 * RUN), each keeping its span, so a short recording ends while a long one plays
 * on. Time-axis plots of the stimulus read a playing clock through the plot
 * cursor port (playback is not undoable). A reference video leads the clock
 * inside its span so frames never drift from the fixations; clocks sharing a
 * video outside one run pause each other.
 */
import { SvelteMap } from 'svelte/reactivity'
import { sessionScoped } from '$lib/session/context'

/** `rest`: where the player parks the clock when idle (a video's first trail); absent = show all.
    `saved`: the moment saved with the plot; a paused clock moves there when it changes (load, undo). */
type Player = { span: { start: number; end: number }; speed: number; rest?: number | null; saved?: number | null }

type VideoBinding = { el: HTMLVideoElement; offset: number }

/** Clocks started together, at the starter's speed; `saved` once their moments are committed. */
export type PlaybackRun = { clocks: PlaybackClock[]; speed: number; saved: boolean }

const EMPTY_SPAN = { start: 0, end: 0 }

export class PlaybackClock {
  /** Recording ms; null = parked without a rest time, the player shows everything. */
  time = $state<number | null>(null)
  playing = $state(false)
  /** Repaint signal: a seeked video frame was decoded. */
  frame = $state(0)
  /** Until the figure sets it: an empty span, nothing to play. */
  player = $state.raw<Player | null>(null)
  /** The run it last played in, itself included; null when it played alone. */
  run: PlaybackRun | null = null
  readonly plotId: number
  /** The plot's stimulus, for the time-axis plots that read it. */
  readonly stimulusId: () => number
  /** Parked at the player's rest time rather than moved there by a seek or play. */
  private atRest = false
  private video: VideoBinding | null = null
  private raf = 0
  private lastAt = 0
  /** play() was refused (autoplay policy): don't retry every frame. */
  private videoBlocked = false
  private readonly owner: PlaybackClocks

  constructor(owner: PlaybackClocks, plotId: number, stimulusId: () => number) {
    this.owner = owner
    this.plotId = plotId
    this.stimulusId = stimulusId
  }

  /** An empty span (a placeholder) is no span. */
  get span(): { start: number; end: number } {
    const span = this.player?.span
    return span && span.end > span.start ? span : EMPTY_SPAN
  }

  get speed(): number {
    return this.run?.speed ?? this.player?.speed ?? 1
  }

  get rest(): number | null {
    return this.player?.rest ?? null
  }

  get videoElement(): HTMLVideoElement | null {
    return this.video?.el ?? null
  }

  /** The time it holds of its own; null when parked (at rest or showing everything). */
  get moment(): number | null {
    return this.atRest ? null : this.time
  }

  setPlayer(player: Player): void {
    const saved = player.saved ?? null
    const changed = saved !== (this.player?.saved ?? null)
    this.player = player
    if (!this.playing) {
      // A new saved moment (load, undo) moves the clock; our own commit is already there.
      if (changed && saved !== this.time) return saved === null ? this.park() : this.seek(saved)
      if (this.time === null || this.atRest) return this.park()
    }
    // A shrunken span must not strand the playhead outside it.
    const { start, end } = this.span
    if (this.time !== null && (this.time < start || this.time > end)) this.seek(this.time)
  }

  bindVideo(el: HTMLVideoElement | null, offset: number): void {
    const before = this.video?.el
    this.video = el ? { el, offset } : null
    if (before === el) return
    if (before) {
      before.removeEventListener('seeked', this.onVideoSeeked)
      // Only our own run: another clock may be playing the element.
      if (this.playing) before.pause()
    }
    if (el) {
      el.addEventListener('seeked', this.onVideoSeeked)
      if (this.time !== null) this.parkVideo(this.time)
    }
  }

  // A paused, unattached video can report 'seeked' before the frame is drawable,
  // so repaint again once it is presented, and once more as a fallback.
  private onVideoSeeked = () => {
    this.frame++
    const el = this.video?.el
    if (el && 'requestVideoFrameCallback' in el) el.requestVideoFrameCallback(() => this.frame++)
    setTimeout(() => this.frame++, SEEK_REPAINT_FALLBACK_MS)
  }

  /** From `from` (clamped), else from where it stands, the top when parked or at the end. */
  play(from?: number): void {
    const { start, end } = this.span
    if (end <= start) return
    if (from !== undefined) this.seek(from)
    else if (this.time === null || this.atRest || this.time >= end - 1) this.time = start
    this.atRest = false
    this.owner.claim(this)
    this.playing = true
    this.videoBlocked = false
    this.lastAt = performance.now()
    this.stopTicking()
    this.raf = requestAnimationFrame(this.tick)
  }

  pause(): void {
    if (this.playing && !this.videoShared()) this.video?.el.pause()
    this.playing = false
    this.stopTicking()
  }

  /** Pause its run; else play with `mates` from its own moment, all at its speed. */
  toggle(mates: PlaybackClock[] = []): void {
    if (this.playing) {
      for (const c of this.runMates()) c.pause()
      this.pause()
      return
    }
    const clocks = [this, ...mates.filter(m => m !== this && m.span.end > m.span.start)]
    const run = clocks.length > 1 ? { clocks, speed: this.player?.speed ?? 1, saved: false } : null
    for (const c of clocks) {
      c.pause()
      c.run = run
    }
    this.play()
    if (this.time !== null) for (const m of clocks.slice(1)) m.play(this.time)
  }

  /** Clamped to the span; keeps playing if it was. */
  seek(time: number): void {
    const { start, end } = this.span
    this.atRest = false
    this.time = Math.min(Math.max(time, start), Math.max(start, end))
    this.lastAt = performance.now()
    const v = this.video
    if (v && this.playing) this.syncVideo(v, this.time, true)
    else if (v) this.parkVideo(this.time)
  }

  /** A seek from the play bar: a playing run moves with it, ended members included. */
  scrub(time: number): void {
    this.seek(time)
    if (this.playing) for (const c of this.runMates()) c.play(time)
  }

  /** Stop and park: at the rest time, else showing everything. */
  reset(): void {
    this.pause()
    this.park()
  }

  /** The other clocks still in its run. */
  private runMates(): PlaybackClock[] {
    const run = this.run
    return run ? run.clocks.filter(c => c !== this && c.run === run) : []
  }

  /** A mate is playing the same element: leave it to that clock. */
  private videoShared(): boolean {
    const el = this.video?.el
    return !!el && this.runMates().some(c => c.playing && c.video?.el === el)
  }

  private park(): void {
    const rest = this.rest
    if (rest === null) {
      this.time = null
      this.atRest = false
      return
    }
    this.seek(rest)
    this.atRest = true
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
    this.time = Math.min(t, end)
    if (t < end) this.raf = requestAnimationFrame(this.tick)
    // At the end, back to the rest time (a video's last frame is often a fade to black); else hold it.
    else if (this.rest !== null) this.reset()
    else this.pause()
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
    if (!v || this.videoShared()) return
    v.el.pause()
    const local = Math.min(Math.max(t - v.offset, 0), Math.max(0, durationMs(v.el) - 1))
    v.el.currentTime = Math.max(local / 1000, 0.001)
  }
}

/** Late repaint after a seek, for browsers that present the frame without a frame callback. */
const SEEK_REPAINT_FALLBACK_MS = 250

const durationMs = (el: HTMLVideoElement) =>
  Number.isFinite(el.duration) ? el.duration * 1000 : 0

/** A session's clocks, one per player plot. */
export class PlaybackClocks {
  private clocks = new SvelteMap<number, PlaybackClock>()

  /** A fresh clock for the plot, replacing any a remounted copy left behind. */
  open(plotId: number, stimulusId: () => number): PlaybackClock {
    const c = new PlaybackClock(this, plotId, stimulusId)
    this.clocks.set(plotId, c)
    return c
  }

  get(plotId: number): PlaybackClock | undefined {
    return this.clocks.get(plotId)
  }

  /** Stops the clock; drops it unless a newer one holds the plot. */
  close(clock: PlaybackClock): void {
    clock.reset()
    clock.bindVideo(null, 0)
    if (this.clocks.get(clock.plotId) === clock) this.clocks.delete(clock.plotId)
  }

  /** The playing clocks' times on the stimulus. */
  playingTimes(stimulusId: number): number[] {
    const times: number[] = []
    for (const c of this.clocks.values()) {
      if (c.playing && c.time !== null && c.stimulusId() === stimulusId) times.push(c.time)
    }
    return times
  }

  /** Starting a clock pauses any other one on the same video, except its run's. */
  claim(clock: PlaybackClock): void {
    const el = clock.videoElement
    if (!el) return
    for (const other of this.clocks.values()) {
      if (other === clock || !other.playing || other.videoElement !== el) continue
      if (clock.run && other.run === clock.run) continue
      other.pause()
    }
  }
}

/** This session's clocks; resolve at component init. */
export const usePlaybackClocks = sessionScoped(() => new PlaybackClocks())
