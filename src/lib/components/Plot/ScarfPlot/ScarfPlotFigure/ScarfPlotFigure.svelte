<!-- @migration-task Error while migrating Svelte code: Can't migrate code with afterUpdate. Please migrate by hand. -->
<script lang="ts">
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType'
  import type { ScarfGridType } from '$lib/type/gridType'
  import ScarfPlotLegend from '$lib/components/Plot/ScarfPlot/ScarfPlotLegend/ScarfPlotLegend.svelte'
  import { generateScarfPlotCSS } from '$lib/utils/scarfPlotTransformations'
  import { addInfoToast } from '$lib/stores/toastStore'
  import { calculatePlotDimensionsWithHeader } from '$lib/utils/plotSizeUtility'
  import { DEFAULT_GRID_CONFIG } from '$lib/utils/gridSizingUtils'

  interface Props {
    tooltipAreaElement: HTMLElement | null
    data: ScarfFillingType
    settings: ScarfGridType
    highlightedIdentifier: string | null
    onLegendClick: (identifier: string) => void
    onmousemove?: (event: MouseEvent) => void
    onmouseleave?: (event: MouseEvent) => void
    onpointerdown?: (event: PointerEvent) => void
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
  }: Props = $props()

  // Constants for space calculations (similar to AoiTransitionMatrixPlot)
  const HEADER_HEIGHT = 150
  const HORIZONTAL_PADDING = 50
  const CONTENT_PADDING = 20
  const LEFT_LABEL_WIDTH = 125 // Width of the participant labels column

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

  const getZoomWidth = (settings: ScarfGridType): number => {
    return 100 * 2 ** settings.zoomLevel
  }

  // Calculate plot dimensions based on settings
  const plotDimensions = $derived.by(() =>
    calculatePlotDimensionsWithHeader(
      settings.w,
      settings.h,
      DEFAULT_GRID_CONFIG,
      HEADER_HEIGHT,
      HORIZONTAL_PADDING
    )
  )

  // Calculate the chart width from plot dimensions
  const chartWidth = $derived(
    plotDimensions.width - LEFT_LABEL_WIDTH - CONTENT_PADDING
  )

  // Apply zoom factor to get actual width
  let xAxisLabel = $derived(getXAxisLabel(settings))
  let zoomWidth = $derived(getZoomWidth(settings))
  let absoluteZoomedWidth = $derived(chartWidth * (zoomWidth / 100))

  // Calculate zoom factor for use in position calculations
  let zoomFactor = $derived(zoomWidth / 100)

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

<figure class="tooltip-area" {onmousemove} {onmouseleave} {onpointerdown}>
  <!-- scarf plot id is used to identify the plot by other components (e.g. for download) -->
  <div class="chartwrap" id={scarfPlotAreaId} bind:this={tooltipAreaElement}>
    {#key styleInputs}
      {@html dynamicStyle}
    {/key}
    <div
      class="chylabs"
      style="grid-auto-rows:{data.heightOfBarWrap}px"
      data-gap={data.heightOfBarWrap}
    >
      {#each data.participants as participant}
        <div>{participant.label}</div>
      {/each}
    </div>
    <div class="charea-holder" class:isHiglighted={highlightedIdentifier}>
      {#key data.participants}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          id="charea"
          width={absoluteZoomedWidth}
          height={data.chartHeight}
        >
          <svg y={data.chartHeight - 12} class="chxlabs">
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
          </svg>

          <!-- Add x-axis ticks -->
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

          <!-- Start of barwrap, each is a participant -->
          {#each data.participants as participant, i}
            <line
              x1="0"
              x2={absoluteZoomedWidth}
              y1={i * data.heightOfBarWrap + 0.5}
              y2={i * data.heightOfBarWrap + 0.5}
              stroke="#cbcbcb"
            ></line>
            <svg
              class="barwrap"
              y={i * data.heightOfBarWrap}
              data-id={participant.id}
              height={data.heightOfBarWrap}
              width={absoluteZoomedWidth}
            >
              {#each participant.segments as segment, segmentId}
                <g data-id={segmentId}>
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
            </svg>
          {/each}
          <!-- End of barwrap -->
          <line
            x1="0"
            x2={absoluteZoomedWidth}
            y1={data.participants.length * data.heightOfBarWrap - 0.5}
            y2={data.participants.length * data.heightOfBarWrap - 0.5}
            stroke="#cbcbcb"
          />
        </svg>
      {/key}
    </div>
    <div class="chxlab">{xAxisLabel}</div>
    <ScarfPlotLegend
      filling={data.stylingAndLegend}
      onlegendIdentifier={handleLegendIdentifier}
    />
  </div>
</figure>

<style>
  figure {
    margin: 0;
    cursor: default;
  }
  .chartwrap {
    display: grid;
    grid-template-columns: 125px 1fr;
    grid-gap: 10px;
  }
  .chxlab {
    grid-column: 2;
    text-align: center;
    font-size: 12px;
    margin-top: -10px;
  }
  .chylabs {
    display: grid;
    font-size: 14px;
    grid-template-columns: 1fr;
    align-items: center;
  }
  .chylabs > div {
    width: 125px;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }
  text {
    font-family: sans-serif;
    font-size: 12px;
  }
  .charea-holder {
    overflow: auto;
  }
</style>
