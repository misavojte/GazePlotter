<script lang="ts">
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType.ts'
  import type { ScarfSettingsType } from '$lib/type/Settings/ScarfSettings/ScarfSettingsType.ts'
  import { PlotAxisBreaks } from '$lib/class/Plot/PlotAxisBreaks/PlotAxisBreaks.ts'
  import ScarfPlotLegend from '$lib/components/Plot/ScarfPlot/ScarfPlotLegend/ScarfPlotLegend.svelte'
  import { ScarfPlotDynamicStyleFactory } from '$lib/class/Plot/ScarfPlot/ScarfPlotDynamicStyleFactory.ts'
  import { addInfoToast } from '$lib/stores/toastStore.ts'

  export let tooltipAreaElement: HTMLElement
  export let data: ScarfFillingType
  export let settings: ScarfSettingsType
  export let axisBreaks: PlotAxisBreaks
  export let highlightedIdentifier: string | null = null

  let fixedHighlight: string | null = null
  $: usedHighlight = fixedHighlight ?? highlightedIdentifier

  const getGridPatternWidth = (
    settings: ScarfSettingsType,
    axisBreaks: PlotAxisBreaks
  ): string => {
    if (settings.timeline === 'relative') return '10%'
    return `${(axisBreaks.maxLabel / axisBreaks.maxLabel) * 100}%`
  }

  const getTimelineUnit = (settings: ScarfSettingsType): string => {
    return settings.timeline === 'relative' ? '%' : 'ms'
  }

  const getXAxisLabel = (settings: ScarfSettingsType): string => {
    return settings.timeline === 'ordinal'
      ? 'Order index'
      : `Elapsed time [${getTimelineUnit(settings)}]`
  }

  const getZoomWidth = (settings: ScarfSettingsType): number => {
    return 100 * 2 ** settings.zoomLevel
  }

  $: patternWidth = getGridPatternWidth(settings, axisBreaks)
  $: xAxisLabel = getXAxisLabel(settings)
  $: zoomWidth = getZoomWidth(settings)

  const scarfPlotAreaId = `scarf-plot-area-${settings.id}`
  const styleFactory = new ScarfPlotDynamicStyleFactory(scarfPlotAreaId)

  const handleFixedHighlight = (event: CustomEvent<string>) => {
    if (fixedHighlight === event.detail) {
      fixedHighlight = null
      highlightedIdentifier = null
      return
    }
    fixedHighlight = event.detail
    addInfoToast(`Highlight fixed. Click the same item in the legend to remove`)
  }

  $: dynamicStyle = styleFactory.generateCss(
    data.stylingAndLegend,
    usedHighlight
  )
</script>

<figure class="tooltip-area" on:mousemove on:mouseleave>
  <!-- scarf plot id is used to identify the plot by other components (e.g. for download) -->
  <div class="chartwrap" id={scarfPlotAreaId} bind:this={tooltipAreaElement}>
    {@html dynamicStyle}
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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        id="charea"
        width="{zoomWidth}%"
        height={data.chartHeight}
      >
        <defs>
          <pattern
            id="grid-{settings.id}"
            width={patternWidth}
            height={data.heightOfBarWrap}
            patternUnits="userSpaceOnUse"
          >
            <rect
              fill="none"
              width="100%"
              height="100%"
              stroke="#cbcbcb"
              stroke-width="1"
            />
          </pattern>
        </defs>
        <g>
          <rect
            fill="url(#grid-{settings.id})"
            stroke="#cbcbcb"
            stroke-width="1"
            width="100%"
            height={data.chartHeight - 20}
          />
        </g>
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
      </svg>
    </div>
    <div class="chxlab">{xAxisLabel}</div>
    <ScarfPlotLegend
      filling={data.stylingAndLegend}
      on:legendIdentifier={handleFixedHighlight}
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
