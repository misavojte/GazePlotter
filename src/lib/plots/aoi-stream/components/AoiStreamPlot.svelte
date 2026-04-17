<script lang="ts">
  import { untrack } from 'svelte'

  import { AoiStreamPlotFigure } from '$lib/plots/aoi-stream/components'
  import { BasePlot } from '$lib/plots/shared/components'

  import { getAoiStreamPlotData, type CollectorWorkspace } from '../core'
  import {
    scanForDynamicRidgelineReferenceHeight,
    scanForSynchronizedTimelineMax,
  } from '../sync'
  import { getParticipants, getParticipantEndTime } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'

  import type { AoiStreamPlotItem } from '$lib/plots/aoi-stream/types'
  import type { AoiStreamPlotResult } from '../types'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { toggleInArray } from '$lib/plots/shared'

  interface Props {
    item: AoiStreamPlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace, grid } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived.by(() => createCommandSourcePlotPattern(item, 'plot'))

  const timelineMinValue = $derived.by(() => {
    if ((settings.timelineStart ?? 0) > 0) return settings.timelineStart!
    return settings.absoluteStimuliLimits[settings.stimulusId]?.[0] ?? 0
  })

  const timelineMaxValue = $derived.by(() => {
    const maxValue =
      settings.absoluteStimuliLimits[settings.stimulusId]?.[1] ?? 0
    if ((settings.timelineEnd ?? 0) > 0) return settings.timelineEnd!
    if (maxValue !== 0) return maxValue

    const syncedMax = scanForSynchronizedTimelineMax(
      engine,
      grid.items,
      item.w,
      settings.stimulusId,
      settings.absoluteStimuliLimits
    )
    if (syncedMax !== null) return syncedMax

    const participants = getParticipants(
      engine,
      settings.groupId,
      settings.stimulusId
    )
    return participants.reduce(
      (max, participant) =>
        Math.max(
          max,
          getParticipantEndTime(engine, settings.stimulusId, participant.id)
        ),
      0
    )
  })

  let resultState = $state<{
    data: AoiStreamPlotResult | null
    workspace: CollectorWorkspace | null
  }>({
    data: null,
    workspace: null,
  })

  $effect(() => {
    const s = settings
    const tMin = timelineMinValue
    const tMax = timelineMaxValue
    const meta = engine.metadata
    void item.redrawTimestamp

    if (!meta) return

    untrack(() => {
      const { data, workspace } = getAoiStreamPlotData(
        engine,
        {
          ...s,
          timelineMin: tMin,
          timelineMax: tMax,
        },
        resultState.workspace
      )
      resultState.data = data
      resultState.workspace = workspace
    })
  })

  const streamResult = $derived(resultState.data)

  const syncedMTopOverride = $derived.by(() => {
    if (settings.alignment !== 'ridgeline' || !streamResult) return null
    return scanForDynamicRidgelineReferenceHeight(
      engine,
      grid.items,
      item.h,
      item.id,
      {
        plotId: item.id,
        widthUnits: item.w,
        heightUnits: item.h,
        settings,
        streamData: streamResult,
      }
    )
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
