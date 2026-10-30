<!--
  The play bar under a stimulus-space figure, on screen only: play/pause, the
  seek rail with the trail filled, the trail's draggable left edge, and the
  time readout. Its own row below the canvas, not keyed on async media
  readiness, so the height never jumps.
-->
<script module lang="ts">
  /** The row's height: the play button's 24 px, so the rail sits close under the plot and the card padding alone carries the bottom. */
  export const PLAY_BAR_HEIGHT = 24
</script>

<script lang="ts">
  import Play from 'lucide-svelte/icons/play'
  import Pause from 'lucide-svelte/icons/pause'
  import { isTextEntryTarget } from '$lib/workspace/keys'
  import type { StimulusMedia } from '$lib/data/types'
  import type { PlaybackClock } from '../playbackClock.svelte'
  import type { PlotPlayback } from '../playback.svelte'

  interface Props {
    playback: PlotPlayback | null
    clock: PlaybackClock | null
    /** The clock's span: the rail. */
    span: { start: number; end: number }
    /** The clock's time; null parked, showing everything. */
    playTime: number | null
    isPlaying: boolean
    /** The committed trail length (ms); 0 = All. */
    trailLength: number
    media: StimulusMedia | null
    /** The decoded video element, null while a video still decodes. */
    videoElement: HTMLVideoElement | null
    mediaFailed: boolean
    /** The figure's host: Space toggles playback while the pointer is over it or focus is inside. */
    host: HTMLElement | null
    /** A trail length being dragged on the rail, before it is committed; null when none. */
    onDraft?: (ms: number | null) => void
    /** The time under the pointer on the rail; null when it leaves. */
    onHoverTime?: (t: number | null) => void
  }

  const {
    playback,
    clock,
    span,
    playTime,
    isPlaying,
    trailLength,
    media,
    videoElement,
    mediaFailed,
    host,
    onDraft,
    onHoverTime,
  }: Props = $props()

  const spanMs = $derived(span.end - span.start)
  // Disabled only while a set video is still decoding; a plain image or no
  // media plays off the fixations' recording-time extent directly.
  const disabled = $derived(
    spanMs <= 0 || !clock || (media?.kind === 'video' && !videoElement && !mediaFailed)
  )

  const toggle = () => clock?.toggle(playback?.plotId ?? null)

  /** Tenths under a minute (trials are often 3 to 10 s), m:ss beyond. */
  function formatTime(ms: number): string {
    const seconds = ms / 1000
    if (!Number.isFinite(seconds) || seconds < 0) return '0.0 s'
    if (seconds < 60) return `${seconds.toFixed(1)} s`
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const railPos = (t: number) => (spanMs > 0 ? Math.min(1, Math.max(0, (t - span.start) / spanMs)) : 0)

  /** A trail length being dragged, before it is committed. */
  let windowDraft = $state<number | null>(null)
  const trail = $derived(windowDraft ?? trailLength)

  /** Parked shows the end: everything is on screen. */
  const shownTime = $derived(playTime ?? span.end)
  const trailFrom = $derived(
    playTime !== null && trail > 0 ? Math.max(span.start, playTime - trail) : span.start
  )
  const fromPct = $derived(railPos(trailFrom) * 100)
  const nowPct = $derived(railPos(shownTime) * 100)

  let railEl = $state<HTMLDivElement | null>(null)

  function timeAtRail(clientX: number): number {
    if (!railEl) return span.start
    const rect = railEl.getBoundingClientRect()
    const f = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
    return span.start + Math.min(1, Math.max(0, f)) * spanMs
  }

  // Hovering the rail marks that moment on the stimulus's other plots.
  function onRailHover(event: PointerEvent) {
    if (spanMs <= 0) return
    onHoverTime?.(timeAtRail(event.clientX))
  }

  // Dragging the trail's left edge sets its length (the rail start = All),
  // committed once on release: one undo step.
  function setDraft(ms: number | null) {
    windowDraft = ms
    onDraft?.(ms)
  }

  function onHandleDown(event: PointerEvent) {
    if (playTime === null) return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget as HTMLElement
    handle.setPointerCapture(event.pointerId)
    setDraft(trail)
  }

  function onHandleMove(event: PointerEvent) {
    if (windowDraft === null || playTime === null) return
    const at = timeAtRail(event.clientX)
    const allZone = span.start + spanMs * 0.01
    setDraft(at <= allZone ? 0 : Math.max(100, Math.round((playTime - at) / 10) * 10))
  }

  function onHandleUp() {
    const next = windowDraft
    if (next === null) return
    if (next !== trailLength) playback?.commitWindow(next)
    setDraft(null)
  }

  // Space plays/pauses the figure under the pointer (or holding focus).
  let hovered = false
  $effect(() => {
    const el = host
    if (!el) return
    const enter = () => (hovered = true)
    const leave = () => (hovered = false)
    el.addEventListener('mouseenter', enter)
    el.addEventListener('mouseleave', leave)
    return () => {
      hovered = false
      el.removeEventListener('mouseenter', enter)
      el.removeEventListener('mouseleave', leave)
    }
  })

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey) return
    if (disabled) return
    const focusInside = !!host && host.contains(document.activeElement)
    if (!hovered && !focusInside) return
    if (isTextEntryTarget(event) && (event.target as HTMLInputElement).type !== 'range') return
    event.preventDefault()
    toggle()
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="video-pill" style:height={`${PLAY_BAR_HEIGHT}px`}>
  <button
    class="pill-toggle"
    aria-label={isPlaying ? 'Pause' : 'Play'}
    onclick={toggle}
    {disabled}
  >
    {#if isPlaying}
      <Pause size={'1em'} fill="currentColor" strokeWidth={0} />
    {:else}
      <Play size={'1em'} fill="currentColor" strokeWidth={0} />
    {/if}
  </button>
  <!-- The filled part is the trail: the fixations on screen. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="pill-rail"
    bind:this={railEl}
    data-owns-drag
    onpointermove={onRailHover}
    onpointerleave={() => onHoverTime?.(null)}
  >
    <input
      class="pill-seek"
      type="range"
      min={span.start}
      max={span.end > span.start ? span.end : span.start + 1}
      step="10"
      value={shownTime}
      oninput={e => clock?.seek(Number(e.currentTarget.value), playback?.plotId ?? null)}
      {disabled}
      aria-label="Playback position"
      style:--trail-from={`${fromPct}%`}
      style:--seek-progress={`${nowPct}%`}
    />
    {#if playTime !== null && !disabled}
      <!-- A button so the workspace never pans from it. Pointer only: the
           pane's Trail length field is the keyboard route. -->
      <button
        type="button"
        class="pill-trail-edge"
        style:left={`${fromPct}%`}
        tabindex="-1"
        aria-label="Trail length"
        onpointerdown={onHandleDown}
        onpointermove={onHandleMove}
        onpointerup={onHandleUp}
        onpointercancel={onHandleUp}
      ></button>
    {/if}
  </div>
  {#if mediaFailed}
    <span class="pill-note" title="Reattach it as MP4 (H.264) or WebM in Edit stimuli &amp; selections.">
      {media?.kind === 'video' ? 'Video' : 'Image'} can't be decoded in this browser
    </span>
  {/if}
  <span class="pill-time">
    {#if windowDraft !== null}
      Trail {windowDraft > 0 ? formatTime(windowDraft) : 'All'}
    {:else}
      {formatTime(shownTime)} / {formatTime(span.end)}
    {/if}
  </span>
</div>

<style>
  /* Its own row below the canvas, spanning the plot's full width.
     border-box so the padding never pushes it past the canvas edge. */
  .video-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    box-sizing: border-box;
    padding: 0 10px;
  }

  .pill-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--c-black);
    cursor: pointer;
    transition: color var(--transition-fast) ease;
  }

  .pill-toggle:hover:not(:disabled) {
    color: var(--c-brand);
  }

  .pill-toggle:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .pill-rail {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    height: 100%;
  }

  /* Minimal seek bar: a thin rail with the trail filled solid and the rest a
     bare grey line. No native track chrome, no borders. */
  .pill-seek:focus-visible {
    outline: 2px solid var(--c-brand);
    outline-offset: 4px;
  }

  .pill-seek {
    flex: 1;
    min-width: 0;
    appearance: none;
    -webkit-appearance: none;
    height: 4px;
    margin: 0;
    border: none;
    outline: none;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      var(--c-midgrey) var(--trail-from, 0%),
      var(--c-brand) var(--trail-from, 0%),
      var(--c-brand) var(--seek-progress, 0%),
      var(--c-midgrey) var(--seek-progress, 0%)
    );
    cursor: pointer;
  }

  .pill-seek::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 10px;
    height: 10px;
    border: none;
    border-radius: 50%;
    background: var(--c-brand);
  }

  .pill-seek::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border: none;
    border-radius: 50%;
    background: var(--c-brand);
  }

  .pill-seek::-moz-range-track {
    background: transparent;
  }

  .pill-seek:disabled {
    cursor: default;
    opacity: 0.4;
  }

  /* The trail's left edge: a short grip on the rail, dragged sideways. */
  .pill-trail-edge {
    position: absolute;
    top: 50%;
    width: 4px;
    height: 12px;
    margin: -6px 0 0 -2px;
    padding: 0;
    border: none;
    border-radius: 2px;
    background: var(--c-brand);
    cursor: ew-resize;
    touch-action: none;
  }

  .pill-note {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-xs);
    color: var(--c-darkgrey);
  }

  .pill-time {
    flex: none;
    font-size: var(--text-xs);
    font-family: var(--font-small);
    font-variant-numeric: tabular-nums;
    color: var(--c-black);
    white-space: nowrap;
  }
</style>
