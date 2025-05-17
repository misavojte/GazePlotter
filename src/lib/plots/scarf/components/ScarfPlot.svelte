<script lang="ts">
  import {
    getNumberOfSegments,
    getParticipantEndTime,
    getParticipants,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import type { ScarfTooltipFillingType } from '$lib/plots/scarf/types/ScarfTooltipFillingType'
  import { onDestroy, onMount } from 'svelte'
  import { ScarfPlotFigure, ScarfPlotHeader } from '$lib/plots/scarf/components'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import {
    tooltipScarfService,
    transformDataToScarfPlot,
    SCARF_LAYOUT,
    calculateScarfHeights,
  } from '$lib/plots/scarf/utils'
  import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared/utils'
  import { DEFAULT_GRID_CONFIG } from '$lib/shared/utils/gridSizingUtils'
  import { PlotPlaceholder } from '$lib/plots/shared/components'
  import { fade } from 'svelte/transition'
  // Component Props using Svelte 5 $props() rune
  interface Props {
    settings: ScarfGridType
    settingsChange: (settings: Partial<ScarfGridType>) => void
    forceRedraw: () => void
  }

  let { settings, settingsChange, forceRedraw }: Props = $props()

  // State management with Svelte 5 runes
  let tooltipArea = $state<HTMLElement | SVGElement | null>(null)
  let windowObj = $state<Window | null>(null)
  let timeout = $state(0)
  let highlightedType = $state<string | null>(null)
  let removeHighlight = $state<null | (() => void)>(null)

  // Derived values using Svelte 5 $derived and $derived.by runes
  const currentGroupId = $derived(settings.groupId)
  const currentStimulusId = $derived(settings.stimulusId)
  const redrawTimestamp = $derived(settings.redrawTimestamp)

  const currentParticipantIds = $derived(
    getParticipants(currentGroupId, currentStimulusId).map(
      participant => participant.id
    )
  )

  // Local timestamp that updates whenever participant IDs change
  const localTimestamp = $derived.by(() => {
    // This will update whenever currentParticipantIds changes
    return (
      Date.now() + '-' + currentParticipantIds.length + '-' + redrawTimestamp
    )
  })

  const scarfData = $derived.by(() => {
    // Force recalculation when redrawTimestamp changes
    // Also use localTimestamp to force recalculation when participants change
    const _ = localTimestamp

    // Get the latest participant IDs directly instead of using untrack
    const participantIds = getParticipants(
      currentGroupId,
      currentStimulusId
    ).map(participant => participant.id)

    return transformDataToScarfPlot(currentStimulusId, participantIds, settings)
  })

  // Calculate plot dimensions using a more descriptive approach
  const plotDimensions = $derived.by(() =>
    calculatePlotDimensionsWithHeader(
      settings.w,
      settings.h,
      DEFAULT_GRID_CONFIG,
      SCARF_LAYOUT.HEADER_HEIGHT,
      SCARF_LAYOUT.HORIZONTAL_PADDING,
      SCARF_LAYOUT.CONTENT_PADDING
    )
  )

  // Available width for chart content
  const chartWidth = $derived(plotDimensions.width)

  // Use the unified height calculation from the service
  const heightCalculations = $derived.by(() => {
    // Force recalculation when participants change or timestamp changes
    // Get the latest participant IDs for accurate height calculation
    const participantIds = getParticipants(
      currentGroupId,
      currentStimulusId
    ).map(participant => participant.id)

    return calculateScarfHeights(
      participantIds,
      scarfData.stylingAndLegend.aoi.length - 1, // Subtract 1 for "No AOI hit" which is added in styling
      scarfData.stylingAndLegend.visibility.length > 0,
      chartWidth
    )
  })

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

  // Tooltip and interaction handlers
  function handleSettingsChange(newSettings: Partial<ScarfGridType>) {
    settingsChange?.(newSettings)
  }

  function scheduleTooltipHide() {
    clearTimeout(timeout)
    if (!windowObj) return

    timeout = windowObj.setTimeout(() => {
      hideTooltipAndHighlight()
    }, SCARF_LAYOUT.TOOLTIP_HIDE_DELAY)
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
    // For a positive stepChange (drag right), move the view window right
    // For a negative stepChange (drag left), move the view window left

    // Calculate the current visible range as a percentage of the total range
    const currentRange = timelineMaxValue - timelineMinValue

    // Scale factor to convert pixels to timeline units
    // Using chartWidth to determine how many timeline units per pixel
    const scaleFactorX = currentRange / chartWidth

    // Calculate the actual units to move based on the drag amount and scale factor
    // Negative to make drag direction intuitive
    const moveAmount = -stepChange * scaleFactorX

    // Get current limits
    const currentMin = timelineMinValue
    const currentMax = timelineMaxValue

    // Calculate new limits with constraints
    let newMin = Math.max(0, currentMin + moveAmount) // Ensure left edge doesn't go below zero
    let newMax = currentMax + moveAmount + (newMin - (currentMin + moveAmount)) // Adjust right edge if left was constrained

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

  let mounted = $state(false)
  // Lifecycle hooks
  onMount(() => {
    windowObj = window
    mounted = true
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
      width: SCARF_LAYOUT.TOOLTIP_WIDTH,
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
    <ScarfPlotHeader
      {settings}
      {forceRedraw}
      settingsChange={handleSettingsChange}
    />
  </div>

  <div class="figure" style="height: {heightCalculations.totalHeight}px">
    {#if mounted}
      <div class="figure-content" in:fade={{ duration: 300 }}>
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
          calculatedHeights={heightCalculations}
        />
      </div>
    {:else}
      <div
        class="figure-content"
        style="height: {heightCalculations.totalHeight}px"
      >
        <PlotPlaceholder
          width={chartWidth}
          height={heightCalculations.totalHeight}
        />
      </div>
    {/if}
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
    position: relative;
    overflow: auto;
  }

  .figure-content {
    position: absolute;
    width: 100%;
    height: 100%;
  }
</style>
