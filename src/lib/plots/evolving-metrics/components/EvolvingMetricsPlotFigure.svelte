<script lang="ts">
  import {
    beginCanvasDrawing,
    finishCanvasDrawing,
    alignToPixelCenter,
  } from '$lib/plots/shared/canvasUtils'
  import {
    usePlot,
    NO_MARGINS,
    canvasBlockSelect,
    type BlockedRegion,
    type CanvasExportProps,
  } from '$lib/plots/shared'
  import { estimateTextWidth } from '$lib/shared/utils/textUtils'
  import { interpolateColor } from '$lib/color'
  import { INACTIVE_COLOR, PRESET_PALETTES } from '$lib/color/palettes'

  import {
    FONT_PRIMARY,
  } from '$lib/plots/shared/const'
  import {
    computeGradientLegendGeometry,
    drawGradientLegend,
  } from '$lib/plots/shared/legendGradient'
  import { drawXAxisLabel, drawYAxisMainLabel } from '$lib/plots/shared/axisUtils'
  import {
    drawPlotArea,
    fillPlotAreaBackground,
    niceTimelineTicks,
    bottomOriginYTicks,
  } from '$lib/plots/shared/plotArea'
  import { drawCanvasPlaceholder, METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
  import { MARGIN, AXIS_CONFIG } from '../const'
  import type { EvolvingMetricsResult, EvolvingMetricsWindow } from '../types'

  const OVERLAY_LEFT_MARGIN = 65
  // Branding red #cd1404 as RGB components, reused for band + mean line.
  const OVERLAY_SUMMARY_RGB = '205, 20, 4'
  const OVERLAY_SUMMARY_COLOR = `rgb(${OVERLAY_SUMMARY_RGB})`
  const OVERLAY_BAND_ALPHA = 0.12
  const OVERLAY_MEAN_LINE_WIDTH = 1.5
  const OVERLAY_INDIVIDUAL_RGB = '210, 210, 210'

  interface Props extends CanvasExportProps {
    data: EvolvingMetricsResult
    alignment?: 'heatmap' | 'overlay'
    colorScale?: string[]
  }

  let {
    width,
    height,
    data,
    alignment = 'heatmap',
    colorScale,
    dpiOverride = null,
    margins = NO_MARGINS,
  }: Props = $props()

  const X_AXIS_LABEL = $derived(data.xAxisLabel)
  const X_AXIS_LABEL_OFFSET = 30
  const AREA_DIVIDER = {
    COLOR: 'rgba(255, 255, 255, 0.4)',
    WIDTH: 1,
  }
  const HEATMAP_LEGEND_HEIGHT = 60

  // Track hover position in ms (not bin index) — the plot renders directly on
  // the ms axis, so ms is the primary coordinate for hit-testing.
  let hoveredMsTime = $state<number | null>(null)
  let hoveredParticipantIndex = $state<number | null>(null)

  const legendHeight = $derived(alignment === 'heatmap' ? HEATMAP_LEGEND_HEIGHT : 0)

  // usePlot.margins are the export margins only, so plot.plotAreaWidth/Height are
  // the drawable CONTENT (total minus export padding). The gradient legend spans
  // the full content width; the plot rectangle is content minus the chrome gutters.
  const plot = usePlot({
    render: renderCanvas,
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [data, alignment],
    onMouseMove: handlePlotMouseMove,
  })

  // Plot-area height is content minus the top/bottom axis chrome and legend band.
  const plotAreaHeight = $derived(
    Math.max(0, plot.plotAreaHeight - MARGIN.TOP - MARGIN.BOTTOM - legendHeight)
  )

  // Compact mode: when row height < font size, switch to index ticks (heatmap only)
  const COMPACT_THRESHOLD = AXIS_CONFIG.fontSize + 2
  const isCompact = $derived(
    alignment === 'heatmap' &&
      data.participants.length > 0 &&
      plotAreaHeight / data.participants.length < COMPACT_THRESHOLD
  )

  // Compute effective left margin based on mode
  const effectiveLeftMargin = $derived.by(() => {
    if (alignment === 'overlay') return OVERLAY_LEFT_MARGIN
    if (isCompact) return 55
    let max = 0
    for (let i = 0; i < data.participants.length; i++) {
      const w = estimateTextWidth(
        data.participants[i].label,
        AXIS_CONFIG.fontSize,
        AXIS_CONFIG.fontFamily
      )
      if (w > max) max = w
    }
    return Math.max(MARGIN.LEFT, Math.min(200, max + 20))
  })

  // Plot rectangle = content carved by the chrome gutters.
  const plotLeft = $derived(plot.plotLeft + effectiveLeftMargin)
  const plotTop = $derived(plot.plotTop + MARGIN.TOP)
  const plotAreaWidth = $derived(
    Math.max(0, plot.plotAreaWidth - effectiveLeftMargin - MARGIN.RIGHT)
  )
  const plotBottom = $derived(plotTop + plotAreaHeight)
  const plotRight = $derived(plotLeft + plotAreaWidth)

  // Evolving-metrics' only legend is the heatmap gradient (static, not
  // interactive), so only the plot area is blocked — everything else
  // (title, axes, legend strip) stays clickable to open the Pane.
  const blockedRegions = $derived<BlockedRegion[]>([
    { x: plotLeft, y: plotTop, w: plotAreaWidth, h: plotAreaHeight },
  ])

  // Color palette (heatmap)
  const palette = $derived<string[]>(
    colorScale && colorScale.length >= 2
      ? colorScale
      : [...PRESET_PALETTES.HEAT.colors]
  )

  // Gradient legend geometry (heatmap only)
  const gradientLegendGeometry = $derived.by(() => {
    if (alignment !== 'heatmap') return null
    return computeGradientLegendGeometry({
      x: margins.left,
      y: plotBottom + MARGIN.BOTTOM,
      availableWidth: plot.plotAreaWidth,
      availableHeight: legendHeight,
      colorScale: palette,
      valueRange: [Math.round(data.valueMin), Math.round(data.valueMax)],
      effectiveMaxValue: Math.round(data.valueMax),
      title: data.yAxisLabel,
      belowMinColor: INACTIVE_COLOR,
    })
  })

  // Overlay: Y-axis timeline and ticks
  const yTimeline = $derived.by(() => {
    if (alignment !== 'overlay') return null
    return createAdaptiveTimeline(0, data.valueMax, 6)
  })

  const yAxisMax = $derived(yTimeline ? yTimeline.maxValue : data.valueMax)

  const yTicks = $derived.by(() => {
    if (!yTimeline) return null
    const niceValues = yTimeline.ticks
      .filter((t) => t.isNice)
      .map((t) => t.value)
    return bottomOriginYTicks(niceValues, yAxisMax, (v) =>
      String(Math.round(v))
    )
  })

  // Overlay aggregates: sampled at one position per pixel across the plot
  // width. At each sample, look up each participant's window containing that
  // ms (via a monotonic pointer since samples advance), then compute
  // mean/P25/P75 across participants. Using pixel-resolution sampling keeps
  // the aggregate line visually smooth without introducing a bin grid.
  const overlayAggregates = $derived.by(() => {
    if (alignment !== 'overlay') return null
    const participantCount = data.participants.length
    if (participantCount === 0 || plotAreaWidth <= 0) return null

    const sampleCount = Math.max(50, plotAreaWidth)
    const timelineMin = data.timeline.minValue
    const timelineMax = data.timeline.maxValue
    const duration = Math.max(1, timelineMax - timelineMin)

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
        if (idx < wins.length && wins[idx].startMs <= t) {
          temp.push(wins[idx].value)
        }
      }
      if (temp.length === 0) continue
      let sum = 0
      for (let j = 0; j < temp.length; j++) sum += temp[j]
      meanValues[s] = sum / temp.length
      temp.sort((a, b) => a - b)
      p25Values[s] = computePercentile(temp, 0.25)
      p75Values[s] = computePercentile(temp, 0.75)
    }
    return { meanValues, p25Values, p75Values, sampleCount }
  })

  function computePercentile(sorted: number[], p: number): number {
    const n = sorted.length
    if (n === 1) return sorted[0]
    const k = (n - 1) * p
    const f = Math.floor(k)
    const c = Math.ceil(k)
    if (f === c) return sorted[f]
    return sorted[f] * (c - k) + sorted[c] * (k - f)
  }

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

  function renderCanvas() {
    beginCanvasDrawing(plot.canvasState, true)

    const ctx = plot.canvasState.context
    if (!ctx) return

    // Empty-state branch: paint the standardized placeholder onto the canvas
    // so exports include the message instead of a blank PNG/SVG.
    if (data.noMetric) {
      drawCanvasPlaceholder(ctx, width, height, METRIC_MISSING_MESSAGE)
      finishCanvasDrawing(plot.canvasState)
      return
    }

    const floorLeft = Math.floor(plotLeft)
    const floorTop = Math.floor(plotTop)
    const floorWidth = Math.floor(plotAreaWidth)
    const floorHeight = Math.floor(plotAreaHeight)
    const floorBottom = floorTop + floorHeight
    const floorRight = floorLeft + floorWidth

    const participantCount = data.participants.length
    if (floorWidth <= 0 || floorHeight <= 0 || participantCount === 0) {
      finishCanvasDrawing(plot.canvasState)
      return
    }

    // Clip to plot area
    ctx.save()
    ctx.beginPath()
    ctx.rect(floorLeft, floorTop, floorWidth, floorHeight)
    ctx.clip()

    if (alignment === 'overlay') {
      renderOverlay(
        ctx,
        floorLeft,
        floorTop,
        floorWidth,
        floorHeight,
        floorBottom,
        floorRight,
        participantCount
      )
    } else {
      renderHeatmap(
        ctx,
        floorLeft,
        floorTop,
        floorWidth,
        floorHeight,
        floorBottom,
        floorRight,
        participantCount
      )
    }

    ctx.restore()

    // Axes and labels (outside clip)
    if (alignment === 'overlay') {
      renderOverlayAxes(ctx, floorLeft, floorTop, floorWidth, floorHeight, floorBottom)
    } else {
      renderHeatmapLabels(ctx, floorLeft, floorTop, floorHeight, floorRight, participantCount)
    }

    ctx.restore()
    finishCanvasDrawing(plot.canvasState)
  }

  // ──────────────────────────────────────────────────────────────────
  // HEATMAP RENDERING
  // ──────────────────────────────────────────────────────────────────

  function renderHeatmap(
    ctx: CanvasRenderingContext2D,
    floorLeft: number,
    floorTop: number,
    floorWidth: number,
    floorHeight: number,
    floorBottom: number,
    floorRight: number,
    participantCount: number
  ) {
    const rowHeight = floorHeight / participantCount
    const paletteStopCount = palette.length - 1
    const valueRange = data.valueMax - data.valueMin
    const invValueRange = valueRange > 0 ? 1 / valueRange : 0
    const timelineMin = data.timeline.minValue
    const timelineMax = data.timeline.maxValue
    const duration = Math.max(1, timelineMax - timelineMin)
    const msPerPx = duration / floorWidth
    const invMsPerPx = 1 / msPerPx

    fillPlotAreaBackground(
      ctx,
      floorLeft,
      floorTop,
      floorWidth,
      floorHeight,
      INACTIVE_COLOR
    )

    for (let p = 0; p < participantCount; p++) {
      const participant = data.participants[p]
      const rowY = floorTop + p * rowHeight
      const wins = participant.windows

      for (let i = 0; i < wins.length; i++) {
        const w = wins[i]
        // NaN values are already filtered in the transformer, but guard
        // defensively. Note: a 0 value (e.g. DET = 0% when R > 0 but no
        // diagonals) is legitimate and must render with the bottom colour.
        if (!Number.isFinite(w.value)) continue
        const xStart = floorLeft + (w.startMs - timelineMin) * invMsPerPx
        const xEnd = floorLeft + (w.endMs - timelineMin) * invMsPerPx
        if (xEnd <= floorLeft || xStart >= floorRight) continue

        const normalized = (w.value - data.valueMin) * invValueRange
        const scaledVal = Math.max(0, Math.min(1, normalized)) * paletteStopCount
        const baseIdx = scaledVal | 0
        const nextIdx = Math.min(paletteStopCount, baseIdx + 1)

        ctx.fillStyle = interpolateColor(
          palette[baseIdx],
          palette[nextIdx],
          scaledVal - baseIdx
        )

        // Paint exactly over the window's ms extent — no anti-alias bleed
        // across boundaries. That preserves the saccade gap between adjacent
        // middle fixations so two sliding-window measurements stay visually
        // distinct instead of smearing into one band.
        const x = Math.max(floorLeft, xStart)
        const rectWidth = Math.min(floorRight, xEnd) - x
        if (rectWidth > 0) ctx.fillRect(x, rowY, rectWidth, rowHeight)
      }
    }

    // Row dividers
    ctx.strokeStyle = AREA_DIVIDER.COLOR
    ctx.lineWidth = AREA_DIVIDER.WIDTH
    for (let p = 1; p < participantCount; p++) {
      const y = alignToPixelCenter(floorTop + p * rowHeight)
      ctx.beginPath()
      ctx.moveTo(floorLeft, y)
      ctx.lineTo(floorRight, y)
      ctx.stroke()
    }

    // Hover highlight — the hovered window of the hovered participant, or a
    // thin vertical marker when hovering outside any participant's window.
    if (hoveredMsTime !== null && hoveredParticipantIndex !== null) {
      const participant = data.participants[hoveredParticipantIndex]
      const w = findWindowAt(participant.windows, hoveredMsTime)
      if (w) {
        const xStart = floorLeft + (w.startMs - timelineMin) * invMsPerPx
        const xEnd = floorLeft + (w.endMs - timelineMin) * invMsPerPx
        const rowY = floorTop + hoveredParticipantIndex * rowHeight
        const x = Math.max(floorLeft, xStart)
        const rectWidth = Math.min(floorRight, xEnd) - x
        ctx.save()
        ctx.globalAlpha = 0.3
        ctx.fillStyle = '#007acc'
        ctx.fillRect(x, rowY, rectWidth, rowHeight)
        ctx.restore()
      }
    } else if (hoveredMsTime !== null) {
      const cx = alignToPixelCenter(
        floorLeft + (hoveredMsTime - timelineMin) * invMsPerPx
      )
      ctx.save()
      ctx.globalAlpha = 0.15
      ctx.fillStyle = '#007acc'
      ctx.fillRect(cx - 0.5, floorTop, 1.5, floorHeight)
      ctx.restore()
    }
  }

  function renderHeatmapLabels(
    ctx: CanvasRenderingContext2D,
    floorLeft: number,
    floorTop: number,
    floorHeight: number,
    floorRight: number,
    participantCount: number
  ) {
    const rowHeight = floorHeight / participantCount
    const floorBottom = floorTop + floorHeight
    const floorWidth = floorRight - floorLeft

    // Participant labels
    ctx.save()
    ctx.font = `${AXIS_CONFIG.fontSize}px ${FONT_PRIMARY.FAMILY}`
    ctx.fillStyle = AXIS_CONFIG.color
    ctx.textBaseline = 'middle'

    if (isCompact) {
      ctx.save()
      ctx.textAlign = 'center'
      const labelX = floorLeft - 40
      const labelY = floorTop + floorHeight / 2
      ctx.translate(labelX, labelY)
      ctx.rotate(-Math.PI / 2)
      const lineHeight = AXIS_CONFIG.fontSize * 1.2
      ctx.fillText('Participants', 0, -lineHeight / 2)
      ctx.fillText('[order indices]', 0, lineHeight / 2)
      ctx.restore()

      ctx.textAlign = 'right'
      const tickX = floorLeft - 8
      const step = calculateTickStep(participantCount)

      for (let i = 0; i < participantCount; i += step) {
        const y = floorTop + i * rowHeight + rowHeight / 2
        ctx.fillText(String(i), tickX, y)
      }
      const lastIdx = participantCount - 1
      if (lastIdx % step !== 0) {
        const y = floorTop + lastIdx * rowHeight + rowHeight / 2
        ctx.fillText(String(lastIdx), tickX, y)
      }
    } else {
      ctx.textAlign = 'right'
      const maxLabelPx = effectiveLeftMargin - 15

      for (let p = 0; p < participantCount; p++) {
        const labelX = floorLeft - 10
        const labelY = floorTop + p * rowHeight + rowHeight / 2

        let labelText = data.participants[p].label
        if (ctx.measureText(labelText).width > maxLabelPx) {
          while (
            ctx.measureText(labelText + '\u2026').width > maxLabelPx &&
            labelText.length > 0
          ) {
            labelText = labelText.slice(0, -1)
          }
          labelText += '\u2026'
        }

        ctx.fillText(labelText, labelX, labelY)
      }
    }
    ctx.restore()

    // X-axis chrome
    const xTicks = niceTimelineTicks(data.timeline)
    drawPlotArea(ctx, {
      x: floorLeft,
      y: floorTop,
      width: floorWidth,
      height: floorHeight,
      ticks: { bottom: xTicks, top: { positions: xTicks.positions } },
    })
    drawXAxisLabel(
      ctx,
      X_AXIS_LABEL,
      floorLeft,
      floorWidth,
      floorBottom,
      X_AXIS_LABEL_OFFSET,
      AXIS_CONFIG
    )

    // Gradient legend (heatmap only)
    if (gradientLegendGeometry) {
      drawGradientLegend(ctx, gradientLegendGeometry, {
        x: margins.left,
        y: floorBottom + MARGIN.BOTTOM,
        availableWidth: plot.plotAreaWidth,
        availableHeight: legendHeight,
        colorScale: palette,
        valueRange: [Math.round(data.valueMin), Math.round(data.valueMax)],
        effectiveMaxValue: Math.round(data.valueMax),
        title: data.yAxisLabel,
        belowMinColor: INACTIVE_COLOR,
      })
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // OVERLAY RENDERING
  // ──────────────────────────────────────────────────────────────────

  function renderOverlay(
    ctx: CanvasRenderingContext2D,
    floorLeft: number,
    floorTop: number,
    floorWidth: number,
    floorHeight: number,
    floorBottom: number,
    floorRight: number,
    participantCount: number
  ) {
    if (!overlayAggregates) return
    const { meanValues, p25Values, p75Values, sampleCount } = overlayAggregates
    const axisMax = yAxisMax
    const timelineMin = data.timeline.minValue
    const duration = Math.max(1, data.timeline.maxValue - timelineMin)
    const invMsPerPx = floorWidth / duration

    const valueToY = (v: number) => floorBottom - (v / axisMax) * floorHeight
    const msToX = (ms: number) => floorLeft + (ms - timelineMin) * invMsPerPx
    const sampleToX = (i: number) =>
      floorLeft + ((i + 0.5) / sampleCount) * floorWidth

    // Individual participants as step lines — each window's value is
    // rendered as a horizontal segment across `[startMs, endMs)` joined to
    // the next by a vertical riser. This is the same step function the
    // heatmap paints and the aggregate samples: one signal, one shape, so
    // an overlay line ends at the exact x-position the heatmap row's
    // colour band ends.
    const alpha = Math.max(0.04, Math.min(0.5, 2 / Math.sqrt(participantCount)))
    ctx.lineWidth = participantCount > 30 ? 0.5 : 1

    for (let p = 0; p < participantCount; p++) {
      if (hoveredParticipantIndex === p) continue
      const wins = data.participants[p].windows
      if (wins.length === 0) continue
      ctx.strokeStyle = `rgba(${OVERLAY_INDIVIDUAL_RGB}, ${alpha})`
      drawStepLinePath(ctx, wins, msToX, valueToY)
      ctx.stroke()
    }

    // --- P25–P75 band ---
    ctx.fillStyle = `rgba(${OVERLAY_SUMMARY_RGB}, ${OVERLAY_BAND_ALPHA})`
    let segStart = -1
    for (let i = 0; i <= sampleCount; i++) {
      const valid =
        i < sampleCount &&
        p25Values[i] === p25Values[i] &&
        p75Values[i] === p75Values[i]
      if (valid && segStart < 0) {
        segStart = i
      } else if (!valid && segStart >= 0) {
        drawBandSegment(ctx, p25Values, p75Values, segStart, i - 1, sampleToX, valueToY)
        segStart = -1
      }
    }

    // --- Mean line ---
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
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
    ctx.restore()

    // --- Hover: dashed vertical line at cursor ms ---
    if (hoveredMsTime !== null) {
      const cx = alignToPixelCenter(msToX(hoveredMsTime))
      ctx.save()
      ctx.strokeStyle = '#007acc'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(cx, floorTop)
      ctx.lineTo(cx, floorBottom)
      ctx.stroke()
      ctx.restore()
    }

    // --- Highlighted participant (on hover) ---
    if (hoveredParticipantIndex !== null) {
      const wins = data.participants[hoveredParticipantIndex].windows
      if (wins.length > 0) {
        ctx.strokeStyle = '#007acc'
        ctx.lineWidth = 1
        drawStepLinePath(ctx, wins, msToX, valueToY)
        ctx.stroke()
      }
    }
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
      // Break the line if this window doesn't abut the previous — signals a
      // data hole rather than stitching across it. The transformer no longer
      // produces gaps, but keep the guard for robustness.
      const prev = i > 0 ? wins[i - 1] : null
      const hasGap = prev !== null && Math.abs(w.startMs - prev.endMs) > 0.5
      const x0 = msToX(w.startMs)
      const x1 = msToX(w.endMs)
      const y = valueToY(w.value)
      if (!drawing || hasGap) {
        ctx.moveTo(x0, y)
      } else {
        ctx.lineTo(x0, y)
      }
      ctx.lineTo(x1, y)
      drawing = true
    }
  }

  function drawBandSegment(
    ctx: CanvasRenderingContext2D,
    p25: Float32Array,
    p75: Float32Array,
    from: number,
    to: number,
    sampleToX: (i: number) => number,
    valueToY: (v: number) => number
  ) {
    ctx.beginPath()
    ctx.moveTo(sampleToX(from), valueToY(p75[from]))
    for (let i = from + 1; i <= to; i++) {
      ctx.lineTo(sampleToX(i), valueToY(p75[i]))
    }
    for (let i = to; i >= from; i--) {
      ctx.lineTo(sampleToX(i), valueToY(p25[i]))
    }
    ctx.closePath()
    ctx.fill()
  }

  function renderOverlayAxes(
    ctx: CanvasRenderingContext2D,
    floorLeft: number,
    floorTop: number,
    floorWidth: number,
    floorHeight: number,
    floorBottom: number
  ) {
    const xTicks = niceTimelineTicks(data.timeline)
    drawPlotArea(ctx, {
      x: floorLeft,
      y: floorTop,
      width: floorWidth,
      height: floorHeight,
      ticks: {
        bottom: xTicks,
        top: { positions: xTicks.positions },
        left: yTicks ?? undefined,
      },
    })

    drawXAxisLabel(
      ctx,
      X_AXIS_LABEL,
      floorLeft,
      floorWidth,
      floorBottom,
      X_AXIS_LABEL_OFFSET,
      AXIS_CONFIG
    )

    drawYAxisMainLabel(
      ctx,
      data.yAxisLabel,
      floorLeft,
      floorTop,
      floorHeight
    )
  }

  // ──────────────────────────────────────────────────────────────────
  // HOVER
  // ──────────────────────────────────────────────────────────────────

  // Coordinates arrive already scaled from usePlot; null marks mouse-leave. The
  // plot bounds here are chrome-aware (the figure's own), so we hit-test them
  // directly rather than relying on usePlot's export-margin-only isOver.
  function handlePlotMouseMove(
    mouseX: number | null,
    mouseY: number | null,
    _isOver: boolean
  ) {
    if (mouseX === null || mouseY === null) {
      clearHover()
      return
    }

    if (
      mouseX < plotLeft ||
      mouseX > plotRight ||
      mouseY < plotTop ||
      mouseY > plotBottom
    ) {
      clearHover()
      return
    }

    const timelineMin = data.timeline.minValue
    const duration = Math.max(1, data.timeline.maxValue - timelineMin)
    const t = timelineMin + ((mouseX - plotLeft) / plotAreaWidth) * duration

    let participantIdx: number | null = null

    if (alignment === 'overlay') {
      // Nearest participant by Y-distance using their window value at t.
      const axisMax = yAxisMax
      let nearestDist = Infinity
      for (let p = 0; p < data.participants.length; p++) {
        const w = findWindowAt(data.participants[p].windows, t)
        if (!w) continue
        const py = plotBottom - (w.value / axisMax) * plotAreaHeight
        const dist = Math.abs(mouseY - py)
        if (dist < nearestDist) {
          nearestDist = dist
          participantIdx = p
        }
      }
    } else {
      // Heatmap: row-based
      const rowHeight = plotAreaHeight / data.participants.length
      const relY = mouseY - plotTop
      participantIdx = Math.max(
        0,
        Math.min(
          data.participants.length - 1,
          Math.floor(relY / rowHeight)
        )
      )
    }

    if (t !== hoveredMsTime || participantIdx !== hoveredParticipantIndex) {
      hoveredMsTime = t
      hoveredParticipantIndex = participantIdx

      if (participantIdx !== null) {
        const participant = data.participants[participantIdx]
        const w = findWindowAt(participant.windows, t)
        const tooltipContent = [
          { key: 'Participant', value: participant.label },
          {
            key: 'Time',
            value: w
              ? `${Math.round(w.startMs)}\u2013${Math.round(w.endMs)} ms`
              : `${Math.round(t)} ms`,
          },
          {
            key: data.yAxisLabel,
            value: w ? w.value.toFixed(2) : 'No data',
          },
        ]

        plot.showTooltip(
          'evolving-metrics-tooltip',
          tooltipContent,
          mouseX,
          mouseY,
          { x: 15, y: 15 }
        )

        plot.setCursor('crosshair')
      } else {
        plot.hideTooltip(0)
        plot.setCursor('default')
      }

      plot.scheduleRender()
    }
  }

  function clearHover() {
    if (hoveredMsTime !== null || hoveredParticipantIndex !== null) {
      hoveredMsTime = null
      hoveredParticipantIndex = null
      plot.hideTooltip(0)
      plot.setCursor('default')
      plot.scheduleRender()
    }
  }

  function calculateTickStep(len: number): number {
    const niceSteps = [5, 10, 20, 25, 50, 100, 200, 500, 1000]
    for (const s of niceSteps) {
      if (len / s <= 10) return s
    }
    return 1000
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: blockedRegions }}
  aria-label="Evolving Metrics visualization"
></canvas>
