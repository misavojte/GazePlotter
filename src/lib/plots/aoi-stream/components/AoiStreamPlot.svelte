<script lang="ts">
  import { untrack } from 'svelte'

  import {
    AoiStreamPlotFigure,
    AoiStreamPlotButtonMenu,
  } from '$lib/plots/aoi-stream/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import Select from '$lib/shared/components/GeneralSelect.svelte'

  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '$lib/plots/shared'
  import { getAoiStreamPlotData, type CollectorWorkspace } from '../core'
  import {
    scanForDynamicRidgelineReferenceHeight,
    scanForSynchronizedTimelineMax,
  } from '../sync'
  import { getParticipants, getParticipantEndTime } from '$lib/data/engine'
  import { getGazePlotterSession, getGridState } from '$lib/session'
  import { RIDGELINE_SCALE } from '../const'

  import type {
    AoiStreamPlotItem,
    AoiStreamPlotSettings,
  } from '$lib/plots/aoi-stream/types'
  import type { AoiStreamPlotResult } from '../types'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  import { PreviewModel } from '$lib/plots/shared'
  import { interpolateColor } from '$lib/color/utility'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import AoiStreamPlotViewSettings from './AoiStreamPlotViewSettings.svelte'
  import AoiStreamPlotColorSettings from './AoiStreamPlotColorSettings.svelte'

  interface Props {
    item: AoiStreamPlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const grid = getGridState()
  const settings = $derived(item.settings)

  type AoiStreamPreview = {
    binSize: number
    ridgelineScale: number
    timelineStart: number | undefined
    timelineEnd: number | undefined
    alignment: 'stream' | 'distribution' | 'ridgeline' | 'heatmap'
    colorMin: string
    colorMiddle: string
    colorMax: string
  }

  const preview = new PreviewModel<
    AoiStreamPreview,
    Partial<AoiStreamPlotSettings>
  >({
    getCommitted: () => ({
      binSize: settings.binSize ?? 500,
      ridgelineScale: settings.ridgelineScale ?? RIDGELINE_SCALE,
      timelineStart: settings.timelineStart,
      timelineEnd: settings.timelineEnd,
      alignment: settings.alignment ?? 'stream',
      colorMin: settings.colorScale?.[0] || PRESET_PALETTES.HEAT.colors[0],
      colorMax:
        settings.colorScale?.length === 3
          ? settings.colorScale[2]
          : settings.colorScale?.[1] || PRESET_PALETTES.HEAT.colors[2],
      colorMiddle:
        settings.colorScale?.length === 3
          ? settings.colorScale[1]
          : settings.colorScale?.length === 2
            ? interpolateColor(
                settings.colorScale[0],
                settings.colorScale[1],
                0.5
              )
            : PRESET_PALETTES.HEAT.colors[1],
    }),
    buildPatch: (draft, committed) => {
      const updates: Partial<AoiStreamPlotSettings> = {}

      if (draft.binSize !== committed.binSize) updates.binSize = draft.binSize
      if (draft.ridgelineScale !== committed.ridgelineScale) {
        updates.ridgelineScale = draft.ridgelineScale
      }
      if (draft.timelineStart !== committed.timelineStart) {
        updates.timelineStart = draft.timelineStart
      }
      if (draft.timelineEnd !== committed.timelineEnd) {
        updates.timelineEnd = draft.timelineEnd
      }
      if (draft.alignment !== committed.alignment) {
        updates.alignment = draft.alignment
      }

      const colorChanged =
        draft.colorMin !== committed.colorMin ||
        draft.colorMiddle !== committed.colorMiddle ||
        draft.colorMax !== committed.colorMax
      if (colorChanged) {
        const autoMiddle = interpolateColor(draft.colorMin, draft.colorMax, 0.5)
        updates.colorScale =
          draft.colorMiddle === autoMiddle
            ? [draft.colorMin, draft.colorMax]
            : [draft.colorMin, draft.colorMiddle, draft.colorMax]
      }

      return updates
    },
  })

  // Grouping them for easier passing to components (typed explicitly for AoiStreamPlotViewSettings)
  const syncs = preview.fields

  const effectiveColorScale = $derived.by(() => {
    const draft = preview.draft
    const min = draft.colorMin
    const middle = draft.colorMiddle
    const max = draft.colorMax
    const autoMiddle = interpolateColor(min, max, 0.5)
    if (middle === autoMiddle) return [min, max]
    return [min, middle, max]
  })

  const effectiveSettings = $derived.by(() => {
    const draft = preview.draft

    return {
      ...settings,
      binSize: draft.binSize,
      ridgelineScale: draft.ridgelineScale ?? RIDGELINE_SCALE,
      timelineStart: draft.timelineStart,
      timelineEnd: draft.timelineEnd,
      alignment: draft.alignment,
      colorScale: effectiveColorScale,
    }
  })

  // --- DERIVED PIPELINE ---

  const source = $derived.by(() => createCommandSourcePlotPattern(item, 'plot'))

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, effectiveSettings.stimulusId)
  )

  const timelineMinValue = $derived.by(() => {
    if ((effectiveSettings.timelineStart ?? 0) > 0)
      return effectiveSettings.timelineStart!
    return (
      effectiveSettings.absoluteStimuliLimits[
        effectiveSettings.stimulusId
      ]?.[0] ?? 0
    )
  })

  const timelineMaxValue = $derived.by(() => {
    const maxValue =
      effectiveSettings.absoluteStimuliLimits[
        effectiveSettings.stimulusId
      ]?.[1] ?? 0
    if ((effectiveSettings.timelineEnd ?? 0) > 0)
      return effectiveSettings.timelineEnd!
    if (maxValue !== 0) return maxValue

    const syncedMax = scanForSynchronizedTimelineMax(
      engine,
      grid.items,
      item.w,
      effectiveSettings.stimulusId,
      effectiveSettings.absoluteStimuliLimits
    )
    if (syncedMax !== null) return syncedMax

    const participants = getParticipants(
      engine,
      effectiveSettings.groupId,
      effectiveSettings.stimulusId
    )
    return participants.reduce(
      (max, participant) =>
        Math.max(
          max,
          getParticipantEndTime(
            engine,
            effectiveSettings.stimulusId,
            participant.id
          )
        ),
      0
    )
  })

  // --- DATA PIPELINE (Workspace-aware) ---
  let resultState = $state<{
    data: AoiStreamPlotResult | null
    workspace: CollectorWorkspace | null
  }>({
    data: null,
    workspace: null,
  })

  $effect(() => {
    const s = effectiveSettings
    const tMin = timelineMinValue
    const tMax = timelineMaxValue
    const meta = engine.metadata

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
    if (effectiveSettings.alignment !== 'ridgeline' || !streamResult)
      return null
    return scanForDynamicRidgelineReferenceHeight(
      engine,
      grid.items,
      item.h,
      item.id,
      {
        plotId: item.id,
        widthUnits: item.w,
        heightUnits: item.h,
        settings: effectiveSettings,
        streamData: streamResult,
      }
    )
  })

  // --- ACTIONS ---

  function handleMenuClose() {
    untrack(() => {
      const updates = preview.buildPatch()

      if (!updates || Object.keys(updates).length === 0) {
        preview.resetAll()
        return
      }

      const snapshotUpdates = $state.snapshot(updates)
      const snapshotSource = $state.snapshot(source)

      workspace.updateItemSettings(item.id, snapshotUpdates, snapshotSource)
      preview.resetAll()
    })
  }

  const handleStimulusChange = (event: CustomEvent) => {
    const stimulusId = parseInt(event.detail as string)
    preview.resetAll()

    if (settings.stimulusId === stimulusId) return
    workspace.updateItemSettings(item.id, { stimulusId }, source)
  }

  const handleUpperGroupChange = (event: CustomEvent) => {
    const groupId = parseInt(event.detail as string)
    preview.resetAll()

    if (settings.groupId === groupId) return
    workspace.updateItemSettings(item.id, { groupId }, source)
  }

  const handleLegendClick = (aoiId: number) => {
    const aoiIdStr = aoiId.toString()
    const currentHighlights = settings.highlights ?? []
    const isCurrentlyHighlighted = currentHighlights.includes(aoiIdStr)
    const newHighlights = isCurrentlyHighlighted
      ? currentHighlights.filter((id: string) => id !== aoiIdStr)
      : [...currentHighlights, aoiIdStr]

    workspace.updateItemSettings(item.id, { highlights: newHighlights }, source)
  }

  const selectItems = $derived([
    {
      label: 'Stimulus',
      options: stimulusOptions,
      value: effectiveSettings.stimulusId.toString(),
      onchange: handleStimulusChange,
    },
    {
      label: 'Group',
      options: groupOptions,
      value: effectiveSettings.groupId.toString(),
      onchange: handleUpperGroupChange,
    },
    {
      label: 'View',
      value: effectiveSettings.alignment ?? 'stream',
      onchange: (event: CustomEvent) => {
        // Alignment changes are mainly driven by onSelect for preview
      },
      onClose: handleMenuClose,
      options: [
        {
          value: 'stream',
          label: 'Stream',
          onSelect: (v: any) => {
            syncs.alignment.value = v
          },
          closeOnAction: false,
          component: AoiStreamPlotViewSettings,
          componentHeight: 170,
          componentProps: {
            syncs,
          },
        },
        {
          value: 'distribution',
          label: 'Distribution',
          onSelect: (v: any) => {
            syncs.alignment.value = v
          },
          closeOnAction: false,
          component: AoiStreamPlotViewSettings,
          componentHeight: 170,
          componentProps: {
            syncs,
          },
        },
        {
          value: 'ridgeline',
          label: 'Ridgeline',
          onSelect: (v: any) => {
            syncs.alignment.value = v
            // Ensure scale has a value for preview if it was undefined
            if (!syncs.ridgelineScale.value) {
              syncs.ridgelineScale.value =
                settings.ridgelineScale ?? RIDGELINE_SCALE
            }
          },
          closeOnAction: false,
          component: AoiStreamPlotViewSettings,
          componentHeight: 240,
          componentProps: {
            syncs,
          },
        },
        {
          value: 'heatmap',
          label: 'Heatmap',
          onSelect: (v: any) => {
            syncs.alignment.value = v
          },
          closeOnAction: false,
          component: AoiStreamPlotColorSettings,
          componentHeight: 140,
          componentProps: {
            syncs,
          },
        },
      ],
    },
  ])
</script>

<BasePlot {item} hasData={!!streamResult}>
  {#snippet header()}
    <div class="controls">
      <Select
        ariaLabel="AOI stream filters"
        items={selectItems}
        label="AOI Stream"
        options={[]}
      />
      <div class="menu-button">
        <AoiStreamPlotButtonMenu {item} />
      </div>
    </div>
  {/snippet}

  {#snippet figure({ width, height })}
    {#if streamResult}
      <AoiStreamPlotFigure
        {width}
        {height}
        data={streamResult}
        highlights={effectiveSettings.highlights}
        alignment={effectiveSettings.alignment ?? 'stream'}
        onLegendClick={handleLegendClick}
        {syncedMTopOverride}
        ridgelineScale={effectiveSettings.ridgelineScale}
        colorScale={effectiveSettings.colorScale}
      />
    {/if}
  {/snippet}
</BasePlot>

<style>
  .controls {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    background: inherit;
  }
  .menu-button {
    display: flex;
    align-items: center;
  }
</style>
