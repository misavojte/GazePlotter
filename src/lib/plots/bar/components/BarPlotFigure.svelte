<script lang="ts">
  import type { AdaptiveTimeline } from '$lib/plots/shared/class/AdaptiveTimeline'
  import {
    calculateLabelOffset,
    truncateTextToPixelWidth,
  } from '$lib/shared/utils/textUtils'
  import { updateTooltip } from '$lib/tooltip'
  import { onMount, untrack } from 'svelte'
  import { browser } from '$app/environment'
  import {
    createCanvasState,
    setupCanvas,
    resizeCanvas,
    getScaledMousePosition,
    getTooltipPosition,
    setupDpiChangeListeners,
    beginCanvasDrawing,
    finishCanvasDrawing,
    type CanvasState,
  } from '$lib/shared/utils/canvasUtils'

  // Layout constants
  const MARGIN = {
    TOP: 30,
    RIGHT: 20,
    BOTTOM: 30,
  }
  const LABEL_FONT_SIZE = 12
  const TICK_LENGTH = 5
  const GRID_COLOR = '#e0e0e0'
  const GRID_STROKE_WIDTH = 1
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

  // Calculate dynamic left margin based on plotting type and label lengths
  const trueLeftMargin = $derived(
    barPlottingType === 'horizontal'
      ? Math.min(150, calculateLabelOffset(data.map(item => item.label))) +
          marginLeft
      : Math.max(
          35,
          calculateLabelOffset(timeline.ticks.map(tick => tick.label))
        ) + marginLeft
  )

  const dynamicRightMargin = $derived.by(() => {
    if (barPlottingType !== 'horizontal') return MARGIN.RIGHT + marginRight

    const maxValue = Math.max(...data.map(d => d.value))
    const timelineMax = timeline.ticks[timeline.ticks.length - 1].value

    // Approximate initial plot area width (using current fixed right margin)
    const estimatedPlotAreaWidth =
      width - trueLeftMargin - MARGIN.RIGHT - marginRight

    // Simulate where the value label would appear
    const barEndX =
      trueLeftMargin + (maxValue / timelineMax) * estimatedPlotAreaWidth

    const labelText = maxValue.toString()
    const labelWidth = labelText.length * LABEL_FONT_SIZE * 0.6
    const labelRightEdge = barEndX + VALUE_LABEL_OFFSET + labelWidth

    const overflow = Math.max(0, labelRightEdge - width)

    return MARGIN.RIGHT + overflow + marginRight
  })

  // Calculate plot area dimensions
  const plotAreaWidth = $derived(width - trueLeftMargin - dynamicRightMargin)
  const plotAreaHeight = $derived(
    height - MARGIN.TOP - MARGIN.BOTTOM - marginTop - marginBottom
  )

  // Scale values to plot area using AdaptiveTimeline
  function scaleValue(value: number): number {
    const position = timeline.getPositionRatio(value)
    return barPlottingType === 'vertical'
      ? position * plotAreaHeight
      : position * plotAreaWidth
  }

  // Calculate optimal bar width based on available space
  const optimalBarWidth = $derived.by(() => {
    if (data.length === 0) return barWidth

    const availableSpace =
      barPlottingType === 'vertical' ? plotAreaWidth : plotAreaHeight

    // Calculate the actual spacing to use (may be reduced if space is tight)
    const effectiveSpacing = Math.max(
      MIN_BAR_SPACING,
      Math.min(
        barSpacing,
        (availableSpace - BAR_SPACING_TOLERANCE * 2) / (data.length + 1)
      )
    )

    const totalSpacing = (data.length - 1) * effectiveSpacing
    const maxBarWidth =
      (availableSpace - totalSpacing - 2 * BAR_SPACING_TOLERANCE) / data.length

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
    const remainingSpace =
      availableSpace - spaceForBars - 2 * BAR_SPACING_TOLERANCE

    // Divide remaining space by number of gaps between bars
    const calculatedSpacing = remainingSpace / (data.length - 1)

    // Use minimum spacing if calculated spacing is too small
    return Math.max(MIN_BAR_SPACING, Math.min(barSpacing, calculatedSpacing))
  })

  // Calculate bar positions and dimensions
  const bars = $derived.by(() => {
    return data.map((item, index) => {
      const scaledValue = scaleValue(item.value)
      const availableSpace =
        barPlottingType === 'vertical' ? plotAreaWidth : plotAreaHeight
      const totalBarWidth = data.length * optimalBarWidth
      const totalSpacing = (data.length - 1) * effectiveBarSpacing

      const startPosition =
        BAR_SPACING_TOLERANCE +
        (availableSpace -
          totalBarWidth -
          totalSpacing -
          2 * BAR_SPACING_TOLERANCE) /
          2

      if (barPlottingType === 'vertical') {
        return {
          x:
            trueLeftMargin +
            startPosition +
            index * (optimalBarWidth + effectiveBarSpacing),
          y: MARGIN.TOP + marginTop + plotAreaHeight - scaledValue,
          width: optimalBarWidth,
          height: scaledValue,
          value: item.value,
          label: item.label,
          color: item.color,
        }
      } else {
        return {
          x: trueLeftMargin,
          y:
            MARGIN.TOP +
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

  // Create a render scheduler function
  function scheduleRender() {
    if (!canvasState.renderScheduled && browser) {
      canvasState.renderScheduled = true
      requestAnimationFrame(() => {
        renderCanvas()
        canvasState.renderScheduled = false
      })
    }
  }

  // Setup canvas and context using our utilities
  function initCanvas() {
    if (!canvas) return

    // Initialize canvas with our utility
    canvasState = setupCanvas(canvasState, canvas, dpiOverride)

    // Resize and render initially
    canvasState = resizeCanvas(
      canvasState,
      width + marginLeft + marginRight,
      height + marginTop + marginBottom
    )
    renderCanvas()
  }

  // Render everything to canvas
  function renderCanvas() {
    beginCanvasDrawing(canvasState, true)

    // Get context from state
    const ctx = canvasState.context
    if (!ctx) return

    // Draw plot area border
    drawPlotBorder(ctx)

    // Draw grid lines
    drawGridLines(ctx)

    // Draw bars
    drawBars(ctx)

    // Draw value labels
    drawValueLabels(ctx)

    // Draw category labels
    drawCategoryLabels(ctx)

    // Draw axis ticks
    drawAxisTicks(ctx)

    // Draw tick labels
    drawTickLabels(ctx)

    // Finish drawing
    finishCanvasDrawing(canvasState)
  }

  // Draw plot area border
  function drawPlotBorder(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#ccc'
    ctx.lineWidth = 1
    ctx.strokeRect(
      trueLeftMargin,
      MARGIN.TOP + marginTop,
      plotAreaWidth,
      plotAreaHeight
    )
  }

  // Draw grid lines
  function drawGridLines(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = GRID_STROKE_WIDTH

    if (barPlottingType === 'vertical') {
      // Horizontal grid lines for vertical bars
      timeline.ticks
        .filter(tick => tick.isNice)
        .forEach(tick => {
          const y =
            MARGIN.TOP +
            marginTop +
            plotAreaHeight -
            tick.position * plotAreaHeight
          ctx.beginPath()
          ctx.moveTo(trueLeftMargin, y)
          ctx.lineTo(trueLeftMargin + plotAreaWidth, y)
          ctx.stroke()
        })
    } else {
      // Vertical grid lines for horizontal bars
      timeline.ticks
        .filter(tick => tick.isNice)
        .forEach(tick => {
          const x = trueLeftMargin + tick.position * plotAreaWidth
          ctx.beginPath()
          ctx.moveTo(x, MARGIN.TOP + marginTop)
          ctx.lineTo(x, MARGIN.TOP + marginTop + plotAreaHeight)
          ctx.stroke()
        })
    }
  }

  // Draw the bars
  function drawBars(ctx: CanvasRenderingContext2D) {
    // Draw each bar
    bars.forEach((bar, index) => {
      const style = getBarStyle(index, bar.color)
      ctx.fillStyle = style.fill
      ctx.fillRect(bar.x, bar.y, bar.width, bar.height)
    })
  }

  // Draw value labels
  function drawValueLabels(ctx: CanvasRenderingContext2D) {
    ctx.font = `${LABEL_FONT_SIZE}px sans-serif`
    ctx.fillStyle = '#000'

    bars.forEach(bar => {
      const text = bar.value.toString()
      let x, y, textAlign, textBaseline

      if (barPlottingType === 'vertical') {
        x = bar.x + bar.width / 2
        y = bar.y - VALUE_LABEL_OFFSET
        textAlign = 'center'
        textBaseline = 'alphabetic'
      } else {
        x = bar.x + bar.width + VALUE_LABEL_OFFSET
        y = bar.y + bar.height / 2
        textAlign = 'left'
        textBaseline = 'middle'
      }

      ctx.textAlign = textAlign as CanvasTextAlign
      ctx.textBaseline = textBaseline as CanvasTextBaseline
      ctx.fillText(text, x, y)
    })
  }

  // Draw category labels
  function drawCategoryLabels(ctx: CanvasRenderingContext2D) {
    ctx.font = `${LABEL_FONT_SIZE}px sans-serif`
    ctx.fillStyle = '#000'

    bars.forEach(bar => {
      let text = bar.label
      let x, y, textAlign, textBaseline

      if (barPlottingType === 'vertical') {
        // For vertical bars, truncate text based on pixel width
        text = truncateTextToPixelWidth(text, bar.width, LABEL_FONT_SIZE)

        x = bar.x + bar.width / 2
        y = MARGIN.TOP + marginTop + plotAreaHeight + CATEGORY_LABEL_OFFSET
        textAlign = 'center'
        textBaseline = 'middle'
      } else {
        // For horizontal bars, truncate text based on pixel width
        text = truncateTextToPixelWidth(text, trueLeftMargin, LABEL_FONT_SIZE)

        x = trueLeftMargin - VALUE_LABEL_OFFSET
        y = bar.y + bar.height / 2
        textAlign = 'right'
        textBaseline = 'middle'
      }

      ctx.textAlign = textAlign as CanvasTextAlign
      ctx.textBaseline = textBaseline as CanvasTextBaseline
      ctx.fillText(text, x, y)
    })
  }

  // Draw axis ticks
  function drawAxisTicks(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 1

    // Draw ticks
    if (barPlottingType === 'vertical') {
      timeline.ticks
        .filter(tick => tick.isNice)
        .forEach(tick => {
          const y =
            MARGIN.TOP +
            marginTop +
            plotAreaHeight -
            tick.position * plotAreaHeight
          ctx.beginPath()
          ctx.moveTo(trueLeftMargin - TICK_LENGTH, y)
          ctx.lineTo(trueLeftMargin, y)
          ctx.stroke()
        })
    } else {
      timeline.ticks
        .filter(tick => tick.isNice)
        .forEach(tick => {
          const x = trueLeftMargin + tick.position * plotAreaWidth
          ctx.beginPath()
          ctx.moveTo(x, MARGIN.TOP + marginTop + plotAreaHeight)
          ctx.lineTo(x, MARGIN.TOP + marginTop + plotAreaHeight + TICK_LENGTH)
          ctx.stroke()
        })
    }
  }

  // Draw tick labels
  function drawTickLabels(ctx: CanvasRenderingContext2D) {
    ctx.font = `${LABEL_FONT_SIZE}px sans-serif`
    ctx.fillStyle = '#000'

    timeline.ticks
      .filter(tick => tick.isNice)
      .forEach(tick => {
        let x, y, textAlign, textBaseline

        if (barPlottingType === 'vertical') {
          x = trueLeftMargin - VALUE_LABEL_OFFSET
          y =
            MARGIN.TOP +
            marginTop +
            plotAreaHeight -
            tick.position * plotAreaHeight
          textAlign = 'right'
          textBaseline = 'middle'
        } else {
          x = trueLeftMargin + tick.position * plotAreaWidth
          y = MARGIN.TOP + marginTop + plotAreaHeight + CATEGORY_LABEL_OFFSET
          textAlign = 'center'
          textBaseline = 'hanging'
        }

        ctx.textAlign = textAlign as CanvasTextAlign
        ctx.textBaseline = textBaseline as CanvasTextBaseline
        ctx.fillText(tick.label, x, y)
      })
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

  // Get style for bars based on hover state
  function getBarStyle(index: number, color: string) {
    return {
      fill: color,
    }
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
      if (canvasState.canvas && canvasState.context) {
        // Reset canvas state with new DPI override if needed
        if (canvasState.dpiOverride !== dpiOverride) {
          canvasState = setupCanvas(
            canvasState,
            canvasState.canvas,
            dpiOverride
          )
        }
        canvasState = resizeCanvas(
          canvasState,
          width + marginLeft + marginRight,
          height + marginTop + marginBottom
        )
        scheduleRender()
      }
    })
  })

  // Lifecycle hooks
  onMount(() => {
    if (canvas) {
      initCanvas()

      // Setup DPI and position change listeners with proper state management
      const cleanup = setupDpiChangeListeners(
        // State getter function that always returns the current state
        () => canvasState,
        // State setter function to properly update the state
        newState => {
          canvasState = newState
          // Resize with new pixel ratio if it changed
          if (canvasState.canvas) {
            canvasState = resizeCanvas(
              canvasState,
              width + marginLeft + marginRight,
              height + marginTop + marginBottom
            )
            renderCanvas() // Ensure canvas redraws after state update
          }
        },
        dpiOverride,
        renderCanvas
      )

      // Clean up event listeners and interval on destroy
      return () => {
        cleanup()
      }
    }
  })
</script>

<div class="plot-container">
  <canvas
    bind:this={canvas}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    aria-label="Bar plot visualization"
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
    max-width: 100%;
    max-height: 100%;
  }
</style>
