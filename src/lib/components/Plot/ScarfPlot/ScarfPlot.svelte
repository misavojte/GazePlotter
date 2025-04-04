<script lang="ts">
  import {
    getNumberOfSegments,
    getParticipantEndTime,
    getParticipants,
  } from '$lib/stores/dataStore'
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

  // Calculate, based on current stimulus, the min value for the timeline
  const timelineMinValue = $derived.by(() => {
    if (settings.timeline === 'absolute') {
      return settings.absoluteStimuliLimits[currentStimulusId]?.[0] ?? 0
    } else if (settings.timeline === 'ordinal') {
      return settings.ordinalStimuliLimits[currentStimulusId]?.[0] ?? 0
    } else {
      return 0 // relative timeline has always a min value of 0
    }
  })

  // Same for max value, however, if the max value is 0, then use the max value of the data
  const timelineMaxValue = $derived.by(() => {
    if (settings.timeline === 'absolute') {
      const maxValue =
        settings.absoluteStimuliLimits[currentStimulusId]?.[1] ?? 0
      return maxValue === 0
        ? currentParticipantIds.reduce(
            (max, participantId) =>
              Math.max(
                max,
                getParticipantEndTime(currentStimulusId, participantId)
              ),
            0
          )
        : maxValue
    } else if (settings.timeline === 'ordinal') {
      const maxValue =
        settings.ordinalStimuliLimits[currentStimulusId]?.[1] ?? 0
      return maxValue === 0
        ? currentParticipantIds.reduce(
            (max, participantId) =>
              Math.max(
                max,
                getNumberOfSegments(currentStimulusId, participantId)
              ),
            0
          )
        : maxValue
    } else {
      return 100 // relative timeline has always a max value of 100
    }
  })

  $effect(() => {
    console.log('timelineMinValue', timelineMinValue)
    console.log('timelineMaxValue', timelineMaxValue)
  })

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

  // Handle legend item clicks
  function handleLegendClick(identifier: string) {
    if (highlightedType === identifier) return
    hideTooltipAndHighlight()
    highlightedType = identifier
  }

  // Handle chart dragging
  function handleDragStepX(stepChange: number) {
    // Convert pixels to time/percentage units based on the timeline type
    // For a negative stepChange (drag right), move the view window left
    // For a positive stepChange (drag left), move the view window right

    // Calculate the current visible range as a percentage of the total range
    const currentRange = timelineMaxValue - timelineMinValue

    // Scale factor to convert pixels to timeline units
    // Using chartWidth to determine how many timeline units per pixel
    const scaleFactorX = currentRange / chartWidth

    // Calculate the actual units to move based on the drag amount and scale factor
    const moveAmount = -stepChange * scaleFactorX // Negative to make drag direction intuitive

    // Get current limits
    const currentMin = timelineMinValue
    const currentMax = timelineMaxValue

    // Calculate new limits with constraints
    let newMin = Math.max(0, currentMin + moveAmount) // Ensure left edge doesn't go below zero
    let newMax = currentMax + moveAmount + (newMin - (currentMin + moveAmount)) // Adjust right edge if left was constrained

    console.log(
      `Dragging: min=${newMin}, max=${newMax}, moveAmount=${moveAmount}`
    )

    // Update the settings based on the timeline type
    if (settings.timeline === 'absolute') {
      const updatedLimits = { ...settings.absoluteStimuliLimits }
      updatedLimits[currentStimulusId] = [newMin, newMax]

      handleSettingsChange({
        absoluteStimuliLimits: updatedLimits,
      })
    } else if (settings.timeline === 'ordinal') {
      const updatedLimits = { ...settings.ordinalStimuliLimits }
      updatedLimits[currentStimulusId] = [newMin, newMax]

      handleSettingsChange({
        ordinalStimuliLimits: updatedLimits,
      })
    }
    // For relative timeline, there's typically nothing to update as it's fixed at 0-100%
  }

  // Lifecycle hooks
  onMount(() => {
    windowObj = window
  })

  onDestroy(() => {
    clearAllInteractions()
  })

  function handleTooltipActivation(event: {
    segmentOrderId: number
    participantId: number
    x: number
    y: number
  }) {
    // Prepare tooltip data
    const tooltipData: ScarfTooltipFillingType = {
      x: event.x,
      y: event.y,
      width: LAYOUT.TOOLTIP_WIDTH,
      participantId: event.participantId,
      segmentId: event.segmentOrderId,
      stimulusId: currentStimulusId,
    }

    // Show tooltip
    clearTimeout(timeout)
    tooltipScarfService(tooltipData)
  }

  function handleTooltipDeactivation() {
    clearTimeout(timeout)
    tooltipScarfService(null)
  }
</script>

<div class="scarf-plot-container">
  <div class="header">
    <ScarfPlotHeader {settings} settingsChange={handleSettingsChange} />
  </div>

  <div class="figure">
    <ScarfPlotFigure
      onTooltipActivation={handleTooltipActivation}
      onTooltipDeactivation={handleTooltipDeactivation}
      tooltipAreaElement={tooltipArea}
      data={scarfData}
      {settings}
      highlightedIdentifier={highlightedType}
      onLegendClick={handleLegendClick}
      onDragStepX={handleDragStepX}
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
