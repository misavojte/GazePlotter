<script lang="ts">
  import {
    beginCanvasDrawing,
    finishCanvasDrawing,
    alignToPixelCenter,
  } from '$lib/plots/shared/canvasUtils'
  import {
    usePlot,
    toCanvasMargins,
    canvasBlockSelect,
    type BlockedRegion,
    type CanvasExportProps,
  } from '$lib/plots/shared'
  import { estimateTextWidth } from '$lib/shared/utils/textUtils'
  import { desaturateToWhite, INACTIVE_COLOR } from '$lib/color'
  import { PRESET_PALETTES } from '$lib/color/palettes'

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
    computeGradientLegendGeometry,
    drawGradientLegend,
  } from '$lib/plots/shared/legendGradient'
  import {
    drawXAxisLabel,
    drawYAxisMainLabel,
  } from '$lib/plots/shared/axisUtils'
  import {
    drawPlotArea,
    fillPlotAreaBackground,
    niceTimelineTicks,
    bottomOriginYTicks,
    centeredYTicks,
    type PlotAreaTicks,
  } from '$lib/plots/shared/plotArea'
  import { drawCanvasPlaceholder, METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import {
    Y_AXIS,
    AXIS_CONFIG,
    MARGIN as AOI_MARGIN,
    RIDGELINE_CONTENT_FILL,
  } from '../const'
  import {
    drawCatmullRom,
    transformStreamDataToCoordinates,
    type RenderBuckets,
  } from '../core'
  import type { AoiStreamPlotResult } from '../types'

  // X-axis label moved after props to access data

  interface Props extends CanvasExportProps {
    data: AoiStreamPlotResult
    highlights?: string[]
    alignment?: 'stream' | 'distribution' | 'ridgeline' | 'heatmap'
    onLegendClick?: (aoiId: number) => void
    syncedMTopOverride?: number | null
    ridgelineScale?: number
    colorScale?: string[]
  }

  let {
    width,
    height,
    data,
    highlights = [],
    alignment = 'stream',
    onLegendClick = () => {},
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
    syncedMTopOverride = null,
    ridgelineScale,
    colorScale,
  }: Props = $props()

  // Single source of truth for the heatmap palette. When the user hasn't
  // explicitly picked a colorScale yet (initial switch to heatmap),
  // settings.colorScale is undefined — the plot-area transform in
  // core/layout.ts falls back to HEAT.colors, so we mirror that fallback
  // here so the gradient legend doesn't render an empty/grayscale
  // palette until the user triggers a pick.
  const effectiveColorScale = $derived(
    colorScale && colorScale.length > 0
      ? colorScale
      : [...PRESET_PALETTES.HEAT.colors]
  )

  const X_AXIS_LABEL = $derived(`Elapsed time [${data.windowLabel}]`)
  const X_AXIS_LABEL_OFFSET = 30
  const AREA_DIVIDER = {
    COLOR: 'rgba(255, 255, 255, 0.4)',
    WIDTH: 1,
  }

  // Render buckets (cached x/y positions for all series and workspace buffers)
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

  const maxAoiLabelWidth = $derived.by(() => {
    if (alignment !== 'heatmap') return 0
    let max = 0
    for (const s of data.series) {
      const w = estimateTextWidth(
        s.label,
        AXIS_CONFIG.fontSize,
        AXIS_CONFIG.fontFamily
      )
      if (w > max) max = w
    }
    return max
  })

  const effectiveLeftMargin = $derived(
    alignment === 'heatmap'
      ? Math.max(AOI_MARGIN.LEFT, Math.min(200, maxAoiLabelWidth + 20))
      : AOI_MARGIN.LEFT
  )

  const effectiveRightMargin = $derived(
    alignment === 'ridgeline' || alignment === 'heatmap'
      ? MARGIN.RIGHT
      : MARGIN.RIGHT + 5 // +5 for tick length when not in ridgeline mode
  )

  // Convert series data to legend items format
  const legendItems: LegendItem[] = $derived(
    data.series.map(s => ({
      identifier: s.id.toString(),
      name: s.label,
      color: s.color,
      type: 'fixation' as const,
    }))
  )

  // usePlot.margins are the export margins only, so plot.plotAreaWidth/Height are
  // the drawable CONTENT (total minus export padding). The legend spans the full
  // content width; the plot rectangle below is content minus the chrome gutters.
  const plot = usePlot({
    render: renderCanvas,
    width: () => width,
    height: () => height,
    margins: () => toCanvasMargins({ marginTop, marginRight, marginBottom, marginLeft }),
    dpiOverride: () => dpiOverride,
    deps: () => [
      data,
      alignment,
      ridgelineScale,
      syncedMTopOverride,
      colorScale,
      highlights,
    ],
    onMouseMove: handlePlotMouseMove,
  })

  // Legend height — depends only on the content width + item labels.
  const legendHeight: number = $derived.by(() => {
    if (alignment === 'heatmap') return 60
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
      Math.max(0, plot.plotAreaWidth),
      STREAM_LEGEND_CONFIG,
      maxTextWidth
    )
  })

  // Plot rectangle = content carved by the chrome gutters (axes + bottom legend band).
  const plotLeft = $derived(plot.plotLeft + effectiveLeftMargin)
  const plotTop = $derived(plot.plotTop + MARGIN.TOP)
  const plotAreaWidth = $derived(
    Math.max(0, plot.plotAreaWidth - effectiveLeftMargin - effectiveRightMargin)
  )
  const plotAreaHeight = $derived(
    Math.max(0, plot.plotAreaHeight - MARGIN.TOP - MARGIN.BOTTOM - legendHeight)
  )
  const plotBottom = $derived(plotTop + plotAreaHeight)

  // Compute full legend geometry for rendering (after we know plotBottom)
  const legendGeometry: LegendGeometry = $derived.by(() => {
    const legendX = marginLeft
    const legendY = plotBottom + MARGIN.BOTTOM + STREAM_LEGEND_CONFIG.topPadding
    const legendWidth = Math.max(0, plot.plotAreaWidth)

    return computeFlatLegendGeometry(
      legendItems,
      STREAM_LEGEND_CONFIG,
      legendX,
      legendY,
      legendWidth
    )
  })

  // Blocked regions: plot area always, plus per-item legend regions when
  // interactive (stream/distribution/ridgeline). Padding = half item
  // spacing so adjacent regions tile with no gaps. Heatmap gradient
  // legend is non-interactive so it stays clickable-to-select.
  const blockedRegions = $derived.by<BlockedRegion[]>(() => {
    const regions: BlockedRegion[] = [
      { x: plotLeft, y: plotTop, w: plotAreaWidth, h: plotAreaHeight },
    ]
    if (alignment !== 'heatmap') {
      const pad = Math.ceil(STREAM_LEGEND_CONFIG.itemSpacing / 2)
      for (const item of legendGeometry.items) {
        regions.push({
          x: item.x - pad,
          y: item.y - pad,
          w: item.width + pad * 2,
          h: STREAM_LEGEND_CONFIG.itemHeight + pad * 2,
        })
      }
    }
    return regions
  })

  // Compute gradient legend geometry for heatmap mode
  const gradientLegendGeometry = $derived.by(() => {
    if (alignment !== 'heatmap') return null

    return computeGradientLegendGeometry({
      x: marginLeft,
      y: plotBottom + MARGIN.BOTTOM,
      availableWidth: plot.plotAreaWidth,
      availableHeight: legendHeight,
      colorScale: effectiveColorScale,
      valueRange: [0, Math.max(1, data.maxValue)],
      effectiveMaxValue: Math.max(1, data.maxValue),
      title: data.yAxisLabel,
      belowMinColor: INACTIVE_COLOR,
    })
  })

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

    // Floor dimensions for pixel-perfect synchronization
    const floorLeft = Math.floor(plotLeft)
    const floorTop = Math.floor(plotTop)
    const floorWidth = Math.floor(plotAreaWidth)
    const floorHeight = Math.floor(plotAreaHeight)
    const floorBottom = floorTop + floorHeight
    const floorRight = floorLeft + floorWidth

    if (floorWidth <= 0 || floorHeight <= 0 || data.binCount <= 0) {
      finishCanvasDrawing(plot.canvasState)
      return
    }

    // Call pure transformation logic from core
    const {
      buckets,
      yAxisMax,
      axisTicks,
      seriesPaint,
      axisHalfRange,
      seriesRanks,
    } = transformStreamDataToCoordinates(
      {
        data,
        alignment,
        floorLeft,
        floorTop,
        floorWidth,
        floorHeight,
        floorBottom,
        syncedMTopOverride,
        highlightMaskById,
        ridgelineScale,
        colorScale: effectiveColorScale,
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

    // Heatmap: solid-gray NODATA background shows through cells without data.
    if (alignment === 'heatmap') {
      fillPlotAreaBackground(
        ctx,
        floorLeft,
        floorTop,
        floorWidth,
        floorHeight,
        INACTIVE_COLOR
      )
    }

    // Draw each series
    for (let s = 0; s < data.series.length; s++) {
      const bucket = seriesBuckets[s]
      const paint = seriesPaint[s]

      if (paint.heatmapBinColors) {
        // Heatmap Plot: Pure intensity-colored heatmap
        const binWidth = floorWidth / data.binCount
        for (let i = 1; i <= data.binCount; i++) {
          const color = paint.heatmapBinColors[i]
          if (color === 'transparent') continue

          const x = floorLeft + (i - 1) * binWidth
          const y = bucket.topY[i]
          const h = bucket.bottomY[i] - y

          ctx.fillStyle = color
          ctx.fillRect(x, y, binWidth + 0.5, h)
        }
      } else if (alignment === 'distribution' && seriesRanks) {
        // Distribution: Group consecutive bins where rank is stable into contiguous "runs"
        // Each run is drawn as a single path with exterior stroke only
        const binWidth = floorWidth / data.binCount
        const renderBinCount = data.binCount + 2
        ctx.fillStyle = paint.color
        ctx.strokeStyle = AREA_DIVIDER.COLOR
        ctx.lineWidth = AREA_DIVIDER.WIDTH

        let runStart = 1
        // iterate through valid bins (1 to data.binCount)
        while (runStart <= data.binCount) {
          const startRank = seriesRanks[s * renderBinCount + runStart]
          let runEnd = runStart

          // Find end of current run
          while (runEnd < data.binCount) {
            const nextRank = seriesRanks[s * renderBinCount + (runEnd + 1)]
            if (nextRank !== startRank) break
            runEnd++
          }

          // Build path for this run [runStart, runEnd]
          ctx.beginPath()

          // Top edge left to right
          for (let j = runStart; j <= runEnd; j++) {
            const x = floorLeft + (j - 1) * binWidth
            ctx.lineTo(x, bucket.topY[j])
            ctx.lineTo(x + binWidth, bucket.topY[j])
          }

          // Bottom edge right to left
          for (let j = runEnd; j >= runStart; j--) {
            const x = floorLeft + (j - 1) * binWidth
            ctx.lineTo(x + binWidth, bucket.bottomY[j])
            ctx.lineTo(x, bucket.bottomY[j])
          }

          ctx.closePath()
          ctx.fill()
          if (binWidth >= 5) ctx.stroke()

          runStart = runEnd + 1
        }
      } else {
        // Smoothed path rendering for other modes (stream, ridgeline)
        ctx.beginPath()
        ctx.moveTo(xPositions[0], bucket.topY[0])
        drawCatmullRom(ctx, xPositions, bucket.topY, true, renderBinCount)
        drawCatmullRom(ctx, xPositions, bucket.bottomY, false, renderBinCount)
        ctx.closePath()

        ctx.fillStyle = paint.color
        ctx.fill()

        // Only stroke the area divider for non-heatmap plots to avoid "white borders"
        if (alignment !== 'heatmap') {
          ctx.strokeStyle = AREA_DIVIDER.COLOR
          ctx.lineWidth = AREA_DIVIDER.WIDTH
          ctx.lineJoin = 'round'
          ctx.lineCap = 'round'
          ctx.stroke()
        }
      }

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

        // Label drawing moved outside clip
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

    // Draw AOI Labels for Heatmap Plot (outside clip)
    if (alignment === 'heatmap') {
      ctx.save()
      ctx.font = `${AXIS_CONFIG.fontSize}px ${FONT_PRIMARY.FAMILY}`
      ctx.fillStyle = AXIS_CONFIG.color
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'

      const maxLabelWidth = effectiveLeftMargin - 15

      for (let s = 0; s < data.series.length; s++) {
        const paint = seriesPaint[s]
        if (
          paint.stripBottom !== undefined &&
          paint.stripHeight !== undefined
        ) {
          const labelX = floorLeft - 10
          // Draw label in the middle of the strip
          const labelY = paint.stripBottom - paint.stripHeight / 2

          let labelText = data.series[s].label
          if (ctx.measureText(labelText).width > maxLabelWidth) {
            // Simple truncation indicator
            while (
              ctx.measureText(labelText + '...').width > maxLabelWidth &&
              labelText.length > 0
            ) {
              labelText = labelText.slice(0, -1)
            }
            labelText += '...'
          }

          ctx.fillText(labelText, labelX, labelY)
        }

        // Draw divider at the bottom of the heatmap strip for better separation
        const stripBottom = paint.stripBottom
        if (
          alignment === 'heatmap' &&
          s < data.series.length - 1 &&
          stripBottom !== undefined
        ) {
          ctx.beginPath()
          ctx.strokeStyle = AREA_DIVIDER.COLOR
          ctx.lineWidth = AREA_DIVIDER.WIDTH
          ctx.moveTo(floorLeft, stripBottom)
          ctx.lineTo(floorRight, stripBottom)
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    setUpFont(ctx)

    if (alignment === 'ridgeline') {
      const centerY = floorTop + floorHeight / 2
      const referenceHeight = seriesPaint[0]?.referenceHeight ?? 0
      let scaleHeight = referenceHeight * RIDGELINE_CONTENT_FILL
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
    }

    // Plot-area chrome: border, ticks on all four edges as needed.
    const xTicks = niceTimelineTicks(data.timeline)
    let leftTicks: PlotAreaTicks | undefined
    let rightTicks: PlotAreaTicks | undefined
    if (alignment === 'stream') {
      leftTicks = centeredYTicks(axisTicks, axisHalfRange)
      rightTicks = centeredYTicks(axisTicks, axisHalfRange, String, false)
    } else if (alignment === 'distribution') {
      leftTicks = bottomOriginYTicks(axisTicks, yAxisMax)
      rightTicks = { positions: leftTicks.positions }
    }
    drawPlotArea(ctx, {
      x: floorLeft,
      y: floorTop,
      width: floorWidth,
      height: floorHeight,
      ticks: {
        bottom: xTicks,
        top: { positions: xTicks.positions },
        left: leftTicks,
        right: rightTicks,
      },
    })

    if (alignment !== 'heatmap') {
      drawYAxisMainLabel(
        ctx,
        data.yAxisLabel,
        floorLeft,
        floorTop,
        floorHeight,
        Y_AXIS.LABEL_OFFSET,
        AXIS_CONFIG
      )
    }
    drawXAxisLabel(
      ctx,
      X_AXIS_LABEL,
      floorLeft,
      floorWidth,
      floorBottom,
      X_AXIS_LABEL_OFFSET,
      AXIS_CONFIG
    )

    // Legend - use shared utility for consistent rendering
    if (alignment === 'heatmap') {
      if (gradientLegendGeometry) {
        drawGradientLegend(ctx, gradientLegendGeometry, {
          x: marginLeft,
          y: plotBottom + MARGIN.BOTTOM,
          availableWidth: plot.plotAreaWidth,
          availableHeight: legendHeight,
          colorScale: effectiveColorScale,
          valueRange: [0, Math.max(1, data.maxValue)],
          effectiveMaxValue: Math.max(1, data.maxValue),
          title: data.yAxisLabel,
          belowMinColor: INACTIVE_COLOR,
        })
      }
    } else if (legendGeometry.items.length > 0 && legendHeight > 0) {
      setUpFont(ctx)
      drawLegend(ctx, legendGeometry, STREAM_LEGEND_CONFIG, usedHighlights)
    }

    ctx.restore()
    finishCanvasDrawing(plot.canvasState)
  }

  // Check if mouse is over a legend item (now uses shared utility)
  function isMouseOverLegendItem(
    mouseX: number,
    mouseY: number
  ): LegendItemGeometry | null {
    if (
      alignment === 'heatmap' ||
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

  // Synchronous hover handler — coordinates arrive already scaled from usePlot.
  // `isOver` reflects the plot area only; legend hit-testing runs regardless
  // since the legend sits in the bottom margin, outside the plot area.
  function handlePlotMouseMove(
    mouseX: number | null,
    mouseY: number | null,
    _isOver: boolean
  ) {
    if (mouseX === null || mouseY === null) {
      if (hoveredLegendItem || hoveredBinIndex !== null) {
        hoveredLegendItem = null
        hoveredBinIndex = null
        plot.hideTooltip(0)
        plot.setCursor('default')
        plot.scheduleRender()
      }
      return
    }

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

        plot.showTooltip(
          legendItem.identifier,
          tooltipContent,
          tooltipItemPos.x,
          tooltipItemPos.y,
          { x: 0, y: 7 }
        )

        plot.setCursor('pointer')
      } else if (hoveredLegendItem) {
        // Hide tooltip when mouse leaves legend item
        hoveredLegendItem = null
        plot.hideTooltip(0)
        plot.setCursor('default')
      }
    }

    // Handle plot area hover
    if (binIndex !== hoveredBinIndex) {
      hoveredBinIndex = binIndex
      if (binIndex !== null) {
        // Window time math: each bin represents a window of length
        // `windowSize`, with adjacent windows offset by `stepSize`. For
        // non-overlapping (step === window) this collapses to the disjoint
        // tile case; for sliding (step < window) consecutive windows
        // overlap and tooltip times reflect the bin's own window span.
        const binStartTime =
          data.timeline.minValue + binIndex * data.stepSize
        const binEndTime = binStartTime + data.windowSize
        const tooltipContent = [
          {
            key: 'Window',
            value: `${Math.round(binStartTime)} ms – ${Math.round(binEndTime)} ms`,
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
        plot.showTooltip(
          'aoi-stream-bin-tooltip',
          tooltipContent,
          mouseX,
          mouseY,
          { x: 15, y: 15 } // Offset from cursor
        )

        plot.setCursor('crosshair')
      } else if (!legendItem) {
        // Hide tooltip when not over bin or legend
        plot.hideTooltip(0)
        plot.setCursor('default')
      }

      // Re-render to show/hide bin highlight
      plot.scheduleRender()
    }
  }

  // Legend clicks: the hovered legend item is tracked synchronously by
  // handlePlotMouseMove, so the click handler needs no coordinates.
  function handleClick() {
    if (hoveredLegendItem) {
      const aoiId = parseInt(hoveredLegendItem.identifier)
      if (!isNaN(aoiId)) {
        onLegendClick(aoiId)
      }
    }
  }

  function setUpFont(ctx: CanvasRenderingContext2D) {
    ctx.font = `${AXIS_CONFIG.fontSize}px ${AXIS_CONFIG.fontFamily}`
    ctx.fillStyle = AXIS_CONFIG.color
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: blockedRegions }}
  onclick={handleClick}
  aria-label="Time-binned AOI Occupancy visualization"
></canvas>
