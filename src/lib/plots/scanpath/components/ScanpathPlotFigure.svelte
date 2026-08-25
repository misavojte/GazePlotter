<script lang="ts">
  import {
    usePlot,
    canvasBlockSelect,
    type CanvasExportProps,
    type FrameHit,
    type PlotFrame,
    type PlotAreaTicks,
  } from '$lib/plots/shared'
  import {
    strokeCrosshairPanel,
    type PlotCursorPort,
  } from '$lib/plots/shared/plotCursor.svelte'
  import Play from 'lucide-svelte/icons/play'
  import Pause from 'lucide-svelte/icons/pause'
  import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/textMeasure'
  import { calculateNiceStepSize } from '$lib/plots/shared/timelineUtils'
  import { SCANPATH_COLORS, SCANPATH_LAYOUT } from '../const'
  import { getColorForValue, interpolateColor } from '$lib/color'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { stimulusMediaStore } from '$lib/data/media/mediaStore.svelte'
  import { mediaRegionOf } from '$lib/data/media/mediaUpload'
  import type { StimulusMedia } from '$lib/data/types'
  import type { ScanpathData, ScanpathFixation } from '../types'
  import { buildScanpathTooltipContent } from '../core/tooltip'
  import type { WarningPlaceholder } from '../core/view'

  interface Props extends CanvasExportProps {
    data: ScanpathData | null
    showFixationOrder?: boolean
    showNumbers?: boolean
    /** Marker coloring: gradient over the recording's time extent (default)
        or one solid color. */
    colorMode?: 'time' | 'solid'
    /** Gradient stops for the time-extent coloring (2 or 3 hex colors). */
    colorScale?: string[]
    /** Trailing playback window (recording ms): while playing, only fixations
        that began within the last N ms stay on screen. 0 = keep all. */
    playbackWindow?: number
    unavailableMessage?: string | WarningPlaceholder | null
    /** The one participant this panel is about. */
    participantId?: number
    /** The stimulus's reference medium, drawn as the plot background. Its
        intrinsic pixel size replaces the fixation bbox as the coordinate
        domain — gaze coordinates are stimulus pixels, so fixations land
        exactly on the image. */
    media?: StimulusMedia | null
    /** Key of `media`'s bytes in the stimulusMediaStore. */
    mediaStimulusId?: number
    /** Shared PLOT CURSOR (screen-only; export renders without one). */
    plotCursor?: PlotCursorPort | null
  }

  let {
    data,
    showFixationOrder = true,
    showNumbers = true,
    colorMode = 'time',
    colorScale = undefined,
    playbackWindow = 0,
    width = 400,
    height = 400,
    margin = 0,
    unavailableMessage = null,
    participantId,
    media = null,
    mediaStimulusId,
    plotCursor = null,
  }: Props = $props()

  /** The decoded background element, or null while it loads. Depends on the
      store version so the canvas repaints when decoding finishes (videos are
      parked on their first frame, so no black background flashes). */
  const mediaElement = $derived.by(() => {
    void stimulusMediaStore.version
    if (!media || mediaStimulusId === undefined) return null
    return stimulusMediaStore.getReadyElement(mediaStimulusId, media)
  })

  // ── Time-sync playback (always on): a bottom
  // bar with play/pause, a seek bar, and the time readout. Fixations appear
  // as recording time passes — an animated scanpath. With a video medium the
  // VIDEO is the clock (frames and fixations stay in sync); otherwise a rAF
  // clock runs over the fixations' recording-time extent. `playTime` null
  // means "show everything" — the parked state before the first play and
  // after a run completes, and what exports render.
  const videoElement = $derived(
    media?.kind === 'video' && mediaElement instanceof HTMLVideoElement
      ? mediaElement
      : null
  )
  let isPlaying = $state(false)
  /** Current playback position (recording ms), or null = show all. */
  let playTime = $state<number | null>(null)
  let videoDurationMs = $state(0)
  let playTick = $state(0)
  let rafId = 0
  let lastFrameAt = 0

  /** Playback span in recording ms: the video's length when a video drives
      the clock, else the rendered fixations' time extent. */
  const playDurationMs = $derived.by(() => {
    if (videoElement) return videoDurationMs
    if (!data || data.fixations.length === 0) return 0
    const last = data.fixations[data.fixations.length - 1]
    return last.start + last.duration
  })

  function playbackTick(now: number) {
    const el = videoElement
    if (el) {
      playTime = el.currentTime * 1000
    } else if (isPlaying && playTime !== null) {
      playTime = Math.min(playTime + (now - lastFrameAt), playDurationMs)
      if (playTime >= playDurationMs) stopPlayback(true)
    }
    lastFrameAt = now
    playTick++
    if (isPlaying) rafId = requestAnimationFrame(playbackTick)
  }

  function startTicking() {
    cancelAnimationFrame(rafId)
    lastFrameAt = performance.now()
    rafId = requestAnimationFrame(playbackTick)
  }

  function stopPlayback(completed = false) {
    isPlaying = false
    cancelAnimationFrame(rafId)
    // A completed run parks back on the full (static) picture.
    if (completed) playTime = null
    playTick++
  }

  function togglePlayback() {
    const el = videoElement
    if (isPlaying) {
      if (el) el.pause()
      stopPlayback()
      return
    }
    // Restart from the beginning when parked on "show all" or at the end.
    const atEnd = playTime !== null && playTime >= playDurationMs - 1
    if (playTime === null || atEnd) {
      playTime = 0
      if (el) el.currentTime = 0
    }
    if (el) {
      void el.play().then(() => {
        isPlaying = true
        startTicking()
      })
    } else {
      isPlaying = true
      startTicking()
    }
  }

  function onSeek(event: Event) {
    const ms = Number((event.currentTarget as HTMLInputElement).value)
    playTime = ms
    const el = videoElement
    if (el) el.currentTime = ms / 1000
    playTick++
  }

  function formatTime(ms: number): string {
    const seconds = ms / 1000
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  $effect(() => {
    const el = videoElement
    if (!el) return
    videoDurationMs = Number.isFinite(el.duration) ? el.duration * 1000 : 0
    const onEnded = () => stopPlayback(true)
    const onDuration = () => {
      videoDurationMs = Number.isFinite(el.duration) ? el.duration * 1000 : 0
    }
    // Repaint the paused frame after a scrub lands on its decoded frame.
    const onSeeked = () => playTick++
    el.addEventListener('ended', onEnded)
    el.addEventListener('durationchange', onDuration)
    el.addEventListener('seeked', onSeeked)
    return () => {
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('durationchange', onDuration)
      el.removeEventListener('seeked', onSeeked)
      // Leaving this plot (or swapping media) must not keep the shared
      // element playing invisibly.
      if (!el.paused) el.pause()
      stopPlayback()
    }
  })

  /** Fixations after this recording time are hidden (Infinity = show all —
      the static/parked state, which reads as "playback finished"). */
  const timeCutoff = $derived(playTime !== null ? playTime : Infinity)

  /** Fixations whose onset predates this are hidden too: the trailing
      playback window's left edge (-Infinity = keep everything). Only applies
      mid-playback; the parked full view ignores the window. */
  const timeFloor = $derived(
    playbackWindow > 0 && timeCutoff !== Infinity
      ? timeCutoff - playbackWindow
      : -Infinity
  )

  function isVisible(f: ScanpathFixation): boolean {
    return f.start <= timeCutoff && f.start >= timeFloor
  }

  // Frame size mirror for the equal-aspect domain below. Written in an effect
  // (not read directly in `scale`) so the derived never touches `plot` during
  // component init, before `usePlot` returns.
  let frameW = $state(0)
  let frameH = $state(0)
  $effect(() => {
    frameW = plot.frame.width
    frameH = plot.frame.height
  })

  /** The cursor either means this whole panel or nothing: one participant, one plot. */
  const cursorIsMine = $derived(
    participantId !== undefined &&
      (plotCursor?.participants ?? []).includes(participantId)
  )

  /** The PLOT CURSOR plus the hovered fixation's highlight ring. */
  function drawScanpathOverlay(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (cursorIsMine) strokeCrosshairPanel(ctx, frame)
    const hovered = plot.hover.data?.fixationIndex
    if (hovered == null || !data) return
    const f = data.fixations[hovered]
    if (!f) return
    const cx = projectX(f.x, frame)
    const cy = projectY(f.y, frame)
    const r = displayRadiusFor(f)
    ctx.save()
    // White gap ring first, accent ring on top — legible on any background.
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = SCANPATH_COLORS.hoverRing
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  const L = SCANPATH_LAYOUT

  function formatTick(v: number): string {
    if (!Number.isFinite(v)) return ''
    const abs = Math.abs(v)
    if (abs >= 1000) return Math.round(v).toString()
    if (abs >= 10) return v.toFixed(0)
    return v.toFixed(2)
  }

  /** Nice round-number ticks (1/2/2.5/5 × 10^n steps, like the timeline
      plots): multiples of the step that fall inside [min, max]. */
  function buildTicks(min: number, max: number, count: number): PlotAreaTicks {
    if (!(max > min)) return { positions: [0.5], labels: [formatTick(min)] }
    const range = max - min
    const step = calculateNiceStepSize(range, count)
    const positions: number[] = []
    const labels: string[] = []
    for (
      let v = Math.ceil(min / step) * step;
      v <= max + step * 1e-4;
      v += step
    ) {
      // Snap floating-point drift (0.30000000000000004) back to the grid.
      const value = Math.abs(v) < step * 1e-6 ? 0 : v
      positions.push((value - min) / range)
      labels.push(formatTick(value))
    }
    return { positions, labels }
  }

  /** Padded data bounding box + its tick scales. */
  const scale = $derived.by(() => {
    if (!data) {
      return {
        dataMinX: 0,
        dataMaxX: 1,
        dataMinY: 0,
        dataMaxY: 1,
        dataW: 1,
        dataH: 1,
        xTicks: { positions: [], labels: [] },
        yTicks: { positions: [], labels: [] },
      }
    }
    if (media) {
      // Media present: the domain covers the gaze rectangle the media spans
      // (its own pixel space unless the user remapped it), EXTENDED to the
      // frame's aspect ratio with equal units-per-pixel on both axes. The
      // image is drawn at its projected rectangle, so it never distorts, and
      // fixations share the same linear projection, so alignment is exact.
      const r = mediaRegionOf(media)
      let minX = r.x
      let minY = r.y
      let w = r.width
      let h = r.height
      if (frameW > 0 && frameH > 0) {
        const unitsPerPx = Math.max(r.width / frameW, r.height / frameH)
        w = frameW * unitsPerPx
        h = frameH * unitsPerPx
        minX = r.x + (r.width - w) / 2
        minY = r.y + (r.height - h) / 2
      }
      return {
        dataMinX: minX,
        dataMaxX: minX + w,
        dataMinY: minY,
        dataMaxY: minY + h,
        dataW: w,
        dataH: h,
        xTicks: buildTicks(minX, minX + w, L.tickCount),
        yTicks: buildTicks(minY, minY + h, L.tickCount),
      }
    }
    const { minX, maxX, minY, maxY } = data.bbox
    const rawW = maxX - minX
    const rawH = maxY - minY
    const padX = rawW > 0 ? rawW * L.bboxPadding : 0.5
    const padY = rawH > 0 ? rawH * L.bboxPadding : 0.5
    const dataMinX = minX - (rawW > 0 ? padX : 0.5)
    const dataMaxX = maxX + (rawW > 0 ? padX : 0.5)
    const dataMinY = minY - (rawH > 0 ? padY : 0.5)
    const dataMaxY = maxY + (rawH > 0 ? padY : 0.5)
    return {
      dataMinX,
      dataMaxX,
      dataMinY,
      dataMaxY,
      dataW: dataMaxX - dataMinX,
      dataH: dataMaxY - dataMinY,
      xTicks: buildTicks(dataMinX, dataMaxX, L.tickCount),
      yTicks: buildTicks(dataMinY, dataMaxY, L.tickCount),
    }
  })

  /** The control bar gets its own row BELOW the canvas: the canvas gives up
      the bar's height so the two never overlap. Not keyed on async media
      readiness, so the height never jumps. */
  const PLAY_BAR_HEIGHT = 36
  const hasPlayBar = $derived(!unavailableMessage && data !== null)

  /** Hover payload: the hovered fixation's index, or null for a bare panel
      hover (which still drives the shared plot cursor). */
  type ScanpathHit = { fixationIndex: number | null }

  /** Nearest fixation whose marker (plus a small grab margin) contains the
      pointer; ties go to the LATER fixation, which is drawn on top. */
  function hitFixation(x: number, y: number, frame: PlotFrame): number | null {
    if (!data) return null
    let best: number | null = null
    let bestDist = Infinity
    for (let i = 0; i < data.fixations.length; i++) {
      const f = data.fixations[i]
      if (f.start > timeCutoff) break // hidden by time-sync playback
      if (!isVisible(f)) continue // scrolled out of the trailing window
      const dx = x - projectX(f.x, frame)
      const dy = y - projectY(f.y, frame)
      const dist = Math.hypot(dx, dy)
      const grab = Math.max(displayRadiusFor(f), 6) + 2
      if (dist <= grab && dist <= bestDist) {
        best = i
        bestDist = dist
      }
    }
    return best
  }

  const plot = usePlot<ScanpathHit>({
    width: () => width,
    height: () => (hasPlayBar ? Math.max(60, height - PLAY_BAR_HEIGHT) : height),
    margin: () => margin,
    deps: () => [data, showFixationOrder, showNumbers, colorMode, gradientStops, playbackWindow, unavailableMessage, media, mediaElement, playTick, timeCutoff],
    placeholder: () => unavailableMessage,
    gutters: () => {
      if (unavailableMessage) return {}
      return {
        left: { tickLabels: scale.yTicks.labels, title: 'Y' },
        bottom: { tickLabels: scale.xTicks.labels, title: 'X' },
        pad: {
          top: L.topSafetyPx,
          right: L.rightSafetyPx,
          bottom: L.bottomSafetyPx,
          left: L.leftSafetyPx,
        },
      }
    },
    drawData: drawScanpath,
    // Marks may slightly overflow the plot area (edge fixations); the axis
    // frame is drawn on top afterwards, matching the pre-frame behaviour.
    clipData: false,
    drawOverlay: drawScanpathOverlay,
    // Fixation markers carry a tooltip; anywhere else in the panel is a
    // track-only hit (empty content = no tooltip) that still publishes the
    // shared plot cursor — this panel IS one participant.
    hitTest: (x, y, frame): FrameHit<ScanpathHit> => {
      const index = hitFixation(x, y, frame)
      if (index === null) {
        // No cursor override: the harness default 'crosshair' over the data
        // rect, same as the scarf and the other canvas plots.
        return {
          content: [],
          anchorX: 0,
          anchorY: 0,
          data: { fixationIndex: null },
        }
      }
      const f = data!.fixations[index]
      return {
        content: buildScanpathTooltipContent(f),
        anchorX: projectX(f.x, frame),
        anchorY: projectY(f.y, frame) - displayRadiusFor(f),
        tooltipWidth: L.tooltipWidth,
        data: { fixationIndex: index },
      }
    },
    // One repaint/publish per fixation change, not per pointer move.
    hoverKey: d => d.fixationIndex,
    onHover: hit =>
      plotCursor?.publish(
        hit && participantId !== undefined ? { participants: () => [participantId] } : null
      ),
    overlayDeps: () => {
      void cursorIsMine
      void plot.hover.data?.fixationIndex
      return null
    },
    axes: () => {
      if (unavailableMessage) return {}
      return {
        bottom: { ticks: scale.xTicks, title: 'X' },
        left: { ticks: scale.yTicks, title: 'Y' },
      }
    },
  })

  function projectX(x: number, frame: PlotFrame): number {
    return frame.x + ((x - scale.dataMinX) / scale.dataW) * frame.width
  }

  function projectY(y: number, frame: PlotFrame): number {
    // Eye-tracker y already grows downward, as does canvas y — no flip.
    return frame.y + ((y - scale.dataMinY) / scale.dataH) * frame.height
  }

  // ── Time-extent coloring: each fixation's fill sampled from the settings'
  // colorScale (the shared 2/3-stop gradient, same as the matrix plots) by
  // its onset within the recording's fixation time span.
  const gradientStops = $derived(
    colorScale && colorScale.length >= 2
      ? colorScale
      : [...PRESET_PALETTES.VIRIDIS.colors]
  )

  /** Gradient domain: the onset span of the fixations on screen RIGHT NOW.
      Statically that's the full recording; during playback it rescales to the
      visible (possibly windowed) set, so the shown fixations always spread
      across the whole gradient instead of pinching into one end. */
  function gradientDomain(visible: ScanpathFixation[]): [number, number] {
    if (visible.length < 2) return [0, 1]
    return [visible[0].start, visible[visible.length - 1].start]
  }

  function fillFor(f: ScanpathFixation, t0: number, t1: number): string {
    if (colorMode === 'solid') return SCANPATH_COLORS.fixationFill
    const pos = t1 > t0 ? (f.start - t0) / (t1 - t0) : 0
    return getColorForValue(pos, 0, 1, gradientStops)
  }

  function strokeFor(f: ScanpathFixation, t0: number, t1: number): string {
    return colorMode === 'solid'
      ? SCANPATH_COLORS.fixationStroke
      : interpolateColor(fillFor(f, t0, t1), '#000000', 0.35)
  }

  /** Density damping: past the threshold, marker radii shrink with √ of the
      overcount (floored at half) so 1000 fixations stay a readable cloud
      instead of a solid blob. */
  const densityScale = $derived.by(() => {
    const n = data?.fixations.length ?? 0
    if (n <= L.densityThreshold) return 1
    return Math.max(0.5, Math.sqrt(L.densityThreshold / n))
  })

  function radiusFor(duration: number): number {
    // Area linear in duration → radius ∝ √duration (Tobii Pro Lab / BeGaze /
    // OGAMA convention).
    if (!data || data.maxDuration <= 0)
      return ((L.minRadius + L.maxRadius) / 2) * densityScale
    const t = Math.sqrt(Math.max(0, duration) / data.maxDuration)
    return (L.minRadius + (L.maxRadius - L.minRadius) * t) * densityScale
  }

  /** Marker radius as shown right now. Statically the final size; during
      time-sync playback the bubble INFLATES over the fixation's own dwell —
      it appears at the minimum size exactly at onset and grows to its final
      radius as the elapsed dwell accumulates, so onset moments read directly
      off the animation. */
  function displayRadiusFor(f: ScanpathFixation): number {
    if (timeCutoff === Infinity) return radiusFor(f.duration)
    return radiusFor(Math.min(Math.max(0, timeCutoff - f.start), f.duration))
  }

  /** The fixations on screen right now: all of them, or (during time-sync
      playback) those whose onset has passed and still sits inside the
      trailing window. */
  function visibleFixations(): ScanpathFixation[] {
    if (!data) return []
    if (timeCutoff === Infinity) return data.fixations
    return data.fixations.filter(isVisible)
  }

  function drawScanpath(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (!data) return
    const fixations = visibleFixations()
    // Reference medium (image or the video's current frame), under
    // everything, at its PROJECTED gaze rectangle. The equal-aspect domain
    // above makes that rectangle keep the media's ratio; the frame's leftover
    // margins stay blank.
    if (mediaElement && media) {
      const r = mediaRegionOf(media)
      ctx.save()
      ctx.globalAlpha = 0.9
      ctx.drawImage(
        mediaElement,
        projectX(r.x, frame),
        projectY(r.y, frame),
        (r.width / scale.dataW) * frame.width,
        (r.height / scale.dataH) * frame.height
      )
      ctx.restore()
    }

    // Polyline (under the circles), on a white halo so the path stays
    // readable across busy reference imagery.
    if (showFixationOrder && fixations.length > 1) {
      ctx.save()
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      const first = fixations[0]
      ctx.moveTo(projectX(first.x, frame), projectY(first.y, frame))
      for (let i = 1; i < fixations.length; i++) {
        const f = fixations[i]
        ctx.lineTo(projectX(f.x, frame), projectY(f.y, frame))
      }
      ctx.globalAlpha = L.polylineAlpha
      ctx.strokeStyle = SCANPATH_COLORS.halo
      ctx.lineWidth = L.polylineWidth + 1.5
      ctx.stroke()
      ctx.strokeStyle = SCANPATH_COLORS.polyline
      ctx.lineWidth = L.polylineWidth
      ctx.stroke()
      ctx.restore()
    }

    // Fixation circles: slightly translucent fill (overlaps stay readable)
    // inside a thin white halo + the conventional darker stroke.
    const [t0, t1] = gradientDomain(fixations)
    ctx.save()
    for (const f of fixations) {
      const cx = projectX(f.x, frame)
      const cy = projectY(f.y, frame)
      const r = displayRadiusFor(f)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.globalAlpha = L.fixationFillAlpha
      ctx.fillStyle = fillFor(f, t0, t1)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = strokeFor(f, t0, t1)
      ctx.lineWidth = L.circleStrokeWidth
      ctx.stroke()
    }
    ctx.restore()

    // Number labels (above the circles), white-haloed for imagery.
    if (showNumbers) {
      ctx.save()
      ctx.font = `${L.numberFontSize}px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.strokeStyle = SCANPATH_COLORS.halo
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.fillStyle = SCANPATH_COLORS.numberLabel
      for (const f of fixations) {
        const r = displayRadiusFor(f)
        const tx = projectX(f.x, frame) + r + L.numberOffset
        const ty = projectY(f.y, frame) - r * 0.4
        const label = String(f.rank)
        ctx.strokeText(label, tx, ty)
        ctx.fillText(label, tx, ty)
      }
      ctx.restore()
    }
  }
</script>

<div class="scanpath-host">
  <canvas
    use:plot.plotAction
    use:canvasBlockSelect={{ regions: plot.blockedRegions }}
  ></canvas>
  {#if hasPlayBar}
    <!-- Disabled only while a set video is still decoding; a plain image or
         no media plays off the fixations' recording-time extent directly. -->
    {@const barDisabled = playDurationMs <= 0 || (media?.kind === 'video' && !videoElement)}
    {@const shownTime = playTime ?? playDurationMs}
    <div class="video-pill" style:height={`${PLAY_BAR_HEIGHT}px`}>
      <button
        class="pill-toggle"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onclick={togglePlayback}
        disabled={barDisabled}
      >
        {#if isPlaying}
          <Pause size={'1em'} fill="currentColor" strokeWidth={0} />
        {:else}
          <Play size={'1em'} fill="currentColor" strokeWidth={0} />
        {/if}
      </button>
      <input
        class="pill-seek"
        type="range"
        min="0"
        max={playDurationMs || 1}
        step="10"
        value={shownTime}
        oninput={onSeek}
        disabled={barDisabled}
        aria-label="Playback position"
        style:--seek-progress={`${playDurationMs > 0 ? (shownTime / playDurationMs) * 100 : 0}%`}
      />
      <span class="pill-time">
        {formatTime(shownTime)} / {formatTime(playDurationMs)}
      </span>
    </div>
  {/if}
</div>

<style>
  .scanpath-host {
    display: flex;
    flex-direction: column;
    width: fit-content;
    height: fit-content;
  }

  /* Its own row below the canvas, spanning the plot's full width.
     border-box so the padding never pushes it past the canvas edge. */
  .video-pill {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    box-sizing: border-box;
    padding: 0 10px;
    border-radius: 999px;
    background: var(--c-darkwhite);
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
    color: var(--c-text);
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

  /* Minimal seek bar: a thin rail with the played part filled solid and the
     unplayed remainder a bare grey line. No native track chrome, no borders. */
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

  .pill-time {
    flex: none;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--c-text);
    white-space: nowrap;
  }
</style>
