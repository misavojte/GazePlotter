<script lang="ts">
  import { untrack } from 'svelte'

  import {
    AoiStreamPlotFigure,
    AoiStreamPlotButtonMenu,
  } from '$lib/plots/aoi-stream/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import Select from '$lib/shared/components/GeneralSelect.svelte'

  import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid'
  import {
    calculatePlotDimensionsWithHeader,
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '$lib/plots/shared'
  import { getAoiStreamPlotData } from '../core'
  import {
    scanForDynamicStripHeight,
    scanForSynchronizedTimelineMax,
  } from '../sync'
  import {
    getParticipants,
    getParticipantEndTime,
    engine,
  } from '$lib/data/engine'
  import { HEADER_HEIGHT, RIDGELINE_SCALE } from '../const'

  import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'
  import type { AoiStreamPlotResult } from '../types'
  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  import { grid } from '$lib/workspace/grid/store.svelte'
  import { PreviewSync } from '$lib/plots/shared'
  import AoiStreamPlotAlignmentSettings from './AoiStreamPlotAlignmentSettings.svelte'

  const LAYOUT = {
    headerHeight: HEADER_HEIGHT,
  }

  interface Props {
    settings: AoiStreamPlotGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  // --- PREVIEW SYNC STATE ---
  // We use PreviewSync to manage "preview" vs "committed" state for settings.
  // This allows submenus to share the same preview state (carrying over changes).

  const binSizeSync = new PreviewSync(settings.binSize)
  const ridgelineScaleSync = new PreviewSync(settings.ridgelineScale)
  const timelineStartSync = new PreviewSync(settings.timelineStart)
  const timelineEndSync = new PreviewSync(settings.timelineEnd)
  const alignmentSync = new PreviewSync(settings.alignment)

  // Explicitly sync committed values when props change
  $effect(() => {
    binSizeSync.updateCommitted(settings.binSize, true)
    ridgelineScaleSync.updateCommitted(settings.ridgelineScale, true)
    timelineStartSync.updateCommitted(settings.timelineStart, true)
    timelineEndSync.updateCommitted(settings.timelineEnd, true)
    alignmentSync.updateCommitted(settings.alignment, true)
  })

  // Grouping them for easier passing to components (typed explicitly for AoiStreamPlotAlignmentSettings)
  const syncs = {
    binSize: binSizeSync,
    ridgelineScale: ridgelineScaleSync,
    timelineStart: timelineStartSync,
    timelineEnd: timelineEndSync,
    // alignmentSync is handled separately in the menu structure but contributes to effectiveSettings
  }

  const effectiveSettings = $derived({
    ...settings,
    binSize: binSizeSync.value,
    ridgelineScale: ridgelineScaleSync.value ?? RIDGELINE_SCALE,
    timelineStart: timelineStartSync.value,
    timelineEnd: timelineEndSync.value,
    alignment: alignmentSync.value,
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

  // PLOT DATA: Driven by effectiveSettings for live preview
  const streamResult: AoiStreamPlotResult | null = $derived.by(() => {
    // Explicit deps for clarity
    effectiveSettings.binSize
    effectiveSettings.alignment
    effectiveSettings.timelineStart
    effectiveSettings.timelineEnd
    effectiveSettings.ridgelineScale
    effectiveSettings.stimulusId
    effectiveSettings.groupId
    effectiveSettings.redrawTimestamp
    engine.metadata
    timelineMaxValue

    return getAoiStreamPlotData({
      ...effectiveSettings,
      timelineMin: timelineMinValue,
      timelineMax: timelineMaxValue,
    })
  })

  const plotDimensions = $derived.by(() =>
    calculatePlotDimensionsWithHeader(
      effectiveSettings.w,
      effectiveSettings.h,
      DEFAULT_GRID_CONFIG,
      LAYOUT.headerHeight
    )
  )

  const stripHeightOverride = $derived.by(() => {
    if (effectiveSettings.alignment !== 'ridgeline') return null
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

      // Only dispatch if there are actual diffs
      if (Object.keys(updates).length === 0) {
        // Just reset previews to be safe (cleans up any accidental state)
        binSizeSync.reset()
        ridgelineScaleSync.reset()
        timelineStartSync.reset()
        timelineEndSync.reset()
        alignmentSync.reset()
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
      label: 'Alignment',
      value: effectiveSettings.alignment ?? 'center',
      onchange: (event: CustomEvent) => {
        // Alignment changes are mainly driven by onSelect for preview
      },
      onClose: handleMenuClose,
      options: [
        {
          value: 'center',
          label: 'Center',
          onSelect: (v: any) => {
            alignmentSync.value = v
          },
          closeOnAction: false,
          component: AoiStreamPlotAlignmentSettings,
          componentHeight: 170,
          componentProps: {
            syncs,
          },
        },
        {
          value: 'bottom',
          label: 'Bottom',
          onSelect: (v: any) => {
            alignmentSync.value = v
          },
          closeOnAction: false,
          component: AoiStreamPlotAlignmentSettings,
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
          component: AoiStreamPlotAlignmentSettings,
          componentHeight: 240,
          componentProps: {
            syncs,
          },
        },
      ],
    },
  ])
</script>

<BasePlot
  settings={effectiveSettings}
  layoutConfig={LAYOUT}
  hasData={!!streamResult}
  dimensions={plotDimensions}
>
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
        alignment={effectiveSettings.alignment ?? 'center'}
        onLegendClick={handleLegendClick}
        {stripHeightOverride}
        ridgelineScale={effectiveSettings.ridgelineScale}
      />
    {/if}
  {/snippet}
</BasePlot>

<style>
  .controls {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    background: inherit;
  }
  .menu-button {
    display: flex;
    align-items: center;
  }
</style>
