<script lang="ts">
  import {
    GRIDLINE_SECONDARY,
    GRIDLINE_PRIMARY,
    FONT_PRIMARY,
    type AdaptiveTimeline,
    getTimelinePositionRatio,
    drawPlotOutline,
    drawYAxisMainLabel,
    drawXAxisLabel,
  } from '$lib/plots/shared'
  import {
    calculateLabelOffset,
    truncateTextToPixelWidth,
  } from '$lib/shared/utils/textUtils'
  import { updateTooltip } from '$lib/tooltip'
  import { getContext, untrack } from 'svelte'
  import {
    EXPORT_SOURCE_CONTEXT,
    type ExportSourceRegistrar,
    registerCanvasExportSource,
  } from '$lib/data/export'
  import {
    createCanvasState,
    getScaledMousePosition,
    getTooltipPosition,
    beginCanvasDrawing,
    finishCanvasDrawing,
    alignToPixelCenter,
    createRenderScheduler,
    canvasLifecycleAction,
    refreshCanvasLifecycle,
    strokeCrispRect,
    type CanvasState,
  } from '$lib/plots/shared/canvasUtils'

  // Layout constants
  const MARGIN = {
    TOP: 30,
    RIGHT: 20,
    BOTTOM: 50,
  }
  const LABEL_FONT_SIZE = FONT_PRIMARY.SIZE
  const TICK_LENGTH = 5
  // GRID_COLOR and GRID_STROKE_WIDTH removed in favor of shared constants
  const BAR_SPACING_TOLERANCE = 20 // Additional spacing on both sides
  const VALUE_LABEL_OFFSET = 5 // Space between bar and value label
  const CATEGORY_LABEL_OFFSET = 15 // Space between plot area and category labels
  const MIN_BAR_SPACING = 2 // Minimum spacing between bars when space is limited

  type BarPlotFigureProps = {
    width: number
    height: number
    data: {
      value: number
      label: string
      color: string
    }[]
    timeline: AdaptiveTimeline
    axisLabel: string
    barPlottingType: 'horizontal' | 'vertical'
    barWidth: number
    barSpacing: number
    onDataHover: (
      data: { value: number; label: string; color: string } | null
    ) => void
    dpiOverride?: number | null // Override for DPI settings when exporting
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
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
  }: BarPlotFigureProps = $props()

  // State management
  let hoveredBarIndex = $state<number | null>(null)
  let lastMouseMoveTime = $state(0)
  const FRAME_TIME = 1000 / 30 // Throttle to 30fps

  // Canvas and rendering state using our utility
  let canvas = $state<HTMLCanvasElement | null>(null)
  let canvasState = $state<CanvasState>(createCanvasState())

  const exportRegistrar = getContext<ExportSourceRegistrar | undefined>(
    EXPORT_SOURCE_CONTEXT
  )

  $effect(() => {
    return registerCanvasExportSource(exportRegistrar, () => canvas)
  })

  const getCanvasDimensions = () => ({
    width: width + marginLeft + marginRight,
    height: height + marginTop + marginBottom,
  })

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

  const scheduleRender = createRenderScheduler(() => canvasState, renderCanvas)

  // Render everything to canvas
  function renderCanvas() {
    beginCanvasDrawing(canvasState, true)

    // Get context from state
    const ctx = canvasState.context
    if (!ctx) return

    // Set up common context properties once
    setupContextProperties(ctx)

    // Floor dimensions for pixel-perfect synchronization
    const floorLeft = Math.floor(trueLeftMargin)
    const floorWidth = Math.floor(plotAreaWidth)
    const floorTop = Math.floor(effectiveTopMargin + marginTop)
    const floorHeight = Math.floor(plotAreaHeight)
    const floorBottom = floorTop + floorHeight

    // Draw plot area border
    drawPlotOutline(ctx, floorLeft, floorTop, floorWidth, floorHeight)

    // Draw grid lines
    drawGridLines(ctx, floorLeft, floorWidth, floorTop, floorHeight)

    // Draw bars
    drawBars(ctx)

    // Draw all text elements (value labels, category labels, tick labels)
    drawAllTextElements(ctx, floorLeft, floorWidth, floorTop, floorHeight)

    // Draw main axis labels
    if (barPlottingType === 'vertical') {
      drawYAxisMainLabel(
        ctx,
        axisLabel,
        floorLeft,
        floorTop,
        floorHeight,
        Math.floor(trueLeftMargin - 15)
      )
    } else {
      drawXAxisLabel(ctx, axisLabel, floorLeft, floorWidth, floorBottom, 35)
    }

    // Finish drawing
    finishCanvasDrawing(canvasState)
  }

  // Set up common context properties once to avoid repeated assignments
  function setupContextProperties(ctx: CanvasRenderingContext2D) {
    // Set up stroke properties for grid lines and axis ticks
    ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
    ctx.lineWidth = GRIDLINE_PRIMARY.WIDTH
  }

  // Draw grid lines
  function drawGridLines(
    ctx: CanvasRenderingContext2D,
    leftX: number,
    plotWidth: number,
    plotTop: number,
    plotHeight: number
  ) {
    // Context properties already set in setupContextProperties()
    if (barPlottingType === 'vertical') {
      const ticks = timeline.ticks.filter(tick => tick.isNice)

      // Draw ticks (primary)
      ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
      ctx.lineWidth = GRIDLINE_PRIMARY.WIDTH
      ticks.forEach(tick => {
        const y = alignToPixelCenter(
          plotTop + plotHeight - tick.position * plotHeight
        )
        ctx.beginPath()
        ctx.moveTo(leftX - TICK_LENGTH, y)
        ctx.lineTo(leftX, y)
        ctx.stroke()
      })
    } else {
      const ticks = timeline.ticks.filter(tick => tick.isNice)

      // Draw ticks (primary)
      ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
      ctx.lineWidth = GRIDLINE_PRIMARY.WIDTH
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

  // Draw the bars
  function drawBars(ctx: CanvasRenderingContext2D) {
    const floorLeft = Math.floor(trueLeftMargin)
    const floorWidth = Math.floor(plotAreaWidth)
    const floorTop = Math.floor(effectiveTopMargin + marginTop)
    const floorHeight = Math.floor(plotAreaHeight)

    // Clip bars to the plot area to prevent overflow over axes or labels
    ctx.save()
    ctx.beginPath()
    ctx.rect(floorLeft, floorTop, floorWidth, floorHeight)
    ctx.clip()

    // bars already contains all calculated positions and dimensions
    for (const bar of bars) {
      ctx.fillStyle = bar.color
      ctx.fillRect(
        alignToPixelCenter(bar.x),
        alignToPixelCenter(bar.y),
        Math.floor(bar.width),
        Math.floor(bar.height)
      )
    }
    ctx.restore()
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

    // Draw value labels
    ctx.textAlign = isVertical ? 'center' : 'left'
    ctx.textBaseline = isVertical ? 'alphabetic' : 'middle'

    for (const bar of bars) {
      const text = bar.value.toString()

      // Calculate label position, capping the X to the plot area bounds if needed
      // so labels don't disappear miles to the right in horizontal mode.
      const labelX = isVertical
        ? alignToPixelCenter(bar.x + bar.width / 2)
        : Math.min(
            leftX + plotWidth + VALUE_LABEL_OFFSET,
            bar.x + bar.width + VALUE_LABEL_OFFSET
          )

      const y = isVertical
        ? bar.y - VALUE_LABEL_OFFSET
        : alignToPixelCenter(bar.y + bar.height / 2)

      ctx.fillText(text, labelX, y)
    }

    // Draw category labels
    ctx.textAlign = isVertical ? 'center' : 'right'
    ctx.textBaseline = 'middle'

    for (const bar of bars) {
      let text = bar.label
      let x, y

      if (isVertical) {
        text = truncateTextToPixelWidth(text, bar.width, LABEL_FONT_SIZE)
        x = alignToPixelCenter(bar.x + bar.width / 2)
        y = alignToPixelCenter(plotTop + plotHeight + CATEGORY_LABEL_OFFSET)
      } else {
        text = truncateTextToPixelWidth(text, trueLeftMargin, LABEL_FONT_SIZE)
        x = trueLeftMargin - VALUE_LABEL_OFFSET
        y = alignToPixelCenter(bar.y + bar.height / 2)
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

  // Event handlers
  function handleMouseMove(event: MouseEvent) {
    const currentTime = performance.now()
    if (currentTime - lastMouseMoveTime < FRAME_TIME) {
      return
    }
    lastMouseMoveTime = currentTime

    if (!canvas) return

    // Get properly scaled mouse position
    const { x: mouseX, y: mouseY } = getScaledMousePosition(canvasState, event)

    // Find hovered bar
    const hoveredIndex = bars.findIndex(bar => {
      return (
        mouseX >= bar.x &&
        mouseX <= bar.x + bar.width &&
        mouseY >= bar.y &&
        mouseY <= bar.y + bar.height
      )
    })

    if (hoveredIndex !== -1 && hoveredIndex !== hoveredBarIndex) {
      hoveredBarIndex = hoveredIndex
      const bar = bars[hoveredIndex]

      // Calculate tooltip position using utility
      const tooltipPos = getTooltipPosition(
        canvasState,
        bar.x + bar.width,
        bar.y,
        { x: 10, y: 0 }
      )

      updateTooltip({
        id: 'bar-plot-tooltip',
        x: tooltipPos.x,
        y: tooltipPos.y,
        content: [
          { key: 'Label', value: bar.label },
          { key: 'Value', value: bar.value.toString() },
        ],
        visible: true,
        width: 150,
      })

      onDataHover(data[hoveredIndex])

      // Request render in case we want to highlight the bar
      scheduleRender()
    } else if (hoveredIndex === -1 && hoveredBarIndex !== null) {
      hoveredBarIndex = null
      updateTooltip(null)
      onDataHover(null)

      // Request render to remove any highlights
      scheduleRender()
    }
  }

  function handleMouseLeave() {
    hoveredBarIndex = null
    updateTooltip(null)
    onDataHover(null)

    // Request render to remove any highlights
    scheduleRender()
  }

  // Track data changes and schedule renders
  $effect(() => {
    // Just track the data dependencies
    const _ = [
      data,
      timeline,
      barPlottingType,
      barWidth,
      barSpacing,
      dpiOverride,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
    ]

    untrack(() => {
      refreshCanvasLifecycle({
        getState: () => canvasState,
        setState: newState => {
          canvasState = newState
        },
        getDimensions: getCanvasDimensions,
        getDpiOverride: () => dpiOverride,
        scheduleRender,
      })
    })
  })

</script>

<canvas
  bind:this={canvas}
  use:canvasLifecycleAction={{
    getState: () => canvasState,
    setState: newState => {
      canvasState = newState
    },
    getDimensions: getCanvasDimensions,
    getDpiOverride: () => dpiOverride,
    render: renderCanvas,
    scheduleRender,
  }}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  aria-label="Bar plot visualization"
></canvas>
