<script lang="ts">
  import { getContext, onMount, untrack } from 'svelte'
  import { browser } from '$app/environment'
  import { calculateIdealStripHeight } from '../utils/ridgelineUtils'
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
  import { getXAxisLabel } from '$lib/plots/scarf/utils'
  import { estimateTextWidth } from '$lib/shared/utils/textUtils'
  import { desaturateToWhite } from '$lib/shared/utils/colorUtils'
  import { updateTooltip } from '$lib/tooltip'
  import type { AoiStreamPlotResult } from '$lib/plots/aoi-stream/types'
  import {
    GRIDLINE_SECONDARY,
    GRIDLINE_PRIMARY,
    FONT_PRIMARY,
    computeFlatLegendGeometry,
    calculateFlatLegendHeight, // Added import
    drawLegend,
    hitTestLegend,
    getLegendTooltipPosition,
    getLegendTooltipContent,
    STREAM_LEGEND_CONFIG,
    drawTimelineLabels,
    drawXAxisTicksAndBorder,
    drawXAxisLabel,
    drawYAxisMainLabel,
    drawCenteredYAxis,
    drawBottomYAxis,
    drawPlotOutline,
    formatAxisTick,
    type LegendItem,
    type LegendGeometry,
    type LegendItemGeometry,
    type AdaptiveTimeline,
    getTimelinePositionRatio,
  } from '$lib/plots/shared'

  const MARGIN = {
    TOP: 20,
    RIGHT: 1, // Space for gridline stroke at right edge
    BOTTOM: 55,
    LEFT: 50,
  }

  const AXIS_CONFIG = {
    tickLength: 5,
    fontSize: FONT_PRIMARY.SIZE,
    fontFamily: FONT_PRIMARY.FAMILY,
    color: FONT_PRIMARY.COLOR,
    gridColor: GRIDLINE_SECONDARY.COLOR,
    baselineColor: GRIDLINE_PRIMARY.COLOR,
    tickLabelOffset: 10,
    labelOffset: 24,
  }

  const Y_AXIS = {
    LABEL_OFFSET: 36,
    TICK_LABEL_OFFSET: 10,
    // The centered streamgraph uses a symmetric domain (e.g. [-50, +50] for 100%).
    // This factor adds headroom so the plot doesn't touch the top/bottom.
    // Example: 100% total -> half-range=50, with factor 1.5 => axis half-range=75.
    HEADROOM_FACTOR: 1.5,
    TARGET_POSITIVE_TICKS: 3,
  }

  const RIDGELINE_OVERLAP = 0.6

  const FLOW_CURVE_TENSION = 0
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
  let renderBuckets = $state<{
    xPositions: Float32Array
    seriesBuckets: Array<{
      topY: Float32Array
      bottomY: Float32Array
    }>
    binCount: number
  } | null>(null)

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

  const safeNumber = (value: number, fallback: number) =>
    Number.isFinite(value) ? value : fallback

  const niceStep = (rawStep: number) => {
    const safeRaw = Math.max(1e-9, Math.abs(rawStep))
    const exponent = Math.floor(Math.log10(safeRaw))
    const pow10 = Math.pow(10, exponent)
    const fraction = safeRaw / pow10
    const niceFractions = [1, 2, 2.5, 5, 10]
    let niceFraction = niceFractions[niceFractions.length - 1]
    for (let i = 0; i < niceFractions.length; i++) {
      if (fraction <= niceFractions[i]) {
        niceFraction = niceFractions[i]
        break
      }
    }
    return niceFraction * pow10
  }

  const computeNiceYAxis = (dataHalfRange: number) => {
    const padded = Math.max(1, dataHalfRange * Y_AXIS.HEADROOM_FACTOR)
    const rawStep = padded / Math.max(1, Y_AXIS.TARGET_POSITIVE_TICKS)
    const step = niceStep(rawStep)
    const axisHalfRange = Math.max(1, Math.ceil(padded / step) * step)

    const ticks: number[] = [0]
    for (let v = step; v <= axisHalfRange + step * 0.001; v += step) {
      ticks.push(v)
    }

    return { axisHalfRange, ticks }
  }

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
    Math.floor(Math.max(0, safeWidth - MARGIN.LEFT - MARGIN.RIGHT))
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
    const dataBinCount = data.binCount
    // Add 2 extra points (one before, one after) to ensure the curve enters/exits the plot area smoothly
    const renderBinCount = dataBinCount + 2

    // Work in percent of participants so axes/labels match the plot title.
    // Values in `data.series[].values[]` are participant-weighted contributions per bin.
    const percentFactor = data.participants > 0 ? 100 / data.participants : 0
    const maxTotalPercent = Math.max(1, data.maxTotal) * percentFactor

    let axisHalfRange = 50 // Default fallback
    let axisTicks = [0]
    let yAxisMin = 0
    let yAxisMax = 100

    if (alignment === 'center') {
      const dataHalfRange = maxTotalPercent / 2
      const computed = computeNiceYAxis(dataHalfRange)
      axisHalfRange = computed.axisHalfRange
      axisTicks = computed.ticks
      yAxisMin = -axisHalfRange
      yAxisMax = axisHalfRange
    } else if (alignment === 'bottom') {
      // Bottom alignment: Use nice steps based on actual max, similar to center but starting at 0
      const padded = Math.max(1, maxTotalPercent)
      // Use logic similar to niceStep but for positive range
      const rawStep = padded / Math.max(1, Y_AXIS.TARGET_POSITIVE_TICKS)
      const step = niceStep(rawStep)
      const axisMax = Math.max(1, Math.ceil(padded / step) * step)

      axisTicks = [0]
      for (let v = step; v <= axisMax + step * 0.001; v += step) {
        axisTicks.push(v)
      }
      yAxisMin = 0
      yAxisMax = axisMax
    } else if (alignment === 'ridgeline') {
      // For ridgeline, we use a shared scale but draw it differently
      axisTicks = [0, 100]
      yAxisMin = 0
      yAxisMax = 100
    }

    // Floor dimensions for pixel-perfect synchronization
    const floorLeft = Math.floor(plotLeft)
    const floorTop = Math.floor(plotTop)
    const floorWidth = Math.floor(plotAreaWidth)
    const floorHeight = Math.floor(plotAreaHeight)
    const floorBottom = floorTop + floorHeight

    if (
      !Number.isFinite(floorWidth) ||
      !Number.isFinite(floorHeight) ||
      !Number.isFinite(floorLeft) ||
      !Number.isFinite(floorTop) ||
      floorWidth <= 0 ||
      floorHeight <= 0 ||
      dataBinCount <= 0
    ) {
      finishCanvasDrawing(canvasState)
      return
    }

    ctx.save()

    ctx.save()

    // Clip to plot area to hide the overflowing guard points
    ctx.beginPath()
    ctx.rect(floorLeft, floorTop, floorWidth, floorHeight)
    ctx.clip()

    // Zero-allocation pipeline: ensure buckets are ready
    const buckets = ensureRenderBuckets(renderBinCount, series.length)
    const { xPositions, seriesBuckets } = buckets

    // Pre-compute X positions once (reused across all series)
    // We map indices 1..N to the actual bins, and 0 / N+1 to outside points.
    const invBinCount = 1 / dataBinCount
    for (let i = 0; i < renderBinCount; i++) {
      if (i === 0) {
        xPositions[i] = floorLeft
      } else if (i === renderBinCount - 1) {
        xPositions[i] = floorLeft + floorWidth
      } else {
        // Real bin centers are at (i - 1 + 0.5)
        xPositions[i] = floorLeft + (i - 1 + 0.5) * invBinCount * floorWidth
      }
    }

    const drawCatmullRom = (
      xs: Float32Array,
      ys: Float32Array,
      forward: boolean
    ) => {
      // Use renderBinCount instead of data.binCount
      const count = renderBinCount
      if (count === 1) {
        ctx.lineTo(xs[0], ys[0])
        return
      }

      const getX = (i: number) => (forward ? xs[i] : xs[count - 1 - i])
      const getY = (i: number) => (forward ? ys[i] : ys[count - 1 - i])

      ctx.lineTo(getX(0), getY(0))

      if (FLOW_CURVE_TENSION === 0) {
        for (let i = 1; i < count; i++) {
          ctx.lineTo(getX(i), getY(i))
        }
        return
      }

      for (let i = 0; i < count - 1; i++) {
        const p0x = getX(Math.max(0, i - 1))
        const p0y = getY(Math.max(0, i - 1))
        const p1x = getX(i)
        const p1y = getY(i)
        const p2x = getX(i + 1)
        const p2y = getY(i + 1)
        const p3x = getX(Math.min(count - 1, i + 2))
        const p3y = getY(Math.min(count - 1, i + 2))

        const cp1x = p1x + (p2x - p0x) * FLOW_CURVE_TENSION
        const cp1y = p1y + (p2y - p0y) * FLOW_CURVE_TENSION
        const cp2x = p2x - (p3x - p1x) * FLOW_CURVE_TENSION
        const cp2y = p2y - (p3y - p1y) * FLOW_CURVE_TENSION

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2x, p2y)
      }
    }

    // Common setup - allocated for renderBinCount
    const cumulative = new Float32Array(renderBinCount)
    const totals = new Float32Array(renderBinCount)
    let stripHeight = 0
    let stripGap = 0

    if (alignment === 'center' || alignment === 'bottom') {
      // Calculate totals
      for (let s = 0; s < series.length; s++) {
        const values = series[s].values

        // Main body
        for (let i = 0; i < dataBinCount; i++) {
          totals[i + 1] += values[i] * percentFactor
        }
      }

      // Pad totals
      // Core concept: initial value of everything is ZERO
      totals[0] = 0
      totals[renderBinCount - 1] = 0
    } else if (alignment === 'ridgeline') {
      // Calculate strip layout with overlap
      const n = Math.max(1, series.length)

      // Calculate optimized strip height based on actual data peaks
      // Default standard layout (assumes 100% max value in all series)
      const standardDenom = n - (n - 1) * RIDGELINE_OVERLAP
      const standardHeight = floorHeight / standardDenom

      if (
        stripHeightOverride !== null &&
        Number.isFinite(stripHeightOverride) &&
        stripHeightOverride > 0
      ) {
        stripHeight = stripHeightOverride
      } else {
        stripHeight = calculateIdealStripHeight(data, floorHeight)
      }
    }

    // Center alignment specifics: offset based on half total
    if (alignment === 'center') {
      for (let i = 0; i < renderBinCount; i++) {
        cumulative[i] = -totals[i] * 0.5
      }
    }

    // Y-scale calculation
    let scaleY = 1
    let yBase = 0

    if (alignment === 'center') {
      const centerY = floorTop + floorHeight / 2
      // axisHalfRange maps to halfHeight
      scaleY = floorHeight / 2 / axisHalfRange
      yBase = centerY
    } else if (alignment === 'bottom') {
      // yAxisMax maps to full height
      scaleY = floorHeight / yAxisMax
      yBase = floorBottom
    }

    // Draw each series using pre-allocated buckets
    for (let s = 0; s < series.length; s++) {
      const values = series[s].values
      const bucket = seriesBuckets[s]
      const aoiId = series[s].id

      const isHighlighted = highlightMaskById?.get(aoiId) ?? false
      const isDimmed = !!highlightMaskById && !isHighlighted
      const effectiveFill = isDimmed
        ? desaturateToWhite(series[s].color, 0.85)
        : series[s].color

      if (alignment === 'ridgeline') {
        const overlapOffset = stripHeight * (1 - RIDGELINE_OVERLAP)

        // Calculate the total height of all strips
        const totalGroupHeight =
          (series.length - 1) * overlapOffset + stripHeight

        // Anchor the group to the bottom of the plot area
        const groupTop = floorBottom - totalGroupHeight

        const stripTop = groupTop + s * overlapOffset
        const stripBottom = stripTop + stripHeight // Bottom of this strip
        // User requested: "for each line, separate y axis, so no continuous line there... also do not center it in separate, have it from the bottom"
        // So for "separate", we align to the bottom of the strip.

        // Scale: 100% = stripHeight * 0.9 (keep some padding at top)
        const localScaleY = (stripHeight * 0.9) / 100

        for (let i = 0; i < renderBinCount; i++) {
          // Map render index `i` to data index
          // 0 -> 0 (duplicate), 1..N -> 0..N-1, N+1 -> N-1 (duplicate)
          const dataIndex = Math.max(0, Math.min(dataBinCount - 1, i - 1))
          let val = values[dataIndex] * percentFactor

          if (i === 0 || i === renderBinCount - 1) val = 0 // Initial/Final value is ZERO

          // Align from bottom
          bucket.bottomY[i] = stripBottom
          bucket.topY[i] = stripBottom - val * localScaleY
        }
      } else {
        // Stacked (center or bottom)
        for (let i = 0; i < renderBinCount; i++) {
          const startVal = cumulative[i]

          const dataIndex = Math.max(0, Math.min(dataBinCount - 1, i - 1))
          let val = values[dataIndex] * percentFactor

          if (i === 0 || i === renderBinCount - 1) val = 0 // Initial/Final value is ZERO

          const endVal = startVal + val
          cumulative[i] = endVal

          // Project to Y pixels
          // Note: Y increases downwards in Canvas
          if (alignment === 'center') {
            bucket.topY[i] = yBase - endVal * scaleY
            bucket.bottomY[i] = yBase - startVal * scaleY
          } else {
            // Bottom alignment: 0 is at plotBottom, positive goes up
            bucket.topY[i] = yBase - endVal * scaleY
            bucket.bottomY[i] = yBase - startVal * scaleY
          }
        }
      }

      // Draw filled area
      ctx.beginPath()
      ctx.moveTo(xPositions[0], bucket.topY[0])
      drawCatmullRom(xPositions, bucket.topY, true)
      drawCatmullRom(xPositions, bucket.bottomY, false)
      ctx.closePath()

      ctx.fillStyle = effectiveFill
      ctx.fill()

      // Draw thin white border between areas
      ctx.strokeStyle = AREA_DIVIDER.COLOR
      ctx.lineWidth = AREA_DIVIDER.WIDTH
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()

      // Draw minimal axis for ridgeline view
      if (alignment === 'ridgeline') {
        const overlapOffset = stripHeight * (1 - RIDGELINE_OVERLAP)
        const totalGroupHeight =
          (series.length - 1) * overlapOffset + stripHeight
        const groupTop = plotBottom - totalGroupHeight
        const stripTop = groupTop + s * overlapOffset
        const stripBottom = stripTop + stripHeight

        // Let's draw the baseline for each strip.
        ctx.beginPath()
        ctx.moveTo(alignToPixelCenter(floorLeft), stripBottom)
        ctx.lineTo(alignToPixelCenter(floorLeft + floorWidth), stripBottom)
        ctx.strokeStyle = GRIDLINE_SECONDARY.COLOR
        ctx.lineWidth = GRIDLINE_SECONDARY.WIDTH
        ctx.stroke()
      }
    }

    // For Ridgeline: If a series is overlapped by the NEXT series, draw the overlapped part as a white line on top.
    // We iterate backwards or check overlaps.
    // Actually, because we draw from top to bottom (index 0 to N), the later series (s+1) is drawn ON TOP of s.
    // So if series s+1 overlaps series s, we need to see series s's curve ON TOP of series s+1?
    // "when the Layers covers up Icon AOI, plot white line of Icon AOI value on top of the Layers one"
    // "Layers" is presumably s+1, "Icon AOI" is s.
    // So if s is covered by s+1, draw s's outline again on top of everything?
    // Yes, that makes sense. We want to see the "phantom" of the covered series.
    // This effectively means redrawing the top curve of *all* series after the main fill loop, in the same order (or simplified).
    // Or we only redraw the *obscured* parts? Redrawing the whole line is easiest and usually looks clearer (like a "Behind" style).

    if (alignment === 'ridgeline') {
      // We only want to draw the white "ghost" where it is overlapped by *subsequent* series (which are drawn "in front").
      // To do this, we can mask the drawing area to only include the *union* of all subsequent series.
      // It's easier to iterate backwards? No, we need to draw on top.

      // Algorithm:
      // For each series s (from 0 to N-2):
      //   We want to draw a white overlay on series s, BUT ONLY where series (s+1)...(N-1) exist.
      //   This is equivalent to: clip to the shape of "union of s+1...N-1", then draw s in white.

      // Since canvas doesn't support complex union paths easily without winding rules, let's try a simpler per-pair or accumulated clip approach.
      // Or simpler: Draw all series normally (done).
      // Now, for each series s, draw its shape again in white, but set `globalCompositeOperation = 'source-atop'`? No.

      // What if we draw the white overlay ONLY where the *next* series (s+1) overlaps?
      // The user said "when the Layers covers up Icon AOI". Layers is presumably on top (drawn later).

      ctx.save()
      // Iterate through series that might be covered (all except the last one)
      for (let s = 0; s < series.length - 1; s++) {
        const currentBucket = seriesBuckets[s]

        // Create a clipping region from all SUBSEQUENT series (the ones covering this one)
        // To avoid complex path unions, we can just iterate through subsequent series and clip?
        // No, standard clip() intersects. We need a union of subsequent series to clip TO.
        // That's hard.

        // Alternative:
        // For each subsequent series 'cover':
        //   Clip to 'cover'.
        //   Draw 'current' in white (0.25 opacity).
        //   Restore clip.
        // This might result in double-drawing if multiple subsequent series cover the same spot, increasing opacity.
        // But given 0.5 overlap, usually only the immediate next series covers significantly?
        // Let's try iterating through all subsequent series.

        for (let cover = s + 1; cover < series.length; cover++) {
          const coverBucket = seriesBuckets[cover]

          ctx.save()

          // Define clipping path for the covering series
          ctx.beginPath()
          ctx.moveTo(xPositions[0], coverBucket.topY[0])
          drawCatmullRom(xPositions, coverBucket.topY, true)
          drawCatmullRom(xPositions, coverBucket.bottomY, false)
          ctx.closePath()
          ctx.clip()

          // Now draw the current (underlying) series in white/pale
          // We use a high desaturation to make it a "ghost" of the original
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.moveTo(xPositions[0], currentBucket.topY[0])
          drawCatmullRom(xPositions, currentBucket.topY, true)
          drawCatmullRom(xPositions, currentBucket.bottomY, false)
          ctx.closePath()
          ctx.fill()

          ctx.restore()
        }
      }
      ctx.restore()
    }

    // Reset opacity (safety)
    ctx.globalAlpha = 1.0

    // Draw hovered bin highlight
    if (hoveredBinIndex !== null) {
      const binWidth = floorWidth / dataBinCount
      const binX = floorLeft + hoveredBinIndex * binWidth

      ctx.save()
      ctx.globalAlpha = 0.2
      ctx.fillStyle = '#007acc' // Blue highlight color
      ctx.fillRect(binX, floorTop, binWidth, floorHeight)
      ctx.restore()

      // Draw vertical line at bin boundary
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

    // Restore context to remove the clipping region before drawing axes
    ctx.restore()

    setUpFont(ctx)

    if (alignment === 'ridgeline') {
      // Draw a single scale indicator for the ridgeline height centered vertically
      // Use the stripHeight calculated in the main render loop
      // Center the scale vertically in the plot area (user preferred this)
      const centerY = floorTop + floorHeight / 2

      // Scale: 100% = stripHeight * 0.9
      const scaleHeight = stripHeight * 0.9
      const scaleTop = centerY - scaleHeight / 2
      const scaleBottom = centerY + scaleHeight / 2

      // Position at the standard axis line (plotLeft)
      const scaleX = floorLeft - 10
      const tickLength = 5
      const tickXStart = scaleX - tickLength

      ctx.save()
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.font = `${AXIS_CONFIG.fontSize - 2}px ${FONT_PRIMARY.FAMILY}`
      ctx.fillStyle = AXIS_CONFIG.color

      // Labels
      const tickLabelX = tickXStart - 3
      ctx.fillText('0', tickLabelX, scaleBottom)
      ctx.fillText('100', tickLabelX, scaleTop)

      // Scale bar
      ctx.beginPath()
      ctx.strokeStyle = AXIS_CONFIG.color
      ctx.lineWidth = 0.5
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

<div class="plot-container">
  <canvas
    bind:this={canvas}
    aria-label="Time-binned AOI Occupancy visualization"
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
