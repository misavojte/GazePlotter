<script lang="ts">
  import {
    getNumberOfSegments,
    getParticipantEndTime,
    getParticipants,
    hasEventsForStimulus,
  } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'
  import { onDestroy, untrack } from 'svelte'
  import { ScarfPlotFigure, ScarfPlotHeader } from '$lib/plots/scarf/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import type { ScarfDisplayMode, ScarfPlotItem, ScarfPlotSettings } from '$lib/plots/scarf/types'
  import {
    tooltipScarfService,
    transformDataToScarfPlot,
    SCARF_LAYOUT,
  } from '$lib/plots/scarf'
  import { scarfTimelineSync } from '$lib/plots/scarf/core/sync.svelte'

  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  import { PreviewModel, createMenuCloseHandler } from '$lib/plots/shared'

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
    displayMode: ScarfDisplayMode | undefined
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
      displayMode: realSettings.displayMode,
    }),
    buildPatch: (draft, committed) =>
      PreviewModel.buildSimplePatch(draft, committed, [
        'timeline', 'timelineStart', 'timelineEnd',
        'ordinalStart', 'ordinalEnd', 'hideNonFixations', 'displayMode',
      ]) as Partial<ScarfPlotSettings>,
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
      displayMode: draft.displayMode,
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
  const stimulusHasEvents = $derived(hasEventsForStimulus(engine, currentStimulusId))
  const stimulusHasSegments = $derived(engine.capabilities.segmented)

  const currentParticipantIds = $derived.by(() =>
    getParticipants(engine, currentGroupId, currentStimulusId).map(p => p.id)
  )

  // --- Cross-plot timeline-axis sync ---
  // Sync applies only when the user has left every range field at its default:
  // no global timelineStart/End (or ordinalStart/End in ordinal mode) AND no
  // legacy per-stimulus limits. The sync key is (timeline, w, h) — 'relative'
  // mode is fixed 0–100 and always opts out.
  const ownDataMax = $derived.by(() => {
    redrawTimestamp
    const timeline = effectiveSettings.timeline
    if (timeline === 'relative') return 0
    const isOrdinal = timeline === 'ordinal'
    let max = 0
    for (const pid of currentParticipantIds) {
      const v = isOrdinal
        ? getNumberOfSegments(engine, currentStimulusId, pid)
        : getParticipantEndTime(engine, currentStimulusId, pid)
      if (v > max) max = v
    }
    return max
  })

  const isDefaultRange = $derived.by(() => {
    const s = effectiveSettings
    if (s.timeline === 'relative') return false
    if (s.timeline === 'absolute') {
      const globalSet = (s.timelineStart ?? 0) > 0 || (s.timelineEnd ?? 0) > 0
      const perStim = s.absoluteStimuliLimits?.[s.stimulusId]
      const perStimSet = Array.isArray(perStim) && perStim[1] > 0
      return !globalSet && !perStimSet
    }
    const globalSet = (s.ordinalStart ?? 0) > 0 || (s.ordinalEnd ?? 0) > 0
    const perStim = s.ordinalStimuliLimits?.[s.stimulusId]
    const perStimSet = Array.isArray(perStim) && perStim[1] > 0
    return !globalSet && !perStimSet
  })

  $effect(() => {
    if (!isDefaultRange) {
      scarfTimelineSync.clearEntry(item.id)
      return
    }
    scarfTimelineSync.setEntry(item.id, {
      timeline: effectiveSettings.timeline as 'absolute' | 'ordinal',
      w: item.w,
      h: item.h,
      dataMax: ownDataMax,
    })
  })
  onDestroy(() => scarfTimelineSync.clearEntry(item.id))

  // Inject the synced max into the transformer input as timelineEnd/ordinalEnd.
  // This reuses the transformer's existing "user set an end" code path to
  // widen the axis — scarfData.timeline.maxValue comes out at the synced value,
  // and downstream layout / renderer logic Just Works. The ScarfPlotFigure
  // still receives un-injected effectiveSettings so the x-axis label and the
  // existing drag → preview.draft flow aren't affected.
  const syncedSettings = $derived.by(() => {
    if (!isDefaultRange) return effectiveSettings
    const timeline = effectiveSettings.timeline as 'absolute' | 'ordinal'
    const syncedMax = scarfTimelineSync.getSyncedMax(timeline, item.w, item.h)
    if (syncedMax <= ownDataMax) return effectiveSettings
    return timeline === 'absolute'
      ? { ...effectiveSettings, timelineEnd: syncedMax }
      : { ...effectiveSettings, ordinalEnd: syncedMax }
  })

  const scarfData = $derived.by(() => {
    // Dependencies: syncedSettings (which tracks effectiveSettings + sync),
    // currentParticipantIds, redrawTimestamp
    redrawTimestamp
    const meta = engine.metadata
    if (!meta) return null
    return transformDataToScarfPlot(
      engine,
      currentStimulusId,
      currentParticipantIds,
      syncedSettings,
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

  const handleMenuClose = createMenuCloseHandler(preview, patch =>
    workspace.updateItemSettings(item.id, patch, createCommandSourcePlotPattern(item, 'plot'))
  )

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
      {stimulusHasEvents}
      {stimulusHasSegments}
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
