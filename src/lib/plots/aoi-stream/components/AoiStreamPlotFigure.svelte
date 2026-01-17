<script lang="ts">
  import { getContext, onMount, untrack } from 'svelte'
  import { browser } from '$app/environment'
  import {
    EXPORT_SOURCE_CONTEXT,
    type ExportSourceRegistrar,
  } from '$lib/shared/utils/exportUtils'
  import {
    createCanvasState,
    setupCanvas,
    resizeCanvas,
    setupDpiChangeListeners,
    beginCanvasDrawing,
    finishCanvasDrawing,
    type CanvasState,
  } from '$lib/shared/utils/canvasUtils'
  import {
    SYSTEM_SANS_SERIF_STACK,
    truncateTextToPixelWidth,
  } from '$lib/shared/utils/textUtils'
  import {
    SCARF_LAYOUT,
    getXAxisLabel,
    getItemsPerRow,
  } from '$lib/plots/scarf/utils'
  import type { AoiStreamPlotResult } from '$lib/plots/aoi-stream/types'

  const MARGIN = {
    TOP: 20,
    RIGHT: SCARF_LAYOUT.RIGHT_MARGIN,
    BOTTOM: 55,
    LEFT: 50,
  }

  const AXIS = {
    TICK_LENGTH: SCARF_LAYOUT.TICK_LENGTH,
    FONT_SIZE: SCARF_LAYOUT.LABEL_FONT_SIZE,
    COLOR: '#222',
    GRID_COLOR: SCARF_LAYOUT.GRID_COLOR,
    BASELINE_COLOR: '#c9c9c9',
  }

  const Y_AXIS = {
    LABEL_OFFSET: 36,
    TICK_LABEL_OFFSET: 10,
  }

  const LEGEND = {
    ITEM_HEIGHT: SCARF_LAYOUT.LEGEND_ITEM_HEIGHT,
    ICON_SIZE: SCARF_LAYOUT.LEGEND_ICON_WIDTH,
    TEXT_PADDING: SCARF_LAYOUT.LEGEND_TEXT_PADDING,
    ITEM_SPACING: SCARF_LAYOUT.LEGEND_ITEM_SPACING,
    ROW_PADDING: SCARF_LAYOUT.LEGEND_ITEM_PADDING,
    TOP_PADDING: SCARF_LAYOUT.LEGEND_GROUP_TITLE_SPACING,
  }

  const FLOW_CURVE_TENSION = 0.12
  const X_AXIS_LABEL = getXAxisLabel('absolute')
  const X_AXIS_LABEL_OFFSET = 24
  const AREA_DIVIDER = {
    COLOR: 'rgba(255, 255, 255, 0.6)',
    WIDTH: 0.75,
  }

  type AoiStreamPlotFigureProps = {
    width: number
    height: number
    data: AoiStreamPlotResult
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
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
  }: AoiStreamPlotFigureProps = $props()

  let canvas = $state<HTMLCanvasElement | null>(null)
  let canvasState = $state<CanvasState>(createCanvasState())

  const safeNumber = (value: number, fallback: number) =>
    Number.isFinite(value) ? value : fallback

  const safeWidth = $derived.by(() => Math.max(1, safeNumber(width, 1)))
  const safeHeight = $derived.by(() => Math.max(1, safeNumber(height, 1)))

  // Export margins can be edited via inputs; treat temporary invalid states as 0
  const safeMarginTop = $derived.by(() => safeNumber(marginTop, 0))
  const safeMarginRight = $derived.by(() => safeNumber(marginRight, 0))
  const safeMarginBottom = $derived.by(() => safeNumber(marginBottom, 0))
  const safeMarginLeft = $derived.by(() => safeNumber(marginLeft, 0))

  const exportRegistrar = getContext<ExportSourceRegistrar | undefined>(
    EXPORT_SOURCE_CONTEXT
  )

  $effect(() => {
    if (!exportRegistrar) return
    if (!canvas) return

    exportRegistrar.register({ kind: 'canvas', getCanvas: () => canvas })

    return () => {
      exportRegistrar.register(null)
    }
  })

  const legendItemsPerRow = $derived.by(() =>
    Math.max(
      1,
      getItemsPerRow({
        chartWidth: Math.max(0, safeWidth - MARGIN.LEFT - MARGIN.RIGHT),
        leftLabelWidth: 0,
        padding: 0,
        iconWidth: LEGEND.ICON_SIZE,
        textPadding: LEGEND.TEXT_PADDING,
        itemSpacing: LEGEND.ITEM_SPACING,
        avgTextWidth: 90,
      })
    )
  )

  const legendRows = $derived.by(() =>
    data.upperSeries.length
      ? Math.ceil(data.upperSeries.length / legendItemsPerRow)
      : 0
  )

  const legendHeight = $derived.by(() =>
    legendRows === 0
      ? 0
      : legendRows * (LEGEND.ITEM_HEIGHT + LEGEND.ROW_PADDING) +
        LEGEND.TOP_PADDING
  )

  // `width`/`height` already represent the drawable area excluding export margins.
  // Export margins are applied as offsets and by growing the canvas size.
  const plotAreaWidth = $derived(
    Math.max(0, safeWidth - MARGIN.LEFT - MARGIN.RIGHT)
  )
  const plotAreaHeight = $derived(
    Math.max(0, safeHeight - MARGIN.TOP - MARGIN.BOTTOM - legendHeight)
  )

  const plotLeft = $derived(safeMarginLeft + MARGIN.LEFT)
  const plotTop = $derived(safeMarginTop + MARGIN.TOP)
  const plotBottom = $derived(plotTop + plotAreaHeight)

  function scheduleRender() {
    if (!canvasState.renderScheduled && browser) {
      canvasState.renderScheduled = true
      requestAnimationFrame(() => {
        renderCanvas()
        canvasState.renderScheduled = false
      })
    }
  }

  function initCanvas() {
    if (!canvas) return
    canvasState = setupCanvas(canvasState, canvas, dpiOverride)

    const targetWidth = Math.max(
      1,
      safeWidth + safeMarginLeft + safeMarginRight
    )
    const targetHeight = Math.max(
      1,
      safeHeight + safeMarginTop + safeMarginBottom
    )
    canvasState = resizeCanvas(canvasState, targetWidth, targetHeight)
    renderCanvas()
  }

  function renderCanvas() {
    beginCanvasDrawing(canvasState, true)

    const ctx = canvasState.context
    if (!ctx) return

    const upperSeries = data.upperSeries
    const binCount = data.binCount

    const upperParticipants = Math.max(1, data.upperParticipants)

    if (
      !Number.isFinite(plotAreaWidth) ||
      !Number.isFinite(plotAreaHeight) ||
      !Number.isFinite(plotLeft) ||
      !Number.isFinite(plotTop) ||
      plotAreaWidth <= 0 ||
      plotAreaHeight <= 0 ||
      binCount <= 0
    ) {
      finishCanvasDrawing(canvasState)
      return
    }

    ctx.save()

    const centerY = plotTop + plotAreaHeight / 2
    const halfHeight = plotAreaHeight / 2
    const scaleY = halfHeight / upperParticipants

    const upperValues: Float32Array[] = new Array(upperSeries.length)
    for (let s = 0; s < upperSeries.length; s++) {
      upperValues[s] = new Float32Array(upperSeries[s].values)
    }

    const y0 = new Float32Array(binCount)
    const y1 = new Float32Array(binCount)

    const drawCatmullRom = (
      xs: Float32Array,
      ys: Float32Array,
      forward: boolean
    ) => {
      if (binCount === 1) {
        ctx.lineTo(xs[0], ys[0])
        return
      }

      const getX = (i: number) => (forward ? xs[i] : xs[binCount - 1 - i])
      const getY = (i: number) => (forward ? ys[i] : ys[binCount - 1 - i])

      ctx.lineTo(getX(0), getY(0))
      for (let i = 0; i < binCount - 1; i++) {
        const p0x = getX(Math.max(0, i - 1))
        const p0y = getY(Math.max(0, i - 1))
        const p1x = getX(i)
        const p1y = getY(i)
        const p2x = getX(i + 1)
        const p2y = getY(i + 1)
        const p3x = getX(Math.min(binCount - 1, i + 2))
        const p3y = getY(Math.min(binCount - 1, i + 2))

        const cp1x = p1x + (p2x - p0x) * FLOW_CURVE_TENSION
        const cp1y = p1y + (p2y - p0y) * FLOW_CURVE_TENSION
        const cp2x = p2x - (p3x - p1x) * FLOW_CURVE_TENSION
        const cp2y = p2y - (p3y - p1y) * FLOW_CURVE_TENSION

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2x, p2y)
      }
    }

    const xs = new Float32Array(binCount)
    const topYs = new Float32Array(binCount)
    const bottomYs = new Float32Array(binCount)

    const drawCenteredStack = (
      seriesValues: Float32Array[],
      seriesMeta: typeof upperSeries,
      clampMax: number
    ) => {
      const cumulative = new Float32Array(binCount)
      const totals = new Float32Array(binCount)

      for (let s = 0; s < seriesValues.length; s++) {
        const values = seriesValues[s]
        for (let i = 0; i < binCount; i++) {
          totals[i] += values[i]
        }
      }

      for (let s = 0; s < seriesValues.length; s++) {
        const values = seriesValues[s]
        for (let i = 0; i < binCount; i++) {
          const offset = totals[i] / 2
          const startValue = cumulative[i] - offset
          const nextValue = startValue + values[i]
          y0[i] = startValue
          y1[i] = nextValue
          cumulative[i] += values[i]

          const x = plotLeft + ((i + 0.5) / binCount) * plotAreaWidth
          xs[i] = x
          const clampedStart = Math.max(-clampMax, Math.min(y0[i], clampMax))
          const clampedEnd = Math.max(-clampMax, Math.min(y1[i], clampMax))
          topYs[i] = centerY - clampedEnd * scaleY
          bottomYs[i] = centerY - clampedStart * scaleY
        }

        ctx.beginPath()
        ctx.moveTo(xs[0], topYs[0])
        drawCatmullRom(xs, topYs, true)
        drawCatmullRom(xs, bottomYs, false)

        ctx.closePath()
        ctx.fillStyle = seriesMeta[s]?.color ?? '#000'
        ctx.globalAlpha = 1
        ctx.fill()

        ctx.strokeStyle = AREA_DIVIDER.COLOR
        ctx.lineWidth = AREA_DIVIDER.WIDTH
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.stroke()
      }
    }

    drawCenteredStack(upperValues, upperSeries, upperParticipants)

    setUpFont(ctx)

    // Y axis labels and ticks
    drawYAxis(ctx, centerY, halfHeight)

    // Timeline axis labels and ticks (match ScarfPlot styling)
    drawTimelineLabels(ctx)
    drawXAxisLabel(ctx)
    drawXAxisTicksAndBorder(ctx)

    // Legend (below plot, scarf-style)
    const legendItems = upperSeries
    if (legendItems.length && legendHeight > 0) {
      const legendX = safeMarginLeft
      const legendY = plotBottom + MARGIN.BOTTOM + LEGEND.TOP_PADDING
      const itemsPerRow = legendItemsPerRow
      const legendWidth = Math.max(0, safeWidth)
      const itemWidth =
        itemsPerRow > 0
          ? (legendWidth - (itemsPerRow - 1) * LEGEND.ITEM_SPACING) /
            itemsPerRow
          : legendWidth

      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'

      for (let i = 0; i < legendItems.length; i++) {
        const item = legendItems[i]
        const row = Math.floor(i / itemsPerRow)
        const col = i % itemsPerRow
        const x = legendX + col * (itemWidth + LEGEND.ITEM_SPACING)
        const y =
          legendY +
          row * (LEGEND.ITEM_HEIGHT + LEGEND.ROW_PADDING) +
          LEGEND.ITEM_HEIGHT / 2

        ctx.fillStyle = item.color
        ctx.fillRect(
          x,
          y - LEGEND.ICON_SIZE / 2,
          LEGEND.ICON_SIZE,
          LEGEND.ICON_SIZE
        )

        ctx.fillStyle = AXIS.COLOR
        const label = truncateTextToPixelWidth(
          item.label,
          Math.max(0, itemWidth - LEGEND.ICON_SIZE - LEGEND.TEXT_PADDING),
          AXIS.FONT_SIZE,
          SYSTEM_SANS_SERIF_STACK
        )
        ctx.fillText(label, x + LEGEND.ICON_SIZE + LEGEND.TEXT_PADDING, y)
      }
    }

    ctx.restore()
    finishCanvasDrawing(canvasState)
  }

  function setUpFont(ctx: CanvasRenderingContext2D) {
    ctx.font = `${AXIS.FONT_SIZE}px ${SYSTEM_SANS_SERIF_STACK}`
    ctx.fillStyle = AXIS.COLOR
  }

  function drawTimelineLabels(ctx: CanvasRenderingContext2D) {
    const ticks = data.timeline.ticks
    const len = ticks.length
    if (len === 0) return

    ctx.textAlign = 'center'
    ctx.textBaseline = 'hanging'
    ctx.fillStyle = AXIS.COLOR

    const yPos = plotBottom + 10
    const rightBoundary = plotLeft + plotAreaWidth
    const isSecondToLast = len - 2
    const isLast = len - 1

    for (let i = 0; i < len; i++) {
      const tick = ticks[i]
      if (!tick.isNice) continue

      const regularXPos = plotLeft + tick.position * plotAreaWidth

      if ((i === isSecondToLast || i === isLast) && tick.label) {
        const textWidth = ctx.measureText(tick.label).width
        const rightEdgeOfText = regularXPos + textWidth / 2

        if (rightEdgeOfText > rightBoundary) {
          const xPos = regularXPos - (rightEdgeOfText - rightBoundary)
          ctx.fillText(tick.label, xPos, yPos)
        } else {
          ctx.fillText(tick.label, regularXPos, yPos)
        }
      } else {
        ctx.fillText(tick.label, regularXPos, yPos)
      }
    }
  }

  function drawXAxisLabel(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const labelX = plotLeft + plotAreaWidth / 2
    const labelY = plotBottom + X_AXIS_LABEL_OFFSET

    ctx.fillText(X_AXIS_LABEL, labelX, labelY)
  }

  function drawXAxisTicksAndBorder(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = AXIS.GRID_COLOR
    ctx.lineWidth = 1.5

    const yLine = plotBottom
    const ticks = data.timeline.ticks
    const len = ticks.length

    for (let i = 0; i < len; i++) {
      const tick = ticks[i]
      const x = plotLeft + tick.position * plotAreaWidth
      const y1 = yLine
      const y2 = y1 + AXIS.TICK_LENGTH

      ctx.beginPath()
      ctx.moveTo(x, y1)
      ctx.lineTo(x, y2)
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.moveTo(plotLeft, yLine)
    ctx.lineTo(plotLeft + plotAreaWidth, yLine)
    ctx.stroke()
  }

  function drawYAxis(
    ctx: CanvasRenderingContext2D,
    centerY: number,
    halfHeight: number
  ) {
    const tickPercents = [0, 25, 50, 75, 100]
    const xLabel = plotLeft - Y_AXIS.TICK_LABEL_OFFSET
    const xTick = plotLeft - 5

    ctx.strokeStyle = AXIS.GRID_COLOR
    ctx.lineWidth = 1
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    for (let i = 0; i < tickPercents.length; i++) {
      const percent = tickPercents[i]
      if (percent === 0) {
        ctx.beginPath()
        ctx.moveTo(xTick, centerY)
        ctx.lineTo(plotLeft, centerY)
        ctx.stroke()
        ctx.fillText('0', xLabel, centerY)
        continue
      }

      const offset = (percent / 100) * halfHeight
      const yUpper = centerY - offset
      const yLower = centerY + offset

      ctx.beginPath()
      ctx.moveTo(xTick, yUpper)
      ctx.lineTo(plotLeft, yUpper)
      ctx.stroke()
      ctx.fillText(percent.toString(), xLabel, yUpper)

      ctx.beginPath()
      ctx.moveTo(xTick, yLower)
      ctx.lineTo(plotLeft, yLower)
      ctx.stroke()
      ctx.fillText(`-${percent}`, xLabel, yLower)
    }

    // Axis label
    const labelX = plotLeft - Y_AXIS.LABEL_OFFSET
    const labelY = plotTop + plotAreaHeight / 2
    ctx.save()
    ctx.translate(labelX, labelY)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('Share of participants fixating [%]', 0, 0)
    ctx.restore()
  }

  $effect(() => {
    const _ = [
      data,
      safeWidth,
      safeHeight,
      dpiOverride,
      safeMarginTop,
      safeMarginRight,
      safeMarginBottom,
      safeMarginLeft,
    ]

    untrack(() => {
      if (canvasState.canvas && canvasState.context) {
        if (canvasState.dpiOverride !== dpiOverride) {
          canvasState = setupCanvas(
            canvasState,
            canvasState.canvas,
            dpiOverride
          )
        }

        const targetWidth = Math.max(
          1,
          safeWidth + safeMarginLeft + safeMarginRight
        )
        const targetHeight = Math.max(
          1,
          safeHeight + safeMarginTop + safeMarginBottom
        )
        canvasState = resizeCanvas(canvasState, targetWidth, targetHeight)
        scheduleRender()
      }
    })
  })

  onMount(() => {
    if (!canvas) return
    initCanvas()

    const cleanup = setupDpiChangeListeners(
      () => canvasState,
      newState => {
        canvasState = newState
        if (canvasState.canvas) {
          const targetWidth = Math.max(
            1,
            safeWidth + safeMarginLeft + safeMarginRight
          )
          const targetHeight = Math.max(
            1,
            safeHeight + safeMarginTop + safeMarginBottom
          )
          canvasState = resizeCanvas(canvasState, targetWidth, targetHeight)
          renderCanvas()
        }
      },
      dpiOverride,
      renderCanvas
    )

    return () => {
      cleanup()
    }
  })
</script>

<div class="plot-container">
  <canvas bind:this={canvas} aria-label="AOI stream plot visualization"
  ></canvas>
</div>

<style>
  .plot-container {
    position: relative;
    width: 100%;
    height: 100%;
  }

  canvas {
    display: block;
  }
</style>
