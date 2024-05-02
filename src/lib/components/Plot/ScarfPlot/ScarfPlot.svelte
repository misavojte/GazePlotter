<script lang="ts">
  import { PlotAxisBreaks } from '$lib/class/Plot/PlotAxisBreaks/PlotAxisBreaks.ts'
  import { ScarfPlotAxisFactory } from '$lib/class/Plot/ScarfPlot/ScarfPlotAxisFactory.ts'
  import { ScarfPlotFillingFactoryS } from '$lib/class/Plot/ScarfPlot/ScarfPlotFillingFactoryS.ts'
  import PlotWrap from '$lib/components/Plot/PlotWrap.svelte'
  import { getParticipants } from '$lib/stores/dataStore.ts'
  import type { ScarfTooltipFillingType } from '$lib/type/Filling/ScarfTooltipFilling/ScarfTooltipFillingType.ts'
  import { onDestroy, onMount } from 'svelte'
  import ScarfPlotHeader from './ScarfPlotHeader/ScarfPlotHeader.svelte'
  import ScarfPlotFigure from './ScarfPlotFigure/ScarfPlotFigure.svelte'
  import type { ScarfGridType } from '$lib/type/gridType.ts'
  import { tooltipScarfService } from '$lib/services/tooltipServices.ts'

  export let settings: ScarfGridType
  export let id: number

  let tooltipArea: HTMLElement

  let highlightedType: string | null = null
  let removeHighlight: null | (() => void) = null

  $: participantIds = getParticipants(
    settings.groupId,
    settings.stimulusId
  ).map(participant => participant.id)

  let window: Window

  const getAxisBreaks = (
    participantIds: number[],
    stimulusId: number,
    settings: ScarfGridType
  ) => {
    const axisFactory = new ScarfPlotAxisFactory(
      participantIds,
      stimulusId,
      settings
    )
    return axisFactory.getAxis()
  }

  const getFilling = (
    stimulusId: number,
    participantIds: number[],
    timeline: PlotAxisBreaks,
    settings: ScarfGridType
  ) => {
    const fillingFactory = new ScarfPlotFillingFactoryS(
      stimulusId,
      participantIds,
      timeline,
      settings
    )
    return fillingFactory.getFilling()
  }

  $: absoluteTimeline = getAxisBreaks(
    participantIds,
    settings.stimulusId,
    settings
  )

  $: data = getFilling(
    settings.stimulusId,
    participantIds,
    absoluteTimeline,
    settings
  )

  let timeout = 0

  const cancelHighlightKeepTooltip = () => {
    clearTimeout(timeout)
    cancelHighlight()
  }

  const cancelTooltip = () => {
    clearTimeout(timeout)
    if (!window) return
    timeout = window.setTimeout(() => {
      cancelTooltipInstantly()
    }, 200)
  }

  const cancelTooltipInstantly = () => {
    clearTimeout(timeout)
    tooltipScarfService(null)
    removeHighlight?.()
  }

  const cancelHighlight = () => {
    highlightedType = null
  }

  const cancelInteractivity = () => {
    cancelHighlight()
    cancelTooltip()
  }

  onMount(() => {
    window = document.defaultView as Window
  })

  const processGElement = (gElement: SVGGElement, event: MouseEvent) => {
    const segmentId = gElement.dataset.id
    if (!segmentId) return cancelInteractivity()
    // now access barwrap (closest svg) and get participant id
    const parent = gElement.closest('svg')
    if (!parent) return cancelInteractivity()
    const participantId = parent.dataset.id
    if (!participantId) return cancelInteractivity()

    // TODO: There was removed things (tooltip?.participantId !== participantId || tooltip?.segmentId !== segmentId)

    removeHighlight?.()
    gElement.classList.add('focus')
    removeHighlight = () => {
      gElement.classList.remove('focus')
    }

    const WIDTH_OF_TOOLTIP = 155
    const y = gElement.getBoundingClientRect().bottom + window.scrollY + 8
    const widthOfView = window.scrollX + document.body.clientWidth
    const x =
      event.pageX + WIDTH_OF_TOOLTIP > widthOfView
        ? widthOfView - WIDTH_OF_TOOLTIP
        : event.pageX

    const filling: ScarfTooltipFillingType = {
      x,
      y,
      width: WIDTH_OF_TOOLTIP,
      participantId: parseInt(participantId),
      segmentId: parseInt(segmentId),
      stimulusId: settings.stimulusId,
    }

    clearTimeout(timeout)
    tooltipScarfService(filling)
  }

  const processLegendItem = (legendItem: Element) => {
    const type = legendItem.classList[1]
    if (!type) return cancelInteractivity()
    if (highlightedType === type) return
    cancelTooltipInstantly()
    highlightedType = type
  }

  const decideInteractivity = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    const gElement = target.closest('g')
    if (gElement) return processGElement(gElement, event)
    const tooltip = target.closest('aside')
    if (tooltip) return cancelHighlightKeepTooltip()
    const legendItem = target.closest('.legendItem')
    if (legendItem) return processLegendItem(legendItem)
    cancelInteractivity()
  }

  onDestroy(() => {
    cancelInteractivity()
    if (!tooltipArea) return
  })
</script>

<PlotWrap {id} title="Scarf Plot">
  <ScarfPlotHeader slot="header" bind:settings />
  <svelte:fragment slot="body">
    <ScarfPlotFigure
      on:mouseleave={cancelInteractivity}
      on:mousemove={decideInteractivity}
      tooltipAreaElement={tooltipArea}
      {data}
      {settings}
      axisBreaks={absoluteTimeline}
      highlightedIdentifier={highlightedType}
    />
  </svelte:fragment>
</PlotWrap>
