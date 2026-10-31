<script lang="ts">
  import {
    usePlot,
    trackOnlyHit,
    intervalAt,
    type CanvasExportProps,
    type FrameHit,
    type PlotFrame,
  } from '$lib/plots/shared'
  import type { PlotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
  import { markCrosshairNode } from '$lib/plots/shared/canvasUtils'
  import { SYSTEM_SANS_SERIF_SMALL_STACK } from '$lib/shared/textMeasure'
  import { AXIS_CONFIG } from '$lib/plots/shared/axisUtils'
  import { drawGradientBar } from '$lib/plots/shared/legendGradient'
  import PlaybackBar, { PLAY_BAR_HEIGHT } from '$lib/plots/shared/components/PlaybackBar.svelte'
  import { usePlayer, type PlotPlayback } from '$lib/plots/shared/playback.svelte'
  import { SCANPATH_COLORS, SCANPATH_LAYOUT } from '../const'
  import { getColorForValue, interpolateColor } from '$lib/color'
  import { PRESET_PALETTES, resolvePalette } from '$lib/color/palettes'
  import { mediaRegionOf } from '$lib/data/media/stimulusMedia'
  import type { Rect } from '$lib/data/media/mediaAlignment'
  import type { StimulusBackground } from '$lib/plots/shared/stimulusBackground'
  import { useStimulusSpace } from '$lib/plots/shared/stimulusSpace.svelte'
  import type { StimulusMedia } from '$lib/data/types'
  import type { ScanpathData, ScanpathFixation } from '../types'
  import { buildScanpathTooltipContent } from '../core/tooltip'
  import type { PlotPlaceholderContent } from '$lib/plots/shared/drawCanvasPlaceholder'

  interface Props extends CanvasExportProps {
    data: ScanpathData | null
    showFixationOrder?: boolean
    showNumbers?: boolean
    /** Marker coloring: gradient over the recording's time extent (default)
        or one solid color. */
    colorMode?: 'time' | 'solid'
    /** Gradient stops for the time-extent coloring (2 or 3 hex colors). */
    colorScale?: string[]
    solidColor?: string
    background?: StimulusBackground
    /** Trail length in ms; 0 = all. */
    trailLength?: number
    playbackSpeed?: number
    /** The time range the fixations were cut to; the play span follows it. */
    timelineStart?: number
    timelineEnd?: number
    unavailableMessage?: PlotPlaceholderContent | null
    /** The one participant this panel is about. */
    participantId?: number
    /** The stimulus's reference medium, drawn as the plot background. Its
        intrinsic pixel size replaces the fixation bbox as the coordinate
        domain — gaze coordinates are stimulus pixels, so fixations land
        exactly on the image. */
    media?: StimulusMedia | null
    /** Key of `media`'s bytes in the session's media store. */
    mediaStimulusId?: number
    /** Publishes this participant and the hovered fixation's time. No
        whole-panel outline: lit from elsewhere it read as a stray focus border. */
    plotCursor?: PlotCursorPort | null
    /** Screen-only; export has no clock and draws every fixation. */
    playback?: PlotPlayback | null
  }

  const props: Props = $props()
  const {
    data,
    showFixationOrder = true,
    showNumbers = true,
    colorMode = 'time',
    colorScale = undefined,
    solidColor = SCANPATH_COLORS.fixationFill,
    background = 'image',
    trailLength = 0,
    playbackSpeed = 1,
    timelineStart = 0,
    timelineEnd = 0,
    height,
    unavailableMessage = null,
    participantId,
    media = null,
    mediaStimulusId,
    plotCursor = null,
    playback = null,
  } = $derived(props)

  // A medium the browser can't decode falls back to the fixation clock, and
  // the bar says why the background is missing.
  const stim = useStimulusSpace({
    world: () => world,
    tickCount: SCANPATH_LAYOUT.tickCount,
    media: () => media,
    mediaStimulusId: () => mediaStimulusId,
    frame: () => plot.frame,
  })

  // ── Playback: a PLAYER on a playback clock (playbackClock.svelte.ts).
  // `playTime` null shows every fixation: an image's idle state and exports.
  const player = usePlayer({
    playback: () => playback,
    media: () => media,
    mediaElement: () => stim.mediaElement,
    hasData: () => !!data && data.fixations.length > 0,
    dataEnd: () => {
      const last = data?.fixations[data.fixations.length - 1]
      return last ? last.start + last.duration : 0
    },
    timelineStart: () => timelineStart,
    timelineEnd: () => timelineEnd,
    speed: () => playbackSpeed,
    trailLength: () => trailLength,
  })
  const clock = $derived(player.clock)
  const playTime = $derived(player.playTime)
  const isPlaying = $derived(player.isPlaying)

  /** A trail length being dragged on the bar, before it is committed. */
  let windowDraft = $state<number | null>(null)
  const trail = $derived(windowDraft ?? trailLength)

  const timeCutoff = $derived(playTime !== null ? playTime : Infinity)

  /** The trail's left edge; -Infinity keeps everything. */
  const timeFloor = $derived(
    trail > 0 && timeCutoff !== Infinity ? timeCutoff - trail : -Infinity
  )

  function isVisible(f: ScanpathFixation): boolean {
    return f.start <= timeCutoff && f.start >= timeFloor
  }

  /** Fades a fixation as it nears the trail's edge, so it never vanishes
      at full strength. */
  function ageAlpha(f: ScanpathFixation): number {
    if (timeFloor === -Infinity) return 1
    const age = (timeCutoff - f.start) / trail
    return 1 - 0.8 * Math.min(1, Math.max(0, age))
  }

  /** Visible fixations active at the cursor's times (another plot's hover,
      a playing shared clock) or at our own playing time. */
  const cursorFixations = $derived.by(() => {
    const times = [...(plotCursor?.times ?? [])]
    if (isPlaying && playTime !== null) times.push(playTime)
    if (times.length === 0 || !data) return []
    const fx = data.fixations
    const out: number[] = []
    for (const t of times) {
      const i = intervalAt(fx.length, i => fx[i].start, i => fx[i].start + fx[i].duration, t)
      if (i >= 0 && isVisible(fx[i]) && !out.includes(i)) out.push(i)
    }
    return out
  })

  /** The hovered fixation's highlight ring, and the plot cursor's marks. */
  function drawScanpathOverlay(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (!data) return
    for (const i of cursorFixations) {
      const f = data.fixations[i]
      markCrosshairNode(ctx, stim.x(f.x, frame), stim.y(f.y, frame), displayRadiusFor(f) + 3)
    }
    const hovered = plot.hover.data?.fixationIndex
    if (hovered == null) return
    const f = data.fixations[hovered]
    if (!f) return
    const cx = stim.x(f.x, frame)
    const cy = stim.y(f.y, frame)
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

  /** Gaze rect the plot frames: the media, grown to any fixation off it, else the padded fixation extent. */
  const world = $derived.by((): Rect | null => {
    if (unavailableMessage || !data) return null
    const { minX, maxX, minY, maxY } = data.bbox
    if (media) {
      const r = mediaRegionOf(media)
      const x = Math.min(r.x, minX)
      const y = Math.min(r.y, minY)
      return { x, y, width: Math.max(r.x + r.width, maxX) - x, height: Math.max(r.y + r.height, maxY) - y }
    }
    const padX = maxX > minX ? (maxX - minX) * L.bboxPadding : 0.5
    const padY = maxY > minY ? (maxY - minY) * L.bboxPadding : 0.5
    return { x: minX - padX, y: minY - padY, width: maxX - minX + 2 * padX, height: maxY - minY + 2 * padY }
  })


  /** The bar gets its own row below the canvas, on screen only. */
  const hasPlayBar = $derived(!unavailableMessage && data !== null && playback !== null)

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
      if (f.start > timeCutoff) break // hidden by playback
      if (!isVisible(f)) continue // aged out of the trail
      const dist = Math.hypot(x - stim.x(f.x, frame), y - stim.y(f.y, frame))
      const grab = Math.max(displayRadiusFor(f), 6) + 2
      if (dist <= grab && dist <= bestDist) {
        best = i
        bestDist = dist
      }
    }
    return best
  }

  /** Midpoint, the recurrence plot's convention; empty if the data changed. */
  function fixationTimes(index: number): number[] {
    const f = data?.fixations[index]
    return f ? [f.start + f.duration / 2] : []
  }

  const plot = usePlot<ScanpathHit>({
    props: () => props,
    height: () => (hasPlayBar ? Math.max(60, height - PLAY_BAR_HEIGHT) : height),
    deps: () => [stim.mediaElement, clock?.frame, timeCutoff, trail, stim.space],
    placeholder: () => unavailableMessage,
    gutters: stim.gutters,
    drawData: drawScanpath,
    // Marks may slightly overflow the plot area (edge fixations); the axis
    // frame is drawn on top afterwards, matching the pre-frame behaviour.
    clipData: false,
    drawAboveAxes: drawTimeLegend,
    drawOverlay: drawScanpathOverlay,
    // Fixation markers carry a tooltip; anywhere else in the panel is a
    // track-only hit (empty content = no tooltip) that still publishes the
    // shared plot cursor — this panel IS one participant.
    hitTest: (x, y, frame): FrameHit<ScanpathHit> => {
      const index = hitFixation(x, y, frame)
      // No cursor override: the harness default 'crosshair' over the data
      // rect, same as the scarf and the other canvas plots.
      if (index === null) return trackOnlyHit({ fixationIndex: null })
      const f = data!.fixations[index]
      return {
        content: buildScanpathTooltipContent(f),
        anchorX: stim.x(f.x, frame),
        anchorY: stim.y(f.y, frame) + displayRadiusFor(f),
        tooltipWidth: L.tooltipWidth,
        data: { fixationIndex: index },
      }
    },
    // One repaint/publish per fixation change, not per pointer move.
    hoverKey: d => d.fixationIndex,
    onHover: hit => {
      const index = hit?.fixationIndex ?? null
      plotCursor?.publish(
        hit && participantId !== undefined
          ? {
              participants: () => [participantId],
              times: index === null ? undefined : () => fixationTimes(index),
            }
          : null
      )
    },
    overlayDeps: () => {
      void plot.hover.data?.fixationIndex
      return cursorFixations.join(',')
    },
    axes: stim.axes,
  })

  // ── Time-extent coloring: fill sampled from the colorScale by onset.
  const gradientStops = $derived(resolvePalette(colorScale, PRESET_PALETTES.VIRIDIS.colors))

  /** The rendered onset span, fixed through playback: color always means
      "when"; age in the trail is opacity (`ageAlpha`). */
  const gradientDomain = $derived.by((): [number, number] => {
    if (!data || data.fixations.length === 0) return [0, 1]
    const t0 = data.fixations[0].start
    const t1 = data.fixations[data.fixations.length - 1].start
    // A lone fixation reads as the gradient's start (an unbounded [0, 1]
    // domain would clamp it to the END color).
    return [t0, t1 > t0 ? t1 : t0 + 1]
  })

  function fillFor(f: ScanpathFixation): string {
    if (colorMode === 'solid') return solidColor
    const [t0, t1] = gradientDomain
    return getColorForValue((f.start - t0) / (t1 - t0), 0, 1, gradientStops)
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

  /** During playback a marker inflates over its own dwell, from the minimum
      at onset to its final radius, so onsets read off the animation. */
  function displayRadiusFor(f: ScanpathFixation): number {
    if (timeCutoff === Infinity) return radiusFor(f.duration)
    return radiusFor(Math.min(Math.max(0, timeCutoff - f.start), f.duration))
  }

  /** Seconds with one decimal: fixation onsets are sub-second apart. */
  const formatOnset = (ms: number) => `${(ms / 1000).toFixed(1)} s`

  /** Time-gradient key: `Onset 0.0 s [gradient] 4.2 s`, right-aligned on the
      X-axis title row, so it costs no plot height and lands in exports.
      Skipped when the plot is too narrow to clear the title. */
  function drawTimeLegend(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (colorMode !== 'time' || !data || unavailableMessage) return
    if (data.fixations.length === 0) return
    const t0 = data.fixations[0].start
    const t1 = data.fixations[data.fixations.length - 1].start
    const BAR_W = 56
    const BAR_H = 8
    const GAP = 5
    ctx.save()
    ctx.font = `${AXIS_CONFIG.fontSize}px ${AXIS_CONFIG.fontFamily}`
    const caption = 'Onset'
    const from = formatOnset(t0)
    const to = formatOnset(t1)
    const captionW = ctx.measureText(caption).width
    const fromW = ctx.measureText(from).width
    const toW = ctx.measureText(to).width
    const keyW = fromW + GAP + BAR_W + GAP + toW
    // Clear the centred axis title with room to spare; drop the caption first.
    const titleRight = frame.x + frame.width / 2 + ctx.measureText('X').width / 2 + 12
    const withCaption = frame.right - (captionW + GAP * 2 + keyW) >= titleRight
    if (!withCaption && frame.right - keyW < titleRight) {
      ctx.restore()
      return
    }
    // A 2px drop off the title row's top: air between the key and the tick labels above.
    const top = frame.bottom + frame.bottomTitleOffset + 2
    const midY = top + AXIS_CONFIG.fontSize / 2
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillStyle = AXIS_CONFIG.color
    let x = frame.right - keyW - (withCaption ? captionW + GAP * 2 : 0)
    if (withCaption) {
      ctx.fillText(caption, x, midY)
      x += captionW + GAP * 2
    }
    ctx.fillText(from, x, midY)
    x += fromW + GAP
    const barX = Math.round(x)
    const barY = Math.round(midY - BAR_H / 2)
    drawGradientBar(ctx, { x: barX, y: barY, width: BAR_W, height: BAR_H }, gradientStops)
    ctx.fillStyle = AXIS_CONFIG.color
    ctx.fillText(to, barX + BAR_W + GAP, midY)
    ctx.restore()
  }

  /** One path when nothing fades (joints never double the alpha), else
      per segment at the newer end's age. */
  function drawOrderLine(
    ctx: CanvasRenderingContext2D,
    frame: PlotFrame,
    fixations: ScanpathFixation[]
  ) {
    const fading = timeFloor !== -Infinity
    const strokeBoth = () => {
      ctx.strokeStyle = SCANPATH_COLORS.halo
      ctx.lineWidth = L.polylineWidth + 1.5
      ctx.stroke()
      ctx.strokeStyle = SCANPATH_COLORS.polyline
      ctx.lineWidth = L.polylineWidth
      ctx.stroke()
    }
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    if (!fading && fixations.length > 1) {
      ctx.beginPath()
      ctx.moveTo(stim.x(fixations[0].x, frame), stim.y(fixations[0].y, frame))
      for (let i = 1; i < fixations.length; i++) {
        ctx.lineTo(stim.x(fixations[i].x, frame), stim.y(fixations[i].y, frame))
      }
      ctx.globalAlpha = L.polylineAlpha
      strokeBoth()
    } else {
      for (let i = 1; i < fixations.length; i++) {
        const a = fixations[i - 1]
        const b = fixations[i]
        ctx.beginPath()
        ctx.moveTo(stim.x(a.x, frame), stim.y(a.y, frame))
        ctx.lineTo(stim.x(b.x, frame), stim.y(b.y, frame))
        ctx.globalAlpha = L.polylineAlpha * ageAlpha(b)
        strokeBoth()
      }
    }
    ctx.restore()
  }

  /** Labels newest first, skipping any that would overlap a placed one
      (checked on a coarse cell grid), so dense recordings stay legible. */
  function drawNumbers(
    ctx: CanvasRenderingContext2D,
    frame: PlotFrame,
    fixations: ScanpathFixation[]
  ) {
    ctx.save()
    ctx.font = `${L.numberFontSize}px ${SYSTEM_SANS_SERIF_SMALL_STACK}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = SCANPATH_COLORS.halo
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.fillStyle = SCANPATH_COLORS.numberLabel
    const CELL = 6
    const h = L.numberFontSize / 2
    const taken = new Set<number>()
    for (let i = fixations.length - 1; i >= 0; i--) {
      const f = fixations[i]
      const r = displayRadiusFor(f)
      const label = String(f.rank)
      const w = ctx.measureText(label).width
      // Right of the marker, flipped to its left where that would leave the plot;
      // held inside it vertically, so an edge fixation's number is never cut.
      const cx = stim.x(f.x, frame)
      const tx = cx + r + L.numberOffset + w > frame.right ? cx - r - L.numberOffset - w : cx + r + L.numberOffset
      const ty = Math.min(frame.bottom - h, Math.max(frame.y + h, stim.y(f.y, frame) - r * 0.4))
      const cells: number[] = []
      for (let cx = Math.floor(tx / CELL); cx <= (tx + w) / CELL; cx++) {
        for (let cy = Math.floor((ty - h) / CELL); cy <= (ty + h) / CELL; cy++) {
          cells.push(cx * 100003 + cy)
        }
      }
      if (cells.some(c => taken.has(c))) continue
      for (const c of cells) taken.add(c)
      ctx.globalAlpha = ageAlpha(f)
      ctx.strokeText(label, tx, ty)
      ctx.fillText(label, tx, ty)
    }
    ctx.restore()
  }

  function drawScanpath(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (!data) return
    const fixations = timeCutoff === Infinity ? data.fixations : data.fixations.filter(isVisible)
    // The stimulus (image or the video's current frame) under everything, at its projected rect.
    if (media) stim.drawMedia(ctx, frame, mediaRegionOf(media), background)

    // Order line (under the circles), on a white halo so the path stays
    // readable across busy reference imagery.
    if (showFixationOrder) drawOrderLine(ctx, frame, fixations)

    // Fixation circles: translucent fill inside the conventional darker
    // stroke; older trail members fade.
    ctx.save()
    for (const f of fixations) {
      const cx = stim.x(f.x, frame)
      const cy = stim.y(f.y, frame)
      const r = displayRadiusFor(f)
      const age = ageAlpha(f)
      const fill = fillFor(f)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.globalAlpha = L.fixationFillAlpha * age
      ctx.fillStyle = fill
      ctx.fill()
      ctx.globalAlpha = age
      ctx.strokeStyle = interpolateColor(fill, '#000000', 0.35)
      ctx.lineWidth = L.circleStrokeWidth
      ctx.stroke()
      // White halo just outside the outline, so a marker reads on any background.
      ctx.beginPath()
      ctx.arc(cx, cy, r + L.circleStrokeWidth / 2 + 1, 0, Math.PI * 2)
      ctx.strokeStyle = SCANPATH_COLORS.halo
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.restore()

    if (showNumbers) drawNumbers(ctx, frame, fixations)
  }

  // ── Play bar: hovering its rail marks that moment on the stimulus's other plots.
  let host = $state<HTMLDivElement | null>(null)

  function onRailHover(t: number | null) {
    if (t === null || participantId === undefined) return plotCursor?.publish(null)
    plotCursor?.publish({ times: () => [t], participants: () => [participantId] })
  }
</script>

<div class="scanpath-host" bind:this={host}>
  <canvas
    use:plot.plotAction
    aria-label="Scanpath visualization"
  ></canvas>
  {#if hasPlayBar}
    <PlaybackBar
      {playback}
      {clock}
      span={player.span}
      {playTime}
      {isPlaying}
      {trailLength}
      {media}
      videoElement={player.videoElement}
      mediaFailed={stim.mediaFailed}
      {host}
      onDraft={ms => (windowDraft = ms)}
      onHoverTime={onRailHover}
    />
  {/if}
</div>

<style>
  .scanpath-host {
    display: flex;
    flex-direction: column;
    width: fit-content;
    height: fit-content;
  }
</style>
