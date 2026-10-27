<script lang="ts">
  import {
    usePlot,
    canvasBlockSelect,
    trackOnlyHit,
    type CanvasExportProps,
    type FrameHit,
    type PlotFrame,
  } from '$lib/plots/shared'
  import type { PlotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
  import { markCrosshairNode } from '$lib/plots/shared/canvasUtils'
  import { untrack } from 'svelte'
  import Play from 'lucide-svelte/icons/play'
  import Pause from 'lucide-svelte/icons/pause'
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw'
  import { SYSTEM_SANS_SERIF_SMALL_STACK } from '$lib/shared/textMeasure'
  import { linearTicks } from '$lib/plots/shared/ticks'
  import { AXIS_CONFIG } from '$lib/plots/shared/axisUtils'
  import { drawGradientBar } from '$lib/plots/shared/legendGradient'
  import { isTextEntryTarget } from '$lib/workspace/keys'
  import { SCANPATH_COLORS, SCANPATH_LAYOUT } from '../const'
  import { getColorForValue, interpolateColor } from '$lib/color'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { useMediaElements } from '../../shared/mediaElements.svelte'
  import { mediaRegionOf } from '$lib/data/media/stimulusMedia'
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
    /** Marker fill in 'solid' mode. */
    solidColor?: string
    /** Trail length (recording ms): during playback only fixations that
        began within the last N ms stay on screen, fading with age. 0 = keep
        all. */
    playbackWindow?: number
    /** Playback rate relative to recording time (1 = real time). */
    playbackSpeed?: number
    /** The time range the fixations were cut to (0 end = to the end); the
        play span follows it. */
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
    /** Shared PLOT CURSOR. Publishes this participant on any hover and the
        hovered fixation's time; reads other plots' times and marks the
        fixation active then. No whole-panel outline: lit by a hover
        elsewhere it read as a stray focus border rather than "this person". */
    plotCursor?: PlotCursorPort | null
    /** Screen-only PLAYBACK CLOCK membership; export has none and draws the
        full parked scanpath. */
    playback?: ScanpathPlayback | null
  }

  let {
    data,
    showFixationOrder = true,
    showNumbers = true,
    colorMode = 'time',
    colorScale = undefined,
    solidColor = SCANPATH_COLORS.fixationFill,
    playbackWindow = 0,
    playbackSpeed = 1,
    timelineStart = 0,
    timelineEnd = 0,
    width = 400,
    height = 400,
    margin = 0,
    unavailableMessage = null,
    participantId,
    media = null,
    mediaStimulusId,
    plotCursor = null,
    playback = null,
  }: Props = $props()

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

  // ── Playback: this plot is a PLAYER on a playback clock (see
  // playbackClock.svelte.ts), the stimulus's shared one unless the plot opted
  // out. Fixations appear as recording time passes. A reference video is
  // slaved to the clock. `playTime` null means "show everything": the parked
  // state before the first play and after a reset, and what exports render.
  const videoElement = $derived(
    media?.kind === 'video' && mediaElement instanceof HTMLVideoElement
      ? mediaElement
      : null
  )
  /** Recording ms at which the video's first frame shows. */
  const videoOffset = $derived(media?.startOffset ?? 0)
  let videoDurationMs = $state(0)

  $effect(() => {
    const el = videoElement
    if (!el) return
    const read = () => {
      videoDurationMs = Number.isFinite(el.duration) ? el.duration * 1000 : 0
    }
    read()
    el.addEventListener('durationchange', read)
    return () => el.removeEventListener('durationchange', read)
  })

  const clock = $derived(playback?.clock ?? null)
  const playTime = $derived(clock?.time ?? null)
  const isPlaying = $derived(clock?.playing ?? false)
  /** Repaint signal from the clock (ticks, decoded video seeks). */
  const clockFrame = $derived(clock?.frame ?? 0)

  /** A trail length being dragged on the bar, before it is committed. */
  let windowDraft = $state<number | null>(null)
  const trail = $derived(windowDraft ?? playbackWindow)

  /** This plot's play span: the time range, else 0 to the last fixation's
      end (or the video's end, whichever is later). */
  const ownSpan = $derived.by(() => {
    if (!data || data.fixations.length === 0) return { start: 0, end: 0 }
    const last = data.fixations[data.fixations.length - 1]
    const videoEnd = videoElement && videoDurationMs > 0 ? videoOffset + videoDurationMs : 0
    const start = timelineStart > 0 ? timelineStart : 0
    const end = timelineEnd > 0 ? timelineEnd : Math.max(last.start + last.duration, videoEnd)
    return { start, end: Math.max(start, end) }
  })

  /** The span the bar shows: the clock's (every player's union, so lockstep
      plots share one rail), else this plot's own. */
  const span = $derived(clock && clock.players.size > 0 ? clock.span : ownSpan)
  const spanMs = $derived(span.end - span.start)

  // Membership. The clock is written untracked: joining reads its span, and
  // the effect must not re-run on the write it makes itself.
  $effect(() => {
    const c = clock
    if (!c || !playback) return
    const player = { span: ownSpan, speed: playbackSpeed }
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

  function togglePlayback() {
    clock?.toggle(playback?.plotId ?? null)
  }

  function resetPlayback() {
    clock?.reset()
  }

  function onSeek(event: Event) {
    const ms = Number((event.currentTarget as HTMLInputElement).value)
    clock?.seek(ms, playback?.plotId ?? null)
  }

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

  /** Fixations whose onset predates this are hidden too: the trail's left
      edge (-Infinity = keep everything). Only applies mid-playback; the
      parked full view ignores the trail. */
  const timeFloor = $derived(
    trail > 0 && timeCutoff !== Infinity ? timeCutoff - trail : -Infinity
  )

  function isVisible(f: ScanpathFixation): boolean {
    return f.start <= timeCutoff && f.start >= timeFloor
  }

  /** Opacity factor by age inside the trail: a fixation fades as it nears
      the trail's edge instead of vanishing at full strength (entry is just
      as gradual: the marker inflates over its dwell). */
  function ageAlpha(f: ScanpathFixation): number {
    if (timeFloor === -Infinity) return 1
    const age = (timeCutoff - f.start) / trail
    return 1 - 0.8 * Math.min(1, Math.max(0, age))
  }

  /** Index of the last fixation starting at or before `t`, or -1. */
  function lastStartedAt(t: number): number {
    if (!data) return -1
    const fx = data.fixations
    let lo = 0
    let hi = fx.length - 1
    let found = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (fx[mid].start <= t) {
        found = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    return found
  }

  /** The fixation in progress at `t`, or -1 (a saccade or a gap). */
  function activeAt(t: number): number {
    const k = lastStartedAt(t)
    if (k < 0 || !data) return -1
    const f = data.fixations[k]
    return t < f.start + f.duration ? k : -1
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

  /** Fixations active at the plot cursor's times (another plot's hover, and
      the shared clock while it plays) and at a private clock's playing time,
      among the ones on screen: all marked with the cursor's node mark. */
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
        xTicks: linearTicks(minX, minX + w, L.tickCount),
        yTicks: linearTicks(minY, minY + h, L.tickCount),
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
      xTicks: linearTicks(dataMinX, dataMaxX, L.tickCount),
      yTicks: linearTicks(dataMinY, dataMaxY, L.tickCount),
    }
  })

  /** The control bar gets its own row BELOW the canvas: the canvas gives up
      the bar's height so the two never overlap. Screen only (export has no
      clock, so the exported canvas keeps its full height). Not keyed on
      async media readiness, so the height never jumps. */
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

  /** The hovered fixation's midpoint for the cursor's time channel (the
      recurrence plot's convention); empty if the data changed under it. */
  function fixationTimes(index: number): number[] {
    const f = data?.fixations[index]
    return f ? [f.start + f.duration / 2] : []
  }

  const plot = usePlot<ScanpathHit>({
    width: () => width,
    height: () => (hasPlayBar ? Math.max(60, height - PLAY_BAR_HEIGHT) : height),
    margin: () => margin,
    deps: () => [data, showFixationOrder, showNumbers, colorMode, gradientStops, solidColor, trail, unavailableMessage, media, mediaElement, clockFrame, timeCutoff],
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
        anchorY: projectY(f.y, frame) - displayRadiusFor(f),
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
  // its onset within the rendered fixations' onset span.
  const gradientStops = $derived(
    colorScale && colorScale.length >= 2
      ? colorScale
      : [...PRESET_PALETTES.VIRIDIS.colors]
  )

  /** Gradient domain: the rendered fixations' onset span, FIXED through
      playback. Color always means "when", so a fixation keeps its color for
      the whole run and the key never moves; age inside the trail is shown by
      opacity instead (see `ageAlpha`). */
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
      X-axis title row, whose single centred "X" leaves that space free, so the
      key costs no plot height and still lands in exports. Fixed through
      playback, like the colors it explains. Skipped when the plot is too
      narrow to clear the title. */
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
    const top = frame.bottom + frame.bottomTitleOffset
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

  /** The order line among the visible fixations: one path when nothing
      fades, else per segment at the newer end's age. */
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

  /** Number labels, newest first, skipping any that would overlap one
      already placed: dense recordings keep their latest numbers legible
      instead of piling up. A spatial hash keeps it linear. */
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
    const CELL = 24
    const h = L.numberFontSize + 2
    const grid = new Map<number, { x: number; y: number; w: number }[]>()
    const cellKey = (cx: number, cy: number) => cx * 100003 + cy
    for (let i = fixations.length - 1; i >= 0; i--) {
      const f = fixations[i]
      const r = displayRadiusFor(f)
      const tx = projectX(f.x, frame) + r + L.numberOffset
      const ty = projectY(f.y, frame) - r * 0.4
      const label = String(f.rank)
      const w = ctx.measureText(label).width + 2
      const top = ty - h / 2
      const c0 = Math.floor(tx / CELL)
      const c1 = Math.floor((tx + w) / CELL)
      const r0 = Math.floor(top / CELL)
      const r1 = Math.floor((top + h) / CELL)
      let blocked = false
      for (let cx = c0; cx <= c1 && !blocked; cx++) {
        for (let cy = r0; cy <= r1 && !blocked; cy++) {
          for (const o of grid.get(cellKey(cx, cy)) ?? []) {
            if (tx < o.x + o.w && o.x < tx + w && top < o.y + h && o.y < top + h) {
              blocked = true
              break
            }
          }
        }
      }
      if (blocked) continue
      const rect = { x: tx, y: top, w }
      for (let cx = c0; cx <= c1; cx++) {
        for (let cy = r0; cy <= r1; cy++) {
          const k = cellKey(cx, cy)
          const list = grid.get(k)
          if (list) list.push(rect)
          else grid.set(k, [rect])
        }
      }
      ctx.globalAlpha = ageAlpha(f)
      ctx.strokeText(label, tx, ty)
      ctx.fillText(label, tx, ty)
    }
    ctx.restore()
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

    // Order line (under the circles), on a white halo so the path stays
    // readable across busy reference imagery.
    if (showFixationOrder) drawOrderLine(ctx, frame, fixations)

    // Fixation circles: slightly translucent fill (overlaps stay readable)
    // inside the conventional darker stroke; older trail members fade.
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
    }
    ctx.restore()

    if (showNumbers) drawNumbers(ctx, frame, fixations)
  }

  // ── Play bar ──────────────────────────────────────────────────────────

  /** Fraction of the rail for a recording time. */
  const railPos = (t: number) => (spanMs > 0 ? Math.min(1, Math.max(0, (t - span.start) / spanMs)) : 0)

  /** The playhead the bar shows: the end while parked (everything shown). */
  const shownTime = $derived(playTime ?? span.end)
  /** The trail's left edge on the rail: everything left of it is hidden. */
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

  // Hovering the rail previews that moment in the other plots of the
  // stimulus through the plot cursor's time channel.
  function onRailHover(event: PointerEvent) {
    if (spanMs <= 0 || participantId === undefined) return
    const t = timeAtRail(event.clientX)
    plotCursor?.publish({ times: () => [t], participants: () => [participantId] })
  }

  function onRailLeave() {
    plotCursor?.publish(null)
  }

  // Dragging the trail's left edge sets the trail length; dropping it at the
  // rail start means "All". Committed once, on release (one undo step).
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
    if (next !== playbackWindow) playback?.commitWindow(next)
    windowDraft = null
  }

  /** Arrows shorten or lengthen the trail by 250 ms (the left edge moves
      with the arrow); Home sets All. Each press is one undo step. */
  function onHandleKey(event: KeyboardEvent) {
    const STEP = 250
    let next: number | null = null
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      next = trail > 0 ? trail + STEP : null
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      next = trail > 0 ? Math.max(100, trail - STEP) : Math.max(100, Math.round(spanMs / 4 / 10) * 10)
    } else if (event.key === 'Home') {
      next = 0
    }
    if (next === null) return
    event.preventDefault()
    if (next !== playbackWindow) playback?.commitWindow(next)
  }

  // Space plays/pauses the scanpath under the pointer (or holding focus).
  let host = $state<HTMLDivElement | null>(null)
  let hovered = false

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey) return
    if (!hasPlayBar || !clock || spanMs <= 0) return
    const focusInside = !!host && host.contains(document.activeElement)
    if (!hovered && !focusInside) return
    const target = event.target as HTMLElement | null
    const isOwnSeek = target instanceof HTMLInputElement && target.type === 'range' && !!host?.contains(target)
    if (isTextEntryTarget(event) && !isOwnSeek) return
    event.preventDefault()
    togglePlayback()
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
    use:canvasBlockSelect={{ regions: plot.blockedRegions }}
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
        onclick={togglePlayback}
        disabled={barDisabled}
      >
        {#if isPlaying}
          <Pause size={'1em'} fill="currentColor" strokeWidth={0} />
        {:else}
          <Play size={'1em'} fill="currentColor" strokeWidth={0} />
        {/if}
      </button>
      {#if playTime !== null}
        <button class="pill-toggle" aria-label="Show all fixations" onclick={resetPlayback}>
          <RotateCcw size={'1em'} />
        </button>
      {/if}
      <!-- The seek bar's filled part is the trail: exactly the fixations on
           screen. Its left edge is draggable to change the trail length. -->
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
          oninput={onSeek}
          disabled={barDisabled}
          aria-label="Playback position"
          style:--trail-from={`${fromPct}%`}
          style:--seek-progress={`${nowPct}%`}
        />
        {#if playTime !== null && !barDisabled}
          <!-- A button so the workspace never starts a pan from it. -->
          <button
            type="button"
            class="pill-trail-edge"
            style:left={`${fromPct}%`}
            role="slider"
            aria-label="Trail length"
            aria-valuemin={0}
            aria-valuemax={spanMs}
            aria-valuenow={trail}
            aria-valuetext={trail > 0 ? formatTime(trail) : 'All'}
            onpointerdown={onHandleDown}
            onpointermove={onHandleMove}
            onpointerup={onHandleUp}
            onpointercancel={onHandleUp}
            onkeydown={onHandleKey}
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

  .pill-trail-edge:focus-visible {
    outline: 2px solid var(--c-brand);
    outline-offset: 2px;
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
