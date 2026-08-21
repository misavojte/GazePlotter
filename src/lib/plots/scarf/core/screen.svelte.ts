import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { toggleInArray } from '$lib/plots/shared'
import { usePlotSync } from '$lib/plots/shared/PlotSyncRegistry.svelte'
import { plotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
import {
  getNumberOfSegments,
  getParticipantEndTime,
  getParticipants,
} from '$lib/data/engine'
import { buildScarfTooltipContent } from './tooltip'
import { visibleHighlights } from './view'
import { scarfTimelineSync } from './sync.svelte'
import type { ScarfPlotSettings } from '../types'

type DragOverrides = Partial<
  Pick<
    ScarfPlotSettings,
    'timelineStart' | 'timelineEnd' | 'ordinalStart' | 'ordinalEnd'
  >
>

type TimelineShape = { timeline: { minValue: number; maxValue: number } }

/**
 * The plot's TIME-channel scope: only 'absolute' x is elapsed ms — 'ordinal' is a
 * segment index and 'relative' a percent of each row's own session, so a shared
 * ms would be a lie in both. `null` keeps the plot out of BOTH directions, which
 * is why the figure carries no mode conditional. Exported to be pinned.
 */
export const absoluteTimeScope = (settings: ScarfPlotSettings): number | null =>
  settings.timeline === 'absolute' ? settings.stimulusId : null

/**
 * Screen recipe: cross-plot timeline sync, drag-to-pan with transient
 * overrides (committed as one settings command on release), the shared PLOT
 * CURSOR, segment-tooltip content, and legend highlight toggling. Export renders
 * the raw view with noop handlers, no sync and no cursor.
 */
export const scarfScreen: PlotScreenFactory<ScarfPlotSettings> = ctx => {
  const timelineSync = scarfTimelineSync()

  // Transient drag-only overrides. The view derives from the overridden
  // settings so the timeline redraws while the user drags; release commits once.
  let dragOverrides = $state<DragOverrides | null>(null)

  const effectiveSettings = $derived.by(() => {
    const real = ctx.item.settings
    if (!dragOverrides) return real
    return { ...real, ...dragOverrides }
  })

  const ownDataMax = $derived.by(() => {
    void ctx.item.redrawTimestamp
    const s = effectiveSettings
    if (s.timeline === 'relative') return 0
    const isOrdinal = s.timeline === 'ordinal'
    let max = 0
    for (const p of getParticipants(ctx.engine, s.groupId, s.stimulusId)) {
      const v = isOrdinal
        ? getNumberOfSegments(ctx.engine, s.stimulusId, p.id)
        : getParticipantEndTime(ctx.engine, s.stimulusId, p.id)
      if (v > max) max = v
    }
    return max
  })

  const plotCursor = plotCursorPort(ctx.item.id, () =>
    absoluteTimeScope(effectiveSettings)
  )

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
    timelineSync,
    () => ctx.item.id,
    () => {
      if (!isDefaultRange) return null
      return {
        timeline: effectiveSettings.timeline as 'absolute' | 'ordinal',
        w: ctx.item.w,
        dataMax: ownDataMax,
      }
    }
  )

  const currentData = () =>
    (ctx.view()?.props.data ?? null) as TimelineShape | null

  const timelineMin = () => {
    const s = effectiveSettings
    if (s.timeline === 'absolute') {
      if ((s.timelineStart ?? 0) > 0) return s.timelineStart!
    } else if (s.timeline === 'ordinal') {
      if ((s.ordinalStart ?? 0) > 0) return s.ordinalStart!
    }
    return currentData()?.timeline.minValue ?? 0
  }

  const timelineMax = () => {
    const s = effectiveSettings
    if (s.timeline === 'absolute') {
      if ((s.timelineEnd ?? 0) > 0) return s.timelineEnd!
    } else if (s.timeline === 'ordinal') {
      if ((s.ordinalEnd ?? 0) > 0) return s.ordinalEnd!
    }
    return currentData()?.timeline.maxValue ?? 100
  }

  function handleLegendClick(identifier: string) {
    ctx.workspace.updateItemSettings(
      ctx.item.id,
      { highlights: toggleInArray(ctx.item.settings.highlights ?? [], identifier) },
      createCommandSourcePlotPattern(ctx.item, 'plot')
    )
  }

  function handleDragStepX(stepChange: number, width: number) {
    if (effectiveSettings.timeline === 'relative') return
    const min = timelineMin()
    const max = timelineMax()
    const visibleRange = max - min
    const moveAmount = -stepChange * (visibleRange / width)
    const newMin = Math.max(0, min + moveAmount)
    const newMax = max + moveAmount + (newMin - (min + moveAmount))

    const roundedMin = Math.round(newMin * 1000) / 1000
    const roundedMax = Math.round(newMax * 1000) / 1000

    const isOrdinal = effectiveSettings.timeline === 'ordinal'
    dragOverrides = isOrdinal
      ? { ordinalStart: roundedMin, ordinalEnd: roundedMax }
      : { timelineStart: roundedMin, timelineEnd: roundedMax }
  }

  function handleDragEnd() {
    if (!dragOverrides) return

    const isOrdinal = effectiveSettings.timeline === 'ordinal'
    const keyStart = isOrdinal ? 'ordinalStart' : 'timelineStart'
    const keyEnd = isOrdinal ? 'ordinalEnd' : 'timelineEnd'

    const valStart = dragOverrides[keyStart]
    const valEnd = dragOverrides[keyEnd]

    const roundedLimitMax = Math.round(ownDataMax * 1000) / 1000

    if (valStart === 0 && valEnd !== undefined && valEnd >= roundedLimitMax) {
      dragOverrides[keyEnd] = 0
    }

    ctx.workspace.updateItemSettings(
      ctx.item.id,
      dragOverrides,
      createCommandSourcePlotPattern(ctx.item, 'plot')
    )
    dragOverrides = null
  }

  return {
    // Screen settings: drag overrides + cross-plot timeline sync merged in.
    // Export derives from the raw item settings (no drag, no sync).
    settings: () => {
      if (!isDefaultRange) return effectiveSettings
      const timeline = effectiveSettings.timeline as 'absolute' | 'ordinal'
      const syncedMax = timelineSync.getSyncedMax(timeline, ctx.item.w)
      if (syncedMax <= ownDataMax) return effectiveSettings
      return timeline === 'absolute'
        ? { ...effectiveSettings, timelineEnd: syncedMax }
        : { ...effectiveSettings, ordinalEnd: syncedMax }
    },
    props: () => ({
      highlights: visibleHighlights(ctx.engine, ctx.item.settings),
      onLegendClick: handleLegendClick,
      getTooltipContent: (participantId: number, segmentOrderId: number) =>
        buildScarfTooltipContent(
          ctx.engine,
          effectiveSettings.stimulusId,
          participantId,
          segmentOrderId
        ),
      onDragStepX: handleDragStepX,
      onDragEnd: handleDragEnd,
      margin: 0,
      plotCursor,
    }),
  }
}
