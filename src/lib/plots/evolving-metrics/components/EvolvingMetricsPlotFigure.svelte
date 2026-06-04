<script lang="ts">
  import { alignToPixelCenter } from '$lib/plots/shared/canvasUtils'
  import {
    usePlot,
    NO_MARGINS,
    canvasBlockSelect,
    type CanvasExportProps,
    type PlotFrame,
    type FrameHit,
  } from '$lib/plots/shared'
  import { estimateTextWidth, measureTextHeight } from '$lib/shared/utils/textUtils'
  import { interpolateColor } from '$lib/color'
  import { INACTIVE_COLOR, PRESET_PALETTES } from '$lib/color/palettes'

  import { FONT_PRIMARY, PLOT_LEGEND_GAP } from '$lib/plots/shared/const'
  import {
    computeGradientLegendGeometry,
    drawGradientLegend,
    getGradientLegendRequiredHeight,
  } from '$lib/plots/shared/legendGradient'
  import {
    drawXAxisLabel,
    drawYAxisMainLabel,
    getXAxisHeight,
    getXAxisLabelOffset,
  } from '$lib/plots/shared/axisUtils'
  import {
    drawPlotArea,
    fillPlotAreaBackground,
    niceTimelineTicks,
    bottomOriginYTicks,
  } from '$lib/plots/shared/plotArea'
  import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
  import { MARGIN, AXIS_CONFIG } from '../const'
  import type { EvolvingMetricsResult, EvolvingMetricsWindow } from '../types'

  const OVERLAY_LEFT_MARGIN = 65
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
  const AREA_DIVIDER = { COLOR: 'rgba(255, 255, 255, 0.4)', WIDTH: 1 }

  let hoveredMsTime = $state<number | null>(null)
  let hoveredParticipantIndex = $state<number | null>(null)

  const legendHeight = $derived(
    alignment === 'heatmap' ? getGradientLegendRequiredHeight(AXIS_CONFIG.fontSize) : 0
  )

  const tickLabelHeight = $derived.by(() => {
    let maxHeight = 0
    for (const t of data.timeline.ticks) {
      const h = measureTextHeight(t.label, AXIS_CONFIG.fontSize, AXIS_CONFIG.fontFamily)
      if (h > maxHeight) maxHeight = h
    }
    return maxHeight
  })
  const axisTitleHeight = $derived(
    X_AXIS_LABEL ? measureTextHeight(X_AXIS_LABEL, AXIS_CONFIG.fontSize, AXIS_CONFIG.fontFamily) : 0
  )
  const xAxisHeight = $derived(
    X_AXIS_LABEL
      ? getXAxisHeight(tickLabelHeight, axisTitleHeight, AXIS_CONFIG.tickLabelOffset)
      : AXIS_CONFIG.tickLabelOffset + tickLabelHeight
  )
  const xAxisLabelOffset = $derived(getXAxisLabelOffset(tickLabelHeight, AXIS_CONFIG.tickLabelOffset))
  const effectiveBottomMargin = $derived(
    xAxisHeight + (legendHeight > 0 ? PLOT_LEGEND_GAP + legendHeight : 0)
  )

  // Compact-mode probe height — derived from the underlying content area, NOT
  // from `plot.frame`, to break the cycle (frame ← gutters ← effectiveLeftMargin
  // ← isCompact). Equals frame.height by construction, since the gutters carve
  // exactly MARGIN.TOP + effectiveBottomMargin out of the content height.
  const probeHeight = $derived.by(() =>
    Math.max(0, plot.plotAreaHeight - MARGIN.TOP - effectiveBottomMargin)
  )
  const COMPACT_THRESHOLD = AXIS_CONFIG.fontSize + 2
  const isCompact = $derived(
    alignment === 'heatmap' &&
      data.participants.length > 0 &&
      probeHeight / data.participants.length < COMPACT_THRESHOLD
  )

  const effectiveLeftMargin = $derived.by(() => {
    if (alignment === 'overlay') return OVERLAY_LEFT_MARGIN
    if (isCompact) return 55
    let max = 0
    for (const p of data.participants) {
      const w = estimateTextWidth(p.label, AXIS_CONFIG.fontSize, AXIS_CONFIG.fontFamily)
      if (w > max) max = w
    }
    return Math.max(MARGIN.LEFT, Math.min(200, max + 20))
  })

  const plot = usePlot<{ t: number; participantIdx: number | null }>({
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [data, alignment],
    placeholder: () => (data.noMetric ? METRIC_MISSING_MESSAGE : null),
    gutters: () => ({
      pad: {
        left: effectiveLeftMargin,
        top: MARGIN.TOP,
        right: MARGIN.RIGHT,
        bottom: effectiveBottomMargin,
      },
    }),
    clipData: false,
    drawData: drawEvolving,
    hitTest: computeHit,
    onHoverChange: (hit) => {
      const tag = hit?.data
      const nextT = tag?.t ?? null
      const nextP = tag?.participantIdx ?? null
      const changed = nextT !== hoveredMsTime || nextP !== hoveredParticipantIndex
      hoveredMsTime = nextT
      hoveredParticipantIndex = nextP
      return changed
    },
  })

  const palette = $derived<string[]>(
    colorScale && colorScale.length >= 2 ? colorScale : [...PRESET_PALETTES.HEAT.colors]
  )

  const gradientLegendGeometry = $derived.by(() => {
    if (alignment !== 'heatmap') return null
    return computeGradientLegendGeometry({
      x: margins.left,
      y: plot.frame.bottom + xAxisHeight + PLOT_LEGEND_GAP,
      availableWidth: plot.plotAreaWidth,
      availableHeight: legendHeight,
      colorScale: palette,
      valueRange: [Math.round(data.valueMin), Math.round(data.valueMax)],
      effectiveMaxValue: Math.round(data.valueMax),
      title: data.yAxisLabel,
      belowMinColor: INACTIVE_COLOR,
    })
  })

  const yTimeline = $derived.by(() =>
    alignment !== 'overlay' ? null : createAdaptiveTimeline(0, data.valueMax, 6)
  )
  const yAxisMax = $derived(yTimeline ? yTimeline.maxValue : data.valueMax)
  const yTicks = $derived.by(() => {
    if (!yTimeline) return null
    const niceValues = yTimeline.ticks.filter(t => t.isNice).map(t => t.value)
    return bottomOriginYTicks(niceValues, yAxisMax, v => String(Math.round(v)))
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
    return f === c ? sorted[f] : sorted[f] * (c - k) + sorted[c] * (k - f)
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

  function drawEvolving(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    const floorLeft = Math.floor(frame.x)
    const floorTop = Math.floor(frame.y)
    const floorWidth = Math.floor(frame.width)
    const floorHeight = Math.floor(frame.height)
    const floorBottom = floorTop + floorHeight
    const floorRight = floorLeft + floorWidth

    const participantCount = data.participants.length
    if (floorWidth <= 0 || floorHeight <= 0 || participantCount === 0) return

    ctx.save()
    ctx.beginPath()
    ctx.rect(floorLeft, floorTop, floorWidth, floorHeight)
    ctx.clip()
    if (alignment === 'overlay') {
      renderOverlay(ctx, floorLeft, floorTop, floorWidth, floorHeight, floorBottom, floorRight, participantCount)
    } else {
      renderHeatmap(ctx, floorLeft, floorTop, floorWidth, floorHeight, floorBottom, floorRight, participantCount)
    }
    ctx.restore()

    if (alignment === 'overlay') {
      renderOverlayAxes(ctx, floorLeft, floorTop, floorWidth, floorHeight, floorBottom)
    } else {
      renderHeatmapLabels(ctx, floorLeft, floorTop, floorHeight, floorRight, participantCount)
    }
  }

  // ── HEATMAP ──
  function renderHeatmap(
    ctx: CanvasRenderingContext2D,
    floorLeft: number, floorTop: number, floorWidth: number, floorHeight: number,
    floorBottom: number, floorRight: number, participantCount: number
  ) {
    const rowHeight = floorHeight / participantCount
    const paletteStopCount = palette.length - 1
    const valueRange = data.valueMax - data.valueMin
    const invValueRange = valueRange > 0 ? 1 / valueRange : 0
    const timelineMin = data.timeline.minValue
    const duration = Math.max(1, data.timeline.maxValue - timelineMin)
    const invMsPerPx = floorWidth / duration

    fillPlotAreaBackground(ctx, floorLeft, floorTop, floorWidth, floorHeight, INACTIVE_COLOR)

    for (let p = 0; p < participantCount; p++) {
      const rowY = floorTop + p * rowHeight
      const wins = data.participants[p].windows
      for (let i = 0; i < wins.length; i++) {
        const w = wins[i]
        if (!Number.isFinite(w.value)) continue
        const xStart = floorLeft + (w.startMs - timelineMin) * invMsPerPx
        const xEnd = floorLeft + (w.endMs - timelineMin) * invMsPerPx
        if (xEnd <= floorLeft || xStart >= floorRight) continue
        const normalized = (w.value - data.valueMin) * invValueRange
        const scaledVal = Math.max(0, Math.min(1, normalized)) * paletteStopCount
        const baseIdx = scaledVal | 0
        const nextIdx = Math.min(paletteStopCount, baseIdx + 1)
        ctx.fillStyle = interpolateColor(palette[baseIdx], palette[nextIdx], scaledVal - baseIdx)
        const x = Math.max(floorLeft, xStart)
        const rectWidth = Math.min(floorRight, xEnd) - x
        if (rectWidth > 0) ctx.fillRect(x, rowY, rectWidth, rowHeight)
      }
    }

    ctx.strokeStyle = AREA_DIVIDER.COLOR
    ctx.lineWidth = AREA_DIVIDER.WIDTH
    for (let p = 1; p < participantCount; p++) {
      const y = alignToPixelCenter(floorTop + p * rowHeight)
      ctx.beginPath()
      ctx.moveTo(floorLeft, y)
      ctx.lineTo(floorRight, y)
      ctx.stroke()
    }

    if (hoveredMsTime !== null && hoveredParticipantIndex !== null) {
      const w = findWindowAt(data.participants[hoveredParticipantIndex].windows, hoveredMsTime)
      if (w) {
        const xStart = floorLeft + (w.startMs - timelineMin) * invMsPerPx
        const xEnd = floorLeft + (w.endMs - timelineMin) * invMsPerPx
        const rowY = floorTop + hoveredParticipantIndex * rowHeight
        const x = Math.max(floorLeft, xStart)
        ctx.save()
        ctx.globalAlpha = 0.3
        ctx.fillStyle = '#007acc'
        ctx.fillRect(x, rowY, Math.min(floorRight, xEnd) - x, rowHeight)
        ctx.restore()
      }
    } else if (hoveredMsTime !== null) {
      const cx = alignToPixelCenter(floorLeft + (hoveredMsTime - timelineMin) * invMsPerPx)
      ctx.save()
      ctx.globalAlpha = 0.15
      ctx.fillStyle = '#007acc'
      ctx.fillRect(cx - 0.5, floorTop, 1.5, floorHeight)
      ctx.restore()
    }
  }

  function renderHeatmapLabels(
    ctx: CanvasRenderingContext2D,
    floorLeft: number, floorTop: number, floorHeight: number,
    floorRight: number, participantCount: number
  ) {
    const rowHeight = floorHeight / participantCount
    const floorBottom = floorTop + floorHeight
    const floorWidth = floorRight - floorLeft

    ctx.save()
    ctx.font = `${AXIS_CONFIG.fontSize}px ${FONT_PRIMARY.FAMILY}`
    ctx.fillStyle = AXIS_CONFIG.color
    ctx.textBaseline = 'middle'

    if (isCompact) {
      ctx.save()
      ctx.textAlign = 'center'
      ctx.translate(floorLeft - 40, floorTop + floorHeight / 2)
      ctx.rotate(-Math.PI / 2)
      const lineHeight = AXIS_CONFIG.fontSize * 1.2
      ctx.fillText('Participants', 0, -lineHeight / 2)
      ctx.fillText('[order indices]', 0, lineHeight / 2)
      ctx.restore()

      ctx.textAlign = 'right'
      const tickX = floorLeft - 8
      const step = calculateTickStep(participantCount)
      for (let i = 0; i < participantCount; i += step) {
        ctx.fillText(String(i), tickX, floorTop + i * rowHeight + rowHeight / 2)
      }
      const lastIdx = participantCount - 1
      if (lastIdx % step !== 0) {
        ctx.fillText(String(lastIdx), tickX, floorTop + lastIdx * rowHeight + rowHeight / 2)
      }
    } else {
      ctx.textAlign = 'right'
      const maxLabelPx = effectiveLeftMargin - 15
      for (let p = 0; p < participantCount; p++) {
        let labelText = data.participants[p].label
        if (ctx.measureText(labelText).width > maxLabelPx) {
          while (ctx.measureText(labelText + '…').width > maxLabelPx && labelText.length > 0) {
            labelText = labelText.slice(0, -1)
          }
          labelText += '…'
        }
        ctx.fillText(labelText, floorLeft - 10, floorTop + p * rowHeight + rowHeight / 2)
      }
    }
    ctx.restore()

    const xTicks = niceTimelineTicks(data.timeline)
    drawPlotArea(ctx, {
      x: floorLeft,
      y: floorTop,
      width: floorWidth,
      height: floorHeight,
      ticks: { bottom: xTicks, top: { positions: xTicks.positions } },
    })
    drawXAxisLabel(ctx, X_AXIS_LABEL, floorLeft, floorWidth, floorBottom, xAxisLabelOffset, AXIS_CONFIG)

    if (gradientLegendGeometry) {
      drawGradientLegend(ctx, gradientLegendGeometry, {
        x: margins.left,
        y: floorBottom + xAxisHeight,
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

  // ── OVERLAY ──
  function renderOverlay(
    ctx: CanvasRenderingContext2D,
    floorLeft: number, floorTop: number, floorWidth: number, floorHeight: number,
    floorBottom: number, _floorRight: number, participantCount: number
  ) {
    if (!overlayAggregates) return
    const { meanValues, p25Values, p75Values, sampleCount } = overlayAggregates
    const axisMax = yAxisMax
    const timelineMin = data.timeline.minValue
    const duration = Math.max(1, data.timeline.maxValue - timelineMin)
    const invMsPerPx = floorWidth / duration

    const valueToY = (v: number) => floorBottom - (v / axisMax) * floorHeight
    const msToX = (ms: number) => floorLeft + (ms - timelineMin) * invMsPerPx
    const sampleToX = (i: number) => floorLeft + ((i + 0.5) / sampleCount) * floorWidth

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

  function renderOverlayAxes(
    ctx: CanvasRenderingContext2D,
    floorLeft: number, floorTop: number, floorWidth: number, floorHeight: number, floorBottom: number
  ) {
    const xTicks = niceTimelineTicks(data.timeline)
    drawPlotArea(ctx, {
      x: floorLeft,
      y: floorTop,
      width: floorWidth,
      height: floorHeight,
      ticks: { bottom: xTicks, top: { positions: xTicks.positions }, left: yTicks ?? undefined },
    })
    drawXAxisLabel(ctx, X_AXIS_LABEL, floorLeft, floorWidth, floorBottom, xAxisLabelOffset, AXIS_CONFIG)
    drawYAxisMainLabel(ctx, data.yAxisLabel, floorLeft, floorTop, floorHeight)
  }

  // ── HOVER ──
  function computeHit(
    mx: number,
    my: number,
    frame: PlotFrame
  ): FrameHit<{ t: number; participantIdx: number | null }> | null {
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
      // Overlay with no window under the cursor — track the ms line, no tooltip.
      return {
        tooltipId: 'evolving-metrics-tooltip',
        content: [],
        anchorX: mx,
        anchorY: my,
        delay: 0,
        cursor: 'default',
        data: { t, participantIdx: null },
      }
    }

    const participant = data.participants[participantIdx]
    const w = findWindowAt(participant.windows, t)
    return {
      tooltipId: 'evolving-metrics-tooltip',
      content: [
        { key: 'Participant', value: participant.label },
        { key: 'Time', value: w ? `${Math.round(w.startMs)}–${Math.round(w.endMs)} ms` : `${Math.round(t)} ms` },
        { key: data.yAxisLabel, value: w ? w.value.toFixed(2) : 'No data' },
      ],
      anchorX: mx,
      anchorY: my,
      offset: { x: 15, y: 15 },
      cursor: 'crosshair',
      data: { t, participantIdx },
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
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
  aria-label="Evolving Metrics visualization"
></canvas>
