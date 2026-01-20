<script lang="ts">
  import { untrack } from 'svelte'

  import {
    AoiStreamPlotFigure,
    AoiStreamPlotButtonMenu,
  } from '$lib/plots/aoi-stream/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import Select, {
    type GroupSelectItem,
  } from '$lib/shared/components/GeneralSelect.svelte'

  import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid'
  import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared/utils/plotSizeUtility'
  import { getAoiStreamPlotData } from '$lib/plots/aoi-stream/utils'
  import {
    getStimuliOptions,
  } from '$lib/plots/shared/utils'
  import {
    getParticipants,
    getParticipantEndTime,
    getParticipantsGroups,
  } from '$lib/gaze-data/front-process/stores/dataStore'

  import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'
  import type { AoiStreamPlotResult } from '$lib/plots/aoi-stream/types'
  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  import {
    scanForDynamicStripHeight,
    scanForSynchronizedTimelineMax
  } from '$lib/plots/aoi-stream/utils'
  import { grid } from '$lib/workspace/grid/store.svelte'

  const LAYOUT = {
    headerHeight: 150,
    horizontalPadding: 40,
    contentPadding: 5,
  }

  interface Props {
    settings: AoiStreamPlotGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  // Calculate dimensions locally because they are needed for autoBinCount
  const plotDimensions = $derived.by(() =>
    calculatePlotDimensionsWithHeader(
      settings.w,
      settings.h,
      DEFAULT_GRID_CONFIG,
      LAYOUT.headerHeight,
      LAYOUT.horizontalPadding,
      LAYOUT.contentPadding
    )
  )

  const autoBinCount = $derived.by(() =>
    Math.max(1, Math.floor(plotDimensions.width / 5))
  )

  let streamResult = $state<AoiStreamPlotResult | null>(null)

  const source = $derived.by(() =>
    createCommandSourcePlotPattern(settings, 'plot')
  )

  // Highlights support (same as scarf plot)
  const highlights = $derived(settings.highlights ?? [])

  // Handle legend click for highlighting
  const handleLegendClick = (aoiId: number) => {
    const aoiIdStr = aoiId.toString()
    const currentHighlights = settings.highlights ?? []
    const isCurrentlyHighlighted = currentHighlights.includes(aoiIdStr)

    const newHighlights = isCurrentlyHighlighted
      ? currentHighlights.filter((id: string) => id !== aoiIdStr)
      : [...currentHighlights, aoiIdStr]

    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      source,
      settings: { highlights: newHighlights },
    })
  }

  // Memoized options generators (prevent unnecessary recalculations)
  const stimulusOptions = $derived(getStimuliOptions())
  const groupOptions = $derived(
    getParticipantsGroups(true).map(group => ({
      value: group.id.toString(),
      label: group.name,
    }))
  )

  // Consolidated event handlers
  const handleStimulusChange = (event: CustomEvent) => {
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      source,
      settings: { stimulusId: parseInt(event.detail as string) },
    })
  }

  const handleUpperGroupChange = (event: CustomEvent) => {
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      source,
      settings: { groupId: parseInt(event.detail as string) },
    })
  }

  const selectItems = $derived<GroupSelectItem[]>([
    {
      label: 'Stimulus',
      options: stimulusOptions,
      value: settings.stimulusId.toString(),
      onchange: handleStimulusChange,
    },
    {
      label: 'Group',
      options: groupOptions,
      value: settings.groupId.toString(),
      onchange: handleUpperGroupChange,
    },
    {
      label: 'Alignment',
      options: [
        { value: 'center', label: 'Center' },
        { value: 'bottom', label: 'Bottom' },
        { value: 'ridgeline', label: 'Ridgeline' },
      ],
      value: settings.alignment ?? 'center',
      onchange: (e: CustomEvent) => {
        onWorkspaceCommand({
          type: 'updateSettings',
          itemId: settings.id,
          source,
          settings: { alignment: e.detail },
        })
      },
    },
  ])

  // Calculate timeline min value based on absoluteStimuliLimits
  const timelineMinValue = $derived.by(() => {
    return settings.absoluteStimuliLimits[settings.stimulusId]?.[0] ?? 0
  })

  // Calculate timeline max value - if 0, check for synchronized max across plots with same width
  const timelineMaxValue = $derived.by(() => {
    const maxValue =
      settings.absoluteStimuliLimits[settings.stimulusId]?.[1] ?? 0

    // If explicitly set, use it
    if (maxValue !== 0) return maxValue

    // Check for synchronized timeline across plots with same width and no clipping
    const syncedMax = scanForSynchronizedTimelineMax(
      grid.items,
      settings.w,
      settings.stimulusId,
      settings.absoluteStimuliLimits
    )

    if (syncedMax !== null) return syncedMax

    // Fallback to local max
    const participants = getParticipants(settings.groupId, settings.stimulusId)
    return participants.reduce(
      (max, participant) =>
        Math.max(
          max,
          getParticipantEndTime(settings.stimulusId, participant.id)
        ),
      0
    )
  })

  const redrawTimestamp = $derived(settings.redrawTimestamp)
  $effect(() => {
    redrawTimestamp // reactive dependency
    timelineMaxValue // reactive dependency for synchronized timeline
    untrack(() => {
      streamResult = getAoiStreamPlotData({
        ...settings,
        binCount: autoBinCount,
        timelineMin: timelineMinValue,
        timelineMax: timelineMaxValue,
      })
    })
  })

  const stripHeightOverride = $derived.by(() => {
    // Only active for ridgeline
    if (settings.alignment !== 'ridgeline') return null
    // Reactive dependency on grid.items ensures updates when any plot changes
    return scanForDynamicStripHeight(grid.items, settings.h, settings.id)
  })
</script>

<BasePlot
  {settings}
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
        {highlights}
        alignment={settings.alignment ?? 'center'}
        onLegendClick={handleLegendClick}
        {stripHeightOverride}
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
