<script lang="ts">
  import {
    FONT_PRIMARY,
    ROW_LABEL_GAP,
    type AdaptiveTimeline,
    getTimelinePositionRatio,
    drawYAxisMainLabel,
    drawXAxisLabel,
    usePlot,
    drawPlotArea,
    fillPlotAreaBackground,
    canvasBlockSelect,
    type PlotAreaTicks,
    type BlockedRegion,
    type CanvasExportProps,
  } from '$lib/plots/shared'
  import {
    calculateLabelOffset,
    truncateTextToPixelWidth,
  } from '$lib/shared/utils/textUtils'
  import {
    beginCanvasDrawing,
    finishCanvasDrawing,
    alignToPixelCenter,
  } from '$lib/plots/shared/canvasUtils'
  import { drawCanvasPlaceholder, METRIC_MISSING_MESSAGE } from '$lib/plots/shared/drawCanvasPlaceholder'
  import type { StatisticalOverlayType, BarPlotDataItem } from '$lib/plots/bar/types'
  import {
    drawOverlayBackgrounds,
    drawCategoryDelimiters,
    drawBeeswarmPoints,
    drawStatisticalOverlay,
    computeDotStyle,
    valueToPixel,
    type BarPlotLayout,
  } from '$lib/plots/bar/core/renderers'

  // Layout constants
  const MARGIN = {
    TOP: 30,
    RIGHT: 20,
    BOTTOM: 50,
  }
  const LABEL_FONT_SIZE = FONT_PRIMARY.SIZE
  const TICK_LENGTH = 5
  const BAR_SPACING_TOLERANCE = 20 // px padding on both sides of the bar region
  const VALUE_LABEL_OFFSET = 5 // gap between axis edge and tick labels
  const CATEGORY_LABEL_OFFSET = 15 // gap between plot border and AOI category labels
  const MIN_BAR_SPACING = 2 // minimum gap between bars when space is tight

  interface Props extends CanvasExportProps {
    data: BarPlotDataItem[]
    timeline: AdaptiveTimeline
    axisLabel: string
    barPlottingType: 'horizontal' | 'vertical'
    barWidth: number
    barSpacing: number
    onDataHover: (
      data: { value: number; label: string; color: string } | null
    ) => void
    statisticalOverlay?: StatisticalOverlayType
    noMetric?: boolean
  }

  let {
    width,
    height,
    data,
    timeline,
    axisLabel,
    barPlottingType,
    barWidth,
    barSpacing,
    onDataHover,
    statisticalOverlay = 'none',
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
    noMetric = false,
  }: Props = $props()

  // Crosshair / hover constants
  const HIGHLIGHT_COLOR = '#007acc'
  const HIGHLIGHT_FILL_ALPHA = 0.2
  const HIGHLIGHT_DASH = [2, 2]

  // State management
  let hoveredBarIndex = $state<number | null>(null)
  let mouseValuePx = $state<number | null>(null) // pixel position on value axis


  // Calculate dynamic margins
  const effectiveTopMargin = $derived(TICK_LENGTH)
  const effectiveBottomMargin = $derived(
    barPlottingType === 'horizontal' ? MARGIN.BOTTOM : 30
  )

  // Calculate dynamic left margin based on plotting type and label lengths
  const trueLeftMarginVal = $derived(
    Math.floor(
      Math.min(
        width * 0.4, // Safety cap: never take more than 40% of width
        barPlottingType === 'horizontal'
          ? Math.min(
              150,
              calculateLabelOffset(data.map(item => item.label)) +
                ROW_LABEL_GAP
            ) + marginLeft
          : Math.max(
              65,
              calculateLabelOffset(timeline.ticks.map(tick => tick.label)) +
                VALUE_LABEL_OFFSET +
                30
            ) + marginLeft
      )
    )
  )

  const dynamicRightMarginVal = $derived.by(() => {
    if (barPlottingType !== 'horizontal') return MARGIN.RIGHT + marginRight

    const values = data.map(d => d.value)
    if (values.length === 0) return MARGIN.RIGHT + marginRight

    const maxValue = Math.max(0, ...values)
    const timelineMax = timeline.maxValue || 1

    // 1. Calculate a stable estimate for the plot area width
    const estimatedPlotAreaWidth = Math.max(
      100,
      width - trueLeftMarginVal - MARGIN.RIGHT - marginRight
    )

    // 2. Calculate the bar end X position, CAPPING it at the estimated plot area width.
    // This is the KEY fix: if maxValue > timelineMax, we assume the bar is clipped
    // and its label should ideally appear at the edge of the plot area, not miles away.
    const clippedValueRatio = Math.min(1, maxValue / timelineMax)
    const barEndX = trueLeftMarginVal + clippedValueRatio * estimatedPlotAreaWidth

    // 3. Estimate label width
    const labelText = maxValue.toString()
    const labelWidth = labelText.length * LABEL_FONT_SIZE * 0.55
    const labelRightEdge = barEndX + VALUE_LABEL_OFFSET + labelWidth

    // 4. Calculate overflow based on the CLIPPED position
    const overflow = Math.max(0, labelRightEdge - width)

    // Cap the maximum possible overflow to prevent the plot area from disappearing
    // if something goes wrong or labels are extremely long.
    const cappedOverflow = Math.min(overflow, width * 0.3)

    return Math.floor(MARGIN.RIGHT + cappedOverflow + marginRight)
  })

  const margins = $derived({
    top: effectiveTopMargin + marginTop,
    right: dynamicRightMarginVal,
    bottom: effectiveBottomMargin + marginBottom,
    left: trueLeftMarginVal,
  })

  const plot = usePlot({
    render: renderCanvas,
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [data, timeline, axisLabel, barPlottingType, barWidth, barSpacing, statisticalOverlay, noMetric],
    onMouseMove: handlePlotMouseMove
  })

  // Decoupled coordinate projection mappings
  const trueLeftMargin = $derived(plot.plotLeft)
  const plotAreaWidth = $derived(plot.plotAreaWidth)
  const plotAreaHeight = $derived(plot.plotAreaHeight)

  // Bar plot has no legend — only the data rectangle is blocked so
  // the surrounding chrome (axes, title, padding) opens the Pane.
  const blockedRegions = $derived<BlockedRegion[]>([
    {
      x: trueLeftMargin,
      y: effectiveTopMargin + marginTop,
      w: plotAreaWidth,
      h: plotAreaHeight,
    },
  ])

  // Scale values to plot area using AdaptiveTimeline
  function scaleValue(value: number, clamp: boolean = true): number {
    const position = getTimelinePositionRatio(timeline, value, clamp)
    return Math.floor(
      position *
        (barPlottingType === 'vertical' ? plotAreaHeight : plotAreaWidth)
    )
  }

  // Calculate optimal bar width based on available space
  const optimalBarWidth = $derived.by(() => {
    if (data.length === 0) return barWidth

    const availableSpace =
      barPlottingType === 'vertical' ? plotAreaWidth : plotAreaHeight

    // Calculate maximum space that can be used for spacing
    // Ensure we don't have negative available space
    const usableSpace = Math.max(0, availableSpace - BAR_SPACING_TOLERANCE * 2)

    // Calculate how many gaps we have
    const gaps = Math.max(1, data.length - 1)

    // Calculate the actual spacing to use (may be reduced if space is tight)
    const effectiveSpacing = Math.max(
      MIN_BAR_SPACING,
      Math.min(barSpacing, (usableSpace - data.length * 2) / gaps)
    )

    const totalSpacing = (data.length - 1) * effectiveSpacing
    const maxBarWidth = Math.max(1, (usableSpace - totalSpacing) / data.length)

    // Use the smaller of the requested barWidth or the maximum possible width
    return Math.min(barWidth, maxBarWidth)
  })

  // Calculate the actual spacing to use between bars (may be reduced from barSpacing)
  const effectiveBarSpacing = $derived.by(() => {
    if (data.length <= 1) return barSpacing

    const availableSpace =
      barPlottingType === 'vertical' ? plotAreaWidth : plotAreaHeight

    // Calculate maximum space that can be used for spacing
    const spaceForBars = data.length * optimalBarWidth
    const remainingSpace = Math.max(
      0,
      availableSpace - spaceForBars - 2 * BAR_SPACING_TOLERANCE
    )

    // Divide remaining space by number of gaps between bars
    const calculatedSpacing = remainingSpace / (data.length - 1)

    // Use minimum spacing if calculated spacing is too small
    return Math.max(MIN_BAR_SPACING, Math.min(barSpacing, calculatedSpacing))
  })

  // Calculate bar positions and dimensions
  const bars = $derived.by(() => {
    return data.map((item, index) => {
      // Use NO CLAMPING for bar length calculation to allow bars to overflow
      // if the user set a small max. We will clip them in drawBars.
      const scaledValue = scaleValue(item.value, false)
      const availableSpace =
        barPlottingType === 'vertical' ? plotAreaWidth : plotAreaHeight
      const totalBarWidth = data.length * optimalBarWidth
      const totalSpacing = (data.length - 1) * effectiveBarSpacing

      const startPosition =
        BAR_SPACING_TOLERANCE +
        Math.max(
          0,
          availableSpace -
            totalBarWidth -
            totalSpacing -
            2 * BAR_SPACING_TOLERANCE
        ) /
          2

      if (barPlottingType === 'vertical') {
        const y = effectiveTopMargin + marginTop + plotAreaHeight - scaledValue
        const h = scaledValue
        return {
          x:
            trueLeftMargin +
            startPosition +
            index * (optimalBarWidth + effectiveBarSpacing),
          y,
          width: optimalBarWidth,
          height: h,
          value: item.value,
          label: item.label,
          color: item.color,
        }
      } else {
        return {
          x: trueLeftMargin,
          y:
            effectiveTopMargin +
            marginTop +
            startPosition +
            index * (optimalBarWidth + effectiveBarSpacing),
          width: scaledValue,
          height: optimalBarWidth,
          value: item.value,
          label: item.label,
          color: item.color,
        }
      }
    })
  })

  // Compute layout for composable renderers
  const rendererLayout = $derived.by((): BarPlotLayout => {
    const fullCategoryWidth = data.length > 0
      ? (barPlottingType === 'vertical' ? plotAreaWidth : plotAreaHeight) / data.length
      : 0
    const items = bars.map((bar, index) => ({
      categoryCenter: barPlottingType === 'vertical'
        ? Math.floor(trueLeftMargin) + (index + 0.5) * fullCategoryWidth
        : Math.floor(effectiveTopMargin + marginTop) + (index + 0.5) * fullCategoryWidth,
      categoryWidth: fullCategoryWidth,
      data: data[index],
    }))

    return {
      plotLeft: Math.floor(trueLeftMargin),
      plotTop: Math.floor(effectiveTopMargin + marginTop),
      plotWidth: Math.floor(plotAreaWidth),
      plotHeight: Math.floor(plotAreaHeight),
      barPlottingType,
      timeline,
      items,
    }
  })

  // Render everything to canvas
  /**
   * Render pipeline (layer order matters):
   *  1. White base fill       — ensures multiply compositing is neutral on background
   *  2. Overlay backgrounds   — light gray fill showing stat region extent
   *  3. Category delimiters   — thin lines between AOI strips
   *  4. Beeswarm dots         — individual participant data points
   *  5. Statistical overlay   — mean/median/whiskers drawn with multiply blend mode
   *  ── clip boundary ──
   *  6. Plot outline + ticks  — border and axis tick marks (outside clip)
   *  7. Crosshair highlight   — hover feedback on AOI + value axis (above outline)
   *  8. Text labels           — AOI names, tick values, axis title
   */
  function renderCanvas() {
    beginCanvasDrawing(plot.canvasState, true)

    const ctx = plot.canvasState.context
    if (!ctx) return

    if (noMetric) {
      drawCanvasPlaceholder(ctx, width, height, METRIC_MISSING_MESSAGE)
      finishCanvasDrawing(plot.canvasState)
      return
    }

    const floorLeft = Math.floor(trueLeftMargin)
    const floorWidth = Math.floor(plotAreaWidth)
    const floorTop = Math.floor(effectiveTopMargin + marginTop)
    const floorHeight = Math.floor(plotAreaHeight)

    // --- Clipped data layers ---
    ctx.save()
    ctx.beginPath()
    ctx.rect(floorLeft, floorTop, floorWidth, floorHeight)
    ctx.clip()

    fillPlotAreaBackground(ctx, floorLeft, floorTop, floorWidth, floorHeight, 'white')

    drawOverlayBackgrounds(ctx, rendererLayout, statisticalOverlay)
    drawCategoryDelimiters(ctx, rendererLayout)
    drawBeeswarmPoints(ctx, rendererLayout)
    drawStatisticalOverlay(ctx, rendererLayout, statisticalOverlay)

    ctx.restore()

    // --- Unclipped chrome: ticks + border + labels ---
    const niceTicks = timeline.ticks.filter(t => t.isNice)
    const isVertical = barPlottingType === 'vertical'
    // Vertical: value axis runs top-to-bottom on left/right edges (0 at bottom,
    // so invert). Horizontal: value axis runs left-to-right on top/bottom edges.
    const valueTicks: PlotAreaTicks = isVertical
      ? {
          positions: niceTicks.map(t => 1 - t.position),
          labels: niceTicks.map(t => t.label),
        }
      : {
          positions: niceTicks.map(t => t.position),
          labels: niceTicks.map(t => t.label),
        }
    const positionsOnly = { positions: valueTicks.positions }
    drawPlotArea(ctx, {
      x: floorLeft,
      y: floorTop,
      width: floorWidth,
      height: floorHeight,
      ticks: isVertical
        ? { left: valueTicks, right: positionsOnly }
        : { bottom: valueTicks, top: positionsOnly },
    })
    drawCrosshairHighlight(ctx, floorLeft, floorTop, floorWidth, floorHeight)
    drawCategoryLabels(ctx, floorLeft, floorWidth, floorTop, floorHeight)

    if (barPlottingType === 'vertical') {
      drawYAxisMainLabel(ctx, axisLabel, floorLeft, floorTop, floorHeight, Math.floor(trueLeftMargin - 15))
    } else {
      drawXAxisLabel(ctx, axisLabel, floorLeft, floorWidth, floorTop + floorHeight, 35)
    }

    finishCanvasDrawing(plot.canvasState)
  }

  /** Draws the per-AOI category labels (axis of categories, one per bar). */
  function drawCategoryLabels(
    ctx: CanvasRenderingContext2D,
    leftX: number,
    plotWidth: number,
    plotTop: number,
    plotHeight: number
  ) {
    ctx.font = `${LABEL_FONT_SIZE}px ${FONT_PRIMARY.FAMILY}`
    ctx.fillStyle = FONT_PRIMARY.COLOR

    const isVertical = barPlottingType === 'vertical'
    ctx.textAlign = isVertical ? 'center' : 'right'
    ctx.textBaseline = 'middle'

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i]
      const layoutItem = rendererLayout.items[i]
      let text = bar.label
      let x, y

      if (isVertical) {
        text = truncateTextToPixelWidth(text, layoutItem.categoryWidth, LABEL_FONT_SIZE)
        x = alignToPixelCenter(layoutItem.categoryCenter)
        y = alignToPixelCenter(plotTop + plotHeight + CATEGORY_LABEL_OFFSET)
      } else {
        text = truncateTextToPixelWidth(text, trueLeftMargin, LABEL_FONT_SIZE)
        x = trueLeftMargin - ROW_LABEL_GAP
        y = alignToPixelCenter(layoutItem.categoryCenter)
      }

      ctx.fillText(text, x, y)
    }
  }

  // Draw crosshair highlight: AOI row highlight + value axis dashed line
  function drawCrosshairHighlight(
    ctx: CanvasRenderingContext2D,
    plotLeft: number,
    plotTop: number,
    plotWidth: number,
    plotHeight: number
  ) {
    if (hoveredBarIndex === null || mouseValuePx === null) return

    const item = rendererLayout.items[hoveredBarIndex]
    if (!item) return

    const isVertical = barPlottingType === 'vertical'
    const halfCat = item.categoryWidth / 2

    // 1. Light blue fill over hovered AOI column/row
    ctx.save()
    ctx.globalAlpha = HIGHLIGHT_FILL_ALPHA
    ctx.fillStyle = HIGHLIGHT_COLOR
    if (isVertical) {
      ctx.fillRect(item.categoryCenter - halfCat, plotTop, item.categoryWidth, plotHeight)
    } else {
      ctx.fillRect(plotLeft, item.categoryCenter - halfCat, plotWidth, item.categoryWidth)
    }
    ctx.restore()

    // 2. Blue dashed borders on category edges
    ctx.save()
    ctx.strokeStyle = HIGHLIGHT_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash(HIGHLIGHT_DASH)
    ctx.beginPath()
    if (isVertical) {
      const left = alignToPixelCenter(item.categoryCenter - halfCat)
      const right = alignToPixelCenter(item.categoryCenter + halfCat)
      ctx.moveTo(left, plotTop)
      ctx.lineTo(left, plotTop + plotHeight)
      ctx.moveTo(right, plotTop)
      ctx.lineTo(right, plotTop + plotHeight)
    } else {
      const top = alignToPixelCenter(item.categoryCenter - halfCat)
      const bottom = alignToPixelCenter(item.categoryCenter + halfCat)
      ctx.moveTo(plotLeft, top)
      ctx.lineTo(plotLeft + plotWidth, top)
      ctx.moveTo(plotLeft, bottom)
      ctx.lineTo(plotLeft + plotWidth, bottom)
    }
    ctx.stroke()
    ctx.restore()

    // 3. Dashed crosshair line on value axis
    ctx.save()
    ctx.strokeStyle = HIGHLIGHT_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash(HIGHLIGHT_DASH)
    ctx.beginPath()
    if (isVertical) {
      const y = alignToPixelCenter(mouseValuePx)
      ctx.moveTo(plotLeft, y)
      ctx.lineTo(plotLeft + plotWidth, y)
    } else {
      const x = alignToPixelCenter(mouseValuePx)
      ctx.moveTo(x, plotTop)
      ctx.lineTo(x, plotTop + plotHeight)
    }
    ctx.stroke()
    ctx.restore()
  }

  // --- Tooltip helpers ---

  function fmt(v: number): string {
    return v % 1 === 0 ? v.toString() : v.toFixed(2)
  }

  /** Find participant names whose data points are within pixel tolerance of the mouse cursor. */
  function findNearbyParticipants(
    values: number[],
    names: string[],
    mousePx: number,
    tolerancePx: number,
    layout: BarPlotLayout
  ): string[] {
    const result: string[] = []
    for (let i = 0; i < values.length; i++) {
      const name = names[i]
      if (!name) continue
      const px = valueToPixel(layout, values[i], true)
      if (Math.abs(px - mousePx) <= tolerancePx) {
        result.push(name)
      }
    }
    return result
  }

  // Synchronous hover and hit-test handler using usePlot coordinates
  function handlePlotMouseMove(mx: number | null, my: number | null, over: boolean) {
    if (!over || mx === null || my === null) {
      if (hoveredBarIndex !== null) {
        hoveredBarIndex = null
        mouseValuePx = null
        plot.hideTooltip(0)
        onDataHover(null)
        plot.setCursor('default')
        plot.scheduleRender()
      }
      return
    }

    plot.setCursor('crosshair')

    const isVertical = barPlottingType === 'vertical'
    
    // Store raw pixel position on value axis
    mouseValuePx = isVertical ? my : mx

    // Determine which AOI category the mouse is over
    const categoryPos = isVertical ? mx : my
    let newIndex: number | null = null
    for (let i = 0; i < rendererLayout.items.length; i++) {
      const item = rendererLayout.items[i]
      const half = item.categoryWidth / 2
      if (categoryPos >= item.categoryCenter - half && categoryPos <= item.categoryCenter + half) {
        newIndex = i
        break
      }
    }

    const changed = newIndex !== hoveredBarIndex
    hoveredBarIndex = newIndex

    if (newIndex !== null) {
      const dataItem = data[newIndex]
      const stats = dataItem.stats

      // Compute value at mouse position on the value axis
      const ratio = isVertical
        ? 1 - (my - plot.plotTop) / plot.plotAreaHeight
        : (mx - plot.plotLeft) / plot.plotAreaWidth
      const mouseValue = timeline.minValue + ratio * (timeline.maxValue - timeline.minValue)

      const tooltipContent: { key: string; value: string }[] = [
        { key: 'AOI', value: dataItem.label },
        { key: 'Value', value: fmt(mouseValue) },
      ]

      // Proximity-based participant detection
      const dotStyle = computeDotStyle(rendererLayout)
      const tolerance = dotStyle.radius
      const values = dataItem.individualValues
      const names = dataItem.individualParticipantNames

      if (values && names && values.length > 0) {
        const nearbyParticipants = findNearbyParticipants(
          values, names, mouseValuePx!, tolerance, rendererLayout
        )

        if (nearbyParticipants.length > 0) {
          const nameSet = new Set(names)
          const isMultiValueMetric = names.length > nameSet.size

          if (isMultiValueMetric) {
            const counts = new Map<string, number>()
            for (const n of nearbyParticipants) {
              counts.set(n, (counts.get(n) ?? 0) + 1)
            }
            const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
            const maxShow = 4
            for (let i = 0; i < Math.min(maxShow, sorted.length); i++) {
              const [name, count] = sorted[i]
              tooltipContent.push({
                key: i === 0 ? 'Nearby' : '',
                value: `${name} × ${count}`,
              })
            }
            if (sorted.length > maxShow) {
              tooltipContent.push({
                key: '',
                value: `+${sorted.length - maxShow} others`,
              })
            }
          } else {
            const unique = [...new Set(nearbyParticipants)]
            const maxShow = 4
            for (let i = 0; i < Math.min(maxShow, unique.length); i++) {
              tooltipContent.push({
                key: i === 0 ? 'Nearby' : '',
                value: unique[i],
              })
            }
            if (unique.length > maxShow) {
              tooltipContent.push({
                key: '',
                value: `+${unique.length - maxShow} others`,
              })
            }
          }
        } else if (stats && stats.count > 0) {
          tooltipContent.push(
            { key: 'Stats', value: `n = ${stats.count}` },
            { key: '', value: `x̄ = ${fmt(stats.mean)}` },
            { key: '', value: `x̃ = ${fmt(stats.median)}` },
            { key: '', value: `σ = ${fmt(stats.sd)}` },
            { key: '', value: `95% CI = ±${fmt(stats.sem * 1.96)}` },
          )
        }
      } else if (stats && stats.count > 0) {
        tooltipContent.push(
          { key: 'Stats', value: `n = ${stats.count}` },
          { key: '', value: `x̄ = ${fmt(stats.mean)}` },
          { key: '', value: `x̃ = ${fmt(stats.median)}` },
          { key: '', value: `σ = ${fmt(stats.sd)}` },
          { key: '', value: `95% CI = ±${fmt(stats.sem * 1.96)}` },
        )
      }

      // Position tooltip near mouse cursor (offset 15px from cursor)
      plot.showTooltip(
        'bar-crosshair',
        tooltipContent,
        mx,
        my,
        { x: 15, y: 15 },
        180
      )

      if (changed) onDataHover(dataItem)
    } else {
      plot.hideTooltip(0)
      if (changed) onDataHover(null)
    }

    plot.scheduleRender()
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: blockedRegions }}
  aria-label="Bar plot visualization"
></canvas>
