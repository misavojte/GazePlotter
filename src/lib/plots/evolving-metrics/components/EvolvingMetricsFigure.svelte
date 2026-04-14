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
  import { interpolateColor, desaturateToWhite } from '$lib/color/utility'
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
  import {
    drawTimelineLabels,
    drawXAxisTicksAndBorder,
    drawXAxisLabel,
    drawTopXAxisTicksAndBorder,
    drawPlotOutline,
  } from '$lib/plots/shared/axisUtils'
  import { safeNumber } from '$lib/shared/utils/mathUtils'
  import { MARGIN, AXIS_CONFIG, getEvolvingMetricsXAxisLabel } from '../const'
  import type { EvolvingMetricsResult } from '../types'

  const RIDGELINE_SCALE_DEFAULT = 2.5
  const RIDGELINE_CONTENT_FILL = 0.9

  type EvolvingMetricsFigureProps = {
    width: number
    height: number
    data: EvolvingMetricsResult
    alignment?: 'heatmap' | 'ridgeline'
    ridgelineScale?: number
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
    ridgelineScale = RIDGELINE_SCALE_DEFAULT,
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
  const RIDGELINE_SCALE_WIDTH = 50

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
  const effectiveRightMargin = $derived(
    alignment === 'ridgeline' ? RIDGELINE_SCALE_WIDTH : MARGIN.RIGHT
  )

  // Compact mode: when row height < font size, switch to index ticks
  const COMPACT_THRESHOLD = AXIS_CONFIG.fontSize + 2
  const isCompact = $derived(
    data.participants.length > 0 &&
      (safeHeight - MARGIN.TOP - MARGIN.BOTTOM - legendHeight) /
        data.participants.length <
        COMPACT_THRESHOLD
  )

  // Compute effective left margin based on label mode
  const effectiveLeftMargin = $derived.by(() => {
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
      Math.max(0, safeWidth - effectiveLeftMargin - effectiveRightMargin)
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

  // Color palette
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

    const rowHeight = floorHeight / participantCount
    const binWidth = floorWidth / data.binCount
    const paletteStopCount = palette.length - 1
    const valueRange = data.valueMax - data.valueMin
    const invValueRange = valueRange > 0 ? 1 / valueRange : 0

    // Clip to plot area
    ctx.save()
    ctx.beginPath()
    ctx.rect(floorLeft, floorTop, floorWidth, floorHeight)
    ctx.clip()

    if (alignment === 'ridgeline') {
      // --- Ridgeline rendering ---
      const scale = ridgelineScale ?? RIDGELINE_SCALE_DEFAULT
      const stripHeight = rowHeight * scale
      const scaleY = data.valueMax > 0 ? (stripHeight * RIDGELINE_CONTENT_FILL) / data.valueMax : 0

      // Precompute x positions and per-participant topY arrays
      const xPositions = new Float32Array(data.binCount)
      for (let i = 0; i < data.binCount; i++) {
        xPositions[i] = floorLeft + (i + 0.5) * binWidth
      }

      const baselines = new Float32Array(participantCount)
      const topYArrays: Float32Array[] = new Array(participantCount)

      for (let p = 0; p < participantCount; p++) {
        const values = data.participants[p].values
        const baseline = floorTop + (p + 1) * rowHeight
        baselines[p] = baseline

        const topY = new Float32Array(data.binCount)
        for (let i = 0; i < data.binCount; i++) {
          const val = values[i]
          topY[i] = val === val && val > 0 ? baseline - val * scaleY : baseline
        }
        topYArrays[p] = topY
      }

      // Helper to trace a ridgeline path (top edge forward, baseline back)
      const traceRidgePath = (c: CanvasRenderingContext2D, p: number) => {
        c.moveTo(floorLeft, baselines[p])
        const topY = topYArrays[p]
        for (let i = 0; i < data.binCount; i++) {
          c.lineTo(xPositions[i], topY[i])
        }
        c.lineTo(floorRight, baselines[p])
        c.closePath()
      }

      // Pass 1: Draw baselines
      ctx.strokeStyle = GRIDLINE_SECONDARY.COLOR
      ctx.lineWidth = GRIDLINE_SECONDARY.WIDTH
      for (let p = 0; p < participantCount; p++) {
        const y = alignToPixelCenter(baselines[p])
        ctx.beginPath()
        ctx.moveTo(alignToPixelCenter(floorLeft), y)
        ctx.lineTo(alignToPixelCenter(floorRight), y)
        ctx.stroke()
      }

      // Pass 2: Draw filled areas
      ctx.fillStyle = INACTIVE_COLOR
      for (let p = 0; p < participantCount; p++) {
        ctx.beginPath()
        traceRidgePath(ctx, p)
        ctx.fill()
      }

      // Pass 3: Relief effect — where a later row overlaps an earlier row,
      // paint the overlapped portion in a lighter tone for depth
      const reliefColor = desaturateToWhite(INACTIVE_COLOR, 0.3)
      ctx.save()
      for (let p = 0; p < participantCount - 1; p++) {
        for (let cover = p + 1; cover < participantCount; cover++) {
          // Clip to covering row's shape
          ctx.save()
          ctx.beginPath()
          traceRidgePath(ctx, cover)
          ctx.clip()

          // Paint current row's shape in lighter tone
          ctx.fillStyle = reliefColor
          ctx.beginPath()
          traceRidgePath(ctx, p)
          ctx.fill()

          ctx.restore()
        }
      }
      ctx.restore()

      // Hover highlight
      if (hoveredBinIndex !== null) {
        const binX = floorLeft + hoveredBinIndex * binWidth

        ctx.save()
        ctx.globalAlpha = 0.15
        ctx.fillStyle = '#007acc'
        ctx.fillRect(binX, floorTop, binWidth, floorHeight)
        ctx.restore()
      }
    } else {
      // --- Heatmap rendering ---
      // Background fill for N/A bins — one rect instead of per-cell paints
      ctx.fillStyle = INACTIVE_COLOR
      ctx.fillRect(floorLeft, floorTop, floorWidth, floorHeight)

      // Draw only cells with data (skip NaN — background already covers them)
      for (let p = 0; p < participantCount; p++) {
        const values = data.participants[p].values
        const rowY = floorTop + p * rowHeight

        for (let i = 0; i < data.binCount; i++) {
          const val = values[i]
          if (val !== val || val <= 0) continue // NaN or zero — already background

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

    ctx.restore()

    // Participant labels (outside clip)
    ctx.save()
    ctx.font = `${AXIS_CONFIG.fontSize}px ${FONT_PRIMARY.FAMILY}`
    ctx.fillStyle = AXIS_CONFIG.color
    ctx.textBaseline = 'middle'

    if (isCompact) {
      // Compact: rotated "Participants [order indices]" + index ticks
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
      // Normal: participant name labels with truncation
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

    // X-axis
    drawTimelineLabels(
      ctx,
      data.timeline,
      floorLeft,
      floorWidth,
      floorBottom,
      AXIS_CONFIG
    )
    drawXAxisLabel(
      ctx,
      X_AXIS_LABEL,
      floorLeft,
      floorWidth,
      floorBottom,
      X_AXIS_LABEL_OFFSET,
      AXIS_CONFIG
    )
    drawPlotOutline(
      ctx,
      floorLeft,
      floorTop,
      floorWidth,
      floorHeight,
      AXIS_CONFIG.baselineColor
    )
    drawXAxisTicksAndBorder(
      ctx,
      data.timeline,
      floorLeft,
      floorWidth,
      floorBottom,
      AXIS_CONFIG,
      false
    )
    drawTopXAxisTicksAndBorder(
      ctx,
      data.timeline,
      floorLeft,
      floorWidth,
      floorTop,
      AXIS_CONFIG,
      false
    )

    // Gradient legend (heatmap only)
    if (alignment === 'heatmap' && gradientLegendGeometry) {
      drawGradientLegend(ctx, gradientLegendGeometry, {
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
    }

    // Right-side scale bar (ridgeline only)
    if (alignment === 'ridgeline' && data.valueMax > 0) {
      const scale = ridgelineScale ?? RIDGELINE_SCALE_DEFAULT
      const stripHeight = rowHeight * scale
      const scaleHeight = stripHeight * RIDGELINE_CONTENT_FILL
      let scaleMaxValue = Math.round(data.valueMax)

      // Adaptive: halve if the scale bar would exceed plot area
      let drawHeight = scaleHeight
      while (drawHeight > floorHeight && scaleMaxValue > 1) {
        drawHeight /= 2
        scaleMaxValue = Math.round(scaleMaxValue / 2)
      }

      const centerY = floorTop + floorHeight / 2
      const scaleTop = alignToPixelCenter(centerY - drawHeight / 2)
      const scaleBottom = alignToPixelCenter(centerY + drawHeight / 2)

      const scaleX = alignToPixelCenter(floorRight + 5)
      const tickLength = 5
      const tickXEnd = alignToPixelCenter(scaleX + tickLength)

      ctx.save()
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = `${AXIS_CONFIG.fontSize - 2}px ${FONT_PRIMARY.FAMILY}`
      ctx.fillStyle = AXIS_CONFIG.color

      const tickLabelX = tickXEnd + 3
      ctx.fillText('0', tickLabelX, scaleBottom)
      ctx.fillText(`${scaleMaxValue}`, tickLabelX, scaleTop)

      // Vertical bar + ticks
      ctx.beginPath()
      ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
      ctx.lineWidth = 1
      ctx.moveTo(scaleX, scaleBottom)
      ctx.lineTo(scaleX, scaleTop)
      ctx.moveTo(scaleX, scaleBottom)
      ctx.lineTo(tickXEnd, scaleBottom)
      ctx.moveTo(scaleX, scaleTop)
      ctx.lineTo(tickXEnd, scaleTop)
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()
    finishCanvasDrawing(plot.canvasState)
  }

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
    const relativeY = mouseY - plotTop
    const binWidth = plotAreaWidth / data.binCount
    const rowHeight = plotAreaHeight / data.participants.length

    const bin = Math.max(0, Math.min(data.binCount - 1, Math.floor(relativeX / binWidth)))
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
  aria-label="Evolving Metrics heatmap visualization"
></canvas>
