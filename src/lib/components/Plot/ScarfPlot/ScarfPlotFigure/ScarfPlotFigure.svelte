<!-- @migration-task Error while migrating Svelte code: Can't migrate code with afterUpdate. Please migrate by hand. -->
<script lang="ts">
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType'
  import type { ScarfGridType } from '$lib/type/gridType'
  import ScarfPlotLegend from '$lib/components/Plot/ScarfPlot/ScarfPlotLegend/ScarfPlotLegend.svelte'
  import { generateScarfPlotCSS } from '$lib/utils/scarfPlotTransformations'
  import { addInfoToast } from '$lib/stores/toastStore'

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
    absoluteZoomedWidth: number
  }

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
    absoluteZoomedWidth = 0,
  }: Props = $props()

  // Constants for SVG layout
  const LEFT_LABEL_WIDTH = 125 // Width for participant labels
  const AXIS_LABEL_HEIGHT = 30 // Height for the x-axis label
  const LEGEND_HEIGHT = 100 // Height for the legend
  const LABEL_FONT_SIZE = 12
  const PADDING = 10

  let fixedHighlight = $state<string | null>(null)
  let usedHighlight = $derived(fixedHighlight ?? highlightedIdentifier)

  const getTimelineUnit = (settings: ScarfGridType): string => {
    return settings.timeline === 'relative' ? '%' : 'ms'
  }

  const getXAxisLabel = (settings: ScarfGridType): string => {
    return settings.timeline === 'ordinal'
      ? 'Order index'
      : `Elapsed time [${getTimelineUnit(settings)}]`
  }

  let xAxisLabel = $derived(getXAxisLabel(settings))

  // Total SVG width and height calculation
  const totalWidth = $derived(
    LEFT_LABEL_WIDTH + absoluteZoomedWidth + PADDING * 2
  )
  const totalHeight = $derived(
    data.chartHeight + AXIS_LABEL_HEIGHT + LEGEND_HEIGHT
  )

  let scarfPlotAreaId = $derived(`scarf-plot-area-${settings.id}`)

  // Function to calculate the absolute X position for a timeline value
  const getAbsoluteX = (value: number): number => {
    if (!chartWidth) return 0

    // Handle different timeline types
    if (settings.timeline === 'ordinal') {
      // For ordinal, each label gets an evenly spaced position
      const lastIndex = data.timeline.length - 1
      const indexPosition = data.timeline.findIndex(v => v === value)
      // Apply zoom factor to the position
      return indexPosition >= 0
        ? (indexPosition / lastIndex) * absoluteZoomedWidth
        : 0
    } else {
      // For absolute and relative, use the same calculation for axis labels
      // Apply zoom factor to the position
      return (value / data.timeline.maxLabel) * absoluteZoomedWidth
    }
  }

  // Function to calculate X position for segments based on timeline type
  const getSegmentX = (
    x: string,
    segmentIndex?: number,
    participantWidth?: string
  ): number => {
    if (!chartWidth) return 0

    if (settings.timeline === 'ordinal' && typeof segmentIndex === 'number') {
      // For ordinal timeline, we position based on segment index
      const totalSegments = data.timeline.maxLabel
      // Apply zoom factor to the position
      return (segmentIndex / totalSegments) * absoluteZoomedWidth
    } else if (settings.timeline === 'absolute' && participantWidth) {
      // For absolute timeline, the width of each participant can be different
      // Parse the participant width (which is in percentage format)
      const participantWidthPercent = parseFloat(participantWidth)
      // Convert the segment x (also in percentage) to the actual x position
      const segmentXPercent = parseFloat(x)
      // Calculate the actual width of this participant in pixels WITH ZOOM
      const actualParticipantWidth =
        (participantWidthPercent / 100) * absoluteZoomedWidth
      // Get the segment's absolute position within this participant's area
      return (segmentXPercent / 100) * actualParticipantWidth
    } else {
      // For relative timeline, convert percentage directly WITH ZOOM
      const percentage = parseFloat(x)
      return (percentage / 100) * absoluteZoomedWidth
    }
  }

  // Function to calculate width for segments based on timeline type
  const getSegmentWidth = (
    width: string,
    segmentIndex?: number,
    participantWidth?: string
  ): number => {
    if (!chartWidth) return 0

    if (settings.timeline === 'ordinal' && typeof segmentIndex === 'number') {
      // For ordinal timeline, each segment has equal width WITH ZOOM
      const totalSegments = data.timeline.maxLabel
      return absoluteZoomedWidth / totalSegments
    } else if (settings.timeline === 'absolute' && participantWidth) {
      // For absolute timeline, the width of each participant can be different
      const participantWidthPercent = parseFloat(participantWidth)
      const segmentWidthPercent = parseFloat(width)
      // Calculate width WITH ZOOM
      const actualParticipantWidth =
        (participantWidthPercent / 100) * absoluteZoomedWidth
      return (segmentWidthPercent / 100) * actualParticipantWidth
    } else {
      // For relative timeline, convert percentage directly WITH ZOOM
      const percentage = parseFloat(width)
      return (percentage / 100) * absoluteZoomedWidth
    }
  }

  // Function to calculate X position for AOI visibility lines
  const getVisibilityLineX = (x: string, participantWidth?: string): number => {
    if (!chartWidth) return 0

    if (settings.timeline === 'ordinal') {
      return 0 // Not applicable in ordinal mode
    } else if (settings.timeline === 'absolute' && participantWidth) {
      // For absolute timeline, we need to scale by participant width
      const participantWidthPercent = parseFloat(participantWidth)
      const xPercent = parseFloat(x)

      // Ensure the visibility line doesn't exceed the participant's width
      const cappedXPercent = Math.min(xPercent, 100)

      // First calculate the participant's actual width in pixels WITH ZOOM
      const actualParticipantWidth =
        (participantWidthPercent / 100) * absoluteZoomedWidth

      // Then calculate position within that participant's area (capped)
      return (cappedXPercent / 100) * actualParticipantWidth
    } else {
      // For relative timeline, the percentage is relative to the full chart width WITH ZOOM
      // but should still be capped at 100%
      const percentage = Math.min(parseFloat(x), 100)
      return (percentage / 100) * absoluteZoomedWidth
    }
  }

  const handleFixedHighlight = (identifier: string) => {
    if (fixedHighlight === identifier) {
      fixedHighlight = null
      highlightedIdentifier = null
      return
    }
    fixedHighlight = identifier
    addInfoToast(`Highlight fixed. Click the same item in the legend to remove`)
  }

  // Create a derived value that changes when any input that would affect the style changes
  let styleInputs = $derived({
    id: settings.id,
    data: data.stylingAndLegend,
    highlight: usedHighlight,
  })

  let dynamicStyle = $derived(
    generateScarfPlotCSS(scarfPlotAreaId, data.stylingAndLegend, usedHighlight)
  )

  // Replace afterUpdate with $effect
  $effect(() => {
    // The dynamicStyle is already reactive, but this ensures it's applied
    // after DOM updates when IDs change
    const styleElement = document.querySelector(`#${scarfPlotAreaId} style`)
    if (styleElement) {
      styleElement.textContent = dynamicStyle
        .replace('<style>', '')
        .replace('</style>', '')
    }
  })

  // Handle legend identifier click - ensure proper function passing
  const handleLegendIdentifier = (identifier: string) => {
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
    height={data.chartHeight + AXIS_LABEL_HEIGHT}
    {onmousemove}
    {onmouseleave}
    {onpointerdown}
    bind:this={tooltipAreaElement}
    data-component="scarfplot"
  >
    <!-- Participant Labels (Left Side) -->
    <g class="participants-labels">
      {#each data.participants as participant, i}
        <text
          x={PADDING}
          y={i * data.heightOfBarWrap + data.heightOfBarWrap / 2}
          font-size={LABEL_FONT_SIZE}
          text-anchor="start"
          dominant-baseline="middle"
          class="participant-label">{participant.label}</text
        >
      {/each}
    </g>

    <!-- Main Chart Area -->
    <g
      class="chart-area"
      transform={`translate(${LEFT_LABEL_WIDTH}, 0)`}
      class:isHiglighted={highlightedIdentifier}
    >
      {#key data.participants}
        <!-- Timeline Axis Labels -->
        <g
          class="timeline-labels"
          transform={`translate(0, ${data.chartHeight - 12})`}
        >
          <text x="0" y="0" text-anchor="start" dominant-baseline="hanging"
            >0</text
          >

          {#each data.timeline.slice(1, -1) as label}
            <text
              x={getAbsoluteX(label)}
              dominant-baseline="hanging"
              text-anchor="middle">{label}</text
            >
          {/each}

          <text
            x={absoluteZoomedWidth}
            dominant-baseline="hanging"
            text-anchor="end">{data.timeline.maxLabel}</text
          >
        </g>

        <!-- X-Axis Ticks -->
        <g class="axis-ticks">
          <line
            x1="0"
            y1={data.participants.length * data.heightOfBarWrap - 0.5}
            x2="0"
            y2={data.participants.length * data.heightOfBarWrap + 5}
            stroke="#cbcbcb"
            stroke-width="1.5"
          ></line>

          {#each data.timeline.slice(1, -1) as label}
            <line
              x1={getAbsoluteX(label)}
              y1={data.participants.length * data.heightOfBarWrap - 0.5}
              x2={getAbsoluteX(label)}
              y2={data.participants.length * data.heightOfBarWrap + 5}
              stroke="#cbcbcb"
              stroke-width="1.5"
            ></line>
          {/each}

          <line
            x1={absoluteZoomedWidth}
            y1={data.participants.length * data.heightOfBarWrap - 0.5}
            x2={absoluteZoomedWidth}
            y2={data.participants.length * data.heightOfBarWrap + 5}
            stroke="#cbcbcb"
            stroke-width="1.5"
          ></line>
        </g>

        <!-- Horizontal Grid Lines and Data -->
        {#each data.participants as participant, i}
          <!-- Horizontal Grid Line -->
          <line
            x1="0"
            x2={absoluteZoomedWidth}
            y1={i * data.heightOfBarWrap + 0.5}
            y2={i * data.heightOfBarWrap + 0.5}
            stroke="#cbcbcb"
          ></line>

          <!-- Participant Segments -->
          <g
            class="participant-segments"
            transform={`translate(0, ${i * data.heightOfBarWrap})`}
            data-id={participant.id}
            data-participant="true"
          >
            {#each participant.segments as segment, segmentId}
              <g data-id={segmentId} data-segment="true">
                {#each segment.content as rectangle}
                  <rect
                    class={rectangle.identifier}
                    height={rectangle.height}
                    x={settings.timeline === 'ordinal'
                      ? getSegmentX(rectangle.x, segmentId)
                      : getSegmentX(
                          rectangle.x,
                          undefined,
                          settings.timeline === 'absolute'
                            ? participant.width
                            : undefined
                        )}
                    width={settings.timeline === 'ordinal'
                      ? getSegmentWidth(rectangle.width, segmentId)
                      : getSegmentWidth(
                          rectangle.width,
                          undefined,
                          settings.timeline === 'absolute'
                            ? participant.width
                            : undefined
                        )}
                    y={rectangle.y}
                  ></rect>
                {/each}
              </g>
            {/each}

            <!-- AOI Visibility Lines -->
            {#each participant.dynamicAoiVisibility as visibility, visibilityIndex}
              {#each visibility.content as visibilityItem, itemIndex}
                <!-- Calculate maximum width for this participant WITH ZOOM -->
                {@const maxWidth =
                  settings.timeline === 'absolute' && participant.width
                    ? (parseFloat(participant.width) / 100) *
                      absoluteZoomedWidth
                    : absoluteZoomedWidth}

                <!-- Calculate visibility line x positions with capping -->
                {@const x1 = getVisibilityLineX(
                  visibilityItem.x1,
                  settings.timeline === 'absolute'
                    ? participant.width
                    : undefined
                )}

                {@const x2 = getVisibilityLineX(
                  visibilityItem.x2,
                  settings.timeline === 'absolute'
                    ? participant.width
                    : undefined
                )}

                <!-- Only render if in bounds and not in ordinal mode -->
                {#if settings.timeline !== 'ordinal' && x1 <= maxWidth && x2 <= maxWidth}
                  <line
                    class={visibilityItem.identifier}
                    {x1}
                    y1={visibilityItem.y}
                    {x2}
                    y2={visibilityItem.y}
                  ></line>
                {/if}
              {/each}
            {/each}
          </g>
        {/each}

        <!-- Bottom Border Line -->
        <line
          x1="0"
          x2={absoluteZoomedWidth}
          y1={data.participants.length * data.heightOfBarWrap - 0.5}
          y2={data.participants.length * data.heightOfBarWrap - 0.5}
          stroke="#cbcbcb"
        />
      {/key}

      <!-- X-Axis Label -->
      <text
        x={absoluteZoomedWidth / 2}
        y={data.chartHeight + 15}
        text-anchor="middle"
        font-size={LABEL_FONT_SIZE}
        class="x-axis-label">{xAxisLabel}</text
      >
    </g>
  </svg>

  <!-- Legend below the SVG -->
  <div class="legend-container">
    <ScarfPlotLegend
      filling={data.stylingAndLegend}
      onlegendIdentifier={handleLegendIdentifier}
    />
  </div>
</figure>

<style>
  .plot-container {
    margin: 0;
    padding: 0;
    cursor: default;
  }

  .scarf-plot-figure {
    font-family: sans-serif;
  }

  .participant-label {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    max-width: 125px;
  }

  text {
    font-family: sans-serif;
    font-size: 12px;
  }

  .legend-container {
    margin-top: 10px;
    width: 100%;
  }
</style>
