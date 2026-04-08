<script lang="ts">
  import {
    GRIDLINE_PRIMARY,
    FONT_PRIMARY,
    type AdaptiveTimeline,
    getTimelinePositionRatio,
    drawPlotOutline,
    drawYAxisMainLabel,
    drawXAxisLabel,
    useCanvasPlot,
  } from '$lib/plots/shared'
  import {
    calculateLabelOffset,
    truncateTextToPixelWidth,
  } from '$lib/shared/utils/textUtils'
  import { updateTooltip } from '$lib/tooltip'
  import { untrack } from 'svelte'
  import {
    getScaledMousePosition,
    getTooltipPosition,
    beginCanvasDrawing,
    finishCanvasDrawing,
    alignToPixelCenter,
    canvasLifecycleAction,
  } from '$lib/plots/shared/canvasUtils'
  import type { StatisticalOverlayType } from '$lib/plots/bar/types'
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

  type BarPlotFigureProps = {
    width: number
    height: number
    data: {
      value: number
      label: string
      color: string
      stats?: { count: number; mean: number; median: number; sd: number; sem: number } | null
      individualValues?: number[] | null
      individualParticipantNames?: string[] | null
    }[]
    timeline: AdaptiveTimeline
    axisLabel: string
    barPlottingType: 'horizontal' | 'vertical'
    barWidth: number
    barSpacing: number
    onDataHover: (
      data: { value: number; label: string; color: string } | null
    ) => void
    statisticalOverlay?: StatisticalOverlayType
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
  }: BarPlotFigureProps = $props()

  // Crosshair / hover constants
  const HIGHLIGHT_COLOR = '#007acc'
  const HIGHLIGHT_FILL_ALPHA = 0.2
  const HIGHLIGHT_DASH = [2, 2]

  // State management
  let hoveredBarIndex = $state<number | null>(null)
  let mouseValuePx = $state<number | null>(null) // pixel position on value axis
  let lastMouseMoveTime = $state(0)
  const FRAME_TIME = 1000 / 30 // Throttle to 30fps

  let canvas = $state<HTMLCanvasElement | null>(null)

  const plot = useCanvasPlot({
    render: renderCanvas,
    getWidth: () => width,
    getHeight: () => height,
    getMargins: () => ({ top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }),
    getDpiOverride: () => dpiOverride,
  })

  $effect(() => plot.registerExportSource(() => canvas))

  // Calculate dynamic margins
  const effectiveTopMargin = $derived(
    barPlottingType === 'horizontal' ? TICK_LENGTH : MARGIN.TOP
  )

  // Calculate dynamic left margin based on plotting type and label lengths
  const trueLeftMargin = $derived(
    Math.floor(
      Math.min(
        width * 0.4, // Safety cap: never take more than 40% of width
        barPlottingType === 'horizontal'
          ? Math.min(
              150,
              calculateLabelOffset(data.map(item => item.label)) +
                VALUE_LABEL_OFFSET
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

  const dynamicRightMargin = $derived.by(() => {
    if (barPlottingType !== 'horizontal') return MARGIN.RIGHT + marginRight

    const values = data.map(d => d.value)
    if (values.length === 0) return MARGIN.RIGHT + marginRight

    const maxValue = Math.max(0, ...values)
    const timelineMax = timeline.maxValue || 1

    // 1. Calculate a stable estimate for the plot area width
    const estimatedPlotAreaWidth = Math.max(
      100,
      width - trueLeftMargin - MARGIN.RIGHT - marginRight
    )

    // 2. Calculate the bar end X position, CAPPING it at the estimated plot area width.
    // This is the KEY fix: if maxValue > timelineMax, we assume the bar is clipped
    // and its label should ideally appear at the edge of the plot area, not miles away.
    const clippedValueRatio = Math.min(1, maxValue / timelineMax)
    const barEndX = trueLeftMargin + clippedValueRatio * estimatedPlotAreaWidth

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

  // Calculate plot area dimensions - Ensure at least 1px to avoid layout collapse
  const plotAreaWidth = $derived(
    Math.max(1, Math.floor(width - trueLeftMargin - dynamicRightMargin))
  )
  const plotAreaHeight = $derived(
    Math.max(
      1,
      Math.floor(
        height - effectiveTopMargin - MARGIN.BOTTOM - marginTop - marginBottom
      )
    )
  )

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
      data: data[index] as any,
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

    const floorLeft = Math.floor(trueLeftMargin)
    const floorWidth = Math.floor(plotAreaWidth)
    const floorTop = Math.floor(effectiveTopMargin + marginTop)
    const floorHeight = Math.floor(plotAreaHeight)

    // --- Clipped data layers ---
    ctx.save()
    ctx.beginPath()
    ctx.rect(floorLeft, floorTop, floorWidth, floorHeight)
    ctx.clip()

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(floorLeft, floorTop, floorWidth, floorHeight)

    drawOverlayBackgrounds(ctx, rendererLayout, statisticalOverlay)
    drawCategoryDelimiters(ctx, rendererLayout)
    drawBeeswarmPoints(ctx, rendererLayout)
    drawStatisticalOverlay(ctx, rendererLayout, statisticalOverlay)

    ctx.restore()

    // --- Unclipped chrome: border, ticks, labels ---
    drawPlotOutline(ctx, floorLeft, floorTop, floorWidth, floorHeight)
    drawCrosshairHighlight(ctx, floorLeft, floorTop, floorWidth, floorHeight)
    drawAxisTicks(ctx, floorLeft, floorWidth, floorTop, floorHeight)
    drawAllTextElements(ctx, floorLeft, floorWidth, floorTop, floorHeight)

    if (barPlottingType === 'vertical') {
      drawYAxisMainLabel(ctx, axisLabel, floorLeft, floorTop, floorHeight, Math.floor(trueLeftMargin - 15))
    } else {
      drawXAxisLabel(ctx, axisLabel, floorLeft, floorWidth, floorTop + floorHeight, 35)
    }

    finishCanvasDrawing(plot.canvasState)
  }

  /** Draws tick marks on both sides of the value axis (outside the plot border). */
  function drawAxisTicks(
    ctx: CanvasRenderingContext2D,
    leftX: number,
    plotWidth: number,
    plotTop: number,
    plotHeight: number
  ) {
    const ticks = timeline.ticks.filter(tick => tick.isNice)
    ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
    ctx.lineWidth = GRIDLINE_PRIMARY.WIDTH

    if (barPlottingType === 'vertical') {
      const rightX = leftX + plotWidth
      ticks.forEach(tick => {
        const y = alignToPixelCenter(
          plotTop + plotHeight - tick.position * plotHeight
        )
        // Left ticks
        ctx.beginPath()
        ctx.moveTo(leftX - TICK_LENGTH, y)
        ctx.lineTo(leftX, y)
        ctx.stroke()
        // Right ticks
        ctx.beginPath()
        ctx.moveTo(rightX, y)
        ctx.lineTo(rightX + TICK_LENGTH, y)
        ctx.stroke()
      })
    } else {
      ticks.forEach(tick => {
        const x = alignToPixelCenter(leftX + tick.position * plotWidth)
        // Bottom ticks
        ctx.beginPath()
        ctx.moveTo(x, plotTop + plotHeight)
        ctx.lineTo(x, plotTop + plotHeight + TICK_LENGTH)
        ctx.stroke()
        // Top ticks
        ctx.beginPath()
        ctx.moveTo(x, plotTop)
        ctx.lineTo(x, plotTop - TICK_LENGTH)
        ctx.stroke()
      })
    }
  }

  // Draw all text elements in one optimized function
  function drawAllTextElements(
    ctx: CanvasRenderingContext2D,
    leftX: number,
    plotWidth: number,
    plotTop: number,
    plotHeight: number
  ) {
    ctx.font = `${LABEL_FONT_SIZE}px ${FONT_PRIMARY.FAMILY}`
    ctx.fillStyle = FONT_PRIMARY.COLOR

    const isVertical = barPlottingType === 'vertical'

    // Draw category labels — aligned to renderer layout centers (where dots are)
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
        x = trueLeftMargin - VALUE_LABEL_OFFSET
        y = alignToPixelCenter(layoutItem.categoryCenter)
      }

      ctx.fillText(text, x, y)
    }

    // Draw tick labels
    for (const tick of timeline.ticks) {
      if (!tick.isNice) continue

      let x, y, textAlign, textBaseline

      if (isVertical) {
        x = leftX - VALUE_LABEL_OFFSET
        y = alignToPixelCenter(
          plotTop + plotHeight - tick.position * plotHeight
        )
        textAlign = 'right'
        textBaseline = 'middle'
      } else {
        x = alignToPixelCenter(leftX + tick.position * plotWidth)
        y = plotTop + plotHeight + CATEGORY_LABEL_OFFSET
        textAlign = 'center'
        textBaseline = 'hanging'
      }

      ctx.textAlign = textAlign as CanvasTextAlign
      ctx.textBaseline = textBaseline as CanvasTextBaseline
      ctx.fillText(tick.label, x, y)
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

  // Event handlers
  function handleMouseMove(event: MouseEvent) {
    const currentTime = performance.now()
    if (currentTime - lastMouseMoveTime < FRAME_TIME) {
      return
    }
    lastMouseMoveTime = currentTime

    if (!canvas) return

    const { x: mouseX, y: mouseY } = getScaledMousePosition(plot.canvasState, event)

    const isVertical = barPlottingType === 'vertical'
    const floorLeft = Math.floor(trueLeftMargin)
    const floorTop = Math.floor(effectiveTopMargin + marginTop)
    const floorWidth = Math.floor(plotAreaWidth)
    const floorHeight = Math.floor(plotAreaHeight)

    // Check if mouse is inside the plot area
    const inPlot =
      mouseX >= floorLeft &&
      mouseX <= floorLeft + floorWidth &&
      mouseY >= floorTop &&
      mouseY <= floorTop + floorHeight

    if (!inPlot) {
      if (hoveredBarIndex !== null) {
        hoveredBarIndex = null
        mouseValuePx = null
        updateTooltip(null)
        onDataHover(null)
        if (canvas) canvas.style.cursor = 'default'
        plot.scheduleRender()
      }
      return
    }

    if (canvas) canvas.style.cursor = 'crosshair'

    // Store raw pixel position on value axis
    mouseValuePx = isVertical ? mouseY : mouseX

    // Determine which AOI category the mouse is over
    const categoryPos = isVertical ? mouseX : mouseY
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
        ? 1 - (mouseY - floorTop) / floorHeight
        : (mouseX - floorLeft) / floorWidth
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
          // Check if this is a multi-value-per-participant metric
          const nameSet = new Set(names)
          const isMultiValueMetric = names.length > nameSet.size

          if (isMultiValueMetric) {
            // Group by participant, show "name × count", ordered by count
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
            // One value per participant — show first 4 by order, then others
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

      // Anchor tooltip to AOI strip edge: below row (horizontal) or right of column (vertical)
      const hoveredItem = rendererLayout.items[newIndex]
      const stripEdge = hoveredItem.categoryCenter + hoveredItem.categoryWidth / 2
      const TOOLTIP_GAP = 8
      const tooltipPos = getTooltipPosition(
        plot.canvasState,
        isVertical ? stripEdge + TOOLTIP_GAP : mouseX,
        isVertical ? mouseY : stripEdge + TOOLTIP_GAP,
        { x: 0, y: 0 }
      )

      updateTooltip({
        id: 'bar-crosshair',
        x: tooltipPos.x,
        y: tooltipPos.y,
        content: tooltipContent,
        visible: true,
        width: 180,
      }, 0)

      if (changed) onDataHover(dataItem)
    } else {
      updateTooltip(null)
      if (changed) onDataHover(null)
    }

    plot.scheduleRender()
  }

  function handleMouseLeave() {
    hoveredBarIndex = null
    mouseValuePx = null
    updateTooltip(null)
    onDataHover(null)
    if (canvas) canvas.style.cursor = 'default'
    plot.scheduleRender()
  }

  // Track data changes and schedule renders
  $effect(() => {
    const _ = [data, width, height, timeline, barPlottingType, barWidth, barSpacing, statisticalOverlay, dpiOverride, marginTop, marginRight, marginBottom, marginLeft]
    untrack(() => plot.refresh())
  })
</script>

<canvas
  bind:this={canvas}
  use:canvasLifecycleAction={plot.actionOptions}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  aria-label="Bar plot visualization"
></canvas>
