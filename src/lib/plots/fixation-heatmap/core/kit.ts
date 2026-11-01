/**
 * The Fixation Heatmap kit: the parked map, or during playback the frame of
 * the shell's moment on the parked grid and basis (so the colour scale holds,
 * see frame.ts), over the stimulus (the stimulus space and its shell:
 * `shared/stimulusSpace.ts`).
 *
 * The scene rebuilds every playback tick, so the frame-independent work is
 * memoised below.
 */
import { PRESET_PALETTES, resolvePalette } from '$lib/color/palettes'
import type { Rect } from '$lib/data/media/mediaAlignment'
import { AXIS_CONFIG, axisTitleLineHeight } from '$lib/plots/shared/axisUtils'
import { cachedRaster, strokeCrosshairRing } from '$lib/plots/shared/canvasUtils'
import { trackOnlyHit, type GradientLegendSlot, type PlotFrame } from '$lib/plots/shared/frame'
import { defineKit, memoByRef } from '$lib/plots/shared/kit'
import { timeRangeQualifier, withQualifiers } from '$lib/plots/shared/labels'
import type { GradientLegendGeometry } from '$lib/plots/shared/legendGradient'
import {
  drawStimulus,
  playerOf,
  stimulusChrome,
  stimulusRect,
  stimulusScene,
  stimulusX,
  stimulusY,
  type StimulusSpace,
} from '$lib/plots/shared/stimulusSpace'
import { estimateTextWidth } from '$lib/shared/textMeasure'
import { bucketFixations, cellCentreOf, fixationsWithin, type FixationBuckets } from './density'
import { createFrameScratch, heatmapFrame, type FrameScratch } from './frame'
import { heatLut, legendRamp, maskLut, paintHeat } from './heatImage'
import { buildHeatmapTooltipContent } from './tooltip'
import type { FixationHeatmapInput } from './view'
import { FIXATION_HEATMAP_COLORS as C, FIXATION_HEATMAP_LAYOUT as L } from '../const'
import type {
  FixationHeatmapAccumulate,
  FixationHeatmapData,
  FixationHeatmapNormalization,
  FixationHeatmapPlotSettings,
} from '../types'

/** Hover payload: the hovered grid cell, -1 off the map (the legend title's notes). */
type HeatmapHit = { cell: number }
type CellInfo = { rows: Array<{ key: string; value: string }>; ids: number[] }

// ── Colouring: one LUT per (mask | stops, opacity), so the texture's key holds
// across scenes and a playback tick never rebuilds the tables.
const colourings = new Map<string, { lut: Uint32Array; ramp: string[]; empty: number }>()

function colouringOf(s: FixationHeatmapPlotSettings) {
  const opacityMap = s.view === 'opacity'
  const mask = opacityMap ? s.maskColor : null
  // Heat overlay opacity, or the mask's where the map is 0.
  const opacity = Math.min(100, Math.max(0, opacityMap ? s.maskOpacity : s.opacity)) / 100
  const stops = resolvePalette(s.colorScale, PRESET_PALETTES.YL_OR_RD.colors)
  const key = mask ? `mask ${mask} ${opacity}` : `heat ${opacity} ${stops.join(' ')}`
  let colouring = colourings.get(key)
  if (!colouring) {
    // A handful are live at once; past that the oldest are long gone.
    if (colourings.size >= 32) colourings.clear()
    const lut = mask ? maskLut(mask, opacity) : heatLut(stops, opacity)
    // Where nobody looked the heat is clear and the mask is at its fullest.
    colouring = { lut, ramp: legendRamp(lut), empty: mask ? lut[0] : 0 }
    colourings.set(key, colouring)
  }
  return colouring
}

// ── Per parked map (one per plot, one per export render): the playback
// frame's buffers and its last frame, and the cached heat texture, one pixel
// per grid cell, rebuilt only when the shown map or its colouring changes;
// resizes just re-blit it (the recurrence pattern).
interface MapCache {
  scratch: FrameScratch
  frame: {
    start: number
    end: number
    accumulate: FixationHeatmapAccumulate
    normalization: FixationHeatmapNormalization
    data: FixationHeatmapData
  } | null
  raster: ReturnType<typeof cachedRaster>
}
const mapCache = memoByRef(
  (_parked: FixationHeatmapData): MapCache => ({ scratch: createFrameScratch(), frame: null, raster: cachedRaster() })
)

/** The window's frame of the parked map, recomputed only when the window or its weighting moves. */
function frameOf(
  parked: FixationHeatmapData,
  window: { start: number; end: number },
  accumulate: FixationHeatmapAccumulate,
  normalization: FixationHeatmapNormalization
): FixationHeatmapData {
  const cache = mapCache(parked)
  const last = cache.frame
  if (
    last &&
    last.start === window.start &&
    last.end === window.end &&
    last.accumulate === accumulate &&
    last.normalization === normalization
  )
    return last.data
  const data = heatmapFrame(parked, window.start, window.end, accumulate, normalization, cache.scratch)
  cache.frame = { start: window.start, end: window.end, accumulate, normalization, data }
  return data
}

/** Gaze rect framed by the plot: the media, or the fixation extent with its kernel margin. */
function worldOf(d: FixationHeatmapData): Rect {
  if (d.clip) return d.clip
  const r = d.radius
  const e = d.extent
  return { x: e.x - r, y: e.y - r, width: e.width + 2 * r, height: e.height + 2 * r }
}

/** The frame's time window: the trail ending at the playhead, inside the time range. */
function windowOf(input: FixationHeatmapInput) {
  const { playTime, trail } = playerOf(input)
  if (playTime === null) return null
  const timelineStart = input.settings.timelineStart ?? 0
  const timelineEnd = input.settings.timelineEnd ?? 0
  const end = timelineEnd > 0 ? Math.min(playTime, timelineEnd) : playTime
  const start = Math.max(timelineStart, trail > 0 ? playTime - trail : -Infinity)
  return { start, end }
}

// ── Hover: what lies within R of the hovered cell's centre. Per shown map,
// its fixations bucketed for the radius query and the last cell's answer.
const hoverIndex = memoByRef(
  (d: FixationHeatmapData): { index: FixationBuckets; out: Uint32Array; sums: Float64Array; cell: number; info: CellInfo | null } => ({
    index: bucketFixations(d.xs, d.ys, d.xs.length, d.grid, d.radius),
    out: new Uint32Array(d.xs.length),
    sums: new Float64Array(d.participants.length),
    cell: -1,
    info: null,
  })
)

function cellInfo(
  d: FixationHeatmapData,
  cell: number,
  accumulate: FixationHeatmapAccumulate,
  normalization: FixationHeatmapNormalization
): CellInfo {
  const buckets = hoverIndex(d)
  if (buckets.cell === cell && buckets.info) return buckets.info
  const { x: cx, y: cy } = cellCentreOf(d.grid, cell)
  const n = fixationsWithin(buckets.index, d.xs, d.ys, cx, cy, d.radius, buckets.out)
  const share = normalization === 'share'
  const sums = buckets.sums
  sums.fill(0)
  let rawSum = 0
  let shareSum = 0
  for (let o = 0; o < n; o++) {
    const k = buckets.out[o]
    const p = d.participantIndex[k]
    const own = d.raw[k] / d.participants[p].total
    rawSum += d.raw[k]
    shareSum += own
    // Contributions in the map's own weighting: equal per person in share mode.
    sums[p] += share ? own : d.raw[k]
  }
  const ids: number[] = []
  let top = -1
  let contribution = 0
  for (let p = 0; p < sums.length; p++) {
    if (sums[p] <= 0) continue
    ids.push(d.participants[p].id)
    contribution += sums[p]
    if (top < 0 || sums[p] > sums[top]) top = p
  }
  const rows = buildHeatmapTooltipContent(
    {
      value: d.values[cell],
      x: cx,
      y: cy,
      radius: d.radius,
      fixations: n,
      rawSum,
      share: shareSum / d.participants.length,
      participants: ids.length,
      ofParticipants: d.participants.length,
      top: top >= 0 ? { name: d.participants[top].name, share: sums[top] / contribution } : null,
    },
    accumulate,
    normalization
  )
  const info = { rows, ids }
  buckets.cell = cell
  buckets.info = info
  return info
}

/** The grid cell under a canvas point, -1 off the grid or outside the media rect. */
function cellAt(d: FixationHeatmapData, space: StimulusSpace, x: number, y: number, frame: PlotFrame): number {
  const wx = (x - frame.x - space.view.offsetX) / space.view.scale
  const wy = (y - frame.y - space.view.offsetY) / space.view.scale
  const c = d.clip
  if (c && (wx < c.x || wx > c.x + c.width || wy < c.y || wy > c.y + c.height)) return -1
  const g = d.grid
  const i = Math.floor((wx - g.x0) / g.cell)
  const j = Math.floor((wy - g.y0) / g.cell)
  return i < 0 || j < 0 || i >= g.cols || j >= g.rows ? -1 : j * g.cols + i
}

function cellCentre(d: FixationHeatmapData, space: StimulusSpace, cell: number, frame: PlotFrame) {
  const c = cellCentreOf(d.grid, cell)
  return { x: stimulusX(space, c.x, frame), y: stimulusY(space, c.y, frame) }
}

/** The legend title's box, where hovering shows the notes. */
function overLegendTitle(legend: GradientLegendGeometry | null, x: number, y: number): boolean {
  const t = legend?.title
  if (!t) return false
  const half = Math.max(0, ...t.lines.map(l => estimateTextWidth(l, AXIS_CONFIG.fontSize, AXIS_CONFIG.fontFamily) / 2))
  return Math.abs(x - t.x) <= half && y >= t.y && y <= t.y + t.lines.length * axisTitleLineHeight(AXIS_CONFIG.fontSize)
}

function drawFixationDots(ctx: CanvasRenderingContext2D, frame: PlotFrame, space: StimulusSpace, d: FixationHeatmapData) {
  const { scale, offsetX, offsetY } = space.view
  const ox = frame.x + offsetX
  const oy = frame.y + offsetY
  const { xs, ys } = d
  ctx.save()
  ctx.globalAlpha = C.dotAlpha
  // Every halo before any dot, so overlapping dots never erase each other.
  ctx.fillStyle = C.dotHalo
  for (let k = 0; k < xs.length; k++) {
    ctx.fillRect(Math.round(ox + xs[k] * scale) - 2, Math.round(oy + ys[k] * scale) - 2, 5, 5)
  }
  ctx.fillStyle = C.dot
  for (let k = 0; k < xs.length; k++) {
    ctx.fillRect(Math.round(ox + xs[k] * scale) - 1, Math.round(oy + ys[k] * scale) - 1, 3, 3)
  }
  ctx.restore()
}

export const fixationHeatmapKit = defineKit<FixationHeatmapInput, HeatmapHit>()({
  label: 'Fixation Heatmap visualization',

  chrome: (input, size) => {
    const world = input.data && worldOf(input.data)
    const window = windowOf(input)
    const { scaleTop } = input
    // An explicit Scale max: values above it take the top colour, shown as the legend cap.
    const fixedMax = input.settings.scaleMax > 0
    const { ramp } = colouringOf(input.settings)
    const legend: GradientLegendSlot | null = world && {
      colorScale: ramp,
      // A non-zero range max is what turns on the above-max cap.
      valueRange: [0, fixedMax ? scaleTop : 0],
      effectiveMaxValue: scaleTop,
      title: window
        ? withQualifiers(input.legendTitleBase, timeRangeQualifier(window.start, window.end))
        : input.legendTitle,
      aboveMaxColor: fixedMax ? ramp[ramp.length - 1] : null,
    }
    return { ...stimulusChrome(input, world, size, legend), window }
  },

  scene: (input, { frame, chrome }) => {
    const { data: parked, settings: s } = input
    const accumulate = s.accumulate ?? 'duration'
    const normalization = s.normalization ?? 'share'
    // The map on screen: the parked one, or the window's frame on the parked
    // grid and basis (so the colour scale holds, see core/frame.ts).
    const shown =
      chrome.window && parked ? frameOf(parked, chrome.window, accumulate, normalization) : parked
    return {
      ...stimulusScene(input, chrome.world, frame),
      ...colouringOf(s),
      parked,
      shown,
      scaleTop: input.scaleTop,
      showFixations: s.showFixations ?? false,
      notes: input.notes,
      accumulate,
      normalization,
    }
  },

  draw: (ctx, scene, frame) => {
    const { shown: d, space } = scene
    if (!d || !space || !scene.parked) return
    // The clip is the media rect; without an image there (None, a video off the shown moment, still decoding) it is white, as the legend assumes.
    if (d.clip) drawStimulus(ctx, scene, frame, d.clip)

    const { lut, scaleTop, empty } = scene
    const layer = mapCache(scene.parked).raster([d, lut, scaleTop], d.grid.cols, d.grid.rows, layer =>
      paintHeat(d.values, scaleTop, lut, layer.pixels, empty)
    )
    if (layer) {
      const g = d.grid
      ctx.save()
      if (d.clip) {
        const c = stimulusRect(space, d.clip, frame)
        ctx.beginPath()
        ctx.rect(c.x, c.y, c.width, c.height)
        ctx.clip()
      }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      // Texel edges on cell edges, so texel centres land on the cell centres the splat used.
      const r = stimulusRect(space, { x: g.x0, y: g.y0, width: g.cols * g.cell, height: g.rows * g.cell }, frame)
      ctx.drawImage(layer.canvas, r.x, r.y, r.width, r.height)
      ctx.restore()
    }

    if (scene.showFixations) drawFixationDots(ctx, frame, space, d)
  },

  overlay: {
    draw: (ctx, scene, frame, { hover }) => {
      const cell = hover?.cell ?? -1
      const { shown: d, space } = scene
      if (cell < 0 || !d || !space) return
      const c = cellCentre(d, space, cell, frame)
      // The overlay is unclipped: keep the ring inside the plot area, off the axes.
      ctx.save()
      ctx.beginPath()
      ctx.rect(frame.x, frame.y, frame.width, frame.height)
      ctx.clip()
      strokeCrosshairRing(ctx, c.x, c.y, d.radius * space.view.scale)
      ctx.restore()
    },
  },

  hit: (scene, x, y, frame) => {
    const { shown: d, space } = scene
    if (!d) return null
    const cell = space ? cellAt(d, space, x, y, frame) : -1
    if (cell < 0 || !(d.values[cell] > 0)) return trackOnlyHit({ cell })
    const c = cellCentre(d, space!, cell, frame)
    // The ring's bottom-right corner, as other plots anchor at their mark's.
    const r = d.radius * space!.view.scale
    return {
      content: cellInfo(d, cell, scene.accumulate, scene.normalization).rows,
      anchorX: c.x + r,
      anchorY: c.y + r,
      tooltipWidth: L.tooltipWidth,
      data: { cell },
    }
  },

  hitChrome: (scene, x, y, _frame, { gradientLegend }) => {
    if (!scene.shown || scene.notes.length === 0 || !overLegendTitle(gradientLegend, x, y)) return null
    return {
      content: scene.notes.map(value => ({ key: 'Note', value })),
      anchorX: x,
      anchorY: gradientLegend!.title!.y,
      tooltipWidth: L.tooltipWidth,
      cursor: 'help',
      data: { cell: -1 },
    }
  },

  hoverKey: d => d.cell,

  // The participants with fixations within R of the hovered cell, as the
  // tooltip lists them when the pointer arrives.
  hover: (hit, act) => {
    const scene = act.scene()
    const d = scene?.shown
    const ids =
      scene && hit && hit.cell >= 0 && d && d.values[hit.cell] > 0
        ? cellInfo(d, hit.cell, scene.accumulate, scene.normalization).ids
        : []
    act.publish(ids.length ? { participants: () => ids } : null)
  },
})
