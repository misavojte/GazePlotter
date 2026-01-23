<script lang="ts">
  import {
    getParticipants,
    getData,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import { onDestroy, onMount, untrack } from 'svelte'
  import { ScarfPlotFigure, ScarfPlotHeader } from '$lib/plots/scarf/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import {
    tooltipScarfService,
    transformDataToScarfPlot,
    SCARF_LAYOUT,
  } from '$lib/plots/scarf'
  import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared'
  import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid'
  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  // Component Props using Svelte 5 $props() rune
  interface Props {
    settings: ScarfGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  // Rename incoming settings prop to realSettings for clarity
  let { settings: realSettings, onWorkspaceCommand }: Props = $props()

  // Local settings that drive all rendering
  let localSettings = $state<ScarfGridType>(untrack(() => realSettings))

  // Sync localSettings when realSettings changes (workspace authority)
  $effect(() => {
    localSettings = realSettings
  })

  // State management
  let tooltipArea = $state<HTMLElement | SVGElement | null>(null)
  let windowObj = $state<Window | null>(null)
  let timeout = 0
  let removeHighlight = $state<null | (() => void)>(null)

  // Derived values
  const currentGroupId = $derived(localSettings.groupId)
  const currentStimulusId = $derived(localSettings.stimulusId)
  const redrawTimestamp = $derived(localSettings.redrawTimestamp)
  const highlights = $derived(realSettings.highlights ?? [])

  const currentParticipantIds = $derived.by(() =>
    getParticipants(currentGroupId, currentStimulusId).map(p => p.id)
  )

  const plotDimensions = $derived.by(() =>
    calculatePlotDimensionsWithHeader(
      localSettings.w,
      localSettings.h,
      DEFAULT_GRID_CONFIG,
      SCARF_LAYOUT.HEADER_HEIGHT
    )
  )

  const scarfData = $derived.by(() => {
    // Dependencies: localSettings, currentParticipantIds, redrawTimestamp
    redrawTimestamp
    const currentData = getData()
    return transformDataToScarfPlot(
      currentStimulusId,
      currentParticipantIds,
      localSettings,
      currentData.noAoiTreatment
    )
  })

  // Access consistent timeline limits from transformed data
  const timelineMin = $derived(scarfData.timeline.minValue)
  const timelineMax = $derived(scarfData.timeline.maxValue)

  const LAYOUT = { headerHeight: SCARF_LAYOUT.HEADER_HEIGHT }
  const PLOT_MARGIN = { TOP: 0, RIGHT: 0, BOTTOM: 0, LEFT: 0 }

  function scheduleTooltipHide() {
    clearTimeout(timeout)
    if (!windowObj) return
    timeout = windowObj.setTimeout(
      hideTooltipAndHighlight,
      SCARF_LAYOUT.TOOLTIP_HIDE_DELAY
    )
  }

  function hideTooltipAndHighlight() {
    clearTimeout(timeout)
    tooltipScarfService(null)
    removeHighlight?.()
  }

  function handleLegendClick(identifier: string) {
    hideTooltipAndHighlight()
    const newHighlights = highlights.includes(identifier)
      ? highlights.filter(id => id !== identifier)
      : [...highlights, identifier]

    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: realSettings.id,
      source: createCommandSourcePlotPattern(realSettings, 'plot'),
      settings: { highlights: newHighlights },
    })
  }

  function handleDragStepX(stepChange: number) {
    const visibleRange = timelineMax - timelineMin
    const moveAmount = -stepChange * (visibleRange / plotDimensions.width)

    const newMin = Math.max(0, timelineMin + moveAmount)
    const newMax =
      timelineMax + moveAmount + (newMin - (timelineMin + moveAmount))

    const isAbsolute = localSettings.timeline === 'absolute'
    const limitsKey = isAbsolute
      ? 'absoluteStimuliLimits'
      : 'ordinalStimuliLimits'

    if (localSettings.timeline !== 'relative') {
      localSettings = {
        ...localSettings,
        [limitsKey]: {
          ...localSettings[limitsKey],
          [currentStimulusId]: [newMin, newMax],
        },
      }
    }
  }

  function handleDragEnd() {
    if (localSettings.timeline === 'relative') return
    const limitsKey =
      localSettings.timeline === 'absolute'
        ? 'absoluteStimuliLimits'
        : 'ordinalStimuliLimits'

    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: realSettings.id,
      source: createCommandSourcePlotPattern(realSettings, 'plot'),
      settings: { [limitsKey]: localSettings[limitsKey] },
    })
  }

  onMount(() => {
    windowObj = window
  })
  onDestroy(hideTooltipAndHighlight)

  function handleTooltipActivation(event: {
    segmentOrderId: number
    participantId: number
    x: number
    y: number
  }) {
    clearTimeout(timeout)
    tooltipScarfService({
      x: event.x,
      y: event.y,
      width: SCARF_LAYOUT.TOOLTIP_WIDTH,
      participantId: event.participantId,
      segmentId: event.segmentOrderId,
      stimulusId: currentStimulusId,
    })
  }

  function handleTooltipDeactivation() {
    clearTimeout(timeout)
    tooltipScarfService(null)
  }
</script>

<BasePlot
  settings={localSettings}
  layoutConfig={LAYOUT}
  dimensions={plotDimensions}
>
  {#snippet header()}
    <ScarfPlotHeader
      source={createCommandSourcePlotPattern(realSettings, 'plot')}
      settings={localSettings}
      {onWorkspaceCommand}
    />
  {/snippet}

  {#snippet figure({ width, height })}
    <div class="scarf-viewport" style:height="{Math.floor(height)}px">
      <ScarfPlotFigure
        onTooltipActivation={handleTooltipActivation}
        onTooltipDeactivation={handleTooltipDeactivation}
        tooltipAreaElement={tooltipArea}
        data={scarfData}
        settings={localSettings}
        {highlights}
        onLegendClick={handleLegendClick}
        onDragStepX={handleDragStepX}
        onDragEnd={handleDragEnd}
        chartWidth={width}
        availableHeight={Math.floor(height)}
        marginTop={PLOT_MARGIN.TOP}
        marginRight={PLOT_MARGIN.RIGHT}
        marginBottom={PLOT_MARGIN.BOTTOM}
        marginLeft={PLOT_MARGIN.LEFT}
      />
    </div>
  {/snippet}
</BasePlot>

<style>
  .scarf-viewport {
    height: 100%;
    width: 100%;
    display: block;
    overflow: hidden; /* No scrolling allowed */
  }
</style>
