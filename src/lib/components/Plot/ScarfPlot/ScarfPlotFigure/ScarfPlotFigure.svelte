<!-- @migration-task Error while migrating Svelte code: Can't migrate code with afterUpdate. Please migrate by hand. -->
<script lang="ts">
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType'
  import type { ScarfGridType } from '$lib/type/gridType'
  import { PlotAxisBreaks } from '$lib/class/Plot/PlotAxisBreaks/PlotAxisBreaks'
  import ScarfPlotLegend from '$lib/components/Plot/ScarfPlot/ScarfPlotLegend/ScarfPlotLegend.svelte'
  import { generateScarfPlotCSS } from '$lib/utils/scarfPlotTransformations'
  import { addInfoToast } from '$lib/stores/toastStore'

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

  let xAxisLabel = $derived(getXAxisLabel(settings))
  let zoomWidth = $derived(getZoomWidth(settings))

  let scarfPlotAreaId = $derived(`scarf-plot-area-${settings.id}`)

  const handleFixedHighlight = (identifier: string) => {
    if (fixedHighlight === identifier) {
      fixedHighlight = null
      highlightedIdentifier = null
      return
    }
    fixedHighlight = identifier
    addInfoToast(`Highlight fixed. Click the same item in the legend to remove`)
  }

  const handleStopPropagation = (event: MouseEvent) => {
    event.stopPropagation()
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
          width="{zoomWidth}%"
          height={data.chartHeight}
        >
          <svg y={data.chartHeight - 14} class="chxlabs">
            <text x="0" y="0" text-anchor="start" dominant-baseline="hanging"
              >0</text
            >
            {#each data.timeline.slice(1, -1) as label}
              <text
                x="{(label / data.timeline.maxLabel) * 100}%"
                dominant-baseline="hanging"
                text-anchor="middle">{label}</text
              >
            {/each}
            <text x="100%" dominant-baseline="hanging" text-anchor="end"
              >{data.timeline.maxLabel}</text
            >
          </svg>
          <!-- Start of barwrap, each is a participant -->
          {#each data.participants as participant, i}
            <line
              x1="0"
              x2="100%"
              y1={i * data.heightOfBarWrap + 0.5}
              y2={i * data.heightOfBarWrap + 0.5}
              stroke="#cbcbcb"
            ></line>
            <svg
              class="barwrap"
              y={i * data.heightOfBarWrap}
              data-id={participant.id}
              height={data.heightOfBarWrap}
              width={participant.width}
            >
              {#each participant.segments as segment, segmentId}
                <g data-id={segmentId}>
                  {#each segment.content as rectangle}
                    <rect
                      class={rectangle.identifier}
                      height={rectangle.height}
                      x={rectangle.x}
                      width={rectangle.width}
                      y={rectangle.y}
                    ></rect>
                  {/each}
                </g>
              {/each}
              {#each participant.dynamicAoiVisibility as visibility}
                {#each visibility.content as visibilityItem}
                  <line
                    class={visibilityItem.identifier}
                    x1={visibilityItem.x1}
                    y1={visibilityItem.y}
                    x2={visibilityItem.x2}
                    y2={visibilityItem.y}
                  ></line>
                {/each}
              {/each}
            </svg>
          {/each}
          <!-- End of barwrap -->
          <line
            x1="0"
            x2="100%"
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
    text-align: right;
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
  #charea {
    transition: 1s width ease-in-out;
  }
  .charea-holder {
    overflow: auto;
  }
</style>
