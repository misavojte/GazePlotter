<script lang="ts">
  import { fade } from 'svelte/transition'
  import { onMount, untrack } from 'svelte'

  import {
    AoiStreamPlotFigure,
    AoiStreamPlotButtonMenu,
  } from '$lib/plots/aoi-stream/components'
  import { PlotPlaceholder } from '$lib/plots/shared/components'
  import Select, {
    type GroupSelectItem,
  } from '$lib/shared/components/GeneralSelect.svelte'

  import { DEFAULT_GRID_CONFIG } from '$lib/shared/utils/gridSizingUtils'
  import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared/utils/plotSizeUtility'
  import { getAoiStreamPlotData } from '$lib/plots/aoi-stream/utils'
  import { getStimuliOptions } from '$lib/plots/shared/utils/sharedPlotUtils'
  import {
    getParticipants,
    getParticipantEndTime,
    getParticipantsGroups,
  } from '$lib/gaze-data/front-process/stores/dataStore'

  import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'
  import type { AoiStreamPlotResult } from '$lib/plots/aoi-stream/types'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'
  import { createCommandSourcePlotPattern } from '$lib/shared/types/workspaceInstructions'

  const LAYOUT = {
    HEADER_HEIGHT: 150,
    HORIZONTAL_PADDING: 40,
    CONTENT_PADDING: 5,
  }

  interface Props {
    settings: AoiStreamPlotGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  const plotDimensions = $derived.by(() =>
    calculatePlotDimensionsWithHeader(
      settings.w,
      settings.h,
      DEFAULT_GRID_CONFIG,
      LAYOUT.HEADER_HEIGHT,
      LAYOUT.HORIZONTAL_PADDING,
      LAYOUT.CONTENT_PADDING
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
  ])

  // Calculate timeline min value based on absoluteStimuliLimits
  const timelineMinValue = $derived.by(() => {
    return settings.absoluteStimuliLimits[settings.stimulusId]?.[0] ?? 0
  })

  // Calculate timeline max value - if 0, use the max from data
  const timelineMaxValue = $derived.by(() => {
    const maxValue =
      settings.absoluteStimuliLimits[settings.stimulusId]?.[1] ?? 0
    if (maxValue === 0) {
      const participants = getParticipants(
        settings.groupId,
        settings.stimulusId
      )
      return participants.reduce(
        (max, participant) =>
          Math.max(
            max,
            getParticipantEndTime(settings.stimulusId, participant.id)
          ),
        0
      )
    }
    return maxValue
  })

  const redrawTimestamp = $derived(settings.redrawTimestamp)
  $effect(() => {
    redrawTimestamp
    untrack(() => {
      streamResult = getAoiStreamPlotData({
        ...settings,
        binCount: autoBinCount,
        timelineMin: timelineMinValue,
        timelineMax: timelineMaxValue,
      })
    })
  })

  let mounted = $state(false)

  onMount(() => {
    mounted = true
  })
</script>

<div class="aoi-stream-container">
  <div class="header">
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
  </div>

  <div class="figure" style="height: {plotDimensions.height}px">
    {#if mounted}
      <div
        class="figure-content"
        in:fade={{ duration: 300 }}
        style="height: {plotDimensions.height}px"
      >
        {#if streamResult}
          <AoiStreamPlotFigure
            width={plotDimensions.width}
            height={plotDimensions.height}
            data={streamResult}
            {highlights}
            onLegendClick={handleLegendClick}
          />
        {:else}
          <PlotPlaceholder
            width={plotDimensions.width}
            height={plotDimensions.height}
          />
        {/if}
      </div>
    {:else}
      <div class="figure-content" style="height: {plotDimensions.height}px">
        <PlotPlaceholder
          width={plotDimensions.width}
          height={plotDimensions.height}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .figure {
    position: relative;
    overflow: hidden;
  }

  .figure-content {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .aoi-stream-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }

  .header {
    padding: 0 0 10px 0;
    margin-bottom: 10px;
    background-color: var(--c-white);
  }

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
