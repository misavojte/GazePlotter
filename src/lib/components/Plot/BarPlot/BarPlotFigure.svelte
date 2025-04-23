<script lang="ts">
  import type { AdaptiveTimeline } from '$lib/class/Plot/AdaptiveTimeline/AdaptiveTimeline'
  import { calculateLabelOffset } from '$lib/components/Plot/utils/textUtils'
  import { updateTooltip } from '$lib/stores/tooltipStore'
  import { onMount, onDestroy } from 'svelte'

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
  }: BarPlotFigureProps = $props()

  // State management
  let hoveredBarIndex = $state<number | null>(null)
  let lastMouseMoveTime = $state(0)
  const FRAME_TIME = 1000 / 30 // Throttle to 30fps

  // Canvas and rendering state
  let canvas = $state<HTMLCanvasElement | null>(null)
  let canvasCtx = $state<CanvasRenderingContext2D | null>(null)
  let pixelRatio = $state(1)
  let renderScheduled = $state(false)

  // Calculate dynamic left margin based on plotting type and label lengths
  const trueLeftMargin = $derived(
    barPlottingType === 'horizontal'
      ? Math.min(150, calculateLabelOffset(data.map(item => item.label)))
      : Math.max(
          35,
          calculateLabelOffset(timeline.ticks.map(tick => tick.label))
        )
  )

  // Calculate plot area dimensions
  const plotAreaWidth = $derived(width - trueLeftMargin - MARGIN.RIGHT)
  const plotAreaHeight = $derived(height - MARGIN.TOP - MARGIN.BOTTOM)

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
          y: MARGIN.TOP + plotAreaHeight - scaledValue,
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

  // Setup canvas and context
  function setupCanvas() {
    if (!canvas) return

    // Get the device pixel ratio or use override if provided
    pixelRatio =
      dpiOverride !== null ? dpiOverride / 96 : window.devicePixelRatio || 1

    // Get the canvas context
    canvasCtx = canvas.getContext('2d')
    if (!canvasCtx) return

    // Apply initial sizing
    resizeCanvas()

    // Render the initial state
    renderCanvas()
  }

  // Resize canvas to match container size and device pixel ratio
  function resizeCanvas() {
    if (!canvas || !canvasCtx) return

    // Set actual canvas dimensions (scaled for high DPI)
    canvas.width = width * pixelRatio
    canvas.height = height * pixelRatio

    // Set display size (css pixels)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  // Clear the canvas
  function clearCanvas() {
    if (!canvasCtx || !canvas) return
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Render everything to canvas
  function renderCanvas() {
    if (!canvasCtx || !canvas) return
    clearCanvas()

    // Scale all drawing operations by the device pixel ratio
    canvasCtx.save()
    canvasCtx.scale(pixelRatio, pixelRatio)

    // Draw plot area border
    drawPlotBorder()

    // Draw grid lines
    drawGridLines()

    // Draw bars
    drawBars()

    // Draw value labels
    drawValueLabels()

    // Draw category labels
    drawCategoryLabels()

    // Draw axis ticks
    drawAxisTicks()

    // Draw tick labels
    drawTickLabels()

    // Reset transformations
    canvasCtx.restore()
  }

  // Draw plot area border
  function drawPlotBorder() {
    if (!canvasCtx) return
    canvasCtx.strokeStyle = '#ccc'
    canvasCtx.lineWidth = 1
    canvasCtx.strokeRect(
      trueLeftMargin,
      MARGIN.TOP,
      plotAreaWidth,
      plotAreaHeight
    )
  }

  // Draw grid lines
  function drawGridLines() {
    if (!canvasCtx) return
    canvasCtx.strokeStyle = GRID_COLOR
    canvasCtx.lineWidth = GRID_STROKE_WIDTH

    if (barPlottingType === 'vertical') {
      // Horizontal grid lines for vertical bars
      timeline.ticks
        .filter(tick => tick.isNice)
        .forEach(tick => {
          const y = MARGIN.TOP + plotAreaHeight - tick.position * plotAreaHeight
          canvasCtx!.beginPath()
          canvasCtx!.moveTo(trueLeftMargin, y)
          canvasCtx!.lineTo(trueLeftMargin + plotAreaWidth, y)
          canvasCtx!.stroke()
        })
    } else {
      // Vertical grid lines for horizontal bars
      timeline.ticks
        .filter(tick => tick.isNice)
        .forEach(tick => {
          const x = trueLeftMargin + tick.position * plotAreaWidth
          canvasCtx!.beginPath()
          canvasCtx!.moveTo(x, MARGIN.TOP)
          canvasCtx!.lineTo(x, MARGIN.TOP + plotAreaHeight)
          canvasCtx!.stroke()
        })
    }
  }

  // Draw the bars
  function drawBars() {
    if (!canvasCtx) return

    // Draw each bar
    bars.forEach((bar, index) => {
      const style = getBarStyle(index, bar.color)
      canvasCtx!.fillStyle = style.fill
      canvasCtx!.fillRect(bar.x, bar.y, bar.width, bar.height)
    })
  }

  // Draw value labels
  function drawValueLabels() {
    if (!canvasCtx) return
    canvasCtx.font = `${LABEL_FONT_SIZE}px sans-serif`
    canvasCtx.fillStyle = '#000'

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

      canvasCtx!.textAlign = textAlign as CanvasTextAlign
      canvasCtx!.textBaseline = textBaseline as CanvasTextBaseline
      canvasCtx!.fillText(text, x, y)
    })
  }

  // Draw category labels
  function drawCategoryLabels() {
    if (!canvasCtx) return
    canvasCtx.font = `${LABEL_FONT_SIZE}px sans-serif`
    canvasCtx.fillStyle = '#000'

    bars.forEach(bar => {
      let text = bar.label
      let x, y, textAlign, textBaseline

      if (barPlottingType === 'vertical') {
        // For vertical bars, truncate text if needed
        const maxLength = Math.floor(bar.width / (LABEL_FONT_SIZE * 0.6))
        if (text.length > maxLength) {
          text = text.substring(0, maxLength - 3) + '...'
        }

        x = bar.x + bar.width / 2
        y = MARGIN.TOP + plotAreaHeight + CATEGORY_LABEL_OFFSET
        textAlign = 'center'
        textBaseline = 'middle'
      } else {
        // For horizontal bars, truncate text if needed
        if (text.length > 14) {
          text = text.substring(0, 11) + '...'
        }

        x = trueLeftMargin - VALUE_LABEL_OFFSET
        y = bar.y + bar.height / 2
        textAlign = 'right'
        textBaseline = 'middle'
      }

      canvasCtx!.textAlign = textAlign as CanvasTextAlign
      canvasCtx!.textBaseline = textBaseline as CanvasTextBaseline
      canvasCtx!.fillText(text, x, y)
    })
  }

  // Draw axis ticks
  function drawAxisTicks() {
    if (!canvasCtx) return
    canvasCtx.strokeStyle = '#666'
    canvasCtx.lineWidth = 1

    // Draw ticks
    if (barPlottingType === 'vertical') {
      timeline.ticks
        .filter(tick => tick.isNice)
        .forEach(tick => {
          const y = MARGIN.TOP + plotAreaHeight - tick.position * plotAreaHeight
          canvasCtx!.beginPath()
          canvasCtx!.moveTo(trueLeftMargin - TICK_LENGTH, y)
          canvasCtx!.lineTo(trueLeftMargin, y)
          canvasCtx!.stroke()
        })
    } else {
      timeline.ticks
        .filter(tick => tick.isNice)
        .forEach(tick => {
          const x = trueLeftMargin + tick.position * plotAreaWidth
          canvasCtx!.beginPath()
          canvasCtx!.moveTo(x, MARGIN.TOP + plotAreaHeight)
          canvasCtx!.lineTo(x, MARGIN.TOP + plotAreaHeight + TICK_LENGTH)
          canvasCtx!.stroke()
        })
    }
  }

  // Draw tick labels
  function drawTickLabels() {
    if (!canvasCtx) return
    canvasCtx.font = `${LABEL_FONT_SIZE}px sans-serif`
    canvasCtx.fillStyle = '#000'

    timeline.ticks
      .filter(tick => tick.isNice)
      .forEach(tick => {
        let x, y, textAlign, textBaseline

        if (barPlottingType === 'vertical') {
          x = trueLeftMargin - VALUE_LABEL_OFFSET
          y = MARGIN.TOP + plotAreaHeight - tick.position * plotAreaHeight
          textAlign = 'right'
          textBaseline = 'middle'
        } else {
          x = trueLeftMargin + tick.position * plotAreaWidth
          y = MARGIN.TOP + plotAreaHeight + CATEGORY_LABEL_OFFSET
          textAlign = 'center'
          textBaseline = 'hanging'
        }

        canvasCtx!.textAlign = textAlign as CanvasTextAlign
        canvasCtx!.textBaseline = textBaseline as CanvasTextBaseline
        canvasCtx!.fillText(tick.label, x, y)
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
    const rect = canvas.getBoundingClientRect()
    const mouseX = (event.clientX - rect.left) / pixelRatio
    const mouseY = (event.clientY - rect.top) / pixelRatio

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

      // Calculate tooltip position
      const idealX = rect.left + bar.x + bar.width + 10
      const idealY = rect.top + bar.y + window.scrollY

      updateTooltip({
        x: idealX,
        y: idealY,
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

  // Create a render scheduler
  function scheduleRender() {
    if (!renderScheduled) {
      renderScheduled = true
      requestAnimationFrame(() => {
        if (canvas && canvasCtx) {
          resizeCanvas()
          renderCanvas()
        }
        renderScheduled = false
      })
    }
  }

  // Watch for changes in props and re-render
  $effect(() => {
    if (canvas && canvasCtx) {
      scheduleRender()
    }
  })

  // Watch for changes in dpiOverride
  $effect(() => {
    if (canvas && canvasCtx && dpiOverride !== null) {
      pixelRatio = dpiOverride / 96
      resizeCanvas()
      renderCanvas()
    }
  })

  // Lifecycle hooks
  onMount(() => {
    setupCanvas()
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
