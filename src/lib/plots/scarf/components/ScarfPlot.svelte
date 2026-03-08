<script lang="ts">
  import { getParticipants, engine } from '$lib/data/engine'
  import { onDestroy, untrack } from 'svelte'
  import { ScarfPlotFigure, ScarfPlotHeader } from '$lib/plots/scarf/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import {
    tooltipScarfService,
    transformDataToScarfPlot,
    SCARF_LAYOUT,
  } from '$lib/plots/scarf'

  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  import { PreviewSync, PLOT_HEADER_HEIGHT } from '$lib/plots/shared'

  // Component Props using Svelte 5 $props() rune
  interface Props {
    settings: ScarfGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  // Rename incoming settings prop to realSettings for clarity
  let { settings: realSettings, onWorkspaceCommand }: Props = $props()

  // --- PREVIEW SYNC STATE ---
  const timelineSync = new PreviewSync(realSettings.timeline)
  const timelineStartSync = new PreviewSync(realSettings.timelineStart)
  const timelineEndSync = new PreviewSync(realSettings.timelineEnd)
  const ordinalStartSync = new PreviewSync(realSettings.ordinalStart)
  const ordinalEndSync = new PreviewSync(realSettings.ordinalEnd)
  const hideNonFixationsSync = new PreviewSync(
    realSettings.hideNonFixations ?? false
  )

  $effect(() => {
    timelineSync.updateCommitted(realSettings.timeline, true)
    timelineStartSync.updateCommitted(realSettings.timelineStart, true)
    timelineEndSync.updateCommitted(realSettings.timelineEnd, true)
    ordinalStartSync.updateCommitted(realSettings.ordinalStart, true)
    ordinalEndSync.updateCommitted(realSettings.ordinalEnd, true)
    hideNonFixationsSync.updateCommitted(
      realSettings.hideNonFixations ?? false,
      true
    )
  })

  // Grouping for header
  const syncs = {
    timeline: timelineSync,
    timelineStart: timelineStartSync,
    timelineEnd: timelineEndSync,
    ordinalStart: ordinalStartSync,
    ordinalEnd: ordinalEndSync,
    hideNonFixations: hideNonFixationsSync,
  }

  const effectiveSettings = $derived({
    ...realSettings,
    timeline: timelineSync.value,
    timelineStart: timelineStartSync.value,
    timelineEnd: timelineEndSync.value,
    ordinalStart: ordinalStartSync.value,
    ordinalEnd: ordinalEndSync.value,
    hideNonFixations: hideNonFixationsSync.value,
  })

  // State management
  let tooltipArea = $state<HTMLElement | SVGElement | null>(null)
  let timeout = 0

  // Derived values
  const currentGroupId = $derived(effectiveSettings.groupId)
  const currentStimulusId = $derived(effectiveSettings.stimulusId)
  const redrawTimestamp = $derived(effectiveSettings.redrawTimestamp)
  const highlights = $derived(realSettings.highlights ?? [])

  const currentParticipantIds = $derived.by(() =>
    getParticipants(currentGroupId, currentStimulusId).map(p => p.id)
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

  const PLOT_MARGIN = { TOP: 0, RIGHT: 0, BOTTOM: 0, LEFT: 0 }

  function hideTooltipAndHighlight() {
    clearTimeout(timeout)
    tooltipScarfService(null)
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

  function handleMenuClose() {
    untrack(() => {
      const updates: Partial<ScarfGridType> = {}

      if (timelineSync.isDirty) updates.timeline = timelineSync.value
      if (timelineStartSync.isDirty)
        updates.timelineStart = timelineStartSync.value
      if (timelineEndSync.isDirty) updates.timelineEnd = timelineEndSync.value
      if (ordinalEndSync.isDirty) updates.ordinalEnd = ordinalEndSync.value
      if (hideNonFixationsSync.isDirty)
        updates.hideNonFixations = hideNonFixationsSync.value

      if (Object.keys(updates).length === 0) {
        timelineSync.reset()
        timelineStartSync.reset()
        timelineEndSync.reset()
        ordinalStartSync.reset()
        ordinalEndSync.reset()
        hideNonFixationsSync.reset()
        return
      }

      onWorkspaceCommand({
        type: 'updateSettings',
        itemId: realSettings.id,
        source: createCommandSourcePlotPattern(effectiveSettings, 'plot'),
        settings: updates,
      })

      timelineSync.reset()
      timelineStartSync.reset()
      timelineEndSync.reset()
      ordinalStartSync.reset()
      ordinalEndSync.reset()
      hideNonFixationsSync.reset()
    })
  }

  function handleDragStepX(stepChange: number, width: number) {
    const visibleRange = timelineMax - timelineMin
    const moveAmount = -stepChange * (visibleRange / width)

    const newMin = Math.max(0, timelineMin + moveAmount)
    const newMax =
      timelineMax + moveAmount + (newMin - (timelineMin + moveAmount))

    if (effectiveSettings.timeline !== 'relative') {
      const isOrdinal = effectiveSettings.timeline === 'ordinal'

      if (isOrdinal) {
        ordinalStartSync.value = newMin
        ordinalEndSync.value = newMax
      } else {
        timelineStartSync.value = newMin
        timelineEndSync.value = newMax
      }
    }
  }

  function handleDragEnd() {
    if (effectiveSettings.timeline === 'relative') return
    const isOrdinal = effectiveSettings.timeline === 'ordinal'

    // We can rely on handleMenuClose logic to commit dirty syncs
    // But drag interaction is usually immediate, implying a commit.
    // However, PreviewSync is designed for menu logic. For direct drag, we can just commit directly
    // OR we can set value and then call commit manually.

    // Let's reuse the commit logic:
    const updates: Partial<ScarfGridType> = {}

    if (isOrdinal) {
      if (ordinalStartSync.isDirty)
        updates.ordinalStart = ordinalStartSync.value
      if (ordinalEndSync.isDirty) updates.ordinalEnd = ordinalEndSync.value
    } else {
      if (timelineStartSync.isDirty)
        updates.timelineStart = timelineStartSync.value
      if (timelineEndSync.isDirty) updates.timelineEnd = timelineEndSync.value
    }

    if (Object.keys(updates).length > 0) {
      onWorkspaceCommand({
        type: 'updateSettings',
        itemId: realSettings.id,
        source: createCommandSourcePlotPattern(realSettings, 'plot'),
        settings: updates,
      })
    }

    // Reset syncs to clean slate (they will be updated by effect once props come back)
    timelineStartSync.reset()
    timelineEndSync.reset()
    ordinalStartSync.reset()
    ordinalEndSync.reset()
  }

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

<BasePlot settings={effectiveSettings}>
  {#snippet header()}
    <ScarfPlotHeader
      source={createCommandSourcePlotPattern(realSettings, 'plot')}
      settings={effectiveSettings}
      {onWorkspaceCommand}
      {syncs}
      onMenuClose={handleMenuClose}
    />
  {/snippet}

  {#snippet figure({ width, height })}
    {@const data = scarfData}
    <div class="scarf-viewport" style:height="{Math.floor(height)}px">
      {#if data}
        <ScarfPlotFigure
          chartWidth={width}
          availableHeight={height}
          data={scarfData}
          settings={effectiveSettings}
          {highlights}
          onLegendClick={handleLegendClick}
          onTooltipActivation={handleTooltipActivation}
          onTooltipDeactivation={handleTooltipDeactivation}
          onDragStepX={step => handleDragStepX(step, width)}
          onDragEnd={handleDragEnd}
          marginTop={PLOT_MARGIN.TOP}
          marginRight={PLOT_MARGIN.RIGHT}
          marginBottom={PLOT_MARGIN.BOTTOM}
          marginLeft={PLOT_MARGIN.LEFT}
          tooltipAreaElement={tooltipArea}
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
