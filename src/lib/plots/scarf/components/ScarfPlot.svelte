<script lang="ts">
  import { getParticipants, engine } from '$lib/data/engine'
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

  // --- NO-EFFECT DRAFT STATE ---
  // We use a local draft that is NOT synced via $effect.
  // Instead, the plot RENDER uses an effective state that prefers localDraft values.
  let localDraft = $state<Partial<ScarfGridType>>({})

  const effectiveSettings = $derived({
    ...realSettings,
    ...localDraft,
  })

  // State management
  let tooltipArea = $state<HTMLElement | SVGElement | null>(null)
  let windowObj = $state<Window | null>(null)
  let timeout = 0
  let removeHighlight = $state<null | (() => void)>(null)

  // Derived values
  const currentGroupId = $derived(effectiveSettings.groupId)
  const currentStimulusId = $derived(effectiveSettings.stimulusId)
  const redrawTimestamp = $derived(effectiveSettings.redrawTimestamp)
  const highlights = $derived(realSettings.highlights ?? [])

  const currentParticipantIds = $derived.by(() =>
    getParticipants(currentGroupId, currentStimulusId).map(p => p.id)
  )

  const plotDimensions = $derived.by(() =>
    calculatePlotDimensionsWithHeader(
      effectiveSettings.w,
      effectiveSettings.h,
      DEFAULT_GRID_CONFIG,
      SCARF_LAYOUT.HEADER_HEIGHT
    )
  )

  const scarfData = $derived.by(() => {
    // Dependencies: effectiveSettings, currentParticipantIds, redrawTimestamp
    redrawTimestamp
    const meta = engine.metadata
    if (!meta) return null
    return transformDataToScarfPlot(
      currentStimulusId,
      currentParticipantIds,
      effectiveSettings,
      meta.noAoiTreatment
    )
  })

  // Access consistent timeline limits from transformed data, but override if global settings are present
  // This logic mimics AoiStreamPlot's preference for explicit settings
  const timelineMin = $derived.by(() => {
    if (effectiveSettings.timeline === 'absolute') {
      if ((effectiveSettings.timelineStart ?? 0) > 0)
        return effectiveSettings.timelineStart!
    } else if (effectiveSettings.timeline === 'ordinal') {
      if ((effectiveSettings.ordinalStart ?? 0) > 0)
        return effectiveSettings.ordinalStart!
    }
    return scarfData?.timeline.minValue ?? 0
  })

  const timelineMax = $derived.by(() => {
    if (effectiveSettings.timeline === 'absolute') {
      if ((effectiveSettings.timelineEnd ?? 0) > 0)
        return effectiveSettings.timelineEnd!
    } else if (effectiveSettings.timeline === 'ordinal') {
      if ((effectiveSettings.ordinalEnd ?? 0) > 0)
        return effectiveSettings.ordinalEnd!
    }
    return scarfData?.timeline.maxValue ?? 100
  })

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

  function handlePreview(data: Partial<ScarfGridType>) {
    localDraft = { ...localDraft, ...data }
  }

  function handleMenuClose() {
    untrack(() => {
      const draftKeys = Object.keys(localDraft) as (keyof ScarfGridType)[]
      if (draftKeys.length === 0) return

      const updates: Partial<ScarfGridType> = {}
      for (const key of draftKeys) {
        if (localDraft[key] !== realSettings[key]) {
          ;(updates as any)[key] = localDraft[key]
        }
      }

      if (Object.keys(updates).length === 0) {
        localDraft = {}
        return
      }

      onWorkspaceCommand({
        type: 'updateSettings',
        itemId: realSettings.id,
        source: createCommandSourcePlotPattern(effectiveSettings, 'plot'),
        settings: updates,
      })

      localDraft = {}
    })
  }

  function handleDragStepX(stepChange: number) {
    const visibleRange = timelineMax - timelineMin
    const moveAmount = -stepChange * (visibleRange / plotDimensions.width)

    const newMin = Math.max(0, timelineMin + moveAmount)
    const newMax =
      timelineMax + moveAmount + (newMin - (timelineMin + moveAmount))

    if (effectiveSettings.timeline !== 'relative') {
      const isOrdinal = effectiveSettings.timeline === 'ordinal'
      const updates = isOrdinal
        ? { ordinalStart: newMin, ordinalEnd: newMax }
        : { timelineStart: newMin, timelineEnd: newMax }

      // Update local draft directly for smooth dragging
      localDraft = { ...localDraft, ...updates }
    }
  }

  function handleDragEnd() {
    if (effectiveSettings.timeline === 'relative') return
    const isOrdinal = effectiveSettings.timeline === 'ordinal'
    const updates = isOrdinal
      ? {
          ordinalStart: localDraft.ordinalStart ?? timelineMin,
          ordinalEnd: localDraft.ordinalEnd ?? timelineMax,
        }
      : {
          timelineStart: localDraft.timelineStart ?? timelineMin,
          timelineEnd: localDraft.timelineEnd ?? timelineMax,
        }

    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: realSettings.id,
      source: createCommandSourcePlotPattern(realSettings, 'plot'),
      settings: updates,
    })

    // Clear draft after committing
    localDraft = {}
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
  settings={effectiveSettings}
  layoutConfig={LAYOUT}
  dimensions={plotDimensions}
>
  {#snippet header()}
    <ScarfPlotHeader
      source={createCommandSourcePlotPattern(realSettings, 'plot')}
      settings={effectiveSettings}
      {onWorkspaceCommand}
      onPreview={handlePreview}
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
          settings={effectiveSettings}
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

<style>
  .scarf-viewport {
    height: 100%;
    width: 100%;
    display: block;
    overflow: hidden; /* No scrolling allowed */
  }
</style>
