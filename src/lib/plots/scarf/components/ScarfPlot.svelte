<script lang="ts">
  import { getParticipants } from '$lib/gaze-data/front-process/stores/dataStore'
  import { onDestroy, onMount } from 'svelte'
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
  import { engine } from '$lib/gaze-data/front-process/stores/dataStore.svelte'

  // Component Props using Svelte 5 $props() rune
  interface Props {
    settings: ScarfGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  // Rename incoming settings prop to realSettings for clarity
  let { settings: realSettings, onWorkspaceCommand }: Props = $props()

  // Local settings "Draft" pattern: interactions use draft, workspace uses real
  let draftSettings = $state<ScarfGridType | null>(null)
  const activeSettings = $derived(draftSettings ?? realSettings)

  // State management
  let tooltipArea = $state<HTMLElement | SVGElement | null>(null)
  let windowObj = $state<Window | null>(null)
  let timeout = 0
  let removeHighlight = $state<null | (() => void)>(null)

  // Derived values
  const currentGroupId = $derived(activeSettings.groupId)
  const currentStimulusId = $derived(activeSettings.stimulusId)

  const currentParticipantIds = $derived.by(() =>
    getParticipants(currentGroupId, currentStimulusId).map(p => p.id)
  )
  const highlights = $derived(realSettings.highlights ?? [])

  const plotDimensions = $derived.by(() =>
    calculatePlotDimensionsWithHeader(
      activeSettings.w,
      activeSettings.h,
      DEFAULT_GRID_CONFIG,
      SCARF_LAYOUT.HEADER_HEIGHT
    )
  )

  const scarfData = $derived.by(() => {
    // Engine access provides high-performance reactivity for AOI changes
    const meta = engine.metadata
    if (!meta) return null

    return transformDataToScarfPlot(
      currentStimulusId,
      currentParticipantIds,
      activeSettings,
      meta.noAoiTreatment
    )
  })

  // Access consistent timeline limits from transformed data
  const timelineMin = $derived(scarfData?.timeline.minValue ?? 0)
  const timelineMax = $derived(scarfData?.timeline.maxValue ?? 1000)

  const LAYOUT = { headerHeight: SCARF_LAYOUT.HEADER_HEIGHT }
  const PLOT_MARGIN = { TOP: 0, RIGHT: 0, BOTTOM: 0, LEFT: 0 }

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

    const isAbsolute = activeSettings.timeline === 'absolute'
    const limitsKey = isAbsolute
      ? 'absoluteStimuliLimits'
      : 'ordinalStimuliLimits'

    if (activeSettings.timeline !== 'relative') {
      const currentLimits = activeSettings[limitsKey] ?? {}
      draftSettings = {
        ...activeSettings,
        [limitsKey]: {
          ...currentLimits,
          [currentStimulusId]: [newMin, newMax],
        },
      }
    }
  }

  function handleDragEnd() {
    if (!draftSettings || activeSettings.timeline === 'relative') return
    const limitsKey =
      activeSettings.timeline === 'absolute'
        ? 'absoluteStimuliLimits'
        : 'ordinalStimuliLimits'

    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: realSettings.id,
      source: createCommandSourcePlotPattern(realSettings, 'plot'),
      settings: { [limitsKey]: activeSettings[limitsKey] },
    })

    // Reset draft after command emission
    draftSettings = null
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
  settings={activeSettings}
  layoutConfig={LAYOUT}
  dimensions={plotDimensions}
>
  {#snippet header()}
    <ScarfPlotHeader
      source={createCommandSourcePlotPattern(realSettings, 'plot')}
      settings={activeSettings}
      {onWorkspaceCommand}
    />
  {/snippet}

  {#snippet figure({ width, height })}
    {@const data = scarfData}
    <div class="scarf-viewport" style:height="{Math.floor(height)}px">
      {#if data}
        <ScarfPlotFigure
          onTooltipActivation={handleTooltipActivation}
          onTooltipDeactivation={handleTooltipDeactivation}
          tooltipAreaElement={tooltipArea}
          {data}
          settings={activeSettings}
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
      {/if}
    </div>
  {/snippet}
</BasePlot>
