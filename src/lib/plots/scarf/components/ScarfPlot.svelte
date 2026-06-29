<script lang="ts">
  import {
    getNumberOfSegments,
    getParticipantEndTime,
    getParticipants,
  } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'
  import { onDestroy } from 'svelte'
  import ScarfPlotFigure from './ScarfPlotFigure.svelte'
  import { BasePlot } from '$lib/plots/shared/components'
  import type {
    ScarfPlotItem,
    ScarfPlotSettings,
  } from '$lib/plots/scarf/types'
  import { tooltipScarfService, SCARF_LAYOUT } from '$lib/plots/scarf'
  import { getScarfData } from '$lib/plots/scarf/core/view'
  import { scarfTimelineSync } from '$lib/plots/scarf/core/sync.svelte'
  import { usePlotSync } from '$lib/plots/shared/PlotSyncRegistry.svelte'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  interface Props {
    item: ScarfPlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const realSettings = $derived(item.settings)

  // Transient drag-only overrides. Figure gets the overridden settings so the
  // timeline redraws while the user drags; on release we commit once.
  type DragOverrides = Partial<
    Pick<
      ScarfPlotSettings,
      'timelineStart' | 'timelineEnd' | 'ordinalStart' | 'ordinalEnd'
    >
  >
  let dragOverrides = $state<DragOverrides | null>(null)

  const effectiveSettings = $derived.by(() => {
    if (!dragOverrides) return realSettings
    return { ...realSettings, ...dragOverrides }
  })

  // State management
  let timeout = 0

  const currentGroupId = $derived(effectiveSettings.groupId)
  const currentStimulusId = $derived(effectiveSettings.stimulusId)
  const redrawTimestamp = $derived(item.redrawTimestamp)
  const highlights = $derived(realSettings.highlights ?? [])

  const currentParticipantIds = $derived.by(() =>
    getParticipants(engine, currentGroupId, currentStimulusId).map(p => p.id)
  )

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

  usePlotSync(
    scarfTimelineSync,
    () => item.id,
    () => {
      if (!isDefaultRange) return null
      return {
        timeline: effectiveSettings.timeline as 'absolute' | 'ordinal',
        w: item.w,
        dataMax: ownDataMax,
      }
    }
  )

  const syncedSettings = $derived.by(() => {
    if (!isDefaultRange) return effectiveSettings
    const timeline = effectiveSettings.timeline as 'absolute' | 'ordinal'
    const syncedMax = scarfTimelineSync.getSyncedMax(timeline, item.w)
    if (syncedMax <= ownDataMax) return effectiveSettings
    return timeline === 'absolute'
      ? { ...effectiveSettings, timelineEnd: syncedMax }
      : { ...effectiveSettings, ordinalEnd: syncedMax }
  })

  const scarfData = $derived.by(() => {
    void redrawTimestamp
    // Same data derivation the export modal renders from, with the screen's
    // sync-adjusted settings.
    return getScarfData(engine, syncedSettings)
  })

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

  function handleDragStepX(stepChange: number, width: number) {
    if (effectiveSettings.timeline === 'relative') return
    const visibleRange = timelineMax - timelineMin
    const moveAmount = -stepChange * (visibleRange / width)
    const newMin = Math.max(0, timelineMin + moveAmount)
    const newMax =
      timelineMax + moveAmount + (newMin - (timelineMin + moveAmount))

    const roundedMin = Math.round(newMin * 1000) / 1000
    const roundedMax = Math.round(newMax * 1000) / 1000

    const isOrdinal = effectiveSettings.timeline === 'ordinal'
    dragOverrides = isOrdinal
      ? { ordinalStart: roundedMin, ordinalEnd: roundedMax }
      : { timelineStart: roundedMin, timelineEnd: roundedMax }
  }

  function handleDragEnd() {
    if (!dragOverrides) return
    workspace.updateItemSettings(
      item.id,
      dragOverrides,
      createCommandSourcePlotPattern(item, 'plot')
    )
    dragOverrides = null
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
  {#snippet figure({ width, height })}
    {@const data = scarfData}
    <div class="scarf-viewport" style:height="{Math.floor(height)}px">
      {#if data}
        <ScarfPlotFigure
          {width}
          {height}
          data={scarfData}
          settings={effectiveSettings}
          {highlights}
          onLegendClick={handleLegendClick}
          onTooltipActivation={handleTooltipActivation}
          onTooltipDeactivation={handleTooltipDeactivation}
          onDragStepX={step => handleDragStepX(step, width)}
          onDragEnd={handleDragEnd}
          margins={{
            top: PLOT_MARGIN.TOP,
            right: PLOT_MARGIN.RIGHT,
            bottom: PLOT_MARGIN.BOTTOM,
            left: PLOT_MARGIN.LEFT,
          }}
        />
      {/if}
    </div>
  {/snippet}
</BasePlot>
