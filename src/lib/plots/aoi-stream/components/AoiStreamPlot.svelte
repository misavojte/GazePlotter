<script lang="ts">
  import AoiStreamPlotFigure from './AoiStreamPlotFigure.svelte'
  import { BasePlot } from '$lib/plots/shared/components'

  import { computeAoiStreamData } from '../core/view'
  import { computeMTop } from '../core/ridgeline'
  import {
    aoiStreamTimelineSync,
    aoiStreamRidgelineSync,
  } from '../core/sync.svelte'
  import { RIDGELINE_SCALE } from '../const'
  import { getGazePlotterSession } from '$lib/session'
  import {
    getParticipants,
    getParticipantEndTime,
  } from '$lib/data/engine'

  import type { AoiStreamPlotItem } from '$lib/plots/aoi-stream/types'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { toggleInArray } from '$lib/plots/shared'
  import { usePlotData } from '$lib/plots/shared/plotData.svelte'
  import { usePlotSync } from '$lib/plots/shared/PlotSyncRegistry.svelte'

  interface Props {
    item: AoiStreamPlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived.by(() => createCommandSourcePlotPattern(item, 'plot'))

  // ── Cross-plot timeline sync (same width, fully-auto timeline) ──
  // A plot participates only while its timeline is fully auto: no global
  // `timelineEnd` and no per-stimulus limits. Customizing any range opts out.
  const isFullyAuto = $derived.by(() => {
    const limits = settings.absoluteStimuliLimits?.[settings.stimulusId]
    return (
      (settings.timelineEnd ?? 0) === 0 &&
      (limits?.[0] ?? 0) === 0 &&
      (limits?.[1] ?? 0) === 0
    )
  })

  const ownDataMax = $derived.by(() => {
    void item.redrawTimestamp
    if (!isFullyAuto) return 0
    let max = 0
    for (const p of getParticipants(engine, settings.groupId, settings.stimulusId)) {
      const v = getParticipantEndTime(engine, settings.stimulusId, p.id)
      if (v > max) max = v
    }
    return max
  })

  usePlotSync(
    aoiStreamTimelineSync,
    () => item.id,
    () => {
      if (!isFullyAuto || ownDataMax <= 0) return null
      return { w: item.w, dataMax: ownDataMax }
    }
  )

  // Screen-only: merge the synced max into the settings the transform sees.
  // Export derives from the raw settings and therefore never syncs (the same
  // rule as bar/transition-matrix).
  const syncedSettings = $derived.by(() => {
    if (!isFullyAuto) return settings
    const syncedMax = aoiStreamTimelineSync.getSyncedMax(item.w)
    if (syncedMax <= ownDataMax) return settings
    return { ...settings, timelineEnd: syncedMax }
  })

  // Same data derivation the export modal renders from. `derive` runs
  // untracked and its result lives outside the proxy layer. `item.h` is
  // deliberately NOT watched: the transform (and its display budget) depend
  // only on width, so a vertical resize must not re-run the full transform.
  const streamHandle = usePlotData({
    epoch: () => item.redrawTimestamp,
    settings: () => syncedSettings,
    viewOnly: ['highlights'],
    watch: () => item.w,
    derive: s =>
      computeAoiStreamData(engine, s, {
        itemWidth: item.w,
        itemHeight: item.h,
      }),
  })

  const streamResult = $derived(streamHandle.current)
  const hasRenderableData = $derived(
    !!streamResult && !streamResult.noMetric && streamResult.series.length > 0
  )

  // ── Cross-plot ridgeline data-scale sync (same height, scale, series count) ──
  // Registered from the plot's OWN result; the synced value only affects strip
  // rendering, never the transform, so there is no feedback loop.
  const ridgelineScaleValue = $derived(settings.ridgelineScale ?? RIDGELINE_SCALE)
  const ownMTop = $derived.by(() => {
    if (settings.alignment !== 'ridgeline' || !hasRenderableData) return null
    return computeMTop(streamResult!, true)
  })

  usePlotSync(
    aoiStreamRidgelineSync,
    () => item.id,
    () => {
      if (ownMTop === null || !streamResult) return null
      return {
        h: item.h,
        scale: ridgelineScaleValue,
        seriesCount: streamResult.series.length,
        dataMax: ownMTop,
      }
    }
  )

  const syncedMTopOverride = $derived.by(() => {
    if (ownMTop === null || !streamResult) return null
    const synced = aoiStreamRidgelineSync.getSyncedMTop(
      item.h,
      ridgelineScaleValue,
      streamResult.series.length
    )
    return synced > ownMTop ? synced : null
  })

  const handleLegendClick = (aoiId: number) => {
    workspace.updateItemSettings(
      item.id,
      {
        highlights: toggleInArray(settings.highlights ?? [], aoiId.toString()),
      },
      source
    )
  }
</script>

<BasePlot {item} hasData={!!streamResult}>
  {#snippet figure({ width, height })}
    {#if streamResult}
      <AoiStreamPlotFigure
        {width}
        {height}
        data={streamResult}
        highlights={settings.highlights}
        alignment={settings.alignment ?? 'stream'}
        onLegendClick={handleLegendClick}
        {syncedMTopOverride}
        ridgelineScale={settings.ridgelineScale}
        colorScale={settings.colorScale}
      />
    {/if}
  {/snippet}
</BasePlot>
