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
    scanForDynamicStripHeight,
    scanForSynchronizedTimelineMax,
  } from '../sync'
  import {
    getParticipants,
    getParticipantEndTime,
    engine,
  } from '$lib/data/engine'
  import { RIDGELINE_SCALE } from '../const'

  import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'
  import type { AoiStreamPlotResult } from '../types'
  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  import { grid } from '$lib/workspace/grid/store.svelte'
  import { PreviewSync } from '$lib/plots/shared'
  import { interpolateColor } from '$lib/color/utility'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import AoiStreamPlotViewSettings from './AoiStreamPlotViewSettings.svelte'
  import AoiStreamPlotColorSettings from './AoiStreamPlotColorSettings.svelte'

  interface Props {
    settings: AoiStreamPlotGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  // --- PREVIEW SYNC STATE ---
  // We use PreviewSync to manage "preview" vs "committed" state for settings.
  // This allows submenus to share the same preview state (carrying over changes).

  const binSizeSync = new PreviewSync<number>(() => settings.binSize ?? 500)
  const ridgelineScaleSync = new PreviewSync<number>(
    () => settings.ridgelineScale ?? RIDGELINE_SCALE
  )
  const timelineStartSync = new PreviewSync<number | undefined>(
    () => settings.timelineStart
  )
  const timelineEndSync = new PreviewSync<number | undefined>(
    () => settings.timelineEnd
  )
  const alignmentSync = new PreviewSync<
    'stream' | 'distribution' | 'ridgeline' | 'heatmap'
  >(() => settings.alignment ?? 'stream')

  const colorMinSync = new PreviewSync<string>(
    () => settings.colorScale?.[0] || PRESET_PALETTES.HEAT.colors[0]
  )
  const colorMaxSync = new PreviewSync<string>(() =>
    settings.colorScale?.length === 3
      ? settings.colorScale[2]
      : settings.colorScale?.[1] || PRESET_PALETTES.HEAT.colors[2]
  )
  const colorMiddleSync = new PreviewSync<string>(() =>
    settings.colorScale?.length === 3
      ? settings.colorScale[1]
      : settings.colorScale?.length === 2
        ? interpolateColor(settings.colorScale[0], settings.colorScale[1], 0.5)
        : PRESET_PALETTES.HEAT.colors[1]
  )

  // Grouping them for easier passing to components (typed explicitly for AoiStreamPlotViewSettings)
  const syncs = {
    binSize: binSizeSync,
    ridgelineScale: ridgelineScaleSync,
    timelineStart: timelineStartSync,
    timelineEnd: timelineEndSync,
    // alignmentSync is handled separately in the menu structure but contributes to effectiveSettings
    colorMin: colorMinSync,
    colorMiddle: colorMiddleSync,
    colorMax: colorMaxSync,
  }

  const effectiveColorScale = $derived.by(() => {
    const min = colorMinSync.value
    const middle = colorMiddleSync.value
    const max = colorMaxSync.value
    const autoMiddle = interpolateColor(min, max, 0.5)
    if (middle === autoMiddle) return [min, max]
    return [min, middle, max]
  })

  const effectiveSettings = $derived({
    ...settings,
    binSize: binSizeSync.value,
    ridgelineScale: ridgelineScaleSync.value ?? RIDGELINE_SCALE,
    timelineStart: timelineStartSync.value,
    timelineEnd: timelineEndSync.value,
    alignment: alignmentSync.value as
      | 'stream'
      | 'distribution'
      | 'ridgeline'
      | 'heatmap',
    colorScale: effectiveColorScale,
  })

  // --- DERIVED PIPELINE ---

  const source = $derived.by(() =>
    createCommandSourcePlotPattern(effectiveSettings, 'plot')
  )

  const stimulusOptions = $derived(getStimuliOptions())
  const groupOptions = $derived(getParticipantsGroupOptions())

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
      grid.items,
      effectiveSettings.w,
      effectiveSettings.stimulusId,
      effectiveSettings.absoluteStimuliLimits
    )
    if (syncedMax !== null) return syncedMax

    const participants = getParticipants(
      effectiveSettings.groupId,
      effectiveSettings.stimulusId
    )
    return participants.reduce(
      (max, participant) =>
        Math.max(
          max,
          getParticipantEndTime(effectiveSettings.stimulusId, participant.id)
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
      try {
        const { data, workspace } = getAoiStreamPlotData(
          {
            ...s,
            timelineMin: tMin,
            timelineMax: tMax,
          },
          resultState.workspace
        )
        resultState.data = data
        resultState.workspace = workspace
      } catch (e) {
        console.error('Failed to fetch AOI stream data:', e)
        resultState.data = null
      }
    })
  })

  const streamResult = $derived(resultState.data)

  const stripHeightOverride = $derived.by(() => {
    if (effectiveSettings.alignment !== 'heatmap') return null
    return scanForDynamicStripHeight(
      grid.items,
      effectiveSettings.h,
      effectiveSettings.id
    )
  })

  // --- ACTIONS ---

  function handleMenuClose() {
    untrack(() => {
      const updates: Partial<AoiStreamPlotGridType> = {}

      if (binSizeSync.isDirty) updates.binSize = binSizeSync.value
      if (ridgelineScaleSync.isDirty)
        updates.ridgelineScale = ridgelineScaleSync.value
      if (timelineStartSync.isDirty)
        updates.timelineStart = timelineStartSync.value
      if (timelineEndSync.isDirty) updates.timelineEnd = timelineEndSync.value
      if (alignmentSync.isDirty) updates.alignment = alignmentSync.value as any

      if (
        colorMinSync.isDirty ||
        colorMiddleSync.isDirty ||
        colorMaxSync.isDirty
      ) {
        updates.colorScale = effectiveSettings.colorScale
      }

      // Only dispatch if there are actual diffs
      if (Object.keys(updates).length === 0) {
        // Just reset previews to be safe (cleans up any accidental state)
        binSizeSync.reset()
        ridgelineScaleSync.reset()
        timelineStartSync.reset()
        timelineEndSync.reset()
        alignmentSync.reset()
        colorMinSync.reset()
        colorMiddleSync.reset()
        colorMaxSync.reset()
        return
      }

      // Snapshot to ensure we send raw values, decoupling from reactive proxies
      const snapshotUpdates = $state.snapshot(updates)
      const snapshotSource = $state.snapshot(source)

      onWorkspaceCommand({
        type: 'updateSettings',
        itemId: settings.id,
        source: snapshotSource,
        settings: snapshotUpdates,
      })

      // IMPORTANT: Reset previews after dispatching.
      // The command will eventually update props, which will update committed values via $effect.
      binSizeSync.reset()
      ridgelineScaleSync.reset()
      timelineStartSync.reset()
      timelineEndSync.reset()
      alignmentSync.reset()
      colorMinSync.reset()
      colorMiddleSync.reset()
      colorMaxSync.reset()
    })
  }

  const handleStimulusChange = (event: CustomEvent) => {
    const stimulusId = parseInt(event.detail as string)
    // Reset preview on structural change
    binSizeSync.reset()
    ridgelineScaleSync.reset()
    timelineStartSync.reset()
    timelineEndSync.reset()
    alignmentSync.reset()

    if (settings.stimulusId === stimulusId) return
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      source,
      settings: { stimulusId },
    })
  }

  const handleUpperGroupChange = (event: CustomEvent) => {
    const groupId = parseInt(event.detail as string)
    // Reset preview on structural change
    binSizeSync.reset()
    ridgelineScaleSync.reset()
    timelineStartSync.reset()
    timelineEndSync.reset()
    alignmentSync.reset()

    if (settings.groupId === groupId) return
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      source,
      settings: { groupId },
    })
  }

  const handleLegendClick = (aoiId: number) => {
    const aoiIdStr = aoiId.toString()
    const currentHighlights = settings.highlights ?? []
    const isCurrentlyHighlighted = currentHighlights.includes(aoiIdStr)
    const newHighlights = isCurrentlyHighlighted
      ? currentHighlights.filter(id => id !== aoiIdStr)
      : [...currentHighlights, aoiIdStr]

    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      source,
      settings: { highlights: newHighlights },
    })
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
            alignmentSync.value = v
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
            alignmentSync.value = v
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
            alignmentSync.value = v
            // Ensure scale has a value for preview if it was undefined
            if (!ridgelineScaleSync.value) {
              ridgelineScaleSync.value =
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
            alignmentSync.value = v
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

<BasePlot settings={effectiveSettings} hasData={!!streamResult}>
  {#snippet header()}
    <div class="controls">
      <Select
        ariaLabel="AOI stream filters"
        items={selectItems}
        label="AOI Stream"
        options={[]}
      />
      <div class="menu-button">
        <AoiStreamPlotButtonMenu {settings} {onWorkspaceCommand} />
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
        {stripHeightOverride}
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
