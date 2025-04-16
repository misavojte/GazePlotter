<script lang="ts">
  import type { AdaptiveTimeline } from '$lib/class/Plot/AdaptiveTimeline/AdaptiveTimeline'
  import SvgText from '$lib/components/Plot/SvgText.svelte'
  import { calculateLabelOffset } from '$lib/components/Plot/utils/textUtils'
  import { updateTooltip } from '$lib/stores/tooltipStore'

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
  }: BarPlotFigureProps = $props()

  // State management
  let hoveredBarIndex = $state<number | null>(null)
  let lastMouseMoveTime = $state(0)
  const FRAME_TIME = 1000 / 30 // Throttle to 30fps

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
    const totalSpacing = (data.length - 1) * barSpacing
    const maxBarWidth =
      (availableSpace - totalSpacing - 2 * BAR_SPACING_TOLERANCE) / data.length

    // Use the smaller of the requested barWidth or the maximum possible width
    return Math.min(barWidth, maxBarWidth)
  })

  // Calculate bar positions and dimensions
  const bars = $derived.by(() => {
    return data.map((item, index) => {
      const scaledValue = scaleValue(item.value)
      const totalSpacing = (data.length - 1) * barSpacing
      const availableSpace =
        barPlottingType === 'vertical' ? plotAreaWidth : plotAreaHeight
      const totalBarWidth = data.length * optimalBarWidth
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
            index * (optimalBarWidth + barSpacing),
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
            MARGIN.TOP + startPosition + index * (optimalBarWidth + barSpacing),
          width: scaledValue,
          height: optimalBarWidth,
          value: item.value,
          label: item.label,
          color: item.color,
        }
      }
    })
  })

  // Event handlers
  function handleMouseMove(event: MouseEvent) {
    const currentTime = performance.now()
    if (currentTime - lastMouseMoveTime < FRAME_TIME) {
      return
    }
    lastMouseMoveTime = currentTime

    const svg = event.currentTarget as SVGSVGElement
    const rect = svg.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

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
    } else if (hoveredIndex === -1 && hoveredBarIndex !== null) {
      hoveredBarIndex = null
      updateTooltip(null)
      onDataHover(null)
    }
  }

  function handleMouseLeave() {
    hoveredBarIndex = null
    updateTooltip(null)
    onDataHover(null)
  }

  // Get style for bars based on hover state
  function getBarStyle(index: number, color: string) {
    return {
      fill: color,
    }
  }
</script>

<div class="plot-container">
  <svg
    {width}
    {height}
    style="background: transparent;"
    viewBox="0 0 {width} {height}"
    preserveAspectRatio="xMidYMid meet"
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    role="img"
    aria-label="Bar plot visualization"
  >
    <!-- Main border for the plot area -->
    <rect
      x={trueLeftMargin}
      y={MARGIN.TOP}
      width={plotAreaWidth}
      height={plotAreaHeight}
      fill="none"
      stroke="#ccc"
      stroke-width="1"
    />

    <!-- Grid lines -->
    {#if barPlottingType === 'vertical'}
      <path
        d={timeline.ticks
          .filter(tick => tick.isNice)
          .map(tick => {
            const y =
              MARGIN.TOP + plotAreaHeight - tick.position * plotAreaHeight
            return `M ${trueLeftMargin},${y} H ${trueLeftMargin + plotAreaWidth}`
          })
          .join(' ')}
        stroke={GRID_COLOR}
        stroke-width={GRID_STROKE_WIDTH}
        fill="none"
      />
    {:else}
      <path
        d={timeline.ticks
          .filter(tick => tick.isNice)
          .map(tick => {
            const x = trueLeftMargin + tick.position * plotAreaWidth
            return `M ${x},${MARGIN.TOP} V ${MARGIN.TOP + plotAreaHeight}`
          })
          .join(' ')}
        stroke={GRID_COLOR}
        stroke-width={GRID_STROKE_WIDTH}
        fill="none"
      />
    {/if}

    <!-- Bars -->
    <g class="bars">
      {#each bars as bar, index}
        {@const style = getBarStyle(index, bar.color)}
        <rect
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={bar.height}
          fill={style.fill}
        />
      {/each}
    </g>

    <!-- Value labels -->
    {#each bars as bar, index}
      <SvgText
        text={bar.value.toString()}
        x={barPlottingType === 'vertical'
          ? bar.x + bar.width / 2
          : bar.x + bar.width + VALUE_LABEL_OFFSET}
        y={barPlottingType === 'vertical'
          ? bar.y - VALUE_LABEL_OFFSET
          : bar.y + bar.height / 2}
        textAnchor={barPlottingType === 'vertical' ? 'middle' : 'start'}
        dominantBaseline={barPlottingType === 'vertical'
          ? 'text-after-edge'
          : 'middle'}
        fontSize={LABEL_FONT_SIZE}
      />
    {/each}

    <!-- Category labels -->
    {#each bars as bar, index}
      <SvgText
        text={bar.label}
        x={barPlottingType === 'vertical'
          ? bar.x + bar.width / 2
          : trueLeftMargin - VALUE_LABEL_OFFSET}
        y={barPlottingType === 'vertical'
          ? MARGIN.TOP + plotAreaHeight + CATEGORY_LABEL_OFFSET
          : bar.y + bar.height / 2}
        textAnchor={barPlottingType === 'vertical' ? 'middle' : 'end'}
        dominantBaseline="middle"
        fontSize={LABEL_FONT_SIZE}
        maxLength={barPlottingType === 'vertical'
          ? Math.floor(bar.width / (LABEL_FONT_SIZE * 0.6))
          : 14}
        truncate={true}
      />
    {/each}

    <!-- Axis ticks -->
    {#if barPlottingType === 'vertical'}
      <path
        d={timeline.ticks
          .filter(tick => tick.isNice)
          .map(tick => {
            const y =
              MARGIN.TOP + plotAreaHeight - tick.position * plotAreaHeight
            return `M ${trueLeftMargin - TICK_LENGTH},${y} H ${trueLeftMargin}`
          })
          .join(' ')}
        stroke="#666"
        stroke-width="1"
        fill="none"
      />
    {:else}
      <path
        d={timeline.ticks
          .filter(tick => tick.isNice)
          .map(tick => {
            const x = trueLeftMargin + tick.position * plotAreaWidth
            return `M ${x},${MARGIN.TOP + plotAreaHeight} V ${MARGIN.TOP + plotAreaHeight + TICK_LENGTH}`
          })
          .join(' ')}
        stroke="#666"
        stroke-width="1"
        fill="none"
      />
    {/if}

    <!-- Tick labels -->
    {#each timeline.ticks as tick}
      {#if tick.isNice}
        <SvgText
          text={tick.label}
          x={barPlottingType === 'vertical'
            ? trueLeftMargin - VALUE_LABEL_OFFSET
            : trueLeftMargin + tick.position * plotAreaWidth}
          y={barPlottingType === 'vertical'
            ? MARGIN.TOP + plotAreaHeight - tick.position * plotAreaHeight
            : MARGIN.TOP + plotAreaHeight + CATEGORY_LABEL_OFFSET}
          textAnchor={barPlottingType === 'vertical' ? 'end' : 'middle'}
          dominantBaseline={barPlottingType === 'vertical'
            ? 'middle'
            : 'hanging'}
          fontSize={LABEL_FONT_SIZE}
        />
      {/if}
    {/each}
  </svg>
</div>

<style>
  .plot-container {
    position: relative;
    width: 100%;
    height: 100%;
  }
</style>
