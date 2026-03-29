<script lang="ts">
  import { getParticipants } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'
  import { onDestroy, untrack } from 'svelte'
  import { ScarfPlotFigure, ScarfPlotHeader } from '$lib/plots/scarf/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import type { ScarfPlotItem, ScarfPlotSettings } from '$lib/plots/scarf/types'
  import {
    tooltipScarfService,
    transformDataToScarfPlot,
    SCARF_LAYOUT,
  } from '$lib/plots/scarf'

  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  import { PreviewModel } from '$lib/plots/shared'

  // Component Props using Svelte 5 $props() rune
  interface Props {
    item: ScarfPlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const realSettings = $derived(item.settings)

  type ScarfPlotPreview = {
    timeline: 'absolute' | 'relative' | 'ordinal'
    timelineStart: number | undefined
    timelineEnd: number | undefined
    ordinalStart: number | undefined
    ordinalEnd: number | undefined
    hideNonFixations: boolean
  }

  const preview = new PreviewModel<
    ScarfPlotPreview,
    Partial<ScarfPlotSettings>
  >({
    getCommitted: () => ({
      timeline: realSettings.timeline,
      timelineStart: realSettings.timelineStart,
      timelineEnd: realSettings.timelineEnd,
      ordinalStart: realSettings.ordinalStart,
      ordinalEnd: realSettings.ordinalEnd,
      hideNonFixations: realSettings.hideNonFixations ?? false,
    }),
    buildPatch: (draft, committed) => {
      const updates: Partial<ScarfPlotSettings> = {}

      if (draft.timeline !== committed.timeline)
        updates.timeline = draft.timeline
      if (draft.timelineStart !== committed.timelineStart) {
        updates.timelineStart = draft.timelineStart
      }
      if (draft.timelineEnd !== committed.timelineEnd) {
        updates.timelineEnd = draft.timelineEnd
      }
      if (draft.ordinalStart !== committed.ordinalStart) {
        updates.ordinalStart = draft.ordinalStart
      }
      if (draft.ordinalEnd !== committed.ordinalEnd) {
        updates.ordinalEnd = draft.ordinalEnd
      }
      if (draft.hideNonFixations !== committed.hideNonFixations) {
        updates.hideNonFixations = draft.hideNonFixations
      }

      return updates
    },
  })

  // Grouping for header
  const syncs = preview.fields

  const effectiveSettings = $derived.by(() => {
    const draft = preview.draft

    return {
      ...realSettings,
      timeline: draft.timeline,
      timelineStart: draft.timelineStart,
      timelineEnd: draft.timelineEnd,
      ordinalStart: draft.ordinalStart,
      ordinalEnd: draft.ordinalEnd,
      hideNonFixations: draft.hideNonFixations,
    }
  })

  // State management
  let tooltipArea = $state<HTMLElement | SVGElement | null>(null)
  let timeout = 0

  // Derived values
  const currentGroupId = $derived(effectiveSettings.groupId)
  const currentStimulusId = $derived(effectiveSettings.stimulusId)
  const redrawTimestamp = $derived(item.redrawTimestamp)
  const highlights = $derived(realSettings.highlights ?? [])

  const currentParticipantIds = $derived.by(() =>
    getParticipants(engine, currentGroupId, currentStimulusId).map(p => p.id)
  )

  const scarfData = $derived.by(() => {
    // Dependencies: effectiveSettings, currentParticipantIds, redrawTimestamp
    redrawTimestamp
    const meta = engine.metadata
    if (!meta) return null
    return transformDataToScarfPlot(
      engine,
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
    tooltipScarfService(engine, null)
  }

  function handleLegendClick(identifier: string) {
    hideTooltipAndHighlight()
    const newHighlights = highlights.includes(identifier)
      ? highlights.filter((id: string) => id !== identifier)
      : [...highlights, identifier]

    workspace.updateItemSettings(
      item.id,
      { highlights: newHighlights },
      createCommandSourcePlotPattern(item, 'plot')
    )
  }

  function handleMenuClose() {
    untrack(() => {
      const updates = preview.buildPatch()

      if (!updates || Object.keys(updates).length === 0) {
        preview.resetAll()
        return
      }

      workspace.updateItemSettings(
        item.id,
        updates,
        createCommandSourcePlotPattern(item, 'plot')
      )

      preview.resetAll()
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
        syncs.ordinalStart.value = newMin
        syncs.ordinalEnd.value = newMax
      } else {
        syncs.timelineStart.value = newMin
        syncs.timelineEnd.value = newMax
      }
    }
  }

  function handleDragEnd() {
    if (effectiveSettings.timeline === 'relative') return
    const isOrdinal = effectiveSettings.timeline === 'ordinal'
    const draft = preview.draft
    const committed = preview.committed
    const updates: Partial<ScarfPlotSettings> = {}

    if (isOrdinal) {
      if (draft.ordinalStart !== committed.ordinalStart) {
        updates.ordinalStart = draft.ordinalStart
      }
      if (draft.ordinalEnd !== committed.ordinalEnd) {
        updates.ordinalEnd = draft.ordinalEnd
      }
    } else {
      if (draft.timelineStart !== committed.timelineStart) {
        updates.timelineStart = draft.timelineStart
      }
      if (draft.timelineEnd !== committed.timelineEnd) {
        updates.timelineEnd = draft.timelineEnd
      }
    }

    if (Object.keys(updates).length > 0) {
      workspace.updateItemSettings(
        item.id,
        updates,
        createCommandSourcePlotPattern(item, 'plot')
      )
    }

    syncs.timelineStart.reset()
    syncs.timelineEnd.reset()
    syncs.ordinalStart.reset()
    syncs.ordinalEnd.reset()
  }

  onDestroy(hideTooltipAndHighlight)

  function handleTooltipActivation(event: {
    segmentOrderId: number
    participantId: number
    x: number
    y: number
  }) {
    clearTimeout(timeout)
    tooltipScarfService(engine, {
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
    tooltipScarfService(engine, null)
  }
</script>

<BasePlot {item}>
  {#snippet header()}
    <ScarfPlotHeader
      {item}
      settings={effectiveSettings}
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
