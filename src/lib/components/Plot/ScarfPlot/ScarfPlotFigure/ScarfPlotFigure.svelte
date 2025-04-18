<!-- @migration-task Error while migrating Svelte code: Can't migrate code with afterUpdate. Please migrate by hand. -->
<script lang="ts">
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType'
  import type { ScarfGridType } from '$lib/type/gridType'
  import { addInfoToast } from '$lib/stores/toastStore'
  import ScarfPlotLegend from '$lib/components/Plot/ScarfPlot/ScarfPlotLegend/ScarfPlotLegend.svelte'
  import SvgText from '$lib/components/Plot/SvgText.svelte'
  import { calculateLabelOffset } from '$lib/components/Plot/utils/textUtils'
  import { draggable } from '$lib/actions/draggable'

  // CONSTANTS - layout dimensions and styling
  const LAYOUT = {
    LEFT_LABEL_MAX_WIDTH: 125, // Width for participant labels
    AXIS_LABEL_HEIGHT: 30, // Height for the x-axis label
    LEGEND_HEIGHT: 100, // Height for the legend
    LABEL_FONT_SIZE: 12, // Font size for labels
    PADDING: 0, // General padding
    RIGHT_MARGIN: 15, // Right margin to prevent tick label cropping
    MIN_CHART_HEIGHT: 50, // Minimum chart height
    TICK_LENGTH: 5, // Length of axis ticks
    AXIS_OFFSET: 12, // Offset for axis labels
    GRID_COLOR: '#cbcbcb', // Color for grid lines
    GRID_STROKE_WIDTH: 1, // Stroke width for grid lines
    LEGEND_ITEM_WIDTH: 100, // Width of each legend item
    LEGEND_ITEM_HEIGHT: 15, // Height of each legend item
    LEGEND_ITEMS_PER_ROW: 3, // Number of legend items per row
  }

  interface Props {
    tooltipAreaElement: HTMLElement | SVGElement | null
    data: ScarfFillingType
    settings: ScarfGridType
    highlightedIdentifier: string | null
    onLegendClick: (identifier: string) => void
    onTooltipActivation: ({
      segmentOrderId,
      participantId,
      x,
      y,
    }: {
      segmentOrderId: number
      participantId: number
      x: number
      y: number
    }) => void
    onTooltipDeactivation: () => void
    onDragStepX?: (stepChange: number) => void
    chartWidth: number
  }

  // Component props using Svelte 5 $props rune
  let {
    tooltipAreaElement,
    data,
    settings,
    highlightedIdentifier = null,
    onLegendClick = () => {},
    onTooltipActivation = () => {},
    onTooltipDeactivation = () => {},
    onDragStepX = () => {},
    chartWidth = 0,
  }: Props = $props()

  // Calculate legend height based on content
  function calculateLegendHeight(): number {
    if (!data.stylingAndLegend) return LAYOUT.LEGEND_HEIGHT

    const LEGEND_CONFIG = {
      TITLE_HEIGHT: 18,
      ITEM_HEIGHT: LAYOUT.LEGEND_ITEM_HEIGHT,
      ITEM_PADDING: 4,
      ITEM_PER_ROW: LAYOUT.LEGEND_ITEMS_PER_ROW,
      GROUP_SPACING: 10,
    }

    // Calculate row counts for each section
    const aoiRows = Math.ceil(
      data.stylingAndLegend.aoi.length / LEGEND_CONFIG.ITEM_PER_ROW
    )
    const categoryRows = Math.ceil(
      data.stylingAndLegend.category.length / LEGEND_CONFIG.ITEM_PER_ROW
    )
    const visibilityRows =
      data.stylingAndLegend.visibility.length > 0
        ? Math.ceil(
            data.stylingAndLegend.visibility.length / LEGEND_CONFIG.ITEM_PER_ROW
          )
        : 0

    // Calculate total height with spacing
    const groupCount = visibilityRows > 0 ? 3 : 2
    const totalRows = aoiRows + categoryRows + visibilityRows

    return (
      LEGEND_CONFIG.TITLE_HEIGHT * groupCount +
      totalRows * (LEGEND_CONFIG.ITEM_HEIGHT + LEGEND_CONFIG.ITEM_PADDING) +
      (groupCount - 1) * LEGEND_CONFIG.GROUP_SPACING +
      LAYOUT.PADDING
    )
  }

  const LEFT_LABEL_WIDTH = $derived(
    // use calculateLabelOffset to calculate the width of the participant labels
    calculateLabelOffset(
      data.participants.map(p => p.label),
      LAYOUT.LABEL_FONT_SIZE
    ) + 10
  )

  // State management with Svelte 5 runes
  let fixedHighlight = $state<string | null>(null)
  let isDragging = $state(false) // New state to track if actively dragging
  let isHoveringSegment = $state(false) // Track if hovering or recently hovering a segment
  let hoverTimeout: number | null = $state(null) // Timeout ID

  // Derived values using Svelte 5 $derived rune
  const usedHighlight = $derived(fixedHighlight ?? highlightedIdentifier)
  const xAxisLabel = $derived(getXAxisLabel(settings))
  const scarfPlotAreaId = $derived(`scarf-plot-area-${settings.id}`)

  // SVG size calculations - MOVE THESE BEFORE RECTANGLE/LINE CALCULATIONS
  const totalWidth = $derived(chartWidth)

  // Track the currently hovered segment
  let currentHoveredSegment = $state<{
    participantId: string | number
    orderId: number
  } | null>(null)

  // Calculate actual plot area width (without label area and with right margin)
  const plotAreaWidth = $derived(
    Math.max(
      0,
      chartWidth - LEFT_LABEL_WIDTH - LAYOUT.PADDING * 2 - LAYOUT.RIGHT_MARGIN
    )
  )

  const chartHeight = $derived(
    Math.max(data.chartHeight, LAYOUT.MIN_CHART_HEIGHT)
  )

  const legendHeight = $derived(calculateLegendHeight())

  const totalHeight = $derived(
    chartHeight + LAYOUT.AXIS_LABEL_HEIGHT + legendHeight
  )

  // Style lookup maps for efficient style access - O(1) instead of O(n)
  const rectStyleMap = $derived.by(() => {
    if (!data.stylingAndLegend) return new Map()

    const map = new Map()

    // Pre-compute all rectangle styles (AOI and category)
    ;[...data.stylingAndLegend.aoi, ...data.stylingAndLegend.category].forEach(
      style => {
        map.set(style.identifier, { fill: style.color })
      }
    )

    return map
  })

  const lineStyleMap = $derived.by(() => {
    if (!data.stylingAndLegend) return new Map()

    const map = new Map()

    // Pre-compute all line styles (visibility)
    data.stylingAndLegend.visibility.forEach(style => {
      map.set(style.identifier, {
        stroke: style.color,
        strokeWidth: style.height,
        strokeDasharray: '1',
      })
    })

    return map
  })

  // Helper functions for calculating styles - now with O(1) lookups
  function getStyleForRect(
    identifier: string,
    isHighlighted: boolean
  ): { fill: string; opacity?: number; stroke?: string; strokeWidth?: number } {
    // Get pre-computed style or fallback
    const baseStyle = rectStyleMap.get(identifier) || { fill: '#ccc' }

    // Apply highlighting effects
    if (usedHighlight) {
      if (identifier === usedHighlight) {
        // This is the highlighted element
        return {
          ...baseStyle,
          stroke: '#333333',
          strokeWidth: 0.5,
        }
      } else {
        // This is not the highlighted element
        return {
          ...baseStyle,
          opacity: 0.15,
        }
      }
    }

    return baseStyle
  }

  function getStyleForLine(
    identifier: string,
    isHighlighted: boolean
  ): {
    stroke: string
    strokeWidth: number
    opacity?: number
    strokeDasharray?: string
    strokeLinecap?: 'butt' | 'inherit' | 'round' | 'square' | null
  } {
    // Get pre-computed style or fallback
    const baseStyle = lineStyleMap.get(identifier) || {
      stroke: '#ccc',
      strokeWidth: 1,
    }

    // Apply highlighting effects
    if (usedHighlight) {
      if (identifier === usedHighlight) {
        // This is the highlighted element
        return {
          stroke: baseStyle.stroke,
          strokeWidth: 3,
          strokeLinecap: 'butt',
          strokeDasharray: 'none',
        }
      } else {
        // This is not the highlighted element
        return {
          ...baseStyle,
          opacity: 0.15,
        }
      }
    }

    return baseStyle
  }

  // Separate derived stores for rectangle and line segments
  const rectangleSegments = $derived.by(() => {
    // Guard against plotAreaWidth not being initialized
    if (!plotAreaWidth) return []

    return data.participants.flatMap((participant, participantIndex) => {
      const isOrdinal = settings.timeline === 'ordinal'
      const isAbsolute = settings.timeline === 'absolute'
      const pWidth = isAbsolute ? participant.width : undefined
      const y0 = participantIndex * data.heightOfBarWrap

      return participant.segments.flatMap((segment, segmentId) =>
        segment.content.map(rectangle => {
          const identifier = rectangle.identifier
          const isHighlighted = identifier === usedHighlight
          const style = getStyleForRect(identifier, isHighlighted)

          return {
            identifier: identifier, // Keep identifier for event handling
            height: rectangle.height,
            x:
              LEFT_LABEL_WIDTH +
              (isOrdinal ? getSegmentX(rectangle.x) : getSegmentX(rectangle.x)),
            y: y0 + rectangle.y,
            width: isOrdinal
              ? getSegmentWidth(rectangle.width)
              : getSegmentWidth(rectangle.width),
            participantId: participant.id,
            segmentId,
            orderId: rectangle.orderId,
            // Include style properties
            fill: style.fill,
            opacity: style.opacity,
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
          }
        })
      )
    })
  })

  const lineSegments = $derived.by(() => {
    // Guard against plotAreaWidth not being initialized
    if (!plotAreaWidth) return []

    return data.participants.flatMap((participant, participantIndex) => {
      const isOrdinal = settings.timeline === 'ordinal'
      const isAbsolute = settings.timeline === 'absolute'
      const pWidth = isAbsolute ? participant.width : undefined
      const y0 = participantIndex * data.heightOfBarWrap

      // Don't process lines in ordinal mode
      if (isOrdinal) return []

      return participant.dynamicAoiVisibility.flatMap(visibility => {
        return visibility.content.map(item => {
          const identifier = item.identifier
          const isHighlighted = identifier === usedHighlight
          const style = getStyleForLine(identifier, isHighlighted)

          return {
            identifier: identifier, // Keep identifier for event handling
            x1: LEFT_LABEL_WIDTH + getVisibilityLineX(item.x1, pWidth),
            y1: y0 + item.y,
            x2: LEFT_LABEL_WIDTH + getVisibilityLineX(item.x2, pWidth),
            y2: y0 + item.y,
            participantId: participant.id,
            // Include style properties
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            opacity: style.opacity,
            strokeDasharray: style.strokeDasharray,
            strokeLinecap: style.strokeLinecap,
          }
        })
      })
    })
  })

  // Helper functions
  function getTimelineUnit(settings: ScarfGridType): string {
    return settings.timeline === 'relative' ? '%' : 'ms'
  }

  function getXAxisLabel(settings: ScarfGridType): string {
    return settings.timeline === 'ordinal'
      ? 'Order index'
      : `Elapsed time [${getTimelineUnit(settings)}]`
  }

  function getSegmentX(x: number): number {
    if (!plotAreaWidth) return 0

    // All calculations now use the numeric value directly
    return x * plotAreaWidth
  }

  function getSegmentWidth(width: number): number {
    if (!plotAreaWidth) return 0

    // All calculations now use the numeric value directly
    return width * plotAreaWidth
  }

  function getVisibilityLineX(x: number, participantWidth?: number): number {
    if (!plotAreaWidth) return 0

    if (settings.timeline === 'ordinal') {
      return 0 // Not applicable in ordinal mode
    } else {
      // Cap at 1.0 (100%)
      const xValue = Math.min(x, 1.0)
      return xValue * plotAreaWidth
    }
  }

  // Interaction handlers
  function handleFixedHighlight(identifier: string) {
    if (fixedHighlight === identifier) {
      // If already highlighted, clear it
      fixedHighlight = null
      highlightedIdentifier = null
      return
    }

    // Otherwise, set the fixed highlight
    fixedHighlight = identifier
    addInfoToast(`Highlight fixed. Click the same item in the legend to remove`)
  }

  function handleLegendIdentifier(identifier: string) {
    // Handle both local fixed highlight and external app state
    handleFixedHighlight(identifier)
    onLegendClick(identifier)
  }

  // Custom handlers for mouse events
  function handleMouseMove(event: MouseEvent) {
    // Get mouse position relative to the SVG
    const svgElement = event.currentTarget as SVGElement
    const svgRect = svgElement.getBoundingClientRect()
    const mouseX = event.clientX - svgRect.left
    const mouseY = event.clientY - svgRect.top

    // Find the segment under the mouse pointer using rectangleSegments data
    const hoveredSegment = rectangleSegments.find(
      rect =>
        mouseX >= rect.x &&
        mouseX <= rect.x + rect.width &&
        mouseY >= rect.y &&
        mouseY <= rect.y + rect.height
    )

    // If hovering over a new segment, log it
    if (
      hoveredSegment &&
      (!currentHoveredSegment ||
        hoveredSegment.participantId !== currentHoveredSegment.participantId ||
        hoveredSegment.orderId !== currentHoveredSegment.orderId)
    ) {
      currentHoveredSegment = {
        participantId: hoveredSegment.participantId,
        orderId: hoveredSegment.orderId,
      }

      // Set hovering state to true
      isHoveringSegment = true

      // Clear any existing timeout
      if (hoverTimeout !== null) {
        window.clearTimeout(hoverTimeout)
        hoverTimeout = null
      }

      const XUnderTheRect = event.clientX + window.scrollX + 5
      const YUnderTheRect =
        hoveredSegment.y +
        hoveredSegment.height +
        svgRect.top +
        window.scrollY +
        5

      onTooltipActivation({
        segmentOrderId: hoveredSegment.orderId,
        participantId: hoveredSegment.participantId,
        x: XUnderTheRect,
        y: YUnderTheRect,
      })
    } else if (!hoveredSegment && currentHoveredSegment) {
      // If moved out of a segment but still in SVG
      currentHoveredSegment = null
      onTooltipDeactivation()

      // Set delayed reset of hovering state
      if (hoverTimeout !== null) {
        window.clearTimeout(hoverTimeout)
      }

      hoverTimeout = window.setTimeout(() => {
        isHoveringSegment = false
        hoverTimeout = null
      }, 150) // Keep default cursor for 150ms after leaving segment
    }
  }

  function handleMouseLeave() {
    // If there was a hovered segment, log that hover has stopped
    if (currentHoveredSegment) {
      currentHoveredSegment = null
      onTooltipDeactivation()

      // Set delayed reset of hovering state
      if (hoverTimeout !== null) {
        window.clearTimeout(hoverTimeout)
      }

      hoverTimeout = window.setTimeout(() => {
        isHoveringSegment = false
        hoverTimeout = null
      }, 150) // Keep default cursor for 150ms after leaving segment
    }
  }

  // Handlers for drag events
  function handleDragStepX(stepChangeX: number, stepChangeY: number) {
    if (!isDragging) isDragging = true
    onDragStepX(stepChangeX)
  }

  function handleDragEnd() {
    isDragging = false
  }
</script>

<!-- Container for dynamic styles and the plot -->
<figure class="plot-container" id={scarfPlotAreaId}>
  <svg
    class="scarf-plot-figure"
    width={totalWidth}
    height={totalHeight}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    bind:this={tooltipAreaElement}
    data-component="scarfplot"
    role="img"
    aria-label="Scarf plot visualization"
  >
    <!-- Participant Labels (Left Side) -->
    <g class="participants-labels">
      {#each data.participants as participant, i}
        <SvgText
          text={participant.label}
          x={LAYOUT.PADDING}
          y={i * data.heightOfBarWrap + data.heightOfBarWrap / 2}
          fontSize={LAYOUT.LABEL_FONT_SIZE}
          textAnchor="start"
          dominantBaseline="middle"
          className="participant-label"
        />
      {/each}
    </g>

    <!-- Horizontal Grid Lines and Data -->
    <path
      d={data.participants
        .map((_, i) => {
          const y = i * data.heightOfBarWrap + 0.5
          return `M ${LEFT_LABEL_WIDTH},${y} H ${LEFT_LABEL_WIDTH + plotAreaWidth}`
        })
        .join(' ')}
      stroke={LAYOUT.GRID_COLOR}
      stroke-width={LAYOUT.GRID_STROKE_WIDTH}
      fill="none"
    />

    <!-- Main Chart Area - Now with draggable action -->
    <g class="chart-area" class:isHiglighted={highlightedIdentifier}>
      <!-- Timeline Axis Labels -->
      <g class="timeline-labels">
        {#if data.timeline.ticks.length > 0}
          {#each data.timeline.ticks as tick}
            <!-- Only show label text if it's a nice tick -->
            {#if tick.isNice}
              <SvgText
                text={tick.label}
                x={LEFT_LABEL_WIDTH + tick.position * plotAreaWidth}
                y={data.chartHeight - LAYOUT.AXIS_OFFSET}
                dominantBaseline="hanging"
                textAnchor="middle"
              />
            {/if}
          {/each}
        {/if}
      </g>

      <!-- X-Axis Ticks and Bottom Border Line -->
      <path
        d={`
            ${data.timeline.ticks
              .map(tick => {
                const x = LEFT_LABEL_WIDTH + tick.position * plotAreaWidth
                const y1 = data.participants.length * data.heightOfBarWrap - 0.5
                const y2 = y1 + LAYOUT.TICK_LENGTH
                return `M ${x},${y1} V ${y2}`
              })
              .join(' ')}
            M ${LEFT_LABEL_WIDTH},${data.participants.length * data.heightOfBarWrap - 0.5}
            H ${LEFT_LABEL_WIDTH + plotAreaWidth}
          `}
        stroke={LAYOUT.GRID_COLOR}
        stroke-width="1.5"
        fill="none"
      />

      <!-- Render rectangles from derived store -->
      <g class="all-rectangles">
        {#each rectangleSegments as rect}
          <rect
            height={rect.height}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            fill={rect.fill}
            opacity={rect.opacity}
            stroke={rect.stroke}
            stroke-width={rect.strokeWidth}
          />
        {/each}
      </g>

      <!-- Render lines from derived store -->
      <g class="all-lines">
        {#each lineSegments as line}
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.stroke}
            stroke-width={line.strokeWidth}
            opacity={line.opacity}
            stroke-dasharray={line.strokeDasharray}
            stroke-linecap={line.strokeLinecap}
          />
        {/each}
      </g>

      <!-- Draggable overlay rectangle -->
      <rect
        class="drag-overlay"
        class:dragging={isDragging}
        class:hovering-segment={isHoveringSegment}
        x={LEFT_LABEL_WIDTH}
        y={0}
        width={plotAreaWidth}
        height={data.participants.length * data.heightOfBarWrap}
        fill="transparent"
        use:draggable={{
          minDragDistance: 1,
          onDragStep: handleDragStepX,
          onDragFinished: handleDragEnd,
        }}
      />

      <!-- X-Axis Label -->
      <SvgText
        text={xAxisLabel}
        x={LEFT_LABEL_WIDTH + plotAreaWidth / 2}
        y={chartHeight + 15}
        textAnchor="middle"
        fontSize={LAYOUT.LABEL_FONT_SIZE}
        className="x-axis-label"
      />
    </g>

    <!-- Legend Section - Using ScarfPlotLegend component -->
    {#if data.stylingAndLegend}
      <ScarfPlotLegend
        filling={data.stylingAndLegend}
        onlegendIdentifier={handleLegendIdentifier}
        availableWidth={totalWidth}
        fixedItemWidth={LAYOUT.LEGEND_ITEM_WIDTH}
        itemsPerRow={0}
        x={LAYOUT.PADDING}
        y={chartHeight + LAYOUT.AXIS_LABEL_HEIGHT}
        highlightedIdentifier={usedHighlight}
      />
    {/if}
  </svg>
</figure>

<style>
  .plot-container {
    margin: 0;
    padding: 0;
    cursor: default;
    display: flex;
    flex-direction: column;
  }

  .scarf-plot-figure {
    font-family: sans-serif;
    display: block;
  }

  /* Cursor styles for draggable overlay */
  .drag-overlay {
    cursor: grab;
  }

  .drag-overlay.dragging {
    cursor: grabbing;
  }

  .drag-overlay.hovering-segment {
    cursor: default;
  }
</style>
