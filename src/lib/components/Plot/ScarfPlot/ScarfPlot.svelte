<script lang="ts">
  import { PlotAxisBreaks } from '$lib/class/Plot/PlotAxisBreaks/PlotAxisBreaks.ts'
  import { ScarfPlotAxisFactory } from '$lib/class/Plot/ScarfPlot/ScarfPlotAxisFactory.ts'
  import { ScarfPlotFillingFactoryS } from '$lib/class/Plot/ScarfPlot/ScarfPlotFillingFactoryS.ts'
  import PlotWrap from '$lib/components/Plot/PlotWrap.svelte'
  import { getParticipants } from '$lib/stores/dataStore.ts'
  import { scarfPlotStates } from '$lib/stores/scarfPlotsStore.ts'
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType.ts'
  import type { ScarfTooltipFillingType } from '$lib/type/Filling/ScarfTooltipFilling/ScarfTooltipFillingType.ts'
  import type { ScarfSettingsType } from '$lib/type/Settings/ScarfSettings/ScarfSettingsType.ts'
  import { onDestroy, onMount } from 'svelte'
  import ScarfPlotHeader from './ScarfPlotHeader/ScarfPlotHeader.svelte'
  import ScarfPlotTooltip from './ScarfPlotTooltip/ScarfPlotTooltip.svelte'
  import ScarfPlotFigure from './ScarfPlotFigure/ScarfPlotFigure.svelte'

  export let scarfPlotId: number
  let tooltipArea: HTMLElement

  const firstSettings: ScarfSettingsType | undefined = $scarfPlotStates.find(
    setting => setting.scarfPlotId === scarfPlotId
  )
  if (!firstSettings)
    throw new Error(`Could not find scarf plot settings for id ${scarfPlotId}`)
  let settings: ScarfSettingsType = firstSettings

  let stimulusId: number = settings.stimulusId

  let highlightedType: string | null = null
  let removeHighlight: null | (() => void) = null

  let participantIds: number[] = getParticipants(settings.groupId).map(
    participant => participant.id
  )

  let window: Window

  const getAxisBreaks = (
    participantIds: number[],
    stimulusId: number,
    settings: ScarfSettingsType
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
    settings: ScarfSettingsType
  ) => {
    const fillingFactory = new ScarfPlotFillingFactoryS(
      stimulusId,
      participantIds,
      timeline,
      settings
    )
    return fillingFactory.getFilling()
  }

  let absoluteTimeline: PlotAxisBreaks = getAxisBreaks(
    participantIds,
    stimulusId,
    settings
  )

  let data = getFilling(stimulusId, participantIds, absoluteTimeline, settings)

  let tooltip: ScarfTooltipFillingType | null = null
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
    tooltip = null
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

    if (
      parseInt(segmentId) === tooltip?.segmentId &&
      parseInt(participantId) === tooltip?.participantId
    )
      return

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
      stimulusId,
    }

    clearTimeout(timeout)
    tooltip = filling
  }

  const processLegendItem = (legendItem: Element) => {
    const type = legendItem.classList[1]
    console.log(type)
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

  const unsubscribe = scarfPlotStates.subscribe(
    (newSettings: ScarfSettingsType[]) => {
      // find by id
      const newSetting = newSettings.find(
        setting => setting.scarfPlotId === scarfPlotId
      )
      if (!newSetting) {
        unsubscribe()
        return
      }
      settings = newSetting
      participantIds = getParticipants(settings.groupId).map(
        participant => participant.id
      )
      stimulusId = settings.stimulusId
      absoluteTimeline = getAxisBreaks(participantIds, stimulusId, settings)
      data = getFilling(stimulusId, participantIds, absoluteTimeline, settings)
    }
  )
</script>

<PlotWrap title="Scarf Plot">
  <ScarfPlotHeader slot="header" scarfId={scarfPlotId} />
  <svelte:fragment slot="body">
    <ScarfPlotFigure
      on:mouseleave={cancelInteractivity}
      on:mousemove={decideInteractivity}
      {scarfPlotId}
      tooltipAreaElement={tooltipArea}
      {data}
      {settings}
      axisBreaks={absoluteTimeline}
      highlightedIdentifier={highlightedType}
    />
    {#if tooltip}
      <ScarfPlotTooltip {...tooltip} />
    {/if}
  </svelte:fragment>
</PlotWrap>
