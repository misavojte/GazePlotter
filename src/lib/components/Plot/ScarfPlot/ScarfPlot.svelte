<script lang="ts">
    import { PlotAxisBreaks } from '$lib/class/Plot/PlotAxisBreaks/PlotAxisBreaks.ts'
    import { ScarfPlotFillingFactoryS } from '$lib/class/Plot/ScarfPlot/ScarfPlotFillingFactoryS.ts'
    import { ScarfPlotAxisFactory } from '$lib/class/Plot/ScarfPlot/ScarfPlotAxisFactory.ts'
    import ScarfPlotLegend from './ScarfPlotLegend/ScarfPlotLegend.svelte'
    import { getParticipantOrderVector } from '$lib/stores/dataStore.ts'
    import PlotWrap from '../PlotWrap.svelte'
    import type { ScarfSettingsType } from '$lib/type/Settings/ScarfSettings/ScarfSettingsType.ts'
    import type { ScarfFillingType } from '../../../type/Filling/ScarfFilling'
    import type { ScarfTooltipFillingType } from '$lib/type/Filling/ScarfTooltipFilling/ScarfTooltipFillingType.ts'
    import ScarfPlotTooltip from './ScarfPlotTooltip/ScarfPlotTooltip.svelte'
    import ZoomInButton from './ScarfPlotButton/ScarfPlotButtonZoomIn.svelte'
    import ZoomOutButton from './ScarfPlotButton/ScarfPlotButtonZoomOut.svelte'
    import { scarfPlotStates } from '$lib/stores/scarfPlotsStore.ts'
    import ScarfTimelineSelect from './ScarfPlotSelect/ScarfPlotSelectTimeline.svelte'
    import ScarfPlotSelectGroup from './ScarfPlotSelect/ScarfPlotSelectGroup.svelte'
    import ScarfPlotSelectStimulus from './ScarfPlotSelect/ScarfPlotSelectStimulus.svelte'
    import ScarfPlotButtonMenu from './ScarfPlotButton/ScarfPlotButtonMenu.svelte'
    import { onDestroy } from 'svelte'

    export let scarfPlotId: number

    const firstSettings: ScarfSettingsType | undefined = $scarfPlotStates.find(setting => setting.scarfPlotId === scarfPlotId)
    if (!firstSettings) throw new Error(`Could not find scarf plot settings for id ${scarfPlotId}`)
    let settings: ScarfSettingsType = firstSettings

    let stimulusId: number = settings.stimulusId
    let zoomWidth = 100 * 2 ** settings.zoomLevel

    let highlightedType: string | null = null
    const participantIds: number[] = getParticipantOrderVector()

    const getAxisBreaks = (participantIds: number[], stimulusId: number, settings: ScarfSettingsType) => {
      const axisFactory = new ScarfPlotAxisFactory(participantIds, stimulusId, settings)
      return axisFactory.getAxis()
    }

    const getFilling = (stimulusId: number, participantIds: number[], timeline: PlotAxisBreaks, settings: ScarfSettingsType) => {
      const fillingFactory = new ScarfPlotFillingFactoryS(stimulusId, participantIds, timeline, settings)
      return fillingFactory.getFilling()
    }

    let absoluteTimeline: PlotAxisBreaks = getAxisBreaks(participantIds, stimulusId, settings)
    let data = getFilling(stimulusId, participantIds, absoluteTimeline, settings)
    let patternWidth = settings.timeline === 'relative' ? '10%' : `${(absoluteTimeline[1] / absoluteTimeline.maxLabel) * 100}%`
    let timelineUnit = settings.timeline === 'relative' ? '%' : 'ms'
    let xAxisLabel = settings.timeline === 'ordinal' ? 'Order index' : `Elapsed time [${timelineUnit}]`

    const getDynamicVisibilityCss = (data: ScarfFillingType): string => {
      let css = ''
      const visibilities = data.stylingAndLegend.visibility
      if (visibilities.length === 0) return css
      for (let i = 0; i < visibilities.length; i++) {
        css += `line.${visibilities[i].identifier}{stroke:${visibilities[i].color};}`
      }
      css += `line{stroke-width:${visibilities[0].height};stroke-dasharray:1}`
      return css
    }

    const getDynamicStyle = (data: ScarfFillingType): string => {
      return `<style>
        ${data.stylingAndLegend.aoi.map(aoi => `rect.${aoi.identifier}{fill:${aoi.color}}`).join('')}
        ${data.stylingAndLegend.category.map(aoi => `rect.${aoi.identifier}{fill:${aoi.color}}`).join('')}
        ${getDynamicVisibilityCss(data)}
    </style>`
    }

    let dynamicStyle: string = getDynamicStyle(data)

    let tooltip: ScarfTooltipFillingType | null = null
    let timeout: number = 0

    const cancelHighlightKeepTooltip = () => {
      clearTimeout(timeout)
      cancelHighlight()
    }

    const cancelTooltip = () => {
      clearTimeout(timeout)
      timeout = window.setTimeout(() => {
        tooltip = null
      }, 200)
    }

    const cancelHighlight = () => {
      highlightedType = null
    }

    const cancelInteractivity = () => {
      cancelHighlight()
      cancelTooltip()
    }

    const processGElement = (gElement: SVGGElement, event: MouseEvent) => {
      const segmentId = gElement.dataset.id
      if (!segmentId) return cancelInteractivity()
      // now access barwrap (closest svg) and get participant id
      const parent = gElement.closest('svg')
      if (!parent) return cancelInteractivity()
      const participantId = parent.dataset.id
      if (!participantId) return cancelInteractivity()

      if (parseInt(segmentId) === tooltip?.segmentId && parseInt(participantId) === tooltip?.participantId) return

      const WIDTH_OF_TOOLTIP = 155
      const y = gElement.getBoundingClientRect().bottom + window.scrollY + 8
      const widthOfView = window.scrollX + document.body.clientWidth
      const x = event.pageX + WIDTH_OF_TOOLTIP > widthOfView ? widthOfView - WIDTH_OF_TOOLTIP : event.pageX
      // const x = gElement.getBoundingClientRect().right + window.scrollX + WIDTH_OF_TOOLTIP + 8 > widthOfView ? widthOfView - WIDTH_OF_TOOLTIP : gElement.getBoundingClientRect().right + window.scrollX + 8

      console.log(widthOfView, x)

      const filling: ScarfTooltipFillingType = {
        x,
        y,
        width: WIDTH_OF_TOOLTIP,
        participantId: parseInt(participantId),
        segmentId: parseInt(segmentId),
        stimulusId
      }

      clearTimeout(timeout)
      tooltip = filling
    }

    const decideInteractivity = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const gElement = target.closest('g')
      if (gElement) return processGElement(gElement, event)
      const tooltip = target.closest('aside')
      if (tooltip) return cancelHighlightKeepTooltip()
      cancelInteractivity()
    }

    onDestroy(() => {
      cancelInteractivity()
    })

    const unsubscribe = scarfPlotStates.subscribe((newSettings: ScarfSettingsType[]) => {
      // find by id
      const newSetting = newSettings.find(setting => setting.scarfPlotId === scarfPlotId)
      if (!newSetting) {
        unsubscribe()
        return
      }
      settings = newSetting
      stimulusId = settings.stimulusId
      zoomWidth = 100 * 2 ** settings.zoomLevel
      absoluteTimeline = getAxisBreaks(participantIds, stimulusId, settings)
      data = getFilling(stimulusId, participantIds, absoluteTimeline, settings)
      patternWidth = settings.timeline === 'relative' ? '10%' : `${(absoluteTimeline[1] / absoluteTimeline.maxLabel) * 100}%`
      timelineUnit = settings.timeline === 'relative' ? '%' : 'ms'
      xAxisLabel = settings.timeline === 'ordinal' ? 'Order index' : `Elapsed time [${timelineUnit}]`
      dynamicStyle = getDynamicStyle(data)
    })

</script>

<PlotWrap title="Scarf Plot">
    <div class="nav" slot="header">
        <ScarfPlotSelectStimulus scarfId={scarfPlotId} />
        <ScarfTimelineSelect scarfId={scarfPlotId} />
        <ScarfPlotSelectGroup scarfId={scarfPlotId} />
        <ZoomInButton scarfId={scarfPlotId}></ZoomInButton>
        <ZoomOutButton scarfId={scarfPlotId}></ZoomOutButton>
        <ScarfPlotButtonMenu scarfId={scarfPlotId}></ScarfPlotButtonMenu>
    </div>
    <figure slot="body" class="tooltip-area js-mouseleave" on:mousemove={decideInteractivity} on:mouseleave={cancelInteractivity}>
        <!-- scarf plot id is used to identify the plot by other components (e.g. for download) -->
        <div class="chartwrap" id="scarf-plot-area-{scarfPlotId}">
            {@html dynamicStyle}
            <div class='chylabs' style='grid-auto-rows:{data.heightOfBarWrap}px' data-gap='{data.heightOfBarWrap}'>
                {#each data.participants as participant}
                    <div>{participant.label}</div>
                {/each}
            </div>
            <div class='charea-holder'>
                <svg xmlns='http://www.w3.org/2000/svg' id='charea' width='{zoomWidth}%' height='{data.chartHeight}'>
                    <defs>
                        <pattern id='grid' width="{patternWidth}" height="{data.heightOfBarWrap}" patternUnits="userSpaceOnUse">
                            <rect fill='none' width='100%' height='100%' stroke='#cbcbcb' stroke-width='1'/>
                        </pattern>
                    </defs>
                    <rect fill='url(#grid)' stroke='#cbcbcb' stroke-width='1' width='100%' height='{data.chartHeight - 20}'/>
                    <svg y='{data.chartHeight - 14}' class='chxlabs'>
                        <text x='0' y='0' text-anchor='start' dominant-baseline='hanging'>0</text>
                        {#each data.timeline.slice(1, -1) as label}
                            <text x='{(label / data.timeline.maxLabel) * 100}%' dominant-baseline='hanging' text-anchor='middle'>{label}</text>
                        {/each}
                        <text x='100%' dominant-baseline='hanging' text-anchor='end'>{data.timeline.maxLabel}</text>
                    </svg>
                    <!-- Start of barwrap, each is a participant -->
                    {#each data.participants as participant, i}
                        <svg class='barwrap' y='{i * data.heightOfBarWrap}' data-id='{participant.id}' height='{data.heightOfBarWrap}' width='{participant.width}'>
                            {#each participant.segments as segment, segmentId}
                                <g data-id='{segmentId}'>
                                    {#each segment.content as rectangle}
                                        <rect class='{rectangle.identifier}' height='{rectangle.height}' x='{rectangle.x}' width='{rectangle.width}' y='{rectangle.y}'></rect>
                                    {/each}
                                </g>
                            {/each}
                            {#each participant.dynamicAoiVisibility as visibility}
                                {#each visibility.content as visibilityItem}
                                    <line class="{visibilityItem.identifier}" x1="{visibilityItem.x1}" y1="{visibilityItem.y}" x2="{visibilityItem.x2}" y2="{visibilityItem.y}"></line>
                                {/each}
                            {/each}
                        </svg>
                    {/each}
                    <!-- End of barwrap -->
                </svg>
            </div>
            <div class='chxlab'>{xAxisLabel}</div>
            <ScarfPlotLegend filling={data.stylingAndLegend} />
        </div>
        {#if tooltip}
            <ScarfPlotTooltip {...tooltip} />
        {/if}
    </figure>
</PlotWrap>

<style>
    figure {
        margin: 0;
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
        margin-top: -10px
    }
    .chylabs {
        display: grid;
        font-size: 14px;
        grid-template-columns: 1fr;
        align-items: center;
    }
    .chylabs > div {
        overflow-wrap: break-word;
        width: 125px;
        line-height: 1;
    }
    text {
        font-family: sans-serif;
        font-size: 12px;
    }
    .nav {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
    }
    #charea {
        transition: 1s width ease-in-out;
    }
    .charea-holder {
        overflow: auto;
    }
</style>
