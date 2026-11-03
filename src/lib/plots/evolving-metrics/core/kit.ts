/**
 * The Metric Timeline kit: one windowed metric per participant over absolute
 * time, as a heatmap (a row per participant, coloured by value) or an overlay
 * (every participant's step line as a density field, under the cohort's mean
 * line and IQR band).
 *
 * The heatmap's compact verdict (index axis instead of names) and the overlay's
 * value axis feed both the gutters and the scene, so the chrome computes them
 * and the scene reads them back from `ctx.chrome`.
 */
import { samplePalette } from '$lib/color'
import { PRESET_PALETTES, resolvePalette } from '$lib/color/palettes'
import { percentileSorted } from '$lib/metrics/core/numeric'
import {
  AXIS_CONFIG,
  drawParticipantRowAxis,
  participantIndexAxisWidth,
  truncatedRowLabels,
} from '$lib/plots/shared/axisUtils'
import {
  alignToPixelCenter,
  clipRect,
  CROSSHAIR_COLOR,
  CROSSHAIR_DASH,
  fillCrosshairBand,
  markCrosshairStrips,
  pixelLayer,
  rowStrips,
  strokeCrosshairGuides,
  type PixelLayer,
} from '$lib/plots/shared/canvasUtils'
import { PLOT_BORDER_PX, PLOT_EDGE_PAD_TOP, PLOT_LEGEND_GAP } from '$lib/plots/shared/const'
import { timeCursor } from '$lib/plots/shared/cursorMarks'
import {
  METRIC_MISSING_MESSAGE,
  cannotFitPlaceholder,
} from '$lib/plots/shared/drawCanvasPlaceholder'
import {
  resolveFrameLayout,
  trackOnlyHit,
  type CanvasSize,
  type FrameAxes,
  type FrameGutters,
  type FrameHit,
  type GradientLegendSlot,
  type PlotFrame,
} from '$lib/plots/shared/frame'
import { defineKit, memoByRef, type SceneContext } from '$lib/plots/shared/kit'
import { getGradientLegendRequiredHeight } from '$lib/plots/shared/legendGradient'
import {
  bottomOriginYTicks,
  niceTimelineTicks,
  paintRowCells,
} from '$lib/plots/shared/plotArea'
import {
  createAdaptiveTimeline,
  formatTimelineLabel,
  intervalAt,
} from '$lib/plots/shared/timelineUtils'
import { rasterizeOverlayDensity, packOverlayDensity } from './overlayDensity'
import type { EvolvingMetricsInput } from './view'
import type { EvolvingMetricsResult, EvolvingMetricsWindow } from '../types'

/** The hovered instant, the pointer's pixel, and the row (heatmap) or nearest line (overlay). */
export interface EvolvingMetricsHover {
  t: number
  x: number
  participantIdx: number | null
}

const OVERLAY_SUMMARY_RGB = '205, 20, 4'
const OVERLAY_SUMMARY_COLOR = `rgb(${OVERLAY_SUMMARY_RGB})`
const OVERLAY_BAND_ALPHA = 0.12
const OVERLAY_MEAN_LINE_WIDTH = 1.5
const OVERLAY_INDIVIDUAL_RGB: readonly [number, number, number] = [210, 210, 210]
const MIN_HEATMAP_ROW_HEIGHT = 4
const COMPACT_THRESHOLD = AXIS_CONFIG.fontSize + 2

// Reused, non-reactive buffers for the overlay individual-line density render
// (see renderOverlayLines); reallocated only when the plot-area pixel size
// changes. One scratch for every Metric Timeline: a draw fills, packs and blits
// it synchronously, so no two draws ever hold it at once.
let dens: { layer: PixelLayer; counts: Int32Array; stamp: Int32Array } | null = null

// 256-step colour LUT built once per palette, so the heatmap draw loop indexes a
// prebuilt string instead of interpolating (string concat + parse) per window on
// every repaint. 256 steps is visually indistinguishable from continuous
// interpolation for a heatmap. Keyed by the settings' colour scale (frozen, so a
// scene rebuilt on resize finds it) or the preset when there is none.
const HEATMAP_LUT_SIZE = 256
const lutOf = memoByRef((colorScale: readonly string[]) => {
  const palette = resolvePalette(colorScale, PRESET_PALETTES.HEAT.colors)
  const lut = new Array<string>(HEATMAP_LUT_SIZE)
  for (let i = 0; i < HEATMAP_LUT_SIZE; i++) {
    lut[i] = samplePalette(palette, i / (HEATMAP_LUT_SIZE - 1))
  }
  return lut
})

const gutters = (left?: number): FrameGutters => ({
  pad: { top: PLOT_EDGE_PAD_TOP, right: PLOT_BORDER_PX, left },
})

// The heatmap height for the compact verdict. Not the frame's: compact mode
// sets the left gutter, which loops back through the title wrap width. So it
// resolves the same layout with the left inset at its widest (row labels never
// pass 40% of the canvas), making the probe never taller than the frame. The
// colorbar band is the one the harness reserves for the heatmap's slot.
function probeHeight(data: EvolvingMetricsResult, timeAxes: FrameAxes, size: CanvasSize): number {
  const plotAreaWidth = Math.max(1, size.width - size.margin * 2)
  const plotAreaHeight = Math.max(1, size.height - size.margin * 2)
  const band = getGradientLegendRequiredHeight(data.yAxisLabel, plotAreaWidth)
  const { rect } = resolveFrameLayout(
    {
      ...gutters(Math.max(participantIndexAxisWidth(data.participants.length), size.width * 0.4)),
      legendHeight: band > 0 ? PLOT_LEGEND_GAP + band : 0,
    },
    { left: 0, top: 0, right: plotAreaWidth, bottom: plotAreaHeight },
    timeAxes
  )
  return rect.height
}

// Overlay aggregates — sampled one position per pixel across the plot width.
function overlayAggregates(data: EvolvingMetricsResult, width: number) {
  const participants = data.participants
  const participantCount = participants.length
  if (participantCount === 0 || width <= 0) return null

  const sampleCount = Math.max(50, width)
  const timelineMin = data.timeline.minValue
  const duration = Math.max(1, data.timeline.maxValue - timelineMin)

  const meanValues = new Float32Array(sampleCount).fill(NaN)
  const p25Values = new Float32Array(sampleCount).fill(NaN)
  const p75Values = new Float32Array(sampleCount).fill(NaN)
  const pointers = new Int32Array(participantCount)
  const temp: number[] = []

  for (let s = 0; s < sampleCount; s++) {
    const t = timelineMin + ((s + 0.5) / sampleCount) * duration
    temp.length = 0
    for (let p = 0; p < participantCount; p++) {
      const wins = participants[p].windows
      let idx = pointers[p]
      while (idx < wins.length && wins[idx].endMs <= t) idx++
      pointers[p] = idx
      if (idx < wins.length && wins[idx].startMs <= t) temp.push(wins[idx].value)
    }
    if (temp.length === 0) continue
    let sum = 0
    for (let j = 0; j < temp.length; j++) sum += temp[j]
    meanValues[s] = sum / temp.length
    // With one contributor p25 === p75, which draws a zero-height band — it
    // reads as perfect agreement exactly where the cohort is thinnest. No band.
    if (temp.length < 2) continue
    temp.sort((a, b) => a - b)
    p25Values[s] = percentileSorted(temp, 0.25)
    p75Values[s] = percentileSorted(temp, 0.75)
  }
  return { meanValues, p25Values, p75Values, sampleCount }
}

function findWindowAt(windows: readonly EvolvingMetricsWindow[], t: number) {
  const i = intervalAt(windows.length, j => windows[j].startMs, j => windows[j].endMs, t)
  return i < 0 ? null : windows[i]
}

function evolvingChrome(input: EvolvingMetricsInput, size: CanvasSize) {
  const { data, settings } = input
  const heatmap = (settings.presentation ?? 'heatmap') === 'heatmap'
  const participantCount = data.participants.length

  const xAxisTicks = niceTimelineTicks(data.timeline)
  const timeAxes: FrameAxes = {
    bottom: { ticks: xAxisTicks, title: data.xAxisLabel },
    top: { ticks: { positions: xAxisTicks.positions } },
  }

  const isCompact =
    heatmap &&
    participantCount > 0 &&
    probeHeight(data, timeAxes, size) / participantCount < COMPACT_THRESHOLD

  const yTimeline = heatmap ? null : createAdaptiveTimeline(0, data.valueMax, 6)
  const yAxisMax = yTimeline ? yTimeline.maxValue : data.valueMax
  // The timeline's own formatter, never a rounding one: a nice step is often
  // fractional (2.5 × 10^n), and rounding collapses distinct ticks onto one
  // string — 0, 0.5, 1, 1.5 printed "0", "1", "1", "2".
  const yTicks = yTimeline
    ? bottomOriginYTicks(
        yTimeline.ticks.filter(t => t.isNice).map(t => t.value),
        yAxisMax,
        formatTimelineLabel
      )
    : null

  // Heatmap participant row labels, capped + pre-truncated (truncatedRowLabels
  // owns the budget rule). Reads the canvas WIDTH, not the frame; the frame
  // depends on the reserved width.
  const participantLabels =
    heatmap && !isCompact
      ? truncatedRowLabels(data.participants.map(p => p.label), size.width)
      : []

  // Overlay: value ticks + title. Heatmap: row labels, or in compact mode the
  // index axis, whose fixed width goes in pad.left. No axes without
  // participants: the empty result's timeline is fabricated.
  let axes: FrameAxes | null
  if (participantCount === 0) axes = null
  else if (!heatmap) axes = { ...timeAxes, left: { ticks: yTicks ?? undefined, title: data.yAxisLabel } }
  else axes = isCompact ? timeAxes : { ...timeAxes, left: { reserve: participantLabels } }

  const gradientLegend: GradientLegendSlot | null = heatmap
    ? {
        colorScale: resolvePalette(settings.colorScale, PRESET_PALETTES.HEAT.colors),
        // Raw, not rounded: rounding turned a 0.2 to 0.9 ramp into "0 to 1".
        valueRange: [data.valueMin, data.valueMax],
        effectiveMaxValue: data.valueMax,
        title: data.yAxisLabel,
      }
    : null

  return {
    placeholder: data.noMetric ? METRIC_MISSING_MESSAGE : null,
    axes,
    gutters: gutters(isCompact ? participantIndexAxisWidth(participantCount) : undefined),
    gradientLegend,
    isCompact,
    participantLabels,
    yAxisMax,
  }
}

type EvolvingChrome = ReturnType<typeof evolvingChrome>

function evolvingScene(
  input: EvolvingMetricsInput,
  { frame, chrome }: SceneContext<EvolvingChrome>
) {
  const { data, settings } = input
  const overlay = settings.presentation === 'overlay'
  return {
    data,
    overlay,
    // x is absolute ms in both presentations. The frame is the guide band
    // (resolveFrameLayout floors it, so it is the same pixel as the local
    // crossline). Gated on real participants: the empty result carries a
    // fabricated 0–100 ms timeline.
    timeAxis: {
      band: data.participants.length > 0 ? frame : null,
      timeline: data.timeline,
      rowIds: data.participants.map(p => p.id),
    },
    isCompact: chrome.isCompact,
    participantLabels: chrome.participantLabels,
    yAxisMax: chrome.yAxisMax,
    lut: overlay ? null : lutOf(settings.colorScale ?? PRESET_PALETTES.HEAT.colors),
    aggregates: overlay ? overlayAggregates(data, frame.width) : null,
  }
}

type EvolvingScene = ReturnType<typeof evolvingScene>

export const evolvingMetricsKit = defineKit<EvolvingMetricsInput, EvolvingMetricsHover>()({
  label: 'Metric Timeline visualization',

  chrome: evolvingChrome,
  scene: evolvingScene,

  fit: (scene, { frame }) => {
    if (scene.overlay) return null
    const n = scene.data.participants.length
    if (n === 0 || frame.height / n >= MIN_HEATMAP_ROW_HEIGHT) return null
    return cannotFitPlaceholder('height', [
      'Switch to Overlay mode in Plot Settings > Visualization',
    ])
  },

  // The frame arrives floored (resolveFrameLayout floors the rect).
  draw: (ctx, scene, frame) => {
    const participantCount = scene.data.participants.length
    if (frame.width <= 0 || frame.height <= 0 || participantCount === 0) return
    if (scene.overlay) {
      renderOverlay(ctx, scene, frame, participantCount)
    } else {
      renderHeatmap(ctx, scene, frame, participantCount)
    }
  },

  // Heatmap rows: names, or the index axis in compact mode.
  drawAboveAxes: (ctx, scene, frame) => {
    const n = scene.data.participants.length
    if (scene.overlay || n === 0 || frame.height <= 0) return
    ctx.save()
    drawParticipantRowAxis(
      ctx,
      n,
      scene.isCompact ? null : scene.participantLabels,
      frame.x,
      frame.y,
      frame.height / n
    )
    ctx.restore()
  },

  overlay: {
    key: timeCursor.key,
    draw: (ctx, scene, frame, { hover, cursor }) => {
      // Both PLOT CURSOR channels first: they are independent of this plot's own
      // hover state, which the local chrome below drops out on.
      const markedRows = timeCursor.draw(ctx, scene, cursor)
      const participantCount = scene.data.participants.length
      const hoveredMsTime = hover?.t ?? null
      // Validated HERE, because the harness keeps the hover payload across a data
      // change — only a pointer event clears it — so an index from a wider
      // participant set outlives it, and every reader below would throw on a row
      // that no longer exists (a keyboard undo/redo never moves the pointer).
      const idx = hover?.participantIdx ?? null
      const hoveredParticipantIndex = idx !== null && idx < participantCount ? idx : null
      if (hoveredMsTime === null && hoveredParticipantIndex === null && markedRows.length === 0)
        return
      if (frame.width <= 0 || frame.height <= 0 || participantCount === 0) return

      const rowHeight = scene.overlay ? null : frame.height / participantCount

      ctx.save()
      clipRect(ctx, frame)
      if (rowHeight === null) {
        for (const row of markedRows) drawStepLine(ctx, scene, row, frame, true)
      } else {
        markCrosshairStrips(ctx, rowStrips(markedRows, frame, rowHeight, 0.15))
      }
      if (hoveredMsTime !== null) {
        drawHoveredWindowChrome(ctx, scene, frame, rowHeight, hoveredMsTime, hoveredParticipantIndex)
      }
      if (rowHeight === null && hoveredParticipantIndex !== null) {
        drawStepLine(ctx, scene, hoveredParticipantIndex, frame)
      }
      ctx.restore()
    },
  },

  hit: (scene, mx, my, frame): FrameHit<EvolvingMetricsHover> | null => {
    const { data } = scene
    // No participants means the blank empty-result shell: a fabricated 0–100 ms
    // timeline this plot never drew, and a heatmap row index that would resolve
    // to a participant that does not exist.
    if (data.participants.length === 0) return null
    const timelineMin = data.timeline.minValue
    const duration = Math.max(1, data.timeline.maxValue - timelineMin)
    const t = timelineMin + ((mx - frame.x) / frame.width) * duration

    let participantIdx: number | null = null
    if (scene.overlay) {
      let nearestDist = Infinity
      for (let p = 0; p < data.participants.length; p++) {
        const w = findWindowAt(data.participants[p].windows, t)
        if (!w) continue
        const py = frame.bottom - (w.value / scene.yAxisMax) * frame.height
        const dist = Math.abs(my - py)
        if (dist < nearestDist) {
          nearestDist = dist
          participantIdx = p
        }
      }
    } else {
      const rowHeight = frame.height / data.participants.length
      participantIdx = Math.max(
        0,
        Math.min(data.participants.length - 1, Math.floor((my - frame.y) / rowHeight))
      )
    }

    if (participantIdx === null) {
      // Overlay with no window under the cursor: track the ms line, no tooltip.
      return trackOnlyHit({ t, x: mx, participantIdx: null })
    }

    const participant = data.participants[participantIdx]
    const w = findWindowAt(participant.windows, t)
    return {
      content: [
        { key: 'Participant', value: participant.label },
        // The WINDOW, so the number matches the band drawn behind the pointer —
        // the paint span is narrower than the measurement and reading it as the
        // measurement understates it by up to windowSize/stepSize.
        {
          key: w ? 'Window' : 'Time',
          value: w
            ? `${Math.round(w.windowStartMs)}–${Math.round(w.windowEndMs)} ms`
            : `${Math.round(t)} ms`,
        },
        { key: data.yAxisLabel, value: w ? w.value.toFixed(2) : 'No data' },
      ],
      anchorX: mx,
      anchorY: my,
      offset: { x: 15, y: 15 },
      data: { t, x: mx, participantIdx },
    }
  },

  hover: (hover, act) =>
    timeCursor.publish(act, hover?.x ?? null, hover?.participantIdx ?? null),
})

// Hover chrome shared by heatmap and overlay modes: the sampled-window band
// (0.08) under the step band (0.15), a row×step band when `rowHeight` is
// given (heatmap), and the dashed crossline at the hovered time.
function drawHoveredWindowChrome(
  ctx: CanvasRenderingContext2D,
  scene: EvolvingScene,
  frame: PlotFrame,
  rowHeight: number | null,
  hoveredMsTime: number,
  hoveredParticipantIndex: number | null
) {
  const { data } = scene
  const timelineMin = data.timeline.minValue
  const duration = Math.max(1, data.timeline.maxValue - timelineMin)
  const invMsPerPx = frame.width / duration

  /** A window's two spans, banded over ONE participant's vertical extent. */
  const bandWindow = (w: EvolvingMetricsWindow, y: number, h: number) => {
    const spanX = (fromMs: number, toMs: number) => {
      const x = Math.max(frame.x, frame.x + (fromMs - timelineMin) * invMsPerPx)
      return {
        x,
        width: Math.min(frame.right, frame.x + (toMs - timelineMin) * invMsPerPx) - x,
      }
    }
    // The WINDOW this value summarises (0.08) under the PAINT span (the cell,
    // 0.15). Both come from this participant's own window.
    const win = spanX(w.windowStartMs, w.windowEndMs)
    const step = spanX(w.startMs, w.endMs)
    if (win.width > 0) fillCrosshairBand(ctx, win.x, y, win.width, h, 0.08)
    if (step.width > 0) fillCrosshairBand(ctx, step.x, y, step.width, h, 0.15)
    return step
  }

  if (rowHeight === null) {
    // Overlay: no rows, so only the line under the pointer can be banded. No
    // borrowing — a participant without a window here gets no band at all.
    const idx = hoveredParticipantIndex
    const w = idx === null ? null : findWindowAt(data.participants[idx].windows, hoveredMsTime)
    if (w) bandWindow(w, frame.y, frame.height)
  } else {
    // Heatmap: band each row from its OWN window. Time-windowed metrics share
    // one window grid so the widths usually match, but PRESENCE does not — a row
    // with no window here gets no band, and nothing is borrowed. One full-height
    // band was a single participant's span painted across everyone, cutting the
    // other rows' cells mid-cell.
    for (let p = 0; p < data.participants.length; p++) {
      const w = findWindowAt(data.participants[p].windows, hoveredMsTime)
      if (!w) continue
      const step = bandWindow(w, frame.y + p * rowHeight, rowHeight)
      // The row under the pointer, banded twice, so it reads as the one you are on.
      if (p === hoveredParticipantIndex && step.width > 0) {
        fillCrosshairBand(ctx, step.x, frame.y + p * rowHeight, step.width, rowHeight, 0.15)
      }
    }
  }

  // The INSTANT is shared by every participant, so this one is legitimately
  // full height — unlike the bands above.
  const cx = alignToPixelCenter(frame.x + (hoveredMsTime - timelineMin) * invMsPerPx)
  strokeCrosshairGuides(ctx, [cx, frame.y, cx, frame.y + frame.height])
}

// Overlay mode also re-strokes the hovered participant's step line on top.
function drawStepLine(
  ctx: CanvasRenderingContext2D,
  scene: EvolvingScene,
  participantIdx: number,
  frame: PlotFrame,
  /** Dashed marks the PLOT CURSOR's participant; solid marks this plot's own. */
  dashed = false
) {
  const { data, yAxisMax } = scene
  const wins = data.participants[participantIdx].windows
  if (wins.length === 0) return
  const timelineMin = data.timeline.minValue
  const duration = Math.max(1, data.timeline.maxValue - timelineMin)
  const invMsPerPx = frame.width / duration
  ctx.save()
  ctx.strokeStyle = CROSSHAIR_COLOR
  ctx.lineWidth = 1
  if (dashed) ctx.setLineDash(CROSSHAIR_DASH)
  drawStepLinePath(
    ctx, wins,
    (ms: number) => frame.x + (ms - timelineMin) * invMsPerPx,
    (v: number) => frame.bottom - (v / yAxisMax) * frame.height
  )
  ctx.stroke()
  ctx.restore()
}

// ── HEATMAP ──
function renderHeatmap(
  ctx: CanvasRenderingContext2D,
  scene: EvolvingScene,
  frame: PlotFrame,
  participantCount: number
) {
  // Plain locals for the per-window loop.
  const { participants, valueMin } = scene.data
  const valueRange = scene.data.valueMax - valueMin
  const invValueRange = valueRange > 0 ? 1 / valueRange : 0
  const timelineMin = scene.data.timeline.minValue
  const duration = Math.max(1, scene.data.timeline.maxValue - timelineMin)
  const lut = scene.lut!
  const lutMax = HEATMAP_LUT_SIZE - 1
  paintRowCells(ctx, frame, participantCount, [timelineMin, timelineMin + duration], (p, put) => {
    for (const w of participants[p].windows) {
      if (!Number.isFinite(w.value)) continue
      const normalized = Math.max(0, Math.min(1, (w.value - valueMin) * invValueRange))
      put(w.startMs, w.endMs, lut[(normalized * lutMax + 0.5) | 0])
    }
  })
}

// ── OVERLAY ──
function renderOverlay(
  ctx: CanvasRenderingContext2D,
  scene: EvolvingScene,
  frame: PlotFrame,
  participantCount: number
) {
  if (!scene.aggregates) return
  const { meanValues, p25Values, p75Values, sampleCount } = scene.aggregates
  const axisMax = scene.yAxisMax
  const valueToY = (v: number) => frame.bottom - (v / axisMax) * frame.height
  const sampleToX = (i: number) => frame.x + ((i + 0.5) / sampleCount) * frame.width

  // Every participant's faint line, drawn once as a density field on this cached
  // data layer (the hovered participant's emphasised line is painted on top in
  // `overlay.draw`). See renderOverlayLines.
  renderOverlayLines(ctx, scene, frame, participantCount)

  ctx.fillStyle = `rgba(${OVERLAY_SUMMARY_RGB}, ${OVERLAY_BAND_ALPHA})`
  let segStart = -1
  for (let i = 0; i <= sampleCount; i++) {
    const valid =
      i < sampleCount && p25Values[i] === p25Values[i] && p75Values[i] === p75Values[i]
    if (valid && segStart < 0) segStart = i
    else if (!valid && segStart >= 0) {
      drawBandSegment(ctx, p25Values, p75Values, segStart, i - 1, sampleToX, valueToY)
      segStart = -1
    }
  }

  ctx.save()
  ctx.strokeStyle = OVERLAY_SUMMARY_COLOR
  ctx.lineWidth = OVERLAY_MEAN_LINE_WIDTH
  ctx.beginPath()
  let drawingMean = false
  for (let i = 0; i < sampleCount; i++) {
    const v = meanValues[i]
    if (v !== v) {
      drawingMean = false
      continue
    }
    const x = sampleToX(i)
    const y = valueToY(v)
    if (!drawingMean) {
      ctx.moveTo(x, y)
      drawingMean = true
    } else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()
}

// Draw every participant's faint step line as a DENSITY field rather than P
// separate translucent strokes (which cost P full-plot composite passes). We
// count how many lines cross each logical pixel and map that to the exact alpha
// those strokes would accumulate (1 − (1 − a)ⁿ, in overlayDensity), then blit
// once — identical look, composite cost independent of participant count. The
// offscreen is at logical resolution and drawn under the dpr-scaled context with
// smoothing off, matching the scarf composite-layer blit.
function renderOverlayLines(
  ctx: CanvasRenderingContext2D,
  scene: EvolvingScene,
  frame: PlotFrame,
  participantCount: number
) {
  const W = frame.width
  const H = frame.height
  if (W <= 0 || H <= 0 || participantCount === 0) return
  const cellCount = W * H

  // null = unsafe size or canvas-less environment (tests): skip the overlay
  const layer = pixelLayer(dens?.layer ?? null, W, H)
  if (!layer) return
  if (layer !== dens?.layer) {
    dens = { layer, counts: new Int32Array(cellCount), stamp: new Int32Array(cellCount) }
  }
  const { counts, stamp } = dens

  const { data } = scene
  const timelineMin = data.timeline.minValue
  const duration = Math.max(1, data.timeline.maxValue - timelineMin)
  const maxCount = rasterizeOverlayDensity(
    data.participants,
    { width: W, height: H, timelineMin, duration, axisMax: scene.yAxisMax },
    counts,
    stamp
  )
  if (maxCount === 0) return

  const alpha = Math.max(0.04, Math.min(0.5, 2 / Math.sqrt(participantCount)))
  packOverlayDensity(counts, maxCount, alpha, OVERLAY_INDIVIDUAL_RGB, layer.pixels)
  layer.ctx.putImageData(layer.image, 0, 0)
  const prevSmoothing = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(layer.canvas as CanvasImageSource, frame.x, frame.y)
  ctx.imageSmoothingEnabled = prevSmoothing
}

function drawStepLinePath(
  ctx: CanvasRenderingContext2D,
  wins: readonly EvolvingMetricsWindow[],
  msToX: (ms: number) => number,
  valueToY: (v: number) => number
) {
  ctx.beginPath()
  let drawing = false
  for (let i = 0; i < wins.length; i++) {
    const w = wins[i]
    const prev = i > 0 ? wins[i - 1] : null
    const hasGap = prev !== null && Math.abs(w.startMs - prev.endMs) > 0.5
    const x0 = msToX(w.startMs)
    const x1 = msToX(w.endMs)
    const y = valueToY(w.value)
    if (!drawing || hasGap) ctx.moveTo(x0, y)
    else ctx.lineTo(x0, y)
    ctx.lineTo(x1, y)
    drawing = true
  }
}

function drawBandSegment(
  ctx: CanvasRenderingContext2D,
  p25: Float32Array, p75: Float32Array, from: number, to: number,
  sampleToX: (i: number) => number, valueToY: (v: number) => number
) {
  ctx.beginPath()
  ctx.moveTo(sampleToX(from), valueToY(p75[from]))
  for (let i = from + 1; i <= to; i++) ctx.lineTo(sampleToX(i), valueToY(p75[i]))
  for (let i = to; i >= from; i--) ctx.lineTo(sampleToX(i), valueToY(p25[i]))
  ctx.closePath()
  ctx.fill()
}
