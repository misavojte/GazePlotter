<script lang="ts">
  import { alignToPixelCenter } from '$lib/plots/shared/canvasUtils'
  import {
    usePlot,
    NO_MARGINS,
    canvasBlockSelect,
    withQualifiers,
    type BlockedRegion,
    type CanvasExportProps,
    type PlotFrame,
    type FrameHit,
  } from '$lib/plots/shared'
  import { estimateTextWidth, truncateTextToPixelWidth } from '$lib/shared/utils/textUtils'
  import { desaturateToWhite, INACTIVE_COLOR } from '$lib/color'
  import { PRESET_PALETTES } from '$lib/color/palettes'

  import {
    GRIDLINE_SECONDARY,
    GRIDLINE_PRIMARY,
    FONT_PRIMARY,
    PLOT_LEGEND_GAP,
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
    getGradientLegendRequiredHeight,
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
  import { METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import {
    AXIS_CONFIG,
    MARGIN as AOI_MARGIN,
    RIDGELINE_CONTENT_FILL,
  } from '../const'
  import {
    drawCatmullRom,
    transformStreamDataToCoordinates,
    computeAoiStreamYAxis,
    type RenderBuckets,
  } from '../core'
  import type { AoiStreamPlotResult } from '../types'

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
    margins = NO_MARGINS,
    syncedMTopOverride = null,
    ridgelineScale,
    colorScale,
  }: Props = $props()

  // Mirror core/layout.ts's HEAT fallback so the gradient legend isn't empty
  // before the user has picked a colorScale.
  const effectiveColorScale = $derived(
    colorScale && colorScale.length > 0 ? colorScale : [...PRESET_PALETTES.HEAT.colors]
  )

  // Time is the main axis here, so the binning window is a mid-dot qualifier on
  // the time label (e.g. "Elapsed time / ms · 500 ms window / 100 ms step"); no
  // time-range qualifier — the axis itself shows the range.
  const X_AXIS_LABEL = $derived(withQualifiers('Elapsed time / ms', data.windowLabel))
  const AREA_DIVIDER = { COLOR: 'rgba(255, 255, 255, 0.4)', WIDTH: 1 }
  const MARGIN = AOI_MARGIN

  let renderBuckets = $state<RenderBuckets | null>(null)
  let hoveredLegendItem = $state<LegendItemGeometry | null>(null)
  let hoveredBinIndex = $state<number | null>(null)
  let mouseXPx = $state<number | null>(null)

  const usedHighlights = $derived(highlights)

  const highlightMaskById = $derived.by(() => {
    if (!usedHighlights || usedHighlights.length === 0) return null
    const mask = new Map<number, boolean>()
    for (const h of usedHighlights) {
      const id = parseInt(h)
      if (!isNaN(id)) mask.set(id, true)
    }
    return mask
  })

  const maxAoiLabelWidth = $derived.by(() => {
    if (alignment !== 'heatmap') return 0
    let max = 0
    for (const s of data.series) {
      const w = estimateTextWidth(s.label, AXIS_CONFIG.fontSize, AXIS_CONFIG.fontFamily)
      if (w > max) max = w
    }
    return max
  })

  const effectiveRightMargin = $derived(
    alignment === 'ridgeline' || alignment === 'heatmap' ? MARGIN.RIGHT : MARGIN.RIGHT + 5
  )

  const legendItems: LegendItem[] = $derived(
    data.series.map(s => ({
      identifier: s.id.toString(),
      name: s.label,
      color: s.color,
      type: 'fixation' as const,
    }))
  )

  const legendHeight: number = $derived.by(() => {
    if (alignment === 'heatmap') return getGradientLegendRequiredHeight(AXIS_CONFIG.fontSize)
    if (legendItems.length === 0) return 0
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

  // ── Axis chrome: tick-label strings fed to the measured gutter ──
  // The X (time) axis and the Y (metric/value) domain are both pixel-independent,
  // so their tick-label strings are available here. The resolver measures their
  // extent + the titles, reserves the gutters, and returns the title offsets
  // (frame.leftTitleOffset / bottomTitleOffset) the figure draws with.
  const xAxisTicks = $derived(niceTimelineTicks(data.timeline))
  const yDomain = $derived(computeAoiStreamYAxis(data, alignment))

  // Heatmap AOI row labels: cap the reserved width (one long AOI name must not
  // eat the plot) and pre-truncate so the gutter reserves exactly what we draw.
  const aoiLeftBudget = $derived(
    alignment === 'heatmap' ? Math.min(200, maxAoiLabelWidth + 20) : 0
  )
  const heatmapAoiLabels = $derived.by<string[]>(() => {
    if (alignment !== 'heatmap') return []
    return data.series.map(s =>
      truncateTextToPixelWidth(s.label, aoiLeftBudget - 15, AXIS_CONFIG.fontSize, AXIS_CONFIG.fontFamily, '…')
    )
  })

  // Left edge per mode: value ticks + rotated metric title (stream/distribution),
  // the scale-bar strip + title (ridgeline), or truncated AOI row labels with no
  // title (heatmap — the metric name lives in the gradient legend).
  const leftTickLabels = $derived.by<string[]>(() => {
    if (alignment === 'stream') return centeredYTicks(yDomain.axisTicks, yDomain.axisHalfRange).labels ?? []
    if (alignment === 'distribution') return bottomOriginYTicks(yDomain.axisTicks, yDomain.yAxisMax).labels ?? []
    if (alignment === 'ridgeline') return ['0', '100'] // reserve the scale-bar strip
    return heatmapAoiLabels
  })
  const leftEdge = $derived(
    alignment === 'heatmap'
      ? { tickLabels: leftTickLabels }
      : { title: data.yAxisLabel, tickLabels: leftTickLabels }
  )

  const plot = usePlot<{ kind: 'legend' | 'bin'; item?: LegendItemGeometry; binIndex?: number }>({
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [data, alignment, ridgelineScale, syncedMTopOverride, colorScale, highlights],
    placeholder: () => (data.noMetric ? METRIC_MISSING_MESSAGE : null),
    // Declarative measured gutters: the resolver measures the left/bottom edge
    // tick labels + titles and returns the title offsets (frame.leftTitleOffset /
    // bottomTitleOffset). The figure still draws its own chrome (clipData:false)
    // but places its titles at those offsets. The legend is reserved as a bottom
    // block; PLOT_LEGEND_GAP is folded in (the resolver abuts the block to the
    // x-axis gutter), and the draw anchors at frame.legendY + PLOT_LEGEND_GAP.
    gutters: () => ({
      left: leftEdge,
      bottom: { title: X_AXIS_LABEL, tickLabels: xAxisTicks.labels ?? [] },
      pad: { top: MARGIN.TOP, right: effectiveRightMargin },
      legendHeight: legendHeight > 0 ? PLOT_LEGEND_GAP + legendHeight : 0,
    }),
    clipData: false,
    drawData: drawStream,
    drawOverlay: drawStreamOverlay,
    legend: { hitTest: hitTestLegendBand },
    hitTest: hitTestBin,
    onHoverChange: (hit, x, y) => {
      const tag = hit?.data
      const legendItem = tag?.kind === 'legend' ? tag.item! : null
      const binIndex = tag?.kind === 'bin' ? tag.binIndex! : null
      const isBinHover = tag?.kind === 'bin'
      const nextMouseXPx = isBinHover ? x : null
      const nextBinIndex = isBinHover ? binIndex : null

      const changed =
        nextBinIndex !== hoveredBinIndex ||
        nextMouseXPx !== mouseXPx
      hoveredLegendItem = legendItem
      hoveredBinIndex = nextBinIndex
      mouseXPx = nextMouseXPx
      return changed
    },
    blockedRegions: () => blockedRegions,
  })

  // Legend geometry sits in the bottom band, below the x-axis.
  const legendGeometry: LegendGeometry = $derived.by(() =>
    computeFlatLegendGeometry(
      legendItems,
      STREAM_LEGEND_CONFIG,
      margins.left,
      plot.frame.legendY + PLOT_LEGEND_GAP,
      Math.max(0, plot.plotAreaWidth)
    )
  )

  const gradientLegendGeometry = $derived.by(() => {
    if (alignment !== 'heatmap') return null
    return computeGradientLegendGeometry({
      x: margins.left,
      y: plot.frame.legendY + PLOT_LEGEND_GAP,
      availableWidth: plot.plotAreaWidth,
      availableHeight: legendHeight,
      colorScale: effectiveColorScale,
      valueRange: [0, Math.max(1, data.maxValue)],
      effectiveMaxValue: Math.max(1, data.maxValue),
      title: data.yAxisLabel,
      belowMinColor: INACTIVE_COLOR,
    })
  })

  // Plot area always blocked; interactive legend items blocked too (stream modes).
  const blockedRegions = $derived.by<BlockedRegion[]>(() => {
    const f = plot.frame
    const regions: BlockedRegion[] = [{ x: f.x, y: f.y, w: f.width, h: f.height }]
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

  function setUpFont(ctx: CanvasRenderingContext2D) {
    ctx.font = `${AXIS_CONFIG.fontSize}px ${AXIS_CONFIG.fontFamily}`
    ctx.fillStyle = AXIS_CONFIG.color
  }

  function drawStream(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    const floorLeft = Math.floor(frame.x)
    const floorTop = Math.floor(frame.y)
    const floorWidth = Math.floor(frame.width)
    const floorHeight = Math.floor(frame.height)
    const floorBottom = floorTop + floorHeight
    const floorRight = floorLeft + floorWidth

    if (floorWidth <= 0 || floorHeight <= 0 || data.binCount <= 0) return

    const { buckets, yAxisMax, axisTicks, seriesPaint, axisHalfRange, seriesRanks } =
      transformStreamDataToCoordinates(
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

    renderBuckets = buckets
    const { xPositions, seriesBuckets } = buckets
    const renderBinCount = data.binCount + 2

    ctx.save()
    ctx.beginPath()
    ctx.rect(floorLeft, floorTop, floorWidth, floorHeight)
    ctx.clip()

    if (alignment === 'heatmap') {
      fillPlotAreaBackground(ctx, floorLeft, floorTop, floorWidth, floorHeight, INACTIVE_COLOR)
    }

    for (let s = 0; s < data.series.length; s++) {
      const bucket = seriesBuckets[s]
      const paint = seriesPaint[s]

      if (paint.heatmapBinColors) {
        const binWidth = floorWidth / data.binCount
        for (let i = 1; i <= data.binCount; i++) {
          const color = paint.heatmapBinColors[i]
          if (color === 'transparent') continue
          const x = floorLeft + (i - 1) * binWidth
          const y = bucket.topY[i]
          ctx.fillStyle = color
          ctx.fillRect(x, y, binWidth + 0.5, bucket.bottomY[i] - y)
        }
      } else if (alignment === 'distribution' && seriesRanks) {
        const binWidth = floorWidth / data.binCount
        ctx.fillStyle = paint.color
        ctx.strokeStyle = AREA_DIVIDER.COLOR
        ctx.lineWidth = AREA_DIVIDER.WIDTH

        let runStart = 1
        while (runStart <= data.binCount) {
          const startRank = seriesRanks[s * renderBinCount + runStart]
          let runEnd = runStart
          while (runEnd < data.binCount) {
            if (seriesRanks[s * renderBinCount + (runEnd + 1)] !== startRank) break
            runEnd++
          }
          ctx.beginPath()
          for (let j = runStart; j <= runEnd; j++) {
            const x = floorLeft + (j - 1) * binWidth
            ctx.lineTo(x, bucket.topY[j])
            ctx.lineTo(x + binWidth, bucket.topY[j])
          }
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
        ctx.beginPath()
        ctx.moveTo(xPositions[0], bucket.topY[0])
        drawCatmullRom(ctx, xPositions, bucket.topY, true, renderBinCount)
        drawCatmullRom(ctx, xPositions, bucket.bottomY, false, renderBinCount)
        ctx.closePath()
        ctx.fillStyle = paint.color
        ctx.fill()
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
        ctx.lineTo(alignToPixelCenter(floorLeft + floorWidth), paint.stripBottom)
        ctx.strokeStyle = GRIDLINE_SECONDARY.COLOR
        ctx.lineWidth = GRIDLINE_SECONDARY.WIDTH
        ctx.stroke()
      }
    }

    // Ridgeline relief effect
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
          drawCatmullRom(ctx, xPositions, coverBucket.topY, true, renderBinCount)
          drawCatmullRom(ctx, xPositions, coverBucket.bottomY, false, renderBinCount)
          ctx.closePath()
          ctx.clip()
          ctx.fillStyle = desaturateToWhite(coverPaint.color, 0.3)
          ctx.beginPath()
          ctx.moveTo(xPositions[0], currentBucket.topY[0])
          drawCatmullRom(ctx, xPositions, currentBucket.topY, true, renderBinCount)
          drawCatmullRom(ctx, xPositions, currentBucket.bottomY, false, renderBinCount)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      }
      ctx.restore()
    }

    ctx.globalAlpha = 1.0

    // Hover highlight (window/step bands) and the cursor line are drawn in
    // drawStreamOverlay on the overlay layer, so a bin hover blits the cached
    // stream instead of re-running this whole render.

    ctx.restore()

    // AOI labels for heatmap (outside clip)
    if (alignment === 'heatmap') {
      ctx.save()
      ctx.font = `${AXIS_CONFIG.fontSize}px ${FONT_PRIMARY.FAMILY}`
      ctx.fillStyle = AXIS_CONFIG.color
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (let s = 0; s < data.series.length; s++) {
        const paint = seriesPaint[s]
        if (paint.stripBottom !== undefined && paint.stripHeight !== undefined) {
          const labelY = paint.stripBottom - paint.stripHeight / 2
          // Pre-truncated to the same budget the gutter reserved (single source).
          ctx.fillText(heatmapAoiLabels[s], floorLeft - 10, labelY)
        }
        const stripBottom = paint.stripBottom
        if (s < data.series.length - 1 && stripBottom !== undefined) {
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

    // Ridgeline scale bar
    if (alignment === 'ridgeline') {
      const centerY = floorTop + floorHeight / 2
      const referenceHeight = seriesPaint[0]?.referenceHeight ?? 0
      let scaleHeight = referenceHeight * RIDGELINE_CONTENT_FILL
      let scaleMaxValue = 100
      while (scaleHeight > floorHeight && scaleMaxValue > 1) {
        scaleHeight /= 2
        scaleMaxValue /= 2
      }
      const scaleTop = alignToPixelCenter(centerY - scaleHeight / 2)
      const scaleBottom = alignToPixelCenter(centerY + scaleHeight / 2)
      const scaleX = alignToPixelCenter(floorLeft - 5)
      const tickXStart = alignToPixelCenter(scaleX - 5)
      ctx.save()
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.font = `${AXIS_CONFIG.fontSize - 2}px ${FONT_PRIMARY.FAMILY}`
      ctx.fillStyle = AXIS_CONFIG.color
      ctx.fillText('0', tickXStart - 3, scaleBottom)
      ctx.fillText(scaleMaxValue.toString(), tickXStart - 3, scaleTop)
      ctx.beginPath()
      ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
      ctx.lineWidth = 1
      ctx.moveTo(scaleX, scaleBottom)
      ctx.lineTo(scaleX, scaleTop)
      ctx.moveTo(scaleX, scaleBottom)
      ctx.lineTo(tickXStart, scaleBottom)
      ctx.moveTo(scaleX, scaleTop)
      ctx.lineTo(tickXStart, scaleTop)
      ctx.stroke()
      ctx.restore()
    }

    // Plot-area chrome
    const xTicks = xAxisTicks
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
      ticks: { bottom: xTicks, top: { positions: xTicks.positions }, left: leftTicks, right: rightTicks },
    })

    if (alignment !== 'heatmap') {
      drawYAxisMainLabel(ctx, data.yAxisLabel, floorLeft, floorTop, floorHeight, frame.leftTitleOffset, AXIS_CONFIG)
    }
    drawXAxisLabel(ctx, X_AXIS_LABEL, frame.x, frame.width, frame.bottom, frame.bottomTitleOffset, AXIS_CONFIG)

    // Legend
    if (alignment === 'heatmap') {
      if (gradientLegendGeometry) {
        drawGradientLegend(ctx, gradientLegendGeometry, {
          x: margins.left,
          y: frame.legendY + PLOT_LEGEND_GAP,
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
  }

  // ── HOVER OVERLAY ──
  // The hovered-bin window/step bands and the cursor line are pure bin-index
  // geometry (no dependency on the transformed stream coordinates), so they live
  // here on the overlay layer. usePlot caches the hover-free stream, so a bin
  // hover blits it back and repaints only this instead of re-running drawStream
  // (which re-derives every series' coordinates).
  function drawStreamOverlay(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (hoveredBinIndex === null && mouseXPx === null) return
    const floorLeft = Math.floor(frame.x)
    const floorTop = Math.floor(frame.y)
    const floorWidth = Math.floor(frame.width)
    const floorHeight = Math.floor(frame.height)
    if (floorWidth <= 0 || floorHeight <= 0 || data.binCount <= 0) return
    const floorBottom = floorTop + floorHeight

    ctx.save()
    ctx.beginPath()
    ctx.rect(floorLeft, floorTop, floorWidth, floorHeight)
    ctx.clip()

    if (hoveredBinIndex !== null) {
      const binWidth = floorWidth / data.binCount
      const binX = floorLeft + hoveredBinIndex * binWidth

      // Window highlight stays in the SAME bin-index space as the step so the two
      // stay concentric (time space would slide the band off the step for sliding
      // windows). The window spans windowSize / stepSize bins, centred on the bin.
      const windowBins = data.stepSize > 0 ? data.windowSize / data.stepSize : 1
      const binCenterX = binX + binWidth / 2
      const halfWindowPx = (windowBins * binWidth) / 2
      const xStart = Math.max(floorLeft, binCenterX - halfWindowPx)
      const xEnd = Math.min(floorLeft + floorWidth, binCenterX + halfWindowPx)
      const rectWidth = xEnd - xStart

      ctx.save()
      ctx.fillStyle = '#007acc'
      if (rectWidth > 0) {
        ctx.globalAlpha = 0.08
        ctx.fillRect(xStart, floorTop, rectWidth, floorHeight)
      }
      ctx.globalAlpha = 0.15
      ctx.fillRect(binX, floorTop, binWidth, floorHeight)
      ctx.restore()
    }

    if (mouseXPx !== null) {
      ctx.save()
      ctx.strokeStyle = '#007acc'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      const x = alignToPixelCenter(mouseXPx)
      ctx.moveTo(x, floorTop)
      ctx.lineTo(x, floorBottom)
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()
  }

  function hitTestLegendBand(
    mx: number,
    my: number
  ): FrameHit<{ kind: 'legend' | 'bin'; item?: LegendItemGeometry; binIndex?: number }> | null {
    if (alignment === 'heatmap' || legendGeometry.items.length === 0 || legendHeight === 0) return null
    const item = hitTestLegend(legendGeometry, STREAM_LEGEND_CONFIG, mx, my)
    if (!item) return null
    const pos = getLegendTooltipPosition(item, STREAM_LEGEND_CONFIG)
    return {
      tooltipId: item.identifier,
      content: getLegendTooltipContent(item, usedHighlights.includes(item.identifier)),
      anchorX: pos.x,
      anchorY: pos.y,
      offset: { x: 0, y: 7 },
      cursor: 'pointer',
      data: { kind: 'legend', item },
    }
  }

  function hitTestBin(
    mx: number,
    my: number,
    frame: PlotFrame
  ): FrameHit<{ kind: 'legend' | 'bin'; item?: LegendItemGeometry; binIndex?: number }> | null {
    const binWidth = frame.width / data.binCount
    const binIndex = Math.max(0, Math.min(data.binCount - 1, Math.floor((mx - frame.x) / binWidth)))

    const binStartTime = data.timeline.minValue + binIndex * data.stepSize
    const binEndTime = binStartTime + data.windowSize
    const content: FrameHit['content'] = [
      { key: 'Window', value: `${Math.round(binStartTime)} ms – ${Math.round(binEndTime)} ms` },
      { key: 'Bin', value: `${binIndex + 1} of ${data.binCount}` },
    ]

    // Show each AOI's value in the metric's native unit, matching the y-axis.
    // (Do NOT synthesise a "%" — `values` are ms/count/% group-aggregated
    // values, not participant shares.)
    const unitSuffix = data.unit ? ` ${data.unit}` : ''
    const fmt = (v: number) =>
      `${Number.isInteger(v) ? v : v.toFixed(1)}${unitSuffix}`
    const aoiValues: { label: string; value: number }[] = []
    for (const seriesItem of data.series) {
      const value = seriesItem.values[binIndex]
      if (Number.isFinite(value) && value > 0) {
        aoiValues.push({ label: seriesItem.label, value })
      }
    }
    aoiValues.sort((a, b) => b.value - a.value)
    for (const aoi of aoiValues.slice(0, 4)) {
      content.push({ key: aoi.label, value: fmt(aoi.value) })
    }
    if (aoiValues.length > 4) {
      const remaining = aoiValues.slice(4)
      const otherSum = remaining.reduce((sum, aoi) => sum + aoi.value, 0)
      content.push({ key: `other ${remaining.length} areas`, value: fmt(otherSum) })
    }

    return {
      tooltipId: 'aoi-stream-bin-tooltip',
      content,
      anchorX: mx,
      anchorY: my,
      offset: { x: 15, y: 15 },
      cursor: 'crosshair',
      data: { kind: 'bin', binIndex },
    }
  }

  // The hovered legend item is tracked synchronously, so click needs no coords.
  function handleClick() {
    if (hoveredLegendItem) {
      const aoiId = parseInt(hoveredLegendItem.identifier)
      if (!isNaN(aoiId)) onLegendClick(aoiId)
    }
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
  onclick={handleClick}
  aria-label="AOI Timeline visualization"
></canvas>
