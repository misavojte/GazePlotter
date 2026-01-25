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
    alignToPixelCenter,
    type CanvasState,
  } from '$lib/shared/utils/canvasUtils'
  import { getXAxisLabel } from '$lib/plots/scarf'
  import { updateTooltip } from '$lib/tooltip'
  import { estimateTextWidth } from '$lib/shared/utils/textUtils'
  import { desaturateToWhite } from '$lib/shared/utils/colorUtils'

  import {
    GRIDLINE_SECONDARY,
    GRIDLINE_PRIMARY,
    FONT_PRIMARY,
  } from '$lib/plots/shared/const'
  import {
    computeFlatLegendGeometry,
    calculateFlatLegendHeight,
    drawLegend,
    hitTestLegend,
    getLegendTooltipPosition,
    getLegendTooltipContent,
    STREAM_LEGEND_CONFIG,
    type LegendItem,
    type LegendGeometry,
    type LegendItemGeometry,
  } from '$lib/plots/shared/legendRendering'
  import {
    drawTimelineLabels,
    drawXAxisTicksAndBorder,
    drawXAxisLabel,
    drawYAxisMainLabel,
    drawCenteredYAxis,
    drawBottomYAxis,
    drawTopXAxisTicksAndBorder,
    drawRightYAxisTicks,
    drawRightCenteredYAxisTicks,
    drawPlotOutline,
  } from '$lib/plots/shared/axisUtils'
  import { safeNumber } from '$lib/shared/utils/mathUtils'
  import { Y_AXIS, AXIS_CONFIG, MARGIN as AOI_MARGIN } from '../const'
  import {
    drawCatmullRom,
    transformStreamDataToCoordinates,
    type RenderBuckets,
  } from '../core'
  import type { AoiStreamPlotResult } from '../types'

  const X_AXIS_LABEL = getXAxisLabel('absolute')
  const X_AXIS_LABEL_OFFSET = 24
  const AREA_DIVIDER = {
    COLOR: '#ffffff',
    WIDTH: 1,
  }

  type AoiStreamPlotFigureProps = {
    width: number
    height: number
    data: AoiStreamPlotResult
    highlights?: string[]
    alignment?: 'center' | 'bottom' | 'ridgeline'
    onLegendClick?: (aoiId: number) => void
    dpiOverride?: number | null
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
    stripHeightOverride?: number | null
  }

  let {
    width,
    height,
    data,
    highlights = [],
    alignment = 'center',
    onLegendClick = () => {},
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
    stripHeightOverride = null,
  }: AoiStreamPlotFigureProps = $props()

  let canvas = $state<HTMLCanvasElement | null>(null)
  let canvasState = $state<CanvasState>(createCanvasState())

  // Zero-allocation rendering pipeline: pre-allocated buckets
  let renderBuckets = $state<RenderBuckets | null>(null)

  // Hover state for legend tooltips
  let hoveredLegendItem = $state<LegendItemGeometry | null>(null)

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

  const MARGIN = AOI_MARGIN

  // Memoized safe values (compute once per change)
  const safeWidth = $derived(Math.max(1, safeNumber(width, 1)))
  const safeHeight = $derived(Math.max(1, safeNumber(height, 1)))
  const safeMarginTop = $derived(safeNumber(marginTop, 0))
  const safeMarginRight = $derived(safeNumber(marginRight, 0))
  const safeMarginBottom = $derived(safeNumber(marginBottom, 0))
  const safeMarginLeft = $derived(safeNumber(marginLeft, 0))

  const effectiveRightMargin = $derived(
    alignment === 'ridgeline' ? MARGIN.RIGHT : MARGIN.RIGHT + 5 // +5 for tick length when not in ridgeline mode
  )

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

  // Convert series data to legend items format
  const legendItems: LegendItem[] = $derived(
    data.series.map(s => ({
      identifier: s.id.toString(),
      name: s.label,
      color: s.color,
      type: 'fixation' as const,
    }))
  )

  // Calculate legend height for layout using the shared utility for consistency
  const legendHeight: number = $derived.by(() => {
    if (legendItems.length === 0) return 0

    // Calculate max text width to ensure height calculation matches geometry calculation
    let maxTextWidth = 0
    const { fontSize, fontFamily } = STREAM_LEGEND_CONFIG

    for (const item of legendItems) {
      const w = estimateTextWidth(item.name, fontSize, fontFamily)
      if (w > maxTextWidth) maxTextWidth = w
    }

    return calculateFlatLegendHeight(
      legendItems.length,
      Math.max(0, safeWidth),
      STREAM_LEGEND_CONFIG,
      maxTextWidth
    )
  })

  // `width`/`height` already represent the drawable area excluding export margins.
  // Export margins are applied as offsets and by growing the canvas size.
  const plotAreaWidth = $derived(
    Math.floor(Math.max(0, safeWidth - MARGIN.LEFT - effectiveRightMargin))
  )
  const plotAreaHeight = $derived(
    Math.floor(
      Math.max(0, safeHeight - MARGIN.TOP - MARGIN.BOTTOM - legendHeight)
    )
  )

  const plotLeft = $derived(Math.floor(safeMarginLeft + MARGIN.LEFT))
  const plotTop = $derived(Math.floor(safeMarginTop + MARGIN.TOP))
  const plotBottom = $derived(plotTop + plotAreaHeight)

  // Compute full legend geometry for rendering (after we know plotBottom)
  const legendGeometry: LegendGeometry = $derived.by(() => {
    const legendX = safeMarginLeft
    const legendY = plotBottom + MARGIN.BOTTOM + STREAM_LEGEND_CONFIG.topPadding
    const legendWidth = Math.max(0, safeWidth)

    return computeFlatLegendGeometry(
      legendItems,
      STREAM_LEGEND_CONFIG,
      legendX,
      legendY,
      legendWidth
    )
  })

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

    // Floor dimensions for pixel-perfect synchronization
    const floorLeft = Math.floor(plotLeft)
    const floorTop = Math.floor(plotTop)
    const floorWidth = Math.floor(plotAreaWidth)
    const floorHeight = Math.floor(plotAreaHeight)
    const floorBottom = floorTop + floorHeight
    const floorRight = floorLeft + floorWidth

    if (floorWidth <= 0 || floorHeight <= 0 || data.binCount <= 0) {
      finishCanvasDrawing(canvasState)
      return
    }

    // Call pure transformation logic from core
    const { buckets, yAxisMax, axisTicks, seriesPaint, axisHalfRange } =
      transformStreamDataToCoordinates(
        {
          data,
          alignment,
          floorLeft,
          floorTop,
          floorWidth,
          floorHeight,
          floorBottom,
          stripHeightOverride,
          highlightMaskById,
        },
        renderBuckets
      )

    // Update stateful buckets
    renderBuckets = buckets
    const { xPositions, seriesBuckets } = buckets
    const renderBinCount = data.binCount + 2

    ctx.save()

    // Clip to plot area
    ctx.beginPath()
    ctx.rect(floorLeft, floorTop, floorWidth, floorHeight)
    ctx.clip()

    // Draw each series
    for (let s = 0; s < data.series.length; s++) {
      const bucket = seriesBuckets[s]
      const paint = seriesPaint[s]

      ctx.beginPath()
      ctx.moveTo(xPositions[0], bucket.topY[0])
      drawCatmullRom(ctx, xPositions, bucket.topY, true, renderBinCount)
      drawCatmullRom(ctx, xPositions, bucket.bottomY, false, renderBinCount)
      ctx.closePath()

      ctx.fillStyle = paint.color
      ctx.fill()

      ctx.strokeStyle = AREA_DIVIDER.COLOR
      ctx.lineWidth = AREA_DIVIDER.WIDTH
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()

      if (alignment === 'ridgeline' && paint.stripBottom !== undefined) {
        ctx.beginPath()
        ctx.moveTo(alignToPixelCenter(floorLeft), paint.stripBottom)
        ctx.lineTo(
          alignToPixelCenter(floorLeft + floorWidth),
          paint.stripBottom
        )
        ctx.strokeStyle = GRIDLINE_SECONDARY.COLOR
        ctx.lineWidth = GRIDLINE_SECONDARY.WIDTH
        ctx.stroke()
      }
    }

    // Ridgeline Relief Effect
    if (alignment === 'ridgeline') {
      ctx.save()
      for (let s = 0; s < data.series.length - 1; s++) {
        const currentBucket = seriesBuckets[s]
        for (let cover = s + 1; cover < data.series.length; cover++) {
          const coverBucket = seriesBuckets[cover]
          const coverPaint = seriesPaint[cover]

          ctx.save()
          ctx.beginPath()
          ctx.moveTo(xPositions[0], coverBucket.topY[0])
          drawCatmullRom(
            ctx,
            xPositions,
            coverBucket.topY,
            true,
            renderBinCount
          )
          drawCatmullRom(
            ctx,
            xPositions,
            coverBucket.bottomY,
            false,
            renderBinCount
          )
          ctx.closePath()
          ctx.clip()

          ctx.fillStyle = desaturateToWhite(coverPaint.color, 0.3)
          ctx.beginPath()
          ctx.moveTo(xPositions[0], currentBucket.topY[0])
          drawCatmullRom(
            ctx,
            xPositions,
            currentBucket.topY,
            true,
            renderBinCount
          )
          drawCatmullRom(
            ctx,
            xPositions,
            currentBucket.bottomY,
            false,
            renderBinCount
          )
          ctx.closePath()
          ctx.fill()

          ctx.restore()
        }
      }
      ctx.restore()
    }

    ctx.globalAlpha = 1.0

    if (hoveredBinIndex !== null) {
      const binWidth = floorWidth / data.binCount
      const binX = floorLeft + hoveredBinIndex * binWidth

      ctx.save()
      ctx.globalAlpha = 0.2
      ctx.fillStyle = '#007acc'
      ctx.fillRect(binX, floorTop, binWidth, floorHeight)
      ctx.restore()

      ctx.save()
      ctx.strokeStyle = '#007acc'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.moveTo(binX, floorTop)
      ctx.lineTo(binX, floorBottom)
      ctx.moveTo(binX + binWidth, floorTop)
      ctx.lineTo(binX + binWidth, floorBottom)
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()

    setUpFont(ctx)

    if (alignment === 'ridgeline') {
      const centerY = floorTop + floorHeight / 2
      const stripHeight = seriesPaint[0]?.stripHeight ?? 0
      let scaleHeight = stripHeight * 0.9
      let scaleMaxValue = 100

      // Adaptive scaling: halve until it fits the plot area
      while (scaleHeight > floorHeight && scaleMaxValue > 1) {
        scaleHeight /= 2
        scaleMaxValue /= 2
      }

      const scaleTop = alignToPixelCenter(centerY - scaleHeight / 2)
      const scaleBottom = alignToPixelCenter(centerY + scaleHeight / 2)

      // Position at the standard axis line (plotLeft), moved 5px right
      const scaleX = alignToPixelCenter(floorLeft - 5)
      const tickLength = 5
      const tickXStart = alignToPixelCenter(scaleX - tickLength)

      ctx.save()
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.font = `${AXIS_CONFIG.fontSize - 2}px ${FONT_PRIMARY.FAMILY}`
      ctx.fillStyle = AXIS_CONFIG.color

      // Labels
      const tickLabelX = tickXStart - 3
      ctx.fillText('0', tickLabelX, scaleBottom)
      ctx.fillText(scaleMaxValue.toString(), tickLabelX, scaleTop)

      // Scale bar
      ctx.beginPath()
      ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
      ctx.lineWidth = 1
      ctx.moveTo(scaleX, scaleBottom)
      ctx.lineTo(scaleX, scaleTop)

      // Ticks
      ctx.moveTo(scaleX, scaleBottom)
      ctx.lineTo(tickXStart, scaleBottom)
      ctx.moveTo(scaleX, scaleTop)
      ctx.lineTo(tickXStart, scaleTop)

      ctx.stroke()
      ctx.restore()
    } else if (alignment === 'center') {
      drawCenteredYAxis(
        ctx,
        plotTop + plotAreaHeight / 2,
        plotAreaHeight / 2,
        axisHalfRange,
        axisTicks,
        plotLeft,
        AXIS_CONFIG
      )
      drawRightCenteredYAxisTicks(
        ctx,
        plotTop + plotAreaHeight / 2,
        plotAreaHeight / 2,
        axisHalfRange,
        axisTicks,
        floorRight,
        AXIS_CONFIG
      )
    } else {
      drawBottomYAxis(
        ctx,
        plotBottom,
        plotAreaHeight,
        yAxisMax,
        axisTicks,
        plotLeft,
        AXIS_CONFIG
      )
      drawRightYAxisTicks(
        ctx,
        plotBottom,
        plotAreaHeight,
        yAxisMax,
        axisTicks,
        floorRight,
        AXIS_CONFIG
      )
    }

    // Shared Y-axis main label and X-axis components
    drawYAxisMainLabel(
      ctx,
      'Share of participants fixating [%]',
      floorLeft,
      floorTop,
      floorHeight,
      Y_AXIS.LABEL_OFFSET,
      AXIS_CONFIG
    )
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
      false // Already drawn by drawPlotOutline
    )
    drawTopXAxisTicksAndBorder(
      ctx,
      data.timeline,
      floorLeft,
      floorWidth,
      floorTop,
      AXIS_CONFIG,
      false // Baseline is already drawn by drawPlotOutline
    )

    // Legend - use shared utility for consistent rendering
    if (legendGeometry.items.length > 0 && legendHeight > 0) {
      setUpFont(ctx)
      drawLegend(ctx, legendGeometry, STREAM_LEGEND_CONFIG, usedHighlights)
    }

    ctx.restore()
    finishCanvasDrawing(canvasState)
  }

  // Check if mouse is over a legend item (now uses shared utility)
  function isMouseOverLegendItem(
    mouseX: number,
    mouseY: number
  ): LegendItemGeometry | null {
    if (
      !legendGeometry ||
      legendGeometry.items.length === 0 ||
      legendHeight === 0
    )
      return null

    return hitTestLegend(legendGeometry, STREAM_LEGEND_CONFIG, mouseX, mouseY)
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
        const isHighlighted = usedHighlights.includes(legendItem.identifier)

        // Use utility functions for tooltip
        const tooltipContent = getLegendTooltipContent(
          legendItem,
          isHighlighted
        )
        const tooltipItemPos = getLegendTooltipPosition(
          legendItem,
          STREAM_LEGEND_CONFIG
        )
        const tooltipPos = getTooltipPosition(
          canvasState,
          tooltipItemPos.x,
          tooltipItemPos.y,
          { x: 0, y: 7 }
        )

        updateTooltip({
          visible: true,
          content: tooltipContent,
          x: tooltipPos.x,
          y: tooltipPos.y,
        })

        if (canvas) canvas.style.cursor = 'pointer'
      } else if (hoveredLegendItem) {
        // Hide tooltip when mouse leaves legend item
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
      const aoiId = parseInt(legendItem.identifier)
      if (!isNaN(aoiId)) {
        onLegendClick(aoiId)
      }
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
      stripHeight: stripHeightOverride,
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

  function setUpFont(ctx: CanvasRenderingContext2D) {
    ctx.font = `${AXIS_CONFIG.fontSize}px ${AXIS_CONFIG.fontFamily}`
    ctx.fillStyle = AXIS_CONFIG.color
  }

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

<canvas bind:this={canvas} aria-label="Time-binned AOI Occupancy visualization"
></canvas>
