import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { toggleSettingEntry } from '$lib/plots/shared'
import { useSyncedMax } from '$lib/plots/shared/plotSync.svelte'
import { plotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
import { getParticipantsIds } from '$lib/data/engine'
import { buildScarfTooltipContent } from './tooltip'
import { scarfDataMax, scarfRange } from './transformer'
import { visibleHighlights, type ScarfView } from './view'
import type { ScarfPlotSettings } from '../types'

type DragOverrides = Partial<
  Pick<
    ScarfPlotSettings,
    'timelineStart' | 'timelineEnd' | 'ordinalStart' | 'ordinalEnd'
  >
>

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
export const scarfScreen: PlotScreenFactory<ScarfPlotSettings, ScarfView> = ctx => {
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
    const ids = getParticipantsIds(ctx.engine, s, s.stimulusId)
    return scarfDataMax(ctx.engine, s.stimulusId, ids, s.timeline === 'ordinal')
  })

  const plotCursor = plotCursorPort(ctx.item.id, {
    timeScope: () => absoluteTimeScope(effectiveSettings),
    stimulus: () => effectiveSettings.stimulusId,
  })

  const isDefaultRange = $derived.by(() => {
    const s = effectiveSettings
    if (s.timeline === 'relative') return false
    const { start, end, limits } = scarfRange(s)
    return !(start > 0 || end > 0) && !(Array.isArray(limits) && limits[1] > 0)
  })

  // Same-width scarfs of one timeline mode ('absolute' | 'ordinal') share their
  // timeline max: the axis's pixel scale depends on width alone, so height is
  // not in the key. 'relative' is a fixed 0-100 scale and never syncs; any
  // customized range opts the plot out.
  const syncedMax = useSyncedMax(ctx, 'scarf-timeline', () =>
    isDefaultRange
      ? { key: [effectiveSettings.timeline, ctx.item.w], own: ownDataMax }
      : null
  )

  const currentData = () => ctx.view()?.props.data ?? null

  const handleLegendClick = (identifier: string) =>
    toggleSettingEntry(ctx, 'highlights', identifier)

  function handleDragStepX(stepChange: number, width: number) {
    if (effectiveSettings.timeline === 'relative') return
    const { startKey, endKey, start, end } = scarfRange(effectiveSettings)
    const min = start > 0 ? start : (currentData()?.timeline.minValue ?? 0)
    const max = end > 0 ? end : (currentData()?.timeline.maxValue ?? 100)
    const visibleRange = max - min
    const moveAmount = -stepChange * (visibleRange / width)
    const newMin = Math.max(0, min + moveAmount)
    const newMax = max + moveAmount + (newMin - (min + moveAmount))

    const roundedMin = Math.round(newMin * 1000) / 1000
    const roundedMax = Math.round(newMax * 1000) / 1000

    dragOverrides = { [startKey]: roundedMin, [endKey]: roundedMax }
  }

  function handleDragEnd() {
    if (!dragOverrides) return
    const { startKey: keyStart, endKey: keyEnd } = scarfRange(effectiveSettings)
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
      const max = syncedMax()
      if (max === null) return effectiveSettings
      return { ...effectiveSettings, [scarfRange(effectiveSettings).endKey]: max }
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
