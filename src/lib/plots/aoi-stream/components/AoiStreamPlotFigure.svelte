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
    getScaledMousePosition,
    getTooltipPosition,
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
  import { updateTooltip } from '$lib/tooltip'
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
    WIDTH: 1,
  }

  type AoiStreamPlotFigureProps = {
    width: number
    height: number
    data: AoiStreamPlotResult
    highlights?: string[]
    onLegendClick?: (aoiId: number) => void
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
    highlights = [],
    onLegendClick = () => {},
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
  }: AoiStreamPlotFigureProps = $props()

  let canvas = $state<HTMLCanvasElement | null>(null)
  let canvasState = $state<CanvasState>(createCanvasState())

  // Zero-allocation rendering pipeline: pre-allocated buckets
  let renderBuckets = $state<{
    xPositions: Float32Array
    seriesBuckets: Array<{
      topY: Float32Array
      bottomY: Float32Array
    }>
    binCount: number
  } | null>(null)

  // Hover state for legend tooltips
  let hoveredLegendItem = $state<{
    id: number
    label: string
    x: number
    y: number
  } | null>(null)

  // Hover state for plot area bins
  let hoveredBinIndex = $state<number | null>(null)

  // Use highlights directly from props
  const usedHighlights = $derived(highlights)

  // Highlight mask by AOI ID (computed once per highlight change)
  const highlightMaskById = $derived.by(() => {
    if (!usedHighlights || usedHighlights.length === 0) return null
    const mask = new Map<number, boolean>()
    for (let i = 0; i < usedHighlights.length; i++) {
      const id = parseInt(usedHighlights[i])
      if (!isNaN(id)) mask.set(id, true)
    }
    return mask
  })

  const safeNumber = (value: number, fallback: number) =>
    Number.isFinite(value) ? value : fallback

  // Memoized safe values (compute once per change)
  const safeWidth = $derived(Math.max(1, safeNumber(width, 1)))
  const safeHeight = $derived(Math.max(1, safeNumber(height, 1)))
  const safeMarginTop = $derived(safeNumber(marginTop, 0))
  const safeMarginRight = $derived(safeNumber(marginRight, 0))
  const safeMarginBottom = $derived(safeNumber(marginBottom, 0))
  const safeMarginLeft = $derived(safeNumber(marginLeft, 0))

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

  const legendItemsPerRow = $derived(
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

  const legendRows = $derived(
    data.series.length ? Math.ceil(data.series.length / legendItemsPerRow) : 0
  )

  const legendHeight = $derived(
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

  // Initialize or reallocate render buckets when binCount changes
  function ensureRenderBuckets(binCount: number, seriesCount: number) {
    if (
      !renderBuckets ||
      renderBuckets.binCount !== binCount ||
      renderBuckets.seriesBuckets.length !== seriesCount
    ) {
      const xPositions = new Float32Array(binCount)
      const seriesBuckets = new Array(seriesCount)

      for (let i = 0; i < seriesCount; i++) {
        seriesBuckets[i] = {
          topY: new Float32Array(binCount),
          bottomY: new Float32Array(binCount),
        }
      }

      renderBuckets = { xPositions, seriesBuckets, binCount }
    }
    return renderBuckets
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

    const series = data.series
    const binCount = data.binCount

    const maxTotal = Math.max(1, data.maxTotal) / 2 // for centered layout this is correct

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
    const scaleY = halfHeight / maxTotal

    // Zero-allocation pipeline: ensure buckets are ready
    const buckets = ensureRenderBuckets(binCount, series.length)
    const { xPositions, seriesBuckets } = buckets

    // Pre-compute X positions once (reused across all series)
    const invBinCount = 1 / binCount
    for (let i = 0; i < binCount; i++) {
      xPositions[i] = plotLeft + (i + 0.5) * invBinCount * plotAreaWidth
    }

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

    // Draw centered streamgraph with white borders
    const cumulative = new Float32Array(binCount)
    const totals = new Float32Array(binCount)

    // Calculate totals for centering
    for (let s = 0; s < series.length; s++) {
      const values = series[s].values
      for (let i = 0; i < binCount; i++) {
        totals[i] += values[i]
      }
    }

    const invTotals = new Float32Array(binCount)
    for (let i = 0; i < binCount; i++) {
      invTotals[i] = totals[i] * 0.5
    }

    // Draw each series using pre-allocated buckets
    for (let s = 0; s < series.length; s++) {
      const values = series[s].values
      const bucket = seriesBuckets[s]
      const aoiId = series[s].id

      // Apply highlight dimming
      const isHighlighted = highlightMaskById?.get(aoiId) ?? false
      const opacity = highlightMaskById && !isHighlighted ? 0.2 : 1.0

      // Compute Y positions into buckets (centered layout)
      for (let i = 0; i < binCount; i++) {
        const startValue = cumulative[i] - invTotals[i]
        const nextValue = startValue + values[i]
        cumulative[i] += values[i]

        const clampedStart = Math.max(-maxTotal, Math.min(startValue, maxTotal))
        const clampedEnd = Math.max(-maxTotal, Math.min(nextValue, maxTotal))
        bucket.topY[i] = centerY - clampedEnd * scaleY
        bucket.bottomY[i] = centerY - clampedStart * scaleY
      }

      // Draw filled area
      ctx.globalAlpha = opacity
      ctx.beginPath()
      ctx.moveTo(xPositions[0], bucket.topY[0])
      drawCatmullRom(xPositions, bucket.topY, true)
      drawCatmullRom(xPositions, bucket.bottomY, false)
      ctx.closePath()

      ctx.fillStyle = series[s].color
      ctx.fill()

      // Draw thin white border between areas
      ctx.globalAlpha = 1.0
      ctx.strokeStyle = AREA_DIVIDER.COLOR
      ctx.lineWidth = AREA_DIVIDER.WIDTH
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    // Reset opacity
    ctx.globalAlpha = 1.0

    // Draw hovered bin highlight
    if (hoveredBinIndex !== null) {
      const binWidth = plotAreaWidth / binCount
      const binX = plotLeft + hoveredBinIndex * binWidth

      ctx.save()
      ctx.globalAlpha = 0.2
      ctx.fillStyle = '#007acc' // Blue highlight color
      ctx.fillRect(binX, plotTop, binWidth, plotAreaHeight)
      ctx.restore()

      // Draw vertical line at bin boundary
      ctx.save()
      ctx.strokeStyle = '#007acc'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.moveTo(binX, plotTop)
      ctx.lineTo(binX, plotBottom)
      ctx.moveTo(binX + binWidth, plotTop)
      ctx.lineTo(binX + binWidth, plotBottom)
      ctx.stroke()
      ctx.restore()
    }

    setUpFont(ctx)

    // Draw axes and labels
    drawYAxis(ctx, centerY, halfHeight, maxTotal)
    drawTimelineLabels(ctx)
    drawXAxisLabel(ctx)
    drawXAxisTicksAndBorder(ctx)

    // Legend (batched rendering with highlight dimming)
    const legendItems = series
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

      const maxLabelWidth = Math.max(
        0,
        itemWidth - LEGEND.ICON_SIZE - LEGEND.TEXT_PADDING
      )

      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'

      const isHighlightActive = usedHighlights.length > 0

      // Batch 1: Draw all color icons with dimming
      for (let i = 0; i < legendItems.length; i++) {
        const item = legendItems[i]
        const row = Math.floor(i / itemsPerRow)
        const col = i % itemsPerRow
        const x = legendX + col * (itemWidth + LEGEND.ITEM_SPACING)
        const y =
          legendY +
          row * (LEGEND.ITEM_HEIGHT + LEGEND.ROW_PADDING) +
          LEGEND.ITEM_HEIGHT / 2

        // Apply highlight dimming
        const isHighlighted = highlightMaskById?.get(item.id) ?? false
        ctx.globalAlpha = isHighlightActive && !isHighlighted ? 0.15 : 1.0

        ctx.fillStyle = item.color
        ctx.fillRect(
          x,
          y - LEGEND.ICON_SIZE / 2,
          LEGEND.ICON_SIZE,
          LEGEND.ICON_SIZE
        )
      }

      // Batch 2: Draw all text labels with dimming
      ctx.fillStyle = AXIS.COLOR
      for (let i = 0; i < legendItems.length; i++) {
        const item = legendItems[i]
        const row = Math.floor(i / itemsPerRow)
        const col = i % itemsPerRow
        const x = legendX + col * (itemWidth + LEGEND.ITEM_SPACING)
        const y =
          legendY +
          row * (LEGEND.ITEM_HEIGHT + LEGEND.ROW_PADDING) +
          LEGEND.ITEM_HEIGHT / 2

        // Apply highlight dimming
        const isHighlighted = highlightMaskById?.get(item.id) ?? false
        ctx.globalAlpha = isHighlightActive && !isHighlighted ? 0.15 : 1.0

        const label = truncateTextToPixelWidth(
          item.label,
          maxLabelWidth,
          AXIS.FONT_SIZE,
          SYSTEM_SANS_SERIF_STACK
        )
        ctx.fillText(label, x + LEGEND.ICON_SIZE + LEGEND.TEXT_PADDING, y)
      }

      // Reset opacity
      ctx.globalAlpha = 1.0
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
    halfHeight: number,
    maxValue: number
  ) {
    const tickPercents = [0, 25, 50]
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

      const value = (percent / 100) * (maxValue * 2) // centered layout
      const offset = (value / maxValue) * halfHeight
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

  // Check if mouse is over a legend item
  function isMouseOverLegendItem(mouseX: number, mouseY: number) {
    const legendItems = data.series
    if (!legendItems || legendItems.length === 0 || legendHeight === 0)
      return null

    const legendX = safeMarginLeft
    const legendY = plotBottom + MARGIN.BOTTOM + LEGEND.TOP_PADDING
    const itemsPerRow = legendItemsPerRow
    const legendWidth = Math.max(0, safeWidth)
    const itemWidth =
      itemsPerRow > 0
        ? (legendWidth - (itemsPerRow - 1) * LEGEND.ITEM_SPACING) / itemsPerRow
        : legendWidth

    for (let i = 0; i < legendItems.length; i++) {
      const item = legendItems[i]
      const row = Math.floor(i / itemsPerRow)
      const col = i % itemsPerRow
      const x = legendX + col * (itemWidth + LEGEND.ITEM_SPACING)
      const y = legendY + row * (LEGEND.ITEM_HEIGHT + LEGEND.ROW_PADDING)

      // Add padding for easier clicking
      if (
        mouseX >= x - 5 &&
        mouseX <= x + itemWidth + 5 &&
        mouseY >= y - 5 &&
        mouseY <= y + LEGEND.ITEM_HEIGHT + 5
      ) {
        return { id: item.id, label: item.label, x, y }
      }
    }

    return null
  }

  // Check if mouse is over the plot area and return bin index
  function getHoveredBinIndex(mouseX: number, mouseY: number): number | null {
    // Check if mouse is within plot area bounds
    if (
      mouseX < plotLeft ||
      mouseX > plotLeft + plotAreaWidth ||
      mouseY < plotTop ||
      mouseY > plotBottom
    ) {
      return null
    }

    // Calculate which bin the mouse is over
    const relativeX = mouseX - plotLeft
    const binWidth = plotAreaWidth / data.binCount
    const binIndex = Math.floor(relativeX / binWidth)

    // Ensure bin index is within bounds
    return Math.max(0, Math.min(data.binCount - 1, binIndex))
  }

  // Mouse event handlers
  function handleMouseMove(event: MouseEvent) {
    if (!canvas) return

    const { x: mouseX, y: mouseY } = getScaledMousePosition(canvasState, event)
    const legendItem = isMouseOverLegendItem(mouseX, mouseY)
    const binIndex = getHoveredBinIndex(mouseX, mouseY)

    // Handle legend hover
    if (legendItem !== hoveredLegendItem) {
      if (legendItem) {
        hoveredLegendItem = legendItem
        const isHighlighted = usedHighlights.includes(legendItem.id.toString())
        const tooltipContent = [
          {
            key: '',
            value: `${isHighlighted ? 'Dehighlight' : 'Highlight'} ${legendItem.label}`,
          },
        ]

        // Position tooltip at bottom of legend item (same as scarf plot)
        const tooltipPos = getTooltipPosition(
          canvasState,
          legendItem.x + LEGEND.ICON_SIZE * 1.5,
          legendItem.y + LEGEND.ITEM_HEIGHT,
          { x: 0, y: 7 } // 7px below the legend item
        )

        updateTooltip({
          visible: true,
          content: tooltipContent,
          x: tooltipPos.x,
          y: tooltipPos.y,
        })

        if (canvas) canvas.style.cursor = 'pointer'
      } else if (hoveredLegendItem) {
        // Hide tooltip when mouse leaves legend item (use null like scarf plot)
        hoveredLegendItem = null
        updateTooltip(null)
        if (canvas) canvas.style.cursor = 'default'
      }
    }

    // Handle plot area hover
    if (binIndex !== hoveredBinIndex) {
      hoveredBinIndex = binIndex
      if (binIndex !== null) {
        // Show tooltip for bin information
        const binStartTime = binIndex * data.binSize
        const binEndTime = (binIndex + 1) * data.binSize
        const tooltipContent = [
          {
            key: 'Time Range',
            value: `${Math.round(binStartTime)}ms - ${Math.round(binEndTime)}ms`,
          },
          {
            key: 'Bin',
            value: `${binIndex + 1} of ${data.binCount}`,
          },
        ]

        // Add AOI shares for this bin
        const plotSeries = data.series
        const aoiShares = []
        for (let i = 0; i < plotSeries.length; i++) {
          const seriesItem = plotSeries[i]
          const value = seriesItem.values[binIndex]
          if (value > 0.001) {
            // Only include AOIs with meaningful shares
            const percentage = (value / data.participants) * 100
            aoiShares.push({
              label: seriesItem.label,
              percentage,
            })
          }
        }

        // Sort by percentage descending
        aoiShares.sort((a, b) => b.percentage - a.percentage)

        // Show top 4 AOIs
        const topAois = aoiShares.slice(0, 4)
        for (const aoi of topAois) {
          tooltipContent.push({
            key: aoi.label,
            value: `${aoi.percentage.toFixed(1)}%`,
          })
        }

        // If there are more AOIs, show "other N areas" with sum
        if (aoiShares.length > 4) {
          const remainingAois = aoiShares.slice(4)
          const otherSum = remainingAois.reduce(
            (sum, aoi) => sum + aoi.percentage,
            0
          )
          const otherCount = remainingAois.length
          tooltipContent.push({
            key: `other ${otherCount} areas`,
            value: `${otherSum.toFixed(1)}%`,
          })
        }

        // Position tooltip near mouse cursor
        const tooltipPos = getTooltipPosition(
          canvasState,
          mouseX,
          mouseY,
          { x: 15, y: 15 } // Offset from cursor
        )

        updateTooltip({
          visible: true,
          content: tooltipContent,
          x: tooltipPos.x,
          y: tooltipPos.y,
        })

        if (canvas) canvas.style.cursor = 'crosshair'
      } else if (!legendItem) {
        // Hide tooltip when not over bin or legend
        updateTooltip(null)
        if (canvas) canvas.style.cursor = 'default'
      }

      // Re-render to show/hide bin highlight
      scheduleRender()
    }
  }

  function handleMouseLeave() {
    if (hoveredLegendItem) {
      hoveredLegendItem = null
      updateTooltip(null)
      if (canvas) canvas.style.cursor = 'default'
    }

    if (hoveredBinIndex !== null) {
      hoveredBinIndex = null
      updateTooltip(null)
      if (canvas) canvas.style.cursor = 'default'
      scheduleRender()
    }
  }

  function handleClick(event: MouseEvent) {
    if (!canvas) return

    const { x: mouseX, y: mouseY } = getScaledMousePosition(canvasState, event)
    const legendItem = isMouseOverLegendItem(mouseX, mouseY)

    if (legendItem) {
      onLegendClick(legendItem.id)
    }
  }

  // Optimized effect: Consolidate all reactive updates
  $effect(() => {
    // Track all dependencies explicitly
    const deps = {
      data,
      w: safeWidth,
      h: safeHeight,
      dpi: dpiOverride,
      mt: safeMarginTop,
      mr: safeMarginRight,
      mb: safeMarginBottom,
      ml: safeMarginLeft,
    }

    untrack(() => {
      if (!canvasState.canvas || !canvasState.context) return

      if (canvasState.dpiOverride !== deps.dpi) {
        canvasState = setupCanvas(canvasState, canvasState.canvas, deps.dpi)
      }

      const targetWidth = Math.max(1, deps.w + deps.ml + deps.mr)
      const targetHeight = Math.max(1, deps.h + deps.mt + deps.mb)

      canvasState = resizeCanvas(canvasState, targetWidth, targetHeight)
      scheduleRender()
    })
  })

  onMount(() => {
    if (!canvas) return
    initCanvas()

    // Add mouse event listeners for legend interaction
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    canvas.addEventListener('click', handleClick)

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
      if (canvas) {
        canvas.removeEventListener('mousemove', handleMouseMove)
        canvas.removeEventListener('mouseleave', handleMouseLeave)
        canvas.removeEventListener('click', handleClick)
      }
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
