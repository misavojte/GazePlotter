<script lang="ts">
  import { getParticipants } from '$lib/stores/dataStore'
  import type { ScarfTooltipFillingType } from '$lib/type/Filling/ScarfTooltipFilling/ScarfTooltipFillingType'
  import { onDestroy, onMount } from 'svelte'
  import ScarfPlotFigure from './ScarfPlotFigure/ScarfPlotFigure.svelte'
  import ScarfPlotHeader from './ScarfPlotHeader/ScarfPlotHeader.svelte'
  import type { ScarfGridType } from '$lib/type/gridType'
  import { tooltipScarfService } from '$lib/services/tooltipServices'
  import { transformDataToScarfPlot } from '$lib/utils/scarfPlotTransformations'

  interface Props {
    settings: ScarfGridType
    settingsChange: (settings: Partial<ScarfGridType>) => void
  }

  let { settings, settingsChange }: Props = $props()

  let tooltipArea: HTMLElement | null = null
  let windowObj: Window
  let timeout = 0

  let highlightedType = $state<string | null>(null)
  let removeHighlight = $state<null | (() => void)>(null)

  const currentGroupId = $derived.by(() => settings.groupId)
  const currentStimulusId = $derived.by(() => settings.stimulusId)
  const currentParticipantIds = $derived.by(() => {
    const participants = getParticipants(currentGroupId, currentStimulusId)
    return participants.map(participant => participant.id)
  })

  const scarfData = $derived.by(() =>
    transformDataToScarfPlot(
      settings.stimulusId,
      currentParticipantIds,
      settings
    )
  )

  function handleSettingsChange(newSettings: Partial<ScarfGridType>) {
    if (settingsChange) {
      settingsChange(newSettings)
    }
  }

  const cancelHighlightKeepTooltip = () => {
    clearTimeout(timeout)
    cancelHighlight()
  }

  const cancelTooltip = () => {
    clearTimeout(timeout)
    if (!windowObj) return
    timeout = windowObj.setTimeout(() => {
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
    windowObj = document.defaultView as Window
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
    const y = gElement.getBoundingClientRect().bottom + windowObj.scrollY + 8
    const widthOfView = windowObj.scrollX + document.body.clientWidth
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

  const handleLegendClick = (identifier: string) => {
    if (highlightedType === identifier) return
    cancelTooltipInstantly()
    highlightedType = identifier
  }

  const decideInteractivity = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    const gElement = target.closest('g')
    if (gElement) return processGElement(gElement, event)
    const tooltip = target.closest('aside')
    if (tooltip) return cancelHighlightKeepTooltip()
    // We no longer need to handle legend item clicks here as they're handled directly
    cancelInteractivity()
  }

  onDestroy(() => {
    cancelInteractivity()
    if (!tooltipArea) return
  })
</script>

<div class="scarf-plot-container">
  <div class="header">
    <ScarfPlotHeader {settings} settingsChange={handleSettingsChange} />
  </div>

  <div class="figure">
    <ScarfPlotFigure
      onmouseleave={cancelInteractivity}
      onmousemove={decideInteractivity}
      tooltipAreaElement={tooltipArea}
      data={scarfData}
      {settings}
      highlightedIdentifier={highlightedType}
      onLegendClick={handleLegendClick}
    />
  </div>
</div>

<style>
  .scarf-plot-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }

  .header {
    padding: 0 0 10px 0;
    margin-bottom: 10px;
    background-color: var(--c-white);
  }

  .figure {
    flex: 1;
    overflow: auto;
  }
</style>
