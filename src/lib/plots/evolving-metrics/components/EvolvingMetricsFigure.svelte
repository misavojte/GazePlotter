<script lang="ts">
  import { untrack } from 'svelte'
  import {
    canvasLifecycleAction,
    beginCanvasDrawing,
    finishCanvasDrawing,
    getScaledMousePosition,
    getTooltipPosition,
    alignToPixelCenter,
  } from '$lib/plots/shared/canvasUtils'
  import { useCanvasPlot } from '$lib/plots/shared'
  import { updateTooltip } from '$lib/tooltip'
  import { estimateTextWidth } from '$lib/shared/utils/textUtils'
  import { interpolateColor } from '$lib/color/utility'
  import { INACTIVE_COLOR, PRESET_PALETTES } from '$lib/color/palettes'

  import {
    GRIDLINE_SECONDARY,
    GRIDLINE_PRIMARY,
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
  import { createAdaptiveTimeline } from '$lib/plots/shared/timelineUtils'
  import { safeNumber } from '$lib/shared/utils/mathUtils'
  import { MARGIN, AXIS_CONFIG, getEvolvingMetricsXAxisLabel } from '../const'
  import type { EvolvingMetricsResult } from '../types'

  const OVERLAY_LEFT_MARGIN = 65
  // Branding red #cd1404 as RGB components, reused for band + mean line.
  const OVERLAY_SUMMARY_RGB = '205, 20, 4'
  const OVERLAY_SUMMARY_COLOR = `rgb(${OVERLAY_SUMMARY_RGB})`
  const OVERLAY_BAND_ALPHA = 0.12
  const OVERLAY_MEAN_LINE_WIDTH = 1.5
  const OVERLAY_INDIVIDUAL_RGB = '210, 210, 210'

  type EvolvingMetricsFigureProps = {
    width: number
    height: number
    data: EvolvingMetricsResult
    alignment?: 'heatmap' | 'overlay'
    colorScale?: string[]
    dpiOverride?: number | null
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
  }

  let {
    width,
    height,
    data,
    alignment = 'heatmap',
    colorScale,
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
  }: EvolvingMetricsFigureProps = $props()

  const X_AXIS_LABEL = $derived(
    getEvolvingMetricsXAxisLabel(data.stepSize, data.windowMs)
  )
  const X_AXIS_LABEL_OFFSET = 30
  const AREA_DIVIDER = {
    COLOR: 'rgba(255, 255, 255, 0.4)',
    WIDTH: 1,
  }
  const HEATMAP_LEGEND_HEIGHT = 60

  let canvas = $state<HTMLCanvasElement | null>(null)
  let hoveredBinIndex = $state<number | null>(null)
  let hoveredParticipantIndex = $state<number | null>(null)

  const safeWidth = $derived(Math.max(1, safeNumber(width, 1)))
  const safeHeight = $derived(Math.max(1, safeNumber(height, 1)))
  const safeMarginTop = $derived(safeNumber(marginTop, 0))
  const safeMarginRight = $derived(safeNumber(marginRight, 0))
  const safeMarginBottom = $derived(safeNumber(marginBottom, 0))
  const safeMarginLeft = $derived(safeNumber(marginLeft, 0))

  const legendHeight = $derived(alignment === 'heatmap' ? HEATMAP_LEGEND_HEIGHT : 0)

  // Compact mode: when row height < font size, switch to index ticks (heatmap only)
  const COMPACT_THRESHOLD = AXIS_CONFIG.fontSize + 2
  const isCompact = $derived(
    alignment === 'heatmap' &&
      data.participants.length > 0 &&
      (safeHeight - MARGIN.TOP - MARGIN.BOTTOM - legendHeight) /
        data.participants.length <
        COMPACT_THRESHOLD
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

  const plotAreaWidth = $derived(
    Math.floor(
      Math.max(0, safeWidth - effectiveLeftMargin - MARGIN.RIGHT)
    )
  )
  const plotAreaHeight = $derived(
    Math.floor(
      Math.max(0, safeHeight - MARGIN.TOP - MARGIN.BOTTOM - legendHeight)
    )
  )

  const plotLeft = $derived(Math.floor(safeMarginLeft + effectiveLeftMargin))
  const plotTop = $derived(Math.floor(safeMarginTop + MARGIN.TOP))
  const plotBottom = $derived(plotTop + plotAreaHeight)
  const plotRight = $derived(plotLeft + plotAreaWidth)

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
      x: safeMarginLeft,
      y: plotBottom + MARGIN.BOTTOM,
      availableWidth: safeWidth,
      availableHeight: legendHeight,
      colorScale: palette,
      valueRange: [Math.round(data.valueMin), Math.round(data.valueMax)],
      effectiveMaxValue: Math.round(data.valueMax),
      title: 'Fixation duration [ms]',
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

  // Overlay: aggregate statistics (mean, P25, P75) per bin
  const overlayAggregates = $derived.by(() => {
    if (alignment !== 'overlay') return null
    const binCount = data.binCount
    const participantCount = data.participants.length
    const meanValues = new Float32Array(binCount)
    const p25Values = new Float32Array(binCount)
    const p75Values = new Float32Array(binCount)
    const temp: number[] = []

    for (let i = 0; i < binCount; i++) {
      temp.length = 0
      for (let p = 0; p < participantCount; p++) {
        const v = data.participants[p].values[i]
        if (v === v && v > 0) temp.push(v)
      }
      if (temp.length === 0) {
        meanValues[i] = NaN
        p25Values[i] = NaN
        p75Values[i] = NaN
      } else {
        let sum = 0
        for (let j = 0; j < temp.length; j++) sum += temp[j]
        meanValues[i] = sum / temp.length
        temp.sort((a, b) => a - b)
        p25Values[i] = computePercentile(temp, 0.25)
        p75Values[i] = computePercentile(temp, 0.75)
      }
    }
    // Smooth the aggregates with a triangular-weighted moving average so the
    // summary lines read as smooth trends rather than noisy per-bin spikes.
    // Kernel adapts to pixel density: cover ~3 pixels worth of bins.
    const binsPerPixel = plotAreaWidth > 0 ? binCount / plotAreaWidth : 1
    const halfWidth = Math.max(1, Math.round(binsPerPixel * 3))
    return {
      meanValues: smoothArray(meanValues, halfWidth),
      p25Values: smoothArray(p25Values, halfWidth),
      p75Values: smoothArray(p75Values, halfWidth),
    }
  })

  function smoothArray(values: Float32Array, halfWidth: number): Float32Array {
    const n = values.length
    const result = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      let sum = 0
      let weight = 0
      for (let j = -halfWidth; j <= halfWidth; j++) {
        const idx = i + j
        if (idx < 0 || idx >= n) continue
        const v = values[idx]
        if (v !== v) continue
        const w = halfWidth + 1 - Math.abs(j)
        sum += v * w
        weight += w
      }
      result[i] = weight > 0 ? sum / weight : NaN
    }
    return result
  }

  function computePercentile(sorted: number[], p: number): number {
    const n = sorted.length
    if (n === 1) return sorted[0]
    const k = (n - 1) * p
    const f = Math.floor(k)
    const c = Math.ceil(k)
    if (f === c) return sorted[f]
    return sorted[f] * (c - k) + sorted[c] * (k - f)
  }

  const plot = useCanvasPlot({
    render: renderCanvas,
    getWidth: () => width,
    getHeight: () => height,
    getMargins: () => ({
      top: marginTop,
      right: marginRight,
      bottom: marginBottom,
      left: marginLeft,
    }),
    getDpiOverride: () => dpiOverride,
  })

  $effect(() => plot.registerExportSource(() => canvas))

  function renderCanvas() {
    beginCanvasDrawing(plot.canvasState, true)

    const ctx = plot.canvasState.context
    if (!ctx) return

    const floorLeft = Math.floor(plotLeft)
    const floorTop = Math.floor(plotTop)
    const floorWidth = Math.floor(plotAreaWidth)
    const floorHeight = Math.floor(plotAreaHeight)
    const floorBottom = floorTop + floorHeight
    const floorRight = floorLeft + floorWidth

    const participantCount = data.participants.length
    if (floorWidth <= 0 || floorHeight <= 0 || data.binCount <= 0 || participantCount === 0) {
      finishCanvasDrawing(plot.canvasState)
      return
    }

    const binWidth = floorWidth / data.binCount

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
        binWidth,
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
        binWidth,
        participantCount
      )
    }

    ctx.restore()

    // Axes and labels (outside clip)
    if (alignment === 'overlay') {
      renderOverlayAxes(ctx, floorLeft, floorTop, floorWidth, floorHeight, floorBottom)
    } else {
      renderHeatmapLabels(ctx, floorLeft, floorTop, floorHeight, floorRight, participantCount, binWidth)
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
    binWidth: number,
    participantCount: number
  ) {
    const rowHeight = floorHeight / participantCount
    const paletteStopCount = palette.length - 1
    const valueRange = data.valueMax - data.valueMin
    const invValueRange = valueRange > 0 ? 1 / valueRange : 0

    fillPlotAreaBackground(
      ctx,
      floorLeft,
      floorTop,
      floorWidth,
      floorHeight,
      INACTIVE_COLOR
    )

    for (let p = 0; p < participantCount; p++) {
      const values = data.participants[p].values
      const rowY = floorTop + p * rowHeight

      for (let i = 0; i < data.binCount; i++) {
        const val = values[i]
        if (val !== val || val <= 0) continue

        const normalized = (val - data.valueMin) * invValueRange
        const scaledVal = Math.max(0, Math.min(1, normalized)) * paletteStopCount
        const baseIdx = scaledVal | 0
        const nextIdx = Math.min(paletteStopCount, baseIdx + 1)

        ctx.fillStyle = interpolateColor(
          palette[baseIdx],
          palette[nextIdx],
          scaledVal - baseIdx
        )
        ctx.fillRect(floorLeft + i * binWidth, rowY, binWidth + 0.5, rowHeight)
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

    // Hover highlight
    if (hoveredBinIndex !== null && hoveredParticipantIndex !== null) {
      const cellX = floorLeft + hoveredBinIndex * binWidth
      const cellY = floorTop + hoveredParticipantIndex * rowHeight

      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.fillStyle = '#007acc'
      ctx.fillRect(cellX, cellY, binWidth, rowHeight)
      ctx.restore()
    } else if (hoveredBinIndex !== null) {
      const binX = floorLeft + hoveredBinIndex * binWidth

      ctx.save()
      ctx.globalAlpha = 0.15
      ctx.fillStyle = '#007acc'
      ctx.fillRect(binX, floorTop, binWidth, floorHeight)
      ctx.restore()
    }
  }

  function renderHeatmapLabels(
    ctx: CanvasRenderingContext2D,
    floorLeft: number,
    floorTop: number,
    floorHeight: number,
    floorRight: number,
    participantCount: number,
    binWidth: number
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
        x: safeMarginLeft,
        y: floorBottom + MARGIN.BOTTOM,
        availableWidth: safeWidth,
        availableHeight: legendHeight,
        colorScale: palette,
        valueRange: [Math.round(data.valueMin), Math.round(data.valueMax)],
        effectiveMaxValue: Math.round(data.valueMax),
        title: 'Fixation duration [ms]',
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
    binWidth: number,
    participantCount: number
  ) {
    if (!overlayAggregates) return
    const { meanValues, p25Values, p75Values } = overlayAggregates
    const axisMax = yAxisMax

    const valueToY = (v: number) =>
      floorBottom - (v / axisMax) * floorHeight
    const binToX = (i: number) => floorLeft + (i + 0.5) * binWidth

    // --- Individual participant lines ---
    // Alpha and width scale with N so that spaghetti recedes into a density
    // cloud at high counts while remaining individually traceable at low N.
    const alpha = Math.max(0.04, Math.min(0.5, 2 / Math.sqrt(participantCount)))
    ctx.lineWidth = participantCount > 30 ? 0.5 : 1

    for (let p = 0; p < participantCount; p++) {
      if (hoveredParticipantIndex === p) continue
      const values = data.participants[p].values

      ctx.strokeStyle = `rgba(${OVERLAY_INDIVIDUAL_RGB}, ${alpha})`
      ctx.beginPath()
      let drawing = false
      for (let i = 0; i < data.binCount; i++) {
        const v = values[i]
        if (v !== v || v <= 0) {
          drawing = false
          continue
        }
        const x = binToX(i)
        const y = valueToY(v)
        if (!drawing) {
          ctx.moveTo(x, y)
          drawing = true
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }

    // --- P25–P75 band ---
    ctx.fillStyle = `rgba(${OVERLAY_SUMMARY_RGB}, ${OVERLAY_BAND_ALPHA})`
    let segStart = -1
    for (let i = 0; i <= data.binCount; i++) {
      const valid =
        i < data.binCount &&
        p25Values[i] === p25Values[i] &&
        p75Values[i] === p75Values[i]
      if (valid && segStart < 0) {
        segStart = i
      } else if (!valid && segStart >= 0) {
        drawBandSegment(ctx, p25Values, p75Values, segStart, i - 1, binToX, valueToY)
        segStart = -1
      }
    }

    // --- Mean line ---
    // Solid stroke in branding color — distinguished from spaghetti by color
    // and weight, not by dash pattern (dashes look messy on noisy data).
    ctx.save()
    ctx.strokeStyle = OVERLAY_SUMMARY_COLOR
    ctx.lineWidth = OVERLAY_MEAN_LINE_WIDTH
    ctx.beginPath()
    let drawingMean = false
    for (let i = 0; i < data.binCount; i++) {
      const v = meanValues[i]
      if (v !== v) {
        drawingMean = false
        continue
      }
      const x = binToX(i)
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

    // --- Hover: dashed vertical line at bin center ---
    if (hoveredBinIndex !== null) {
      const cx = alignToPixelCenter(binToX(hoveredBinIndex))
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
      const values = data.participants[hoveredParticipantIndex].values
      ctx.strokeStyle = '#007acc'
      ctx.lineWidth = 1
      ctx.beginPath()
      let drawingHL = false
      for (let i = 0; i < data.binCount; i++) {
        const v = values[i]
        if (v !== v || v <= 0) {
          drawingHL = false
          continue
        }
        const x = binToX(i)
        const y = valueToY(v)
        if (!drawingHL) {
          ctx.moveTo(x, y)
          drawingHL = true
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }
  }

  function drawBandSegment(
    ctx: CanvasRenderingContext2D,
    p25: Float32Array,
    p75: Float32Array,
    from: number,
    to: number,
    binToX: (i: number) => number,
    valueToY: (v: number) => number
  ) {
    ctx.beginPath()
    ctx.moveTo(binToX(from), valueToY(p75[from]))
    for (let i = from + 1; i <= to; i++) {
      ctx.lineTo(binToX(i), valueToY(p75[i]))
    }
    for (let i = to; i >= from; i--) {
      ctx.lineTo(binToX(i), valueToY(p25[i]))
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
      'Fixation duration [ms]',
      floorLeft,
      floorTop,
      floorHeight
    )
  }

  // ──────────────────────────────────────────────────────────────────
  // HOVER
  // ──────────────────────────────────────────────────────────────────

  function getHoveredCell(
    mouseX: number,
    mouseY: number
  ): { bin: number | null; participant: number | null } {
    if (
      mouseX < plotLeft ||
      mouseX > plotRight ||
      mouseY < plotTop ||
      mouseY > plotBottom
    ) {
      return { bin: null, participant: null }
    }

    const relativeX = mouseX - plotLeft
    const binWidth = plotAreaWidth / data.binCount
    const bin = Math.max(0, Math.min(data.binCount - 1, Math.floor(relativeX / binWidth)))

    if (alignment === 'overlay') {
      // Find nearest participant by Y-distance at this bin
      let nearest: number | null = null
      let nearestDist = Infinity
      const axisMax = yAxisMax
      for (let p = 0; p < data.participants.length; p++) {
        const v = data.participants[p].values[bin]
        if (v !== v || v <= 0) continue
        const py = plotBottom - (v / axisMax) * plotAreaHeight
        const dist = Math.abs(mouseY - py)
        if (dist < nearestDist) {
          nearestDist = dist
          nearest = p
        }
      }
      return { bin, participant: nearest }
    }

    // Heatmap: row-based
    const relativeY = mouseY - plotTop
    const rowHeight = plotAreaHeight / data.participants.length
    const participant = Math.max(
      0,
      Math.min(data.participants.length - 1, Math.floor(relativeY / rowHeight))
    )
    return { bin, participant }
  }

  function handleMouseMove(event: MouseEvent) {
    if (!canvas) return

    const { x: mouseX, y: mouseY } = getScaledMousePosition(
      plot.canvasState,
      event
    )
    const { bin, participant } = getHoveredCell(mouseX, mouseY)

    if (bin !== hoveredBinIndex || participant !== hoveredParticipantIndex) {
      hoveredBinIndex = bin
      hoveredParticipantIndex = participant

      if (bin !== null && participant !== null) {
        const p = data.participants[participant]
        const value = p.values[bin]
        const binStartTime =
          data.timeline.minValue + bin * data.stepSize
        const binEndTime =
          data.timeline.minValue + (bin + 1) * data.stepSize

        const tooltipContent = [
          {
            key: 'Participant',
            value: p.label,
          },
          {
            key: 'Time',
            value: `${Math.round(binStartTime)}\u2013${Math.round(binEndTime)} ms`,
          },
          {
            key: 'Fixation duration',
            value:
              value !== value || value <= 0
                ? 'No fixations'
                : `${value.toFixed(1)} ms`,
          },
        ]

        const tooltipPos = getTooltipPosition(
          plot.canvasState,
          mouseX,
          mouseY,
          { x: 15, y: 15 }
        )

        updateTooltip({
          id: 'evolving-metrics-tooltip',
          visible: true,
          content: tooltipContent,
          x: tooltipPos.x,
          y: tooltipPos.y,
        })

        if (canvas) canvas.style.cursor = 'crosshair'
      } else {
        updateTooltip(null)
        if (canvas) canvas.style.cursor = 'default'
      }

      plot.scheduleRender()
    }
  }

  function handleMouseLeave() {
    if (hoveredBinIndex !== null || hoveredParticipantIndex !== null) {
      hoveredBinIndex = null
      hoveredParticipantIndex = null
      updateTooltip(null)
      if (canvas) canvas.style.cursor = 'default'
      plot.scheduleRender()
    }
  }

  $effect(() => {
    const _ = {
      data,
      alignment,
      w: safeWidth,
      h: safeHeight,
      dpi: dpiOverride,
      mt: safeMarginTop,
      mr: safeMarginRight,
      mb: safeMarginBottom,
      ml: safeMarginLeft,
    }

    untrack(() => plot.refresh())
  })

  function calculateTickStep(len: number): number {
    const niceSteps = [5, 10, 20, 25, 50, 100, 200, 500, 1000]
    for (const s of niceSteps) {
      if (len / s <= 10) return s
    }
    return 1000
  }
</script>

<canvas
  bind:this={canvas}
  use:canvasLifecycleAction={plot.actionOptions}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  aria-label="Evolving Metrics visualization"
></canvas>
