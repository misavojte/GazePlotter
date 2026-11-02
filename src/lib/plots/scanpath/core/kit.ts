/**
 * The Scanpath kit: one participant's fixations over the stimulus, all of
 * them parked, or during playback the trail ending at the shell's moment, older
 * members fading (the stimulus space and its shell: `shared/stimulusSpace.ts`).
 */
import { getColorForValue, interpolateColor } from '$lib/color'
import { PRESET_PALETTES, resolvePalette } from '$lib/color/palettes'
import { mediaRegionOf } from '$lib/data/media/stimulusMedia'
import type { Rect } from '$lib/data/media/mediaAlignment'
import type { StimulusMedia } from '$lib/data/types'
import { AXIS_CONFIG } from '$lib/plots/shared/axisUtils'
import { markCrosshairNode } from '$lib/plots/shared/canvasUtils'
import type { CursorRead } from '$lib/plots/shared/cursorMarks'
import { trackOnlyHit, type CanvasSize, type FrameHit, type PlotFrame } from '$lib/plots/shared/frame'
import { defineKit, type SceneContext } from '$lib/plots/shared/kit'
import { drawGradientBar } from '$lib/plots/shared/legendGradient'
import {
  drawStimulus,
  stimulusChrome,
  stimulusScene,
  stimulusX,
  stimulusY,
  type StimulusSpace,
} from '$lib/plots/shared/stimulusSpace'
import { intervalAt } from '$lib/plots/shared/timelineUtils'
import { SYSTEM_SANS_SERIF_SMALL_STACK } from '$lib/shared/textMeasure'
import { SCANPATH_COLORS, SCANPATH_LAYOUT as L } from '../const'
import type { ScanpathData, ScanpathFixation } from '../types'
import { buildScanpathTooltipContent } from './tooltip'
import type { ScanpathInput } from './view'

/** Hover payload: the hovered fixation's index, or null for a bare panel
    hover (which still drives the shared plot cursor). */
type ScanpathHit = { fixationIndex: number | null }

/**
 * Gaze rect the plot frames: the media, grown to any fixation off it, else the
 * padded fixation extent. Gaze coordinates are stimulus pixels, so fixations
 * land exactly on the image.
 */
function worldOf(data: ScanpathData, media: StimulusMedia | null): Rect {
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
}

/** What playback shows: fixations from `floor` (-Infinity keeps everything) to `cutoff`. */
interface Trail {
  cutoff: number
  floor: number
  length: number
}

function isVisible(t: Trail, f: ScanpathFixation): boolean {
  return f.start <= t.cutoff && f.start >= t.floor
}

/** Fades a fixation as it nears the trail's edge, so it never vanishes
    at full strength. */
function ageAlpha(t: Trail, f: ScanpathFixation): number {
  if (t.floor === -Infinity) return 1
  const age = (t.cutoff - f.start) / t.length
  return 1 - 0.8 * Math.min(1, Math.max(0, age))
}

/** The rendered onset span, fixed through playback: color always means
    "when"; age in the trail is opacity (`ageAlpha`). */
function gradientDomainOf(data: ScanpathData | null): [number, number] {
  if (!data || data.fixations.length === 0) return [0, 1]
  const t0 = data.fixations[0].start
  const t1 = data.fixations[data.fixations.length - 1].start
  // A lone fixation reads as the gradient's start (an unbounded [0, 1]
  // domain would clamp it to the END color).
  return [t0, t1 > t0 ? t1 : t0 + 1]
}

const densityScaleOf = (n: number) =>
  n <= L.densityThreshold ? 1 : Math.max(0.5, Math.sqrt(L.densityThreshold / n))

const scanpathChrome = (input: ScanpathInput, size: CanvasSize) =>
  stimulusChrome(input, input.data && worldOf(input.data, input.media), size)

function scanpathScene(
  input: ScanpathInput,
  { frame, chrome }: SceneContext<ReturnType<typeof scanpathChrome>>
) {
  const { data, settings: s } = input
  const stimulus = stimulusScene(input, chrome.world, frame)
  const { player } = stimulus
  const cutoff = player.playTime !== null ? player.playTime : Infinity
  const floor = player.trail > 0 && cutoff !== Infinity ? cutoff - player.trail : -Infinity
  const trail: Trail = { cutoff, floor, length: player.trail }
  return {
    ...stimulus,
    data,
    trail,
    fixations: !data ? [] : cutoff === Infinity ? data.fixations : data.fixations.filter(f => isVisible(trail, f)),
    showFixationOrder: s.showFixationOrder ?? true,
    showNumbers: s.showNumbers ?? true,
    colorMode: s.colorMode ?? 'time',
    solidColor: s.solidColor ?? SCANPATH_COLORS.fixationFill,
    // Time-extent coloring: fill sampled from the colorScale by onset.
    gradientStops: resolvePalette(s.colorScale, PRESET_PALETTES.VIRIDIS.colors),
    gradientDomain: gradientDomainOf(data),
    densityScale: densityScaleOf(data?.fixations.length ?? 0),
  }
}

type Scene = ReturnType<typeof scanpathScene>

function radiusFor(scene: Scene, duration: number): number {
  // Area linear in duration → radius ∝ √duration (Tobii Pro Lab / BeGaze /
  // OGAMA convention).
  const { data, densityScale } = scene
  if (!data || data.maxDuration <= 0) return ((L.minRadius + L.maxRadius) / 2) * densityScale
  const t = Math.sqrt(Math.max(0, duration) / data.maxDuration)
  return (L.minRadius + (L.maxRadius - L.minRadius) * t) * densityScale
}

/** During playback a marker inflates over its own dwell, from the minimum
    at onset to its final radius, so onsets read off the animation. */
function displayRadiusFor(scene: Scene, f: ScanpathFixation): number {
  const { cutoff } = scene.trail
  if (cutoff === Infinity) return radiusFor(scene, f.duration)
  return radiusFor(scene, Math.min(Math.max(0, cutoff - f.start), f.duration))
}

function fillFor(scene: Scene, f: ScanpathFixation): string {
  if (scene.colorMode === 'solid') return scene.solidColor
  const [t0, t1] = scene.gradientDomain
  return getColorForValue((f.start - t0) / (t1 - t0), 0, 1, scene.gradientStops)
}

/** Visible fixations active at the cursor's times (another plot's hover,
    a playing shared clock) or at our own playing time. */
function cursorFixations(scene: Scene, cursor: CursorRead): number[] {
  const { data, player } = scene
  const times = [...cursor.times]
  if (player.isPlaying && player.playTime !== null) times.push(player.playTime)
  if (times.length === 0 || !data) return []
  const fx = data.fixations
  const out: number[] = []
  for (const t of times) {
    const i = intervalAt(fx.length, i => fx[i].start, i => fx[i].start + fx[i].duration, t)
    if (i >= 0 && isVisible(scene.trail, fx[i]) && !out.includes(i)) out.push(i)
  }
  return out
}

/** Nearest fixation whose marker (plus a small grab margin) contains the
    pointer; ties go to the LATER fixation, which is drawn on top. */
function hitFixation(scene: Scene, x: number, y: number, frame: PlotFrame): number | null {
  const { data, space } = scene
  if (!data || !space) return null
  let best: number | null = null
  let bestDist = Infinity
  for (let i = 0; i < data.fixations.length; i++) {
    const f = data.fixations[i]
    if (f.start > scene.trail.cutoff) break // hidden by playback
    if (!isVisible(scene.trail, f)) continue // aged out of the trail
    const dist = Math.hypot(x - stimulusX(space, f.x, frame), y - stimulusY(space, f.y, frame))
    const grab = Math.max(displayRadiusFor(scene, f), 6) + 2
    if (dist <= grab && dist <= bestDist) {
      best = i
      bestDist = dist
    }
  }
  return best
}

/** Seconds with one decimal: fixation onsets are sub-second apart. */
const formatOnset = (ms: number) => `${(ms / 1000).toFixed(1)} s`

/** Time-gradient key: `Onset 0.0 s [gradient] 4.2 s`, right-aligned on the
    X-axis title row, so it costs no plot height and lands in exports.
    Skipped when the plot is too narrow to clear the title. */
function drawTimeLegend(ctx: CanvasRenderingContext2D, scene: Scene, frame: PlotFrame) {
  const { data } = scene
  if (scene.colorMode !== 'time' || !data) return
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
  drawGradientBar(ctx, { x: barX, y: barY, width: BAR_W, height: BAR_H }, scene.gradientStops)
  ctx.fillStyle = AXIS_CONFIG.color
  ctx.fillText(to, barX + BAR_W + GAP, midY)
  ctx.restore()
}

/** One path when nothing fades (joints never double the alpha), else
    per segment at the newer end's age. */
function drawOrderLine(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  space: StimulusSpace,
  frame: PlotFrame,
  fixations: readonly ScanpathFixation[]
) {
  const fading = scene.trail.floor !== -Infinity
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
    ctx.moveTo(stimulusX(space, fixations[0].x, frame), stimulusY(space, fixations[0].y, frame))
    for (let i = 1; i < fixations.length; i++) {
      ctx.lineTo(stimulusX(space, fixations[i].x, frame), stimulusY(space, fixations[i].y, frame))
    }
    ctx.globalAlpha = L.polylineAlpha
    strokeBoth()
  } else {
    for (let i = 1; i < fixations.length; i++) {
      const a = fixations[i - 1]
      const b = fixations[i]
      ctx.beginPath()
      ctx.moveTo(stimulusX(space, a.x, frame), stimulusY(space, a.y, frame))
      ctx.lineTo(stimulusX(space, b.x, frame), stimulusY(space, b.y, frame))
      ctx.globalAlpha = L.polylineAlpha * ageAlpha(scene.trail, b)
      strokeBoth()
    }
  }
  ctx.restore()
}

/** Labels newest first, skipping any that would overlap a placed one
    (checked on a coarse cell grid), so dense recordings stay legible. */
function drawNumbers(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  space: StimulusSpace,
  frame: PlotFrame,
  fixations: readonly ScanpathFixation[]
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
    const r = displayRadiusFor(scene, f)
    const label = String(f.rank)
    const w = ctx.measureText(label).width
    // Right of the marker, flipped to its left where that would leave the plot;
    // held inside it vertically, so an edge fixation's number is never cut.
    const cx = stimulusX(space, f.x, frame)
    const tx = cx + r + L.numberOffset + w > frame.right ? cx - r - L.numberOffset - w : cx + r + L.numberOffset
    const ty = Math.min(frame.bottom - h, Math.max(frame.y + h, stimulusY(space, f.y, frame) - r * 0.4))
    const cells: number[] = []
    for (let cx = Math.floor(tx / CELL); cx <= (tx + w) / CELL; cx++) {
      for (let cy = Math.floor((ty - h) / CELL); cy <= (ty + h) / CELL; cy++) {
        cells.push(cx * 100003 + cy)
      }
    }
    if (cells.some(c => taken.has(c))) continue
    for (const c of cells) taken.add(c)
    ctx.globalAlpha = ageAlpha(scene.trail, f)
    ctx.strokeText(label, tx, ty)
    ctx.fillText(label, tx, ty)
  }
  ctx.restore()
}

export const scanpathKit = defineKit<ScanpathInput, ScanpathHit>()({
  label: 'Scanpath visualization',
  // Marks may slightly overflow the plot area (edge fixations); the axis frame is drawn on top.
  clip: false,

  chrome: scanpathChrome,
  scene: scanpathScene,

  draw: (ctx, scene, frame) => {
    const { space, fixations, media } = scene
    if (!scene.data || !space) return
    if (media) drawStimulus(ctx, scene, frame, mediaRegionOf(media))

    // Order line (under the circles), on a white halo so the path stays
    // readable across busy reference imagery.
    if (scene.showFixationOrder) drawOrderLine(ctx, scene, space, frame, fixations)

    // Fixation circles: translucent fill inside the conventional darker
    // stroke; older trail members fade.
    ctx.save()
    for (const f of fixations) {
      const cx = stimulusX(space, f.x, frame)
      const cy = stimulusY(space, f.y, frame)
      const r = displayRadiusFor(scene, f)
      const age = ageAlpha(scene.trail, f)
      const fill = fillFor(scene, f)
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

    if (scene.showNumbers) drawNumbers(ctx, scene, space, frame, fixations)
  },

  drawAboveAxes: (ctx, scene, frame) => drawTimeLegend(ctx, scene, frame),

  /** The hovered fixation's highlight ring, and the plot cursor's marks. */
  overlay: {
    key: (scene, cursor) => cursorFixations(scene, cursor).join(','),
    draw: (ctx, scene, frame, { hover, cursor }) => {
      const { data, space } = scene
      if (!data || !space) return
      for (const i of cursorFixations(scene, cursor)) {
        const f = data.fixations[i]
        markCrosshairNode(ctx, stimulusX(space, f.x, frame), stimulusY(space, f.y, frame), displayRadiusFor(scene, f) + 3)
      }
      const hovered = hover?.fixationIndex
      if (hovered == null) return
      const f = data.fixations[hovered]
      if (!f) return
      ctx.save()
      ctx.beginPath()
      ctx.arc(stimulusX(space, f.x, frame), stimulusY(space, f.y, frame), displayRadiusFor(scene, f) + 2.5, 0, Math.PI * 2)
      // White gap ring first, accent ring on top — legible on any background.
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.strokeStyle = SCANPATH_COLORS.hoverRing
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    },
  },

  // Fixation markers carry a tooltip; anywhere else in the panel is a
  // track-only hit (empty content = no tooltip) that still publishes the
  // shared plot cursor — this panel IS one participant.
  hit: (scene, x, y, frame): FrameHit<ScanpathHit> => {
    const index = hitFixation(scene, x, y, frame)
    if (index === null) return trackOnlyHit({ fixationIndex: null })
    const f = scene.data!.fixations[index]
    const space = scene.space!
    return {
      content: buildScanpathTooltipContent(f),
      anchorX: stimulusX(space, f.x, frame),
      anchorY: stimulusY(space, f.y, frame) + displayRadiusFor(scene, f),
      tooltipWidth: L.tooltipWidth,
      data: { fixationIndex: index },
    }
  },

  hoverKey: d => d.fixationIndex,

  // This participant, and the hovered fixation's midpoint (the recurrence
  // plot's convention), read live: empty if the data changed under it. No
  // whole-panel outline: lit from elsewhere it read as a stray focus border.
  hover: (hit, act) => {
    if (!hit) return act.publish(null)
    const index = hit.fixationIndex
    act.publish({
      participants: () => (act.input().data ? [act.input().settings.participantId] : []),
      times:
        index === null
          ? undefined
          : () => {
              const f = act.input().data?.fixations[index]
              return f ? [f.start + f.duration / 2] : []
            },
    })
  },
})
