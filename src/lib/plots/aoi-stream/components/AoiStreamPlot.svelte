<script lang="ts">
  import { untrack } from 'svelte'
  import { createMenuComponentItem } from '$lib/context-menu'

  import {
    AoiStreamPlotFigure,
    AoiStreamPlotButtonMenu,
  } from '$lib/plots/aoi-stream/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import GroupSelect from '$lib/shared/components/GroupSelect.svelte'
  import type { GroupSelectItem } from '$lib/shared/components'

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
  import { getGazePlotterSession } from '$lib/session'
  import { RIDGELINE_SCALE } from '../const'

  import type {
    AoiStreamPlotItem,
    AoiStreamPlotSettings,
  } from '$lib/plots/aoi-stream/types'
  import type { AoiStreamPlotResult } from '../types'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  import {
    PreviewModel,
    createMenuCloseHandler,
    getColorScaleCommitted,
    buildColorScalePatch,
    deriveEffectiveColorScale,
  } from '$lib/plots/shared'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import AoiStreamPlotViewSettings from './AoiStreamPlotViewSettings.svelte'
  import AoiStreamPlotColorSettings from './AoiStreamPlotColorSettings.svelte'

  interface Props {
    item: AoiStreamPlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace, grid } = getGazePlotterSession()
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
      ...getColorScaleCommitted(settings.colorScale, PRESET_PALETTES.HEAT.colors[0], PRESET_PALETTES.HEAT.colors[2]),
    }),
    buildPatch: (draft, committed) => {
      const updates: Partial<AoiStreamPlotSettings> = {
        ...PreviewModel.buildSimplePatch(draft, committed, [
          'binSize', 'ridgelineScale', 'timelineStart', 'timelineEnd', 'alignment',
        ]),
      }

      const colorScale = buildColorScalePatch(draft, committed)
      if (colorScale) updates.colorScale = colorScale

      return updates
    },
  })

  // Grouping them for easier passing to components (typed explicitly for AoiStreamPlotViewSettings)
  const syncs = preview.fields

  const effectiveColorScale = $derived(deriveEffectiveColorScale(preview.draft))

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

  const handleMenuClose = createMenuCloseHandler(preview, patch =>
    workspace.updateItemSettings(item.id, patch, $state.snapshot(source))
  )

  const handleStimulusChange = (event: CustomEvent<string>) => {
    const stimulusId = parseInt(event.detail)
    preview.resetAll()

    if (settings.stimulusId === stimulusId) return
    workspace.updateItemSettings(item.id, { stimulusId }, source)
  }

  const handleUpperGroupChange = (event: CustomEvent<string>) => {
    const groupId = parseInt(event.detail)
    preview.resetAll()

    if (settings.groupId === groupId) return
    workspace.updateItemSettings(item.id, { groupId }, source)
  }

  function previewAlignment(value?: string) {
    if (
      value !== 'stream' &&
      value !== 'distribution' &&
      value !== 'ridgeline' &&
      value !== 'heatmap'
    ) {
      return
    }

    syncs.alignment.value = value
    return value
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

  const selectItems = $derived<GroupSelectItem[]>([
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
        // Alignment changes are mainly driven by onAction for preview
      },
      onClose: handleMenuClose,
      options: [
        createMenuComponentItem({
          value: 'stream',
          label: 'Stream',
          onAction: previewAlignment,
          closeOnAction: false,
          component: AoiStreamPlotViewSettings,
          componentHeight: 170,
          componentProps: {
            syncs,
          },
        }),
        createMenuComponentItem({
          value: 'distribution',
          label: 'Distribution',
          onAction: previewAlignment,
          closeOnAction: false,
          component: AoiStreamPlotViewSettings,
          componentHeight: 170,
          componentProps: {
            syncs,
          },
        }),
        createMenuComponentItem({
          value: 'ridgeline',
          label: 'Ridgeline',
          onAction: v => {
            const alignment = previewAlignment(v)
            // Ensure scale has a value for preview if it was undefined
            if (alignment === 'ridgeline' && !syncs.ridgelineScale.value) {
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
        }),
        createMenuComponentItem({
          value: 'heatmap',
          label: 'Heatmap',
          onAction: previewAlignment,
          closeOnAction: false,
          component: AoiStreamPlotColorSettings,
          componentHeight: 140,
          componentProps: {
            syncs,
          },
        }),
      ],
    },
  ])
</script>

<BasePlot {item} hasData={!!streamResult}>
  {#snippet header()}
    <div class="plot-controls">
      <GroupSelect ariaLabel="AOI stream filters" items={selectItems} />
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
  .menu-button {
    display: flex;
    align-items: center;
  }
</style>
