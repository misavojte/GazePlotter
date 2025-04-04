<script lang="ts">
  import { getParticipants } from '$lib/stores/dataStore'
  import type { ScarfTooltipFillingType } from '$lib/type/Filling/ScarfTooltipFilling/ScarfTooltipFillingType'
  import { onDestroy, onMount } from 'svelte'
  import ScarfPlotFigure from './ScarfPlotFigure/ScarfPlotFigure.svelte'
  import ScarfPlotHeader from './ScarfPlotHeader/ScarfPlotHeader.svelte'
  import type { ScarfGridType } from '$lib/type/gridType'
  import { tooltipScarfService } from '$lib/services/tooltipServices'
  import { transformDataToScarfPlot } from '$lib/utils/scarfPlotTransformations'
  import { calculatePlotDimensionsWithHeader } from '$lib/utils/plotSizeUtility'
  import { DEFAULT_GRID_CONFIG } from '$lib/utils/gridSizingUtils'

  // CONSTANTS - centralized for easier maintenance
  const LAYOUT = {
    HEADER_HEIGHT: 150,
    HORIZONTAL_PADDING: 50,
    CONTENT_PADDING: 20,
    LEFT_LABEL_WIDTH: 125,
    TOOLTIP_WIDTH: 155,
    TOOLTIP_OFFSET_Y: 8,
    TOOLTIP_HIDE_DELAY: 200,
  }

  // Component Props using Svelte 5 $props() rune
  interface Props {
    settings: ScarfGridType
    settingsChange: (settings: Partial<ScarfGridType>) => void
  }

  let { settings, settingsChange }: Props = $props()

  // State management with Svelte 5 runes
  let tooltipArea = $state<HTMLElement | SVGElement | null>(null)
  let windowObj = $state<Window | null>(null)
  let timeout = $state(0)
  let highlightedType = $state<string | null>(null)
  let removeHighlight = $state<null | (() => void)>(null)

  // Derived values using Svelte 5 $derived and $derived.by runes
  const currentGroupId = $derived(settings.groupId)
  const currentStimulusId = $derived(settings.stimulusId)

  const currentParticipantIds = $derived.by(() => {
    const participants = getParticipants(currentGroupId, currentStimulusId)
    return participants.map(participant => participant.id)
  })

  const scarfData = $derived.by(() =>
    transformDataToScarfPlot(currentStimulusId, currentParticipantIds, settings)
  )

  // Calculate plot dimensions using a more descriptive approach
  const plotDimensions = $derived.by(() =>
    calculatePlotDimensionsWithHeader(
      settings.w,
      settings.h,
      DEFAULT_GRID_CONFIG,
      LAYOUT.HEADER_HEIGHT,
      LAYOUT.HORIZONTAL_PADDING,
      LAYOUT.CONTENT_PADDING
    )
  )

  // Available width for chart content
  const chartWidth = $derived(plotDimensions.width)

  // Tooltip and interaction handlers
  function handleSettingsChange(newSettings: Partial<ScarfGridType>) {
    settingsChange?.(newSettings)
  }

  // Clear functions with more descriptive names
  function clearHighlightKeepTooltip() {
    clearTimeout(timeout)
    clearHighlight()
  }

  function scheduleTooltipHide() {
    clearTimeout(timeout)
    if (!windowObj) return

    timeout = windowObj.setTimeout(() => {
      hideTooltipAndHighlight()
    }, LAYOUT.TOOLTIP_HIDE_DELAY)
  }

  function hideTooltipAndHighlight() {
    clearTimeout(timeout)
    tooltipScarfService(null)
    removeHighlight?.()
  }

  function clearHighlight() {
    highlightedType = null
  }

  function clearAllInteractions() {
    clearHighlight()
    scheduleTooltipHide()
  }

  // Process tooltip when hovering over a segment or participant
  function processGElement(gElement: SVGGElement, event: MouseEvent) {
    const segmentId = gElement.dataset.id
    if (!segmentId) return clearAllInteractions()

    // Find the participant ID using data attributes
    let participantId = null
    if (gElement.dataset.segment) {
      // If this is a segment element, find its parent with data-participant
      const participantElement = gElement.closest('[data-participant="true"]')
      if (participantElement) {
        participantId = participantElement.getAttribute('data-id')
      }
    } else if (gElement.dataset.participant) {
      // If this is already a participant element
      participantId = gElement.dataset.id
    }

    if (!participantId) return clearAllInteractions()

    // Apply visual highlight
    removeHighlight?.()
    gElement.classList.add('focus')
    removeHighlight = () => {
      gElement.classList.remove('focus')
    }

    // Calculate tooltip position
    const elementBottom =
      gElement.getBoundingClientRect().bottom + window.scrollY
    const viewportRightEdge = windowObj!.scrollX + document.body.clientWidth

    const y = elementBottom + LAYOUT.TOOLTIP_OFFSET_Y
    const x = Math.min(event.pageX, viewportRightEdge - LAYOUT.TOOLTIP_WIDTH)

    // Prepare tooltip data
    const tooltipData: ScarfTooltipFillingType = {
      x,
      y,
      width: LAYOUT.TOOLTIP_WIDTH,
      participantId: parseInt(participantId),
      segmentId: parseInt(segmentId),
      stimulusId: currentStimulusId,
    }

    // Show tooltip
    clearTimeout(timeout)
    tooltipScarfService(tooltipData)
  }

  // Handle legend item clicks
  function handleLegendClick(identifier: string) {
    if (highlightedType === identifier) return
    hideTooltipAndHighlight()
    highlightedType = identifier
  }

  // Determine what to do based on mouse target
  function handleMouseInteraction(event: MouseEvent) {
    const target = event.target as HTMLElement

    // Check if hovering over a chart element
    const gElement = target.closest('g')
    if (gElement) return processGElement(gElement as SVGGElement, event)

    // Check if hovering over tooltip
    const tooltip = target.closest('aside')
    if (tooltip) return clearHighlightKeepTooltip()

    // Otherwise, clear all interactions
    clearAllInteractions()
  }

  // Lifecycle hooks
  onMount(() => {
    windowObj = window
  })

  onDestroy(() => {
    clearAllInteractions()
  })
</script>

<div class="scarf-plot-container">
  <div class="header">
    <ScarfPlotHeader {settings} settingsChange={handleSettingsChange} />
  </div>

  <div class="figure">
    <ScarfPlotFigure
      onmouseleave={clearAllInteractions}
      onmousemove={handleMouseInteraction}
      tooltipAreaElement={tooltipArea}
      data={scarfData}
      {settings}
      highlightedIdentifier={highlightedType}
      onLegendClick={handleLegendClick}
      {chartWidth}
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
