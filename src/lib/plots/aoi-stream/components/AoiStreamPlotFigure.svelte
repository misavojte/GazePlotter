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
    // The centered streamgraph uses a symmetric domain (e.g. [-50, +50] for 100%).
    // This factor adds headroom so the plot doesn't touch the top/bottom.
    // Example: 100% total -> half-range=50, with factor 1.5 => axis half-range=75.
    HEADROOM_FACTOR: 1.5,
    TARGET_POSITIVE_TICKS: 3,
  }

  const RIDGELINE_OVERLAP = 0.6

  const LEGEND = {
    ITEM_HEIGHT: SCARF_LAYOUT.LEGEND_ITEM_HEIGHT,
    ICON_SIZE: SCARF_LAYOUT.LEGEND_ICON_WIDTH,
    TEXT_PADDING: SCARF_LAYOUT.LEGEND_TEXT_PADDING,
    ITEM_SPACING: SCARF_LAYOUT.LEGEND_ITEM_SPACING,
    ROW_PADDING: SCARF_LAYOUT.LEGEND_ITEM_PADDING,
    TOP_PADDING: SCARF_LAYOUT.LEGEND_GROUP_TITLE_SPACING,
  }

  const FLOW_CURVE_TENSION = 0
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

  const formatAxisTick = (value: number) => {
    if (!Number.isFinite(value)) return '0'
    const rounded = Math.round(value)
    if (Math.abs(value - rounded) < 1e-6) return rounded.toString()
    return value.toFixed(1).replace(/\.0$/, '')
  }

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

      if (FLOW_CURVE_TENSION === 0) {
        for (let i = 1; i < binCount; i++) {
          ctx.lineTo(getX(i), getY(i))
        }
        return
      }

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

    // Common setup
    const cumulative = new Float32Array(binCount)
    const totals = new Float32Array(binCount)
    let stripHeight = 0
    let stripGap = 0

    if (alignment === 'center' || alignment === 'bottom') {
      // Calculate totals
      for (let s = 0; s < series.length; s++) {
        const values = series[s].values
        for (let i = 0; i < binCount; i++) {
          totals[i] += values[i] * percentFactor
        }
      }
    } else if (alignment === 'ridgeline') {
      // Calculate strip layout with overlap
      const n = Math.max(1, series.length)

      // Calculate optimized strip height based on actual data peaks
      // Default standard layout (assumes 100% max value in all series)
      const standardDenom = n - (n - 1) * RIDGELINE_OVERLAP
      const standardHeight = plotAreaHeight / standardDenom

      if (
        stripHeightOverride !== null &&
        Number.isFinite(stripHeightOverride) &&
        stripHeightOverride > 0
      ) {
        stripHeight = stripHeightOverride
      } else {
        // Calculate using only the first series peak (for efficiency and consistency with sync)
        let maxVal = 0
        if (series.length > 0) {
          const values = series[0].values
          for (let i = 0; i < binCount; i++) {
            const v = values[i] * percentFactor
            if (v > maxVal) maxVal = v
          }
        }

        // First series (s=0) has relativePosition = (n - 1 - 0) * (1 - OVERLAP) = (n-1) * (1 - OVERLAP)
        const relativePosition = (n - 1) * (1 - RIDGELINE_OVERLAP)
        const dataFactor = (maxVal * 0.9) / 100
        const totalFactor = relativePosition + dataFactor

        let minAllowableS = Infinity

        if (totalFactor > 1e-4) {
          minAllowableS = plotAreaHeight / totalFactor
        }

        // Apply clamping
        if (minAllowableS === Infinity) {
          stripHeight = standardHeight
        } else {
          stripHeight = Math.min(minAllowableS, standardHeight * 10)
          stripHeight = Math.max(stripHeight, standardHeight)
        }
      }
    }

    // Center alignment specifics: offset based on half total
    if (alignment === 'center') {
      for (let i = 0; i < binCount; i++) {
        cumulative[i] = -totals[i] * 0.5
      }
    }

    // Y-scale calculation
    let scaleY = 1
    let yBase = 0

    if (alignment === 'center') {
      const centerY = plotTop + plotAreaHeight / 2
      // axisHalfRange maps to halfHeight
      scaleY = plotAreaHeight / 2 / axisHalfRange
      yBase = centerY
    } else if (alignment === 'bottom') {
      // yAxisMax maps to full height
      scaleY = plotAreaHeight / yAxisMax
      yBase = plotBottom
    }

    // Draw each series using pre-allocated buckets
    for (let s = 0; s < series.length; s++) {
      const values = series[s].values
      const bucket = seriesBuckets[s]
      const aoiId = series[s].id

      // Apply highlight dimming
      const isHighlighted = highlightMaskById?.get(aoiId) ?? false
      const opacity = highlightMaskById && !isHighlighted ? 0.2 : 1.0

      if (alignment === 'ridgeline') {
        const overlapOffset = stripHeight * (1 - RIDGELINE_OVERLAP)

        // Calculate the total height of all strips
        // Total Height = (N-1) * overlapOffset + stripHeight
        // The first strip (s=0) starts at 0 relative to the group
        // The last strip (s=N-1) starts at (N-1) * overlapOffset
        // And extends by stripHeight.

        const totalGroupHeight =
          (series.length - 1) * overlapOffset + stripHeight

        // Anchor the group to the bottom of the plot area
        // groupTop + totalGroupHeight = plotBottom
        const groupTop = plotBottom - totalGroupHeight

        const stripTop = groupTop + s * overlapOffset
        const stripBottom = stripTop + stripHeight // Bottom of this strip
        // User requested: "for each line, separate y axis, so no continuous line there... also do not center it in separate, have it from the bottom"
        // So for "separate", we align to the bottom of the strip.

        // Scale: 100% = stripHeight * 0.9 (keep some padding at top)
        const localScaleY = (stripHeight * 0.9) / 100

        for (let i = 0; i < binCount; i++) {
          const val = values[i] * percentFactor
          // Align from bottom
          bucket.bottomY[i] = stripBottom
          bucket.topY[i] = stripBottom - val * localScaleY
        }
      } else {
        // Stacked (center or bottom)
        for (let i = 0; i < binCount; i++) {
          const startVal = cumulative[i]
          const val = values[i] * percentFactor
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

      // Draw minimal axis for ridgeline view
      if (alignment === 'ridgeline') {
        const overlapOffset = stripHeight * (1 - RIDGELINE_OVERLAP)
        const totalGroupHeight =
          (series.length - 1) * overlapOffset + stripHeight
        const groupTop = plotBottom - totalGroupHeight
        const stripTop = groupTop + s * overlapOffset
        const stripBottom = stripTop + stripHeight
        // Draw simplified axis line (divider)
        // With overlap, maybe we only draw the baseline for each?
        // Let's draw the baseline for each strip.
        ctx.beginPath()
        ctx.moveTo(plotLeft, stripBottom)
        ctx.lineTo(plotLeft + plotAreaWidth, stripBottom)
        ctx.strokeStyle = '#eee'
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

          // Now draw the current (underlying) series in white
          ctx.globalAlpha = 0.25
          ctx.fillStyle = '#fff'
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

    if (alignment === 'ridgeline') {
      // Draw a single scale indicator for the ridgeline height centered vertically
      // Use the stripHeight calculated in the main render loop
      // Center the scale vertically in the plot area (user preferred this)
      const centerY = plotTop + plotAreaHeight / 2

      // Scale: 100% = stripHeight * 0.9
      const scaleHeight = stripHeight * 0.9
      const scaleTop = centerY - scaleHeight / 2
      const scaleBottom = centerY + scaleHeight / 2

      // Position at the standard axis line (plotLeft)
      const scaleX = plotLeft - 10
      const tickLength = 5
      const tickXStart = scaleX - tickLength

      ctx.save()
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.font = `${AXIS.FONT_SIZE - 2}px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.fillStyle = AXIS.COLOR

      // Labels
      const tickLabelX = tickXStart - 3
      ctx.fillText('0', tickLabelX, scaleBottom)
      ctx.fillText('100', tickLabelX, scaleTop)

      // Scale bar
      ctx.beginPath()
      ctx.strokeStyle = AXIS.COLOR
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
        axisTicks
      )
    } else {
      drawBottomYAxis(ctx, plotBottom, plotAreaHeight, yAxisMax, axisTicks)
    }

    // Shared Y-axis main label and X-axis components
    drawYAxisMainLabel(ctx)
    drawTimelineLabels(ctx)
    drawXAxisLabel(ctx)
    drawXAxisTicksAndBorder(ctx)

    // Legend (batched rendering with highlight dimming)
    const legendItems = series
    if (legendItems.length && legendHeight > 0) {
      setUpFont(ctx)
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

  function drawCenteredYAxis(
    ctx: CanvasRenderingContext2D,
    centerY: number,
    halfHeight: number,
    axisHalfRange: number,
    ticks: number[]
  ) {
    const xLabel = plotLeft - Y_AXIS.TICK_LABEL_OFFSET
    const xTick = plotLeft - 5

    ctx.strokeStyle = AXIS.GRID_COLOR
    ctx.lineWidth = 1
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    for (let i = 0; i < ticks.length; i++) {
      const value = ticks[i]
      const offset = (value / axisHalfRange) * halfHeight
      const yUpper = centerY - offset
      const yLower = centerY + offset

      // Tick and label (common for all ticks)
      ctx.beginPath()
      ctx.moveTo(xTick, yUpper)
      ctx.lineTo(plotLeft, yUpper)
      ctx.stroke()
      ctx.fillText(formatAxisTick(value), xLabel, yUpper)

      // Parallel mirrored tick/label for positive values
      if (value > 0) {
        ctx.beginPath()
        ctx.moveTo(xTick, yLower)
        ctx.lineTo(plotLeft, yLower)
        ctx.stroke()
        ctx.fillText(`-${formatAxisTick(value)}`, xLabel, yLower)
      }
    }
  }

  function drawBottomYAxis(
    ctx: CanvasRenderingContext2D,
    baselineY: number,
    fullHeight: number,
    axisMax: number,
    ticks: number[]
  ) {
    const xLabel = plotLeft - Y_AXIS.TICK_LABEL_OFFSET
    const xTick = plotLeft - 5

    ctx.strokeStyle = AXIS.GRID_COLOR
    ctx.lineWidth = 1
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    for (let i = 0; i < ticks.length; i++) {
      const value = ticks[i]
      const offset = (value / axisMax) * fullHeight
      const y = baselineY - offset

      ctx.beginPath()
      ctx.moveTo(xTick, y)
      ctx.lineTo(plotLeft, y)
      ctx.stroke()
      ctx.fillText(formatAxisTick(value), xLabel, y)
    }
  }

  function drawYAxisMainLabel(ctx: CanvasRenderingContext2D) {
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
