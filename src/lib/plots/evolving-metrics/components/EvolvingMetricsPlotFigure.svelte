<script lang="ts">
  import {
    alignToPixelCenter,
    CROSSHAIR_COLOR,
    CROSSHAIR_DASH,
    fillCrosshairBand,
    markCrosshairStrips,
    pixelLayer,
    rowStrips,
    strokeCrosshairGuides,
    strokeParallelLines,
    type PixelLayer,
  } from '$lib/plots/shared/canvasUtils'
  import {
    usePlot,
    participantIndexAxisWidth,
    PLOT_BORDER_PX,
    PLOT_EDGE_PAD_TOP,
    trackOnlyHit,
    type CanvasExportProps,
    type PlotFrame,
    type FrameAxes,
    type FrameHit,
  } from '$lib/plots/shared'
  import {
    cursorGuides,
    drawTimeGuides,
    timeAtX,
    type PlotCursorPort,
  } from '$lib/plots/shared/plotCursor.svelte'
  import { measureTextHeight } from '$lib/shared/textMeasure'
  import { percentileSorted } from '$lib/shared/stats'
  import { samplePalette } from '$lib/color'
  import { INACTIVE_COLOR, PRESET_PALETTES, resolvePalette } from '$lib/color/palettes'

  import { AREA_DIVIDER } from '$lib/plots/shared/const'
  import {
    AXIS_CONFIG,
    drawParticipantRowAxis,
    getXAxisHeight,
    maxAxisTitleHeight,
    truncatedRowLabels,
  } from '$lib/plots/shared/axisUtils'
  import {
    fillPlotAreaBackground,
    niceTimelineTicks,
    bottomOriginYTicks,
  } from '$lib/plots/shared/plotArea'
  import {
    METRIC_MISSING_MESSAGE,
    cannotFitPlaceholder,
  } from '$lib/plots/shared/drawCanvasPlaceholder'
  import { createAdaptiveTimeline, formatTimelineLabel } from '$lib/plots/shared/timelineUtils'
  import { rasterizeOverlayDensity, packOverlayDensity } from '../core/overlayDensity'
  import type { EvolvingMetricsResult, EvolvingMetricsWindow } from '../types'

  const OVERLAY_SUMMARY_RGB = '205, 20, 4'
  const OVERLAY_SUMMARY_COLOR = `rgb(${OVERLAY_SUMMARY_RGB})`
  const OVERLAY_BAND_ALPHA = 0.12
  const OVERLAY_MEAN_LINE_WIDTH = 1.5
  const OVERLAY_INDIVIDUAL_RGB: readonly [number, number, number] = [210, 210, 210]
  const MIN_HEATMAP_ROW_HEIGHT = 4

  // Reused, non-reactive buffers for the overlay individual-line density render
  // (see renderOverlayLines). Kept per-instance; reallocated only when the
  // plot-area pixel size changes.
  let dens: { layer: PixelLayer; counts: Int32Array; stamp: Int32Array } | null = null

  interface Props extends CanvasExportProps {
    data: EvolvingMetricsResult
    alignment?: 'heatmap' | 'overlay'
    colorScale?: string[]
    /** Shared PLOT CURSOR (screen-only; export renders without one). */
    plotCursor?: PlotCursorPort | null
  }

  const props: Props = $props()
  const { width, data, alignment = 'heatmap', colorScale, plotCursor = null } = $derived(props)

  const X_AXIS_LABEL = $derived(data.xAxisLabel)

  const tickLabelHeight = $derived.by(() => {
    let maxHeight = 0
    for (const t of data.timeline.ticks) {
      const h = measureTextHeight(t.label, AXIS_CONFIG.fontSize, AXIS_CONFIG.fontFamily)
      if (h > maxHeight) maxHeight = h
    }
    return maxHeight
  })
  // Bottom-reserve estimate for the COMPACT PROBE ONLY. Mirrors what the resolver
  // carves for the x-axis (ticks + worst-case 2-line title) plus the legend
  // block, but GAP-FREE: the resolver abuts the legend block to the x-axis gutter
  // with no PLOT_LEGEND_GAP, so including the gap here would flip isCompact ~14px
  // early. Worst-case title height avoids a wrap-width cycle; the draw wraps for real.
  const bottomReserveEstimate = $derived.by(() =>
    getXAxisHeight(
      tickLabelHeight,
      X_AXIS_LABEL ? maxAxisTitleHeight(AXIS_CONFIG.fontSize) : 0,
      AXIS_CONFIG.tickLabelOffset
    ) + plot.gradientLegendHeight
  )

  // Compact-mode probe height — derived from the PRE-gutter content area
  // (plot.plotAreaHeight), NOT plot.frame.height, to break the cycle
  // (frame.height ← axes.left ← isCompact ← probeHeight). LOAD-BEARING: do not
  // switch this to frame.height or the $derived graph cycles / settles stale.
  const probeHeight = $derived.by((): number =>
    Math.max(0, plot.plotAreaHeight - PLOT_EDGE_PAD_TOP - bottomReserveEstimate)
  )
  const COMPACT_THRESHOLD = AXIS_CONFIG.fontSize + 2
  const isCompact: boolean = $derived(
    alignment === 'heatmap' &&
      data.participants.length > 0 &&
      probeHeight / data.participants.length < COMPACT_THRESHOLD
  )

  // ── Axis chrome (all pixel-independent) ──
  const xAxisTicks = $derived(niceTimelineTicks(data.timeline))
  const yTimeline = $derived.by(() =>
    alignment !== 'overlay' ? null : createAdaptiveTimeline(0, data.valueMax, 6)
  )
  const yAxisMax = $derived(yTimeline ? yTimeline.maxValue : data.valueMax)
  const yTicks = $derived.by(() => {
    if (!yTimeline) return null
    const niceValues = yTimeline.ticks.filter(t => t.isNice).map(t => t.value)
    // The timeline's own formatter, never a rounding one: a nice step is often
    // fractional (2.5 × 10^n), and rounding collapses distinct ticks onto one
    // string — 0, 0.5, 1, 1.5 printed "0", "1", "1", "2".
    return bottomOriginYTicks(niceValues, yAxisMax, formatTimelineLabel)
  })

  // Heatmap participant row labels, capped + pre-truncated (truncatedRowLabels
  // owns the budget rule). Reads the WIDTH PROP, not `plot.frame`; the frame
  // depends on the reserved width.
  const participantLabels = $derived(
    alignment === 'heatmap' && !isCompact
      ? truncatedRowLabels(data.participants.map(p => p.label), width)
      : []
  )

  // Overlay: value ticks + rotated metric title. Heatmap: the participant row
  // labels, or in compact mode the index axis, which reserves its fixed width
  // as pad.left (a 2-line "Participants / [order indices]" title at fixed
  // offsets). No axes without participants: the empty result's timeline is fabricated.
  const axes = $derived.by<FrameAxes | null>(() => {
    if (data.participants.length === 0) return null
    const bottom = { ticks: xAxisTicks, title: X_AXIS_LABEL }
    const top = { ticks: { positions: xAxisTicks.positions } }
    if (alignment === 'overlay') {
      return { bottom, top, left: { ticks: yTicks ?? undefined, title: data.yAxisLabel } }
    }
    return isCompact ? { bottom, top } : { bottom, top, left: { reserve: participantLabels } }
  })

  const plot = usePlot<{ t: number; x: number; participantIdx: number | null }>({
    props: () => props,
    placeholder: () => (data.noMetric ? METRIC_MISSING_MESSAGE : null),
    fit: frame => {
      if (alignment !== 'heatmap') return null
      const n = data.participants.length
      if (n === 0 || frame.height / n >= MIN_HEATMAP_ROW_HEIGHT) return null
      return cannotFitPlaceholder('height', [
        'Switch to Overlay mode in Plot Settings > Visualization',
      ])
    },
    axes: () => axes,
    gutters: () => ({
      pad: {
        top: PLOT_EDGE_PAD_TOP,
        right: PLOT_BORDER_PX,
        left: isCompact ? participantIndexAxisWidth(data.participants.length) : undefined,
      },
    }),
    gradientLegend: () =>
      alignment !== 'heatmap'
        ? null
        : {
            colorScale: palette,
            // Raw, not rounded: the legend must advertise the range the cells are
            // actually coloured by. `formatLegendValue` already renders 0.2 as "0.2";
            // rounding turned a 0.2–0.9 ramp into a "0–1" one and misread every cell.
            valueRange: [data.valueMin, data.valueMax],
            effectiveMaxValue: data.valueMax,
            title: data.yAxisLabel,
            belowMinColor: INACTIVE_COLOR,
          },
    drawData: drawEvolving,
    drawAboveAxes: drawRowLabels,
    drawOverlay: drawEvolvingOverlay,
    hitTest: computeHit,
    // Live reads of the hovered PIXEL and ROW, so a resize or an undo under a
    // resting pointer re-derives them instead of stranding the old values.
    onHover: hit => {
      const idx = hit?.participantIdx
      plotCursor?.publish(
        hit === null
          ? null
          : {
              times: () => [timeAtX(plot.frame, data.timeline, hit.x)],
              // Slice, not index: an undo that narrows the participants under a
              // resting pointer must read back EMPTY, never throw into a sibling.
              participants:
                idx === null || idx === undefined
                  ? undefined
                  : () => participantIds.slice(idx, idx + 1),
            }
      )
    },
    // Annotated: `cursorX` reads `plot`, so inference would loop. The rows KEY, not
    // the array: moving within one row must not repaint every sibling.
    overlayDeps: (): string => `${cursorGuide.xsKey}:${cursorGuide.rowsKey}`,
  })

  const hoveredMsTime = $derived(plot.hover.data?.t ?? null)
  // Validated HERE, once, because the harness keeps `hover.data` across a data
  // change — only a pointer event clears it — so an index from a wider
  // participant set outlives it, and every reader below would throw on a row
  // that no longer exists (a keyboard undo/redo never moves the pointer).
  const hoveredParticipantIndex = $derived.by(() => {
    const idx = plot.hover.data?.participantIdx ?? null
    return idx !== null && idx < data.participants.length ? idx : null
  })

  /** Row order for the PLOT CURSOR — rebuilt on a data change, not per frame. */
  const participantIds = $derived(data.participants.map(p => p.id))
  // The frame is the guide band (resolveFrameLayout floors it, so it is the same
  // pixel as the local crossline). Gated on real participants: the empty result
  // carries a fabricated 0–100 ms timeline.
  const cursorGuide = cursorGuides({
    cursor: () => plotCursor,
    band: () => (data.participants.length > 0 ? plot.frame : null),
    timeline: () => data.timeline,
    rowIds: () => participantIds,
  })

  const palette = $derived(resolvePalette(colorScale, PRESET_PALETTES.HEAT.colors))

  // 256-step colour LUT built once per palette change, so the heatmap draw loop
  // indexes a prebuilt string instead of interpolating (string concat + parse)
  // per window on every repaint. 256 steps is visually indistinguishable from
  // continuous interpolation for a heatmap.
  const HEATMAP_LUT_SIZE = 256
  const heatmapColorLut = $derived.by<string[]>(() => {
    const lut = new Array<string>(HEATMAP_LUT_SIZE)
    for (let i = 0; i < HEATMAP_LUT_SIZE; i++) {
      lut[i] = samplePalette(palette, i / (HEATMAP_LUT_SIZE - 1))
    }
    return lut
  })

  // Overlay aggregates — sampled one position per pixel across the plot width.
  const overlayAggregates = $derived.by(() => {
    if (alignment !== 'overlay') return null
    const participantCount = data.participants.length
    const w = plot.frame.width
    if (participantCount === 0 || w <= 0) return null

    const sampleCount = Math.max(50, w)
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
        const wins = data.participants[p].windows
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
  })

  function findWindowAt(
    windows: readonly EvolvingMetricsWindow[],
    t: number
  ): EvolvingMetricsWindow | null {
    let lo = 0
    let hi = windows.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const w = windows[mid]
      if (t < w.startMs) hi = mid - 1
      else if (t >= w.endMs) lo = mid + 1
      else return w
    }
    return null
  }

  // The frame arrives already floored (resolveFrameLayout floors the rect), so
  // draws read it directly — no re-flooring preamble.
  function drawEvolving(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    const participantCount = data.participants.length
    if (frame.width <= 0 || frame.height <= 0 || participantCount === 0) return
    if (alignment === 'overlay') {
      renderOverlay(ctx, frame, participantCount)
    } else {
      renderHeatmap(ctx, frame, participantCount)
    }
  }

  // Heatmap rows: names, or the index axis in compact mode. Pre-truncated to the
  // same budget the axis reserved (single source).
  function drawRowLabels(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    const participantCount = data.participants.length
    if (alignment !== 'heatmap' || participantCount === 0 || frame.height <= 0) return
    ctx.save()
    drawParticipantRowAxis(
      ctx,
      participantCount,
      isCompact ? null : participantLabels,
      frame.x,
      frame.y,
      frame.height / participantCount
    )
    ctx.restore()
  }

  // ── HOVER OVERLAY ──
  // The hover visuals (highlight bands, cursor line, emphasised participant
  // line) are drawn here on the overlay layer. usePlot caches the hover-free
  // data layer, so a mouse move blits that back and repaints only this — instead
  // of re-running the full heatmap/overlay draw on every move.
  function drawEvolvingOverlay(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    // Both PLOT CURSOR channels first: they are independent of this plot's own
    // hover state, which the local chrome below drops out on.
    drawTimeGuides(ctx, frame, cursorGuide.xs)
    if (
      hoveredMsTime === null &&
      hoveredParticipantIndex === null &&
      cursorGuide.rows.length === 0
    )
      return
    const participantCount = data.participants.length
    if (frame.width <= 0 || frame.height <= 0 || participantCount === 0) return

    const rowHeight = alignment === 'overlay' ? null : frame.height / participantCount

    ctx.save()
    ctx.beginPath()
    ctx.rect(frame.x, frame.y, frame.width, frame.height)
    ctx.clip()
    if (rowHeight === null) {
      for (const row of cursorGuide.rows) drawStepLine(ctx, row, frame, true)
    } else {
      markCrosshairStrips(ctx, rowStrips(cursorGuide.rows, frame, rowHeight, 0.15))
    }
    drawHoveredWindowChrome(ctx, frame, rowHeight)
    if (rowHeight === null && hoveredParticipantIndex !== null) {
      drawStepLine(ctx, hoveredParticipantIndex, frame)
    }
    ctx.restore()
  }

  // Hover chrome shared by heatmap and overlay modes: the sampled-window band
  // (0.08) under the step band (0.15), a row×step band when `rowHeight` is
  // given (heatmap), and the dashed crossline at the hovered time.
  function drawHoveredWindowChrome(
    ctx: CanvasRenderingContext2D,
    frame: PlotFrame,
    rowHeight: number | null
  ) {
    if (hoveredMsTime === null) return
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
    participantIdx: number,
    frame: PlotFrame,
    /** Dashed marks the PLOT CURSOR's participant; solid marks this plot's own. */
    dashed = false
  ) {
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
    frame: PlotFrame,
    participantCount: number
  ) {
    const rowHeight = frame.height / participantCount
    const valueRange = data.valueMax - data.valueMin
    const invValueRange = valueRange > 0 ? 1 / valueRange : 0
    const timelineMin = data.timeline.minValue
    const duration = Math.max(1, data.timeline.maxValue - timelineMin)
    const invMsPerPx = frame.width / duration
    const lut = heatmapColorLut
    const lutMax = HEATMAP_LUT_SIZE - 1

    fillPlotAreaBackground(ctx, frame.x, frame.y, frame.width, frame.height, INACTIVE_COLOR)

    // Track the last LUT index so an unchanged colour doesn't re-assign fillStyle.
    let lastIdx = -1
    for (let p = 0; p < participantCount; p++) {
      const rowY = frame.y + p * rowHeight
      const wins = data.participants[p].windows
      for (let i = 0; i < wins.length; i++) {
        const w = wins[i]
        if (!Number.isFinite(w.value)) continue
        const xStart = frame.x + (w.startMs - timelineMin) * invMsPerPx
        const xEnd = frame.x + (w.endMs - timelineMin) * invMsPerPx
        if (xEnd <= frame.x || xStart >= frame.right) continue
        const normalized = Math.max(0, Math.min(1, (w.value - data.valueMin) * invValueRange))
        const idx = (normalized * lutMax + 0.5) | 0
        // Snap bin edges to whole logical pixels. A fractional shared edge between
        // two bins is anti-aliased on both sides, so the plot background bleeds
        // through as a faint vertical seam. Contiguous bins share the same edge
        // value, so rounding both sides gives a gap-free, overlap-free tiling.
        const x0 = Math.round(Math.max(frame.x, xStart))
        const x1 = Math.round(Math.min(frame.right, xEnd))
        if (x1 > x0) {
          if (idx !== lastIdx) {
            ctx.fillStyle = lut[idx]
            lastIdx = idx
          }
          ctx.fillRect(x0, rowY, x1 - x0, rowHeight)
        }
      }
    }

    ctx.strokeStyle = AREA_DIVIDER.COLOR
    ctx.lineWidth = AREA_DIVIDER.WIDTH
    strokeParallelLines(
      ctx, true, participantCount - 1,
      p => alignToPixelCenter(frame.y + (p + 1) * rowHeight),
      frame.x, frame.right
    )
    // Hover highlight is drawn in `drawEvolvingOverlay` (overlay layer) so a
    // mouse move blits the cached heatmap instead of re-running this loop.
  }

  // ── OVERLAY ──
  function renderOverlay(
    ctx: CanvasRenderingContext2D,
    frame: PlotFrame,
    participantCount: number
  ) {
    if (!overlayAggregates) return
    const { meanValues, p25Values, p75Values, sampleCount } = overlayAggregates
    const axisMax = yAxisMax
    const valueToY = (v: number) => frame.bottom - (v / axisMax) * frame.height
    const sampleToX = (i: number) => frame.x + ((i + 0.5) / sampleCount) * frame.width

    // Every participant's faint line, drawn once as a density field on this cached
    // data layer (the hovered participant's emphasised line is painted on top in
    // drawEvolvingOverlay). See renderOverlayLines.
    renderOverlayLines(ctx, frame, participantCount)

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

    // Hover highlight (window/step bands, cursor line, emphasised participant
    // line) is drawn in drawEvolvingOverlay on the overlay layer.
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

    const timelineMin = data.timeline.minValue
    const duration = Math.max(1, data.timeline.maxValue - timelineMin)
    const maxCount = rasterizeOverlayDensity(
      data.participants,
      { width: W, height: H, timelineMin, duration, axisMax: yAxisMax },
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

  // ── HOVER ──
  function computeHit(
    mx: number,
    my: number,
    frame: PlotFrame
  ): FrameHit<{ t: number; x: number; participantIdx: number | null }> | null {
    // No participants means the blank empty-result shell: a fabricated 0–100 ms
    // timeline this plot never drew, and a heatmap row index that would resolve
    // to a participant that does not exist.
    if (data.participants.length === 0) return null
    const timelineMin = data.timeline.minValue
    const duration = Math.max(1, data.timeline.maxValue - timelineMin)
    const t = timelineMin + ((mx - frame.x) / frame.width) * duration

    let participantIdx: number | null = null
    if (alignment === 'overlay') {
      let nearestDist = Infinity
      for (let p = 0; p < data.participants.length; p++) {
        const w = findWindowAt(data.participants[p].windows, t)
        if (!w) continue
        const py = frame.bottom - (w.value / yAxisMax) * frame.height
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
  }

</script>

<canvas
  use:plot.plotAction
  aria-label="Metric Timeline visualization"
></canvas>
