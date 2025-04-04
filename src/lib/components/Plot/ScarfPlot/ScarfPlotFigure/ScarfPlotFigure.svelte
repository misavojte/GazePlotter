<!-- @migration-task Error while migrating Svelte code: Can't migrate code with afterUpdate. Please migrate by hand. -->
<script lang="ts">
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType'
  import type { ScarfGridType } from '$lib/type/gridType'
  import { generateScarfPlotCSS } from '$lib/utils/scarfPlotTransformations'
  import { addInfoToast } from '$lib/stores/toastStore'
  import ScarfPlotLegend from '$lib/components/Plot/ScarfPlot/ScarfPlotLegend/ScarfPlotLegend.svelte'
  import SvgText from '$lib/components/Plot/SvgText.svelte'
  import { calculateLabelOffset } from '$lib/components/Plot/utils/textUtils'

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
    onmousemove?: (event: MouseEvent) => void
    onmouseleave?: (event: MouseEvent) => void
    onpointerdown?: (event: PointerEvent) => void
    chartWidth: number
  }

  // Component props using Svelte 5 $props rune
  let {
    tooltipAreaElement,
    data,
    settings,
    highlightedIdentifier = null,
    onLegendClick = () => {},
    onmousemove = () => {},
    onmouseleave = () => {},
    onpointerdown = () => {},
    chartWidth = 0,
  }: Props = $props()

  console.log('chartWidth', chartWidth)
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

  // Derived values using Svelte 5 $derived rune
  const usedHighlight = $derived(fixedHighlight ?? highlightedIdentifier)
  const xAxisLabel = $derived(getXAxisLabel(settings))
  const scarfPlotAreaId = $derived(`scarf-plot-area-${settings.id}`)

  // SVG size calculations
  const totalWidth = $derived(chartWidth)

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

  // Style management
  const styleInputs = $derived({
    id: settings.id,
    data: data.stylingAndLegend,
    highlight: usedHighlight,
  })

  const dynamicStyle = $derived(
    generateScarfPlotCSS(scarfPlotAreaId, data.stylingAndLegend, usedHighlight)
  )

  // Apply styles when component updates
  $effect(() => {
    const styleElement = document.querySelector(`#${scarfPlotAreaId} style`)
    if (styleElement) {
      styleElement.textContent = dynamicStyle
        .replace('<style>', '')
        .replace('</style>', '')
    }
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

  // Calculation functions for positioning elements
  function getAbsoluteX(value: number): number {
    if (!plotAreaWidth) return 0
    return data.timeline.getPositionRatio(value) * plotAreaWidth
  }

  function getSegmentX(
    x: string,
    segmentIndex?: number,
    participantWidth?: string
  ): number {
    if (!plotAreaWidth) return 0

    if (settings.timeline === 'ordinal' && typeof segmentIndex === 'number') {
      // Ordinal timeline - position by segment index
      const totalSegments = data.timeline.maxValue || 1
      return (segmentIndex / totalSegments) * plotAreaWidth
    } else if (settings.timeline === 'absolute' && participantWidth) {
      // Absolute timeline - calculate based on participant width
      const participantWidthPercent = parseFloat(participantWidth)
      const segmentXPercent = parseFloat(x)
      const actualParticipantWidth =
        (participantWidthPercent / 100) * plotAreaWidth
      return (segmentXPercent / 100) * actualParticipantWidth
    } else {
      // Relative timeline - direct percentage calculation
      return (parseFloat(x) / 100) * plotAreaWidth
    }
  }

  function getSegmentWidth(
    width: string,
    segmentIndex?: number,
    participantWidth?: string
  ): number {
    if (!plotAreaWidth) return 0

    if (settings.timeline === 'ordinal' && typeof segmentIndex === 'number') {
      // Ordinal timeline - equal widths for all segments
      const totalSegments = data.timeline.maxValue || 1
      return plotAreaWidth / totalSegments
    } else if (settings.timeline === 'absolute' && participantWidth) {
      // Absolute timeline - scaled by participant width
      const participantWidthPercent = parseFloat(participantWidth)
      const segmentWidthPercent = parseFloat(width)
      const actualParticipantWidth =
        (participantWidthPercent / 100) * plotAreaWidth
      return (segmentWidthPercent / 100) * actualParticipantWidth
    } else {
      // Relative timeline - direct percentage calculation
      return (parseFloat(width) / 100) * plotAreaWidth
    }
  }

  function getVisibilityLineX(x: string, participantWidth?: string): number {
    if (!plotAreaWidth) return 0

    if (settings.timeline === 'ordinal') {
      return 0 // Not applicable in ordinal mode
    } else if (settings.timeline === 'absolute' && participantWidth) {
      // Absolute timeline - scale within participant width
      const participantWidthPercent = parseFloat(participantWidth)
      const xPercent = Math.min(parseFloat(x), 100) // Cap at 100%
      const actualParticipantWidth =
        (participantWidthPercent / 100) * plotAreaWidth
      return (xPercent / 100) * actualParticipantWidth
    } else {
      // Relative timeline - cap at 100% of chart width
      return (Math.min(parseFloat(x), 100) / 100) * plotAreaWidth
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
</script>

<!-- Container for dynamic styles and the plot -->
<figure class="plot-container" id={scarfPlotAreaId}>
  {#key styleInputs}
    {@html dynamicStyle}
  {/key}

  <svg
    class="scarf-plot-figure"
    width={totalWidth}
    height={totalHeight}
    {onmousemove}
    {onmouseleave}
    {onpointerdown}
    bind:this={tooltipAreaElement}
    data-component="scarfplot"
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

    <!-- Main Chart Area -->
    <g class="chart-area" class:isHiglighted={highlightedIdentifier}>
      {#key data.participants}
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

        <!-- X-Axis Ticks - Always show all ticks -->
        <g class="axis-ticks">
          {#if data.timeline.ticks.length > 0}
            {#each data.timeline.ticks as tick}
              <line
                x1={LEFT_LABEL_WIDTH + tick.position * plotAreaWidth}
                y1={data.participants.length * data.heightOfBarWrap - 0.5}
                x2={LEFT_LABEL_WIDTH + tick.position * plotAreaWidth}
                y2={data.participants.length * data.heightOfBarWrap +
                  LAYOUT.TICK_LENGTH}
                stroke={LAYOUT.GRID_COLOR}
                stroke-width="1.5"
              />
            {/each}
          {/if}
        </g>

        <!-- Horizontal Grid Lines and Data -->
        {#each data.participants as participant, i}
          <!-- Horizontal Grid Line -->
          <line
            x1={LEFT_LABEL_WIDTH}
            x2={LEFT_LABEL_WIDTH + plotAreaWidth}
            y1={i * data.heightOfBarWrap + 0.5}
            y2={i * data.heightOfBarWrap + 0.5}
            stroke={LAYOUT.GRID_COLOR}
            stroke-width={LAYOUT.GRID_STROKE_WIDTH}
          />

          <!-- Participant Segments -->
          <g
            class="participant-segments"
            data-id={participant.id}
            data-participant="true"
          >
            {#each participant.segments as segment, segmentId}
              <g data-id={segmentId} data-segment="true">
                {#each segment.content as rectangle}
                  {@const isOrdinal = settings.timeline === 'ordinal'}
                  {@const isAbsolute = settings.timeline === 'absolute'}
                  {@const pWidth = isAbsolute ? participant.width : undefined}

                  <rect
                    class={rectangle.identifier}
                    height={rectangle.height}
                    x={LEFT_LABEL_WIDTH +
                      (isOrdinal
                        ? getSegmentX(rectangle.x, segmentId)
                        : getSegmentX(rectangle.x, undefined, pWidth))}
                    y={i * data.heightOfBarWrap + rectangle.y}
                    width={isOrdinal
                      ? getSegmentWidth(rectangle.width, segmentId)
                      : getSegmentWidth(rectangle.width, undefined, pWidth)}
                  />
                {/each}
              </g>
            {/each}

            <!-- AOI Visibility Lines -->
            {#each participant.dynamicAoiVisibility as visibility}
              {#each visibility.content as visibilityItem}
                {@const isAbsolute = settings.timeline === 'absolute'}
                {@const isOrdinal = settings.timeline === 'ordinal'}
                {@const pWidth = isAbsolute ? participant.width : undefined}

                <!-- Calculate maximum width for this participant -->
                {@const maxWidth =
                  isAbsolute && participant.width
                    ? (parseFloat(participant.width) / 100) * plotAreaWidth
                    : plotAreaWidth}

                <!-- Calculate visibility line x positions with capping -->
                {@const x1 = getVisibilityLineX(visibilityItem.x1, pWidth)}
                {@const x2 = getVisibilityLineX(visibilityItem.x2, pWidth)}

                <!-- Only render if in bounds and not in ordinal mode -->
                {#if !isOrdinal && x1 <= maxWidth && x2 <= maxWidth}
                  <line
                    class={visibilityItem.identifier}
                    x1={LEFT_LABEL_WIDTH + x1}
                    y1={i * data.heightOfBarWrap + visibilityItem.y}
                    x2={LEFT_LABEL_WIDTH + x2}
                    y2={i * data.heightOfBarWrap + visibilityItem.y}
                  />
                {/if}
              {/each}
            {/each}
          </g>
        {/each}

        <!-- Bottom Border Line -->
        <line
          x1={LEFT_LABEL_WIDTH}
          x2={LEFT_LABEL_WIDTH + plotAreaWidth}
          y1={data.participants.length * data.heightOfBarWrap - 0.5}
          y2={data.participants.length * data.heightOfBarWrap - 0.5}
          stroke={LAYOUT.GRID_COLOR}
          stroke-width={LAYOUT.GRID_STROKE_WIDTH}
        />
      {/key}

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

  .participant-label {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    max-width: 125px;
  }

  .x-axis-label {
    font-weight: 500;
  }

  .legend-title {
    font-weight: 500;
  }
</style>
