<script lang="ts">
  import {
    usePlot,
    trackOnlyHit,
    PLOT_BORDER_PX,
    type CanvasExportProps,
    type FrameHit,
    type PlotFrame,
  } from '$lib/plots/shared'
  import type { PlotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
  import { markCrosshairNode } from '$lib/plots/shared/canvasUtils'
  import { untrack } from 'svelte'
  import Play from 'lucide-svelte/icons/play'
  import Pause from 'lucide-svelte/icons/pause'
  import { SYSTEM_SANS_SERIF_SMALL_STACK } from '$lib/shared/textMeasure'
  import { AXIS_CONFIG } from '$lib/plots/shared/axisUtils'
  import { drawGradientBar } from '$lib/plots/shared/legendGradient'
  import { isTextEntryTarget } from '$lib/workspace/keys'
  import { SCANPATH_COLORS, SCANPATH_LAYOUT } from '../const'
  import { getColorForValue, interpolateColor } from '$lib/color'
  import { PRESET_PALETTES, resolvePalette } from '$lib/color/palettes'
  import { useMediaElements } from '../../shared/mediaElements.svelte'
  import { mediaRegionOf } from '$lib/data/media/stimulusMedia'
  import type { Rect } from '$lib/data/media/mediaAlignment'
  import { drawStimulusBackground, stimulusSpace, worldAspect, type StimulusBackground } from '$lib/plots/shared/stimulusBackground'
  import type { StimulusMedia } from '$lib/data/types'
  import type { ScanpathData, ScanpathFixation } from '../types'
  import type { ScanpathPlayback } from '../core/screen.svelte'
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
    /** Shared PLOT CURSOR: publishes this participant and the hovered
        fixation's time; marks the fixation active at other plots' times. No
        whole-panel outline: lit from elsewhere it read as a stray focus border. */
    plotCursor?: PlotCursorPort | null
    /** Screen-only; export has no clock and draws every fixation. */
    playback?: ScanpathPlayback | null
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

  const mediaElements = useMediaElements()
  /** The decoded background element, or null while it loads. Depends on the
      cache version so the canvas repaints when decoding finishes (videos are
      parked on their first frame, so no black background flashes). */
  const mediaElement = $derived.by(() => {
    if (!media || mediaStimulusId === undefined) return null
    void mediaElements.version
    return mediaElements.getReadyElement(mediaStimulusId, media)
  })
  /** The browser can't decode the medium: playback falls back to the
      fixation clock and the bar says why the background is missing. */
  const mediaFailed = $derived.by(() => {
    if (!media || mediaStimulusId === undefined) return false
    void mediaElements.version
    return mediaElements.failed(mediaStimulusId)
  })

  // ── Playback: a PLAYER on a playback clock (playbackClock.svelte.ts).
  // `playTime` null shows every fixation: an image's idle state and exports.
  // A video idles at its first full trail, so the frame and fixations agree.
  const videoElement = $derived(
    media?.kind === 'video' && mediaElement instanceof HTMLVideoElement
      ? mediaElement
      : null
  )
  const videoOffset = $derived(media?.startOffset ?? 0)
  const clock = $derived(playback?.clock ?? null)
  const playTime = $derived(clock?.time ?? null)
  const isPlaying = $derived(clock?.playing ?? false)

  /** A trail length being dragged on the bar, before it is committed. */
  let windowDraft = $state<number | null>(null)
  const trail = $derived(windowDraft ?? trailLength)

  /** The time range, else 0 to the last fixation's or the video's end. A
      ready video element already knows its duration. */
  const ownSpan = $derived.by(() => {
    if (!data || data.fixations.length === 0) return { start: 0, end: 0 }
    const last = data.fixations[data.fixations.length - 1]
    const videoEnd = videoElement ? videoOffset + (videoElement.duration || 0) * 1000 : 0
    const end = timelineEnd || Math.max(last.start + last.duration, videoEnd)
    return { start: timelineStart, end: Math.max(timelineStart, end) }
  })

  /** The clock's span (all players' union, so lockstep plots share a rail). */
  const span = $derived(clock?.span ?? ownSpan)
  const spanMs = $derived(span.end - span.start)

  /** A video's idle time: the end of its first trail (All: the end). */
  const rest = $derived(
    media?.kind === 'video' && ownSpan.end > ownSpan.start
      ? Math.min(ownSpan.end, trailLength > 0 ? ownSpan.start + trailLength : ownSpan.end)
      : null
  )

  // Untracked writes: joining reads the clock's span, which must not re-run us.
  $effect(() => {
    const c = clock
    if (!c || !playback) return
    const player = { span: ownSpan, speed: playbackSpeed, rest }
    untrack(() => c.join(playback.plotId, player))
  })
  $effect(() => {
    const c = clock
    if (!c || !playback) return
    const el = videoElement
    const offset = videoOffset
    untrack(() => c.bindVideo(playback.plotId, el, offset))
    return () => untrack(() => c.bindVideo(playback.plotId, null, 0))
  })

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

  /** The fixation in progress at `t`, or -1 (a saccade or a gap). */
  function activeAt(t: number): number {
    const fx = data?.fixations ?? []
    let lo = 0
    let hi = fx.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (fx[mid].start <= t) lo = mid + 1
      else hi = mid
    }
    const f = fx[lo - 1]
    return f && t < f.start + f.duration ? lo - 1 : -1
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

  /** Visible fixations active at the cursor's times (another plot's hover,
      a playing shared clock) or at our own playing time. */
  const cursorFixations = $derived.by(() => {
    const times = [...(plotCursor?.times ?? [])]
    if (isPlaying && playTime !== null) times.push(playTime)
    if (times.length === 0 || !data) return []
    const out: number[] = []
    for (const t of times) {
      const i = activeAt(t)
      if (i >= 0 && isVisible(data.fixations[i]) && !out.includes(i)) out.push(i)
    }
    return out
  })

  /** The hovered fixation's highlight ring, and the plot cursor's marks. */
  function drawScanpathOverlay(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (!data) return
    for (const i of cursorFixations) {
      const f = data.fixations[i]
      markCrosshairNode(ctx, projectX(f.x, frame), projectY(f.y, frame), displayRadiusFor(f) + 3)
    }
    const hovered = plot.hover.data?.fixationIndex
    if (hovered == null) return
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

  /** Gaze rect the plot frames: the media, grown to any fixation off it, else the padded fixation extent. */
  const world = $derived.by((): Rect | null => {
    if (!data) return null
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

  const space = $derived(world ? stimulusSpace(world, frameW, frameH, L.tickCount) : null)

  /** The bar gets its own row below the canvas, on screen only. Not keyed
      on async media readiness, so the height never jumps. */
  const PLAY_BAR_HEIGHT = 36
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

  /** The hovered fixation's midpoint (the recurrence plot's convention);
      empty if the data changed under it. */
  function fixationTimes(index: number): number[] {
    const f = data?.fixations[index]
    return f ? [f.start + f.duration / 2] : []
  }

  const plot = usePlot<ScanpathHit>({
    props: () => props,
    height: () => (hasPlayBar ? Math.max(60, height - PLAY_BAR_HEIGHT) : height),
    deps: () => [mediaElement, clock?.frame, timeCutoff, trail, space],
    placeholder: () => unavailableMessage,
    gutters: () => {
      if (unavailableMessage || !space) return {}
      return {
        left: { tickLabels: space.yTicks.labels, title: 'Y' },
        bottom: { tickLabels: space.xTicks.labels, title: 'X' },
        pad: { right: PLOT_BORDER_PX },
        aspect: worldAspect(world!),
      }
    },
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
        anchorX: projectX(f.x, frame),
        anchorY: projectY(f.y, frame) + displayRadiusFor(f),
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
    axes: () => {
      if (unavailableMessage || !space) return {}
      return {
        bottom: { ticks: space.xTicks, title: 'X' },
        left: { ticks: space.yTicks, title: 'Y' },
      }
    },
  })

  function projectX(x: number, frame: PlotFrame): number {
    return frame.x + x * space!.view.scale + space!.view.offsetX
  }

  // Eye-tracker y already grows downward, as does canvas y: no flip.
  function projectY(y: number, frame: PlotFrame): number {
    return frame.y + y * space!.view.scale + space!.view.offsetY
  }

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

  function strokeFor(f: ScanpathFixation): string {
    return interpolateColor(fillFor(f), '#000000', 0.35)
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
      playback the bubble INFLATES over the fixation's own dwell — it appears
      at the minimum size exactly at onset and grows to its final radius as
      the elapsed dwell accumulates, so onset moments read directly off the
      animation. */
  function displayRadiusFor(f: ScanpathFixation): number {
    if (timeCutoff === Infinity) return radiusFor(f.duration)
    return radiusFor(Math.min(Math.max(0, timeCutoff - f.start), f.duration))
  }

  /** The fixations on screen right now: all of them, or (during playback)
      those whose onset has passed and still sits inside the trail. */
  function visibleFixations(): ScanpathFixation[] {
    if (!data) return []
    if (timeCutoff === Infinity) return data.fixations
    return data.fixations.filter(isVisible)
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
    ctx.fillStyle = AXIS_CONFIG.color
    let x = frame.right - keyW - (withCaption ? captionW + GAP * 2 : 0)
    if (withCaption) {
      ctx.textAlign = 'left'
      ctx.fillText(caption, x, midY)
      x += captionW + GAP * 2
    }
    ctx.textAlign = 'left'
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
      ctx.moveTo(projectX(fixations[0].x, frame), projectY(fixations[0].y, frame))
      for (let i = 1; i < fixations.length; i++) {
        ctx.lineTo(projectX(fixations[i].x, frame), projectY(fixations[i].y, frame))
      }
      ctx.globalAlpha = L.polylineAlpha
      strokeBoth()
    } else {
      for (let i = 1; i < fixations.length; i++) {
        const a = fixations[i - 1]
        const b = fixations[i]
        ctx.beginPath()
        ctx.moveTo(projectX(a.x, frame), projectY(a.y, frame))
        ctx.lineTo(projectX(b.x, frame), projectY(b.y, frame))
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
      const cx = projectX(f.x, frame)
      const tx = cx + r + L.numberOffset + w > frame.right ? cx - r - L.numberOffset - w : cx + r + L.numberOffset
      const ty = Math.min(frame.bottom - h, Math.max(frame.y + h, projectY(f.y, frame) - r * 0.4))
      const right = tx + w
      const cells: number[] = []
      for (let cx = Math.floor(tx / CELL); cx <= right / CELL; cx++) {
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
    const fixations = visibleFixations()
    // The stimulus (image or the video's current frame) under everything, at its projected rect.
    if (media) {
      const r = mediaRegionOf(media)
      const s = space!.view.scale
      drawStimulusBackground(ctx, mediaElement, projectX(r.x, frame), projectY(r.y, frame), r.width * s, r.height * s, background)
    }

    // Order line (under the circles), on a white halo so the path stays
    // readable across busy reference imagery.
    if (showFixationOrder) drawOrderLine(ctx, frame, fixations)

    // Fixation circles: translucent fill inside the conventional darker
    // stroke; older trail members fade.
    ctx.save()
    for (const f of fixations) {
      const cx = projectX(f.x, frame)
      const cy = projectY(f.y, frame)
      const r = displayRadiusFor(f)
      const age = ageAlpha(f)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.globalAlpha = L.fixationFillAlpha * age
      ctx.fillStyle = fillFor(f)
      ctx.fill()
      ctx.globalAlpha = age
      ctx.strokeStyle = strokeFor(f)
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

  // ── Play bar ──────────────────────────────────────────────────────────

  const railPos = (t: number) => (spanMs > 0 ? Math.min(1, Math.max(0, (t - span.start) / spanMs)) : 0)

  /** Parked shows the end: everything is on screen. */
  const shownTime = $derived(playTime ?? span.end)
  const trailFrom = $derived(
    playTime !== null && trail > 0 ? Math.max(span.start, playTime - trail) : span.start
  )

  let railEl = $state<HTMLDivElement | null>(null)

  function timeAtRail(clientX: number): number {
    if (!railEl) return span.start
    const rect = railEl.getBoundingClientRect()
    const f = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
    return span.start + Math.min(1, Math.max(0, f)) * spanMs
  }

  // Hovering the rail marks that moment on the stimulus's other plots.
  function onRailHover(event: PointerEvent) {
    if (spanMs <= 0 || participantId === undefined) return
    const t = timeAtRail(event.clientX)
    plotCursor?.publish({ times: () => [t], participants: () => [participantId] })
  }

  function onRailLeave() {
    plotCursor?.publish(null)
  }

  // Dragging the trail's left edge sets its length (the rail start = All),
  // committed once on release: one undo step.
  function onHandleDown(event: PointerEvent) {
    if (playTime === null) return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget as HTMLElement
    handle.setPointerCapture(event.pointerId)
    windowDraft = trail
  }

  function onHandleMove(event: PointerEvent) {
    if (windowDraft === null || playTime === null) return
    const at = timeAtRail(event.clientX)
    const allZone = span.start + spanMs * 0.01
    windowDraft = at <= allZone ? 0 : Math.max(100, Math.round((playTime - at) / 10) * 10)
  }

  function onHandleUp() {
    const next = windowDraft
    if (next === null) return
    if (next !== trailLength) playback?.commitWindow(next)
    windowDraft = null
  }

  // Space plays/pauses the scanpath under the pointer (or holding focus).
  let host = $state<HTMLDivElement | null>(null)
  let hovered = false

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey) return
    if (!hasPlayBar || !clock || spanMs <= 0) return
    const focusInside = !!host && host.contains(document.activeElement)
    if (!hovered && !focusInside) return
    if (isTextEntryTarget(event) && (event.target as HTMLInputElement).type !== 'range') return
    event.preventDefault()
    toggle()
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="scanpath-host"
  bind:this={host}
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
>
  <canvas
    use:plot.plotAction
    aria-label="Scanpath visualization"
  ></canvas>
  {#if hasPlayBar}
    <!-- Disabled only while a set video is still decoding; a plain image or
         no media plays off the fixations' recording-time extent directly. -->
    {@const barDisabled = spanMs <= 0 || !clock || (media?.kind === 'video' && !videoElement && !mediaFailed)}
    {@const fromPct = railPos(trailFrom) * 100}
    {@const nowPct = railPos(shownTime) * 100}
    <div class="video-pill" style:height={`${PLAY_BAR_HEIGHT}px`}>
      <button
        class="pill-toggle"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onclick={toggle}
        disabled={barDisabled}
      >
        {#if isPlaying}
          <Pause size={'1em'} fill="currentColor" strokeWidth={0} />
        {:else}
          <Play size={'1em'} fill="currentColor" strokeWidth={0} />
        {/if}
      </button>
      <!-- The filled part is the trail: the fixations on screen. -->
      <div
        class="pill-rail"
        bind:this={railEl}
        data-owns-drag
        onpointermove={onRailHover}
        onpointerleave={onRailLeave}
      >
        <input
          class="pill-seek"
          type="range"
          min={span.start}
          max={span.end > span.start ? span.end : span.start + 1}
          step="10"
          value={shownTime}
          oninput={e => clock?.seek(Number(e.currentTarget.value), playback?.plotId ?? null)}
          disabled={barDisabled}
          aria-label="Playback position"
          style:--trail-from={`${fromPct}%`}
          style:--seek-progress={`${nowPct}%`}
        />
        {#if playTime !== null && !barDisabled}
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
