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
  import { contextMenuAction } from '$lib/context-menu/contextMenuAction.svelte'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import AoiStreamPlotAlignmentSettings from './AoiStreamPlotAlignmentSettings.svelte'

  const LAYOUT = {
    headerHeight: HEADER_HEIGHT,
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
      LAYOUT.headerHeight
    )
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
  const groupOptions = $derived(getParticipantsGroupOptions())

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
      value: settings.alignment ?? 'center',
      onchange: (e: CustomEvent) => {
        onWorkspaceCommand({
          type: 'updateSettings',
          itemId: settings.id,
          source,
          settings: { alignment: e.detail as any },
        })
      },
      options: [
        {
          value: 'center',
          label: 'Center',
          component: AoiStreamPlotAlignmentSettings,
          componentHeight: 170,
          componentProps: {
            defaultValue: (settings.binSize ?? 0) > 0 ? settings.binSize! : 500,
            defaultValueTimelineStart: settings.timelineStart ?? 0,
            defaultValueTimelineEnd: settings.timelineEnd ?? 0,
          },
          action: (data: any) => {
            const updates: any = { alignment: 'center' }
            if (data?.binSize !== undefined) {
              const binSize = parseInt(data.binSize)
              updates.binSize = isNaN(binSize) || binSize <= 0 ? 500 : binSize
            }
            if (data?.timelineStart !== undefined) {
              updates.timelineStart = parseInt(data.timelineStart)
            }
            if (data?.timelineEnd !== undefined) {
              updates.timelineEnd = parseInt(data.timelineEnd)
            }
            onWorkspaceCommand({
              type: 'updateSettings',
              itemId: settings.id,
              source,
              settings: updates,
            })
          },
        },
        {
          value: 'bottom',
          label: 'Bottom',
          component: AoiStreamPlotAlignmentSettings,
          componentHeight: 170,
          componentProps: {
            defaultValue: (settings.binSize ?? 0) > 0 ? settings.binSize! : 500,
            defaultValueTimelineStart: settings.timelineStart ?? 0,
            defaultValueTimelineEnd: settings.timelineEnd ?? 0,
          },
          action: (data: any) => {
            const updates: any = { alignment: 'bottom' }
            if (data?.binSize !== undefined) {
              const binSize = parseInt(data.binSize)
              updates.binSize = isNaN(binSize) || binSize <= 0 ? 500 : binSize
            }
            if (data?.timelineStart !== undefined) {
              updates.timelineStart = parseInt(data.timelineStart)
            }
            if (data?.timelineEnd !== undefined) {
              updates.timelineEnd = parseInt(data.timelineEnd)
            }
            onWorkspaceCommand({
              type: 'updateSettings',
              itemId: settings.id,
              source,
              settings: updates,
            })
          },
        },
        {
          value: 'ridgeline',
          label: 'Ridgeline',
          component: AoiStreamPlotAlignmentSettings,
          componentHeight: 240, // Increased for two inputs
          componentProps: {
            defaultValue: (settings.binSize ?? 0) > 0 ? settings.binSize! : 500,
            defaultValueScale: settings.ridgelineScale ?? RIDGELINE_SCALE,
            defaultValueTimelineStart: settings.timelineStart ?? 0,
            defaultValueTimelineEnd: settings.timelineEnd ?? 0,
          },
          action: (data: any) => {
            const updates: any = { alignment: 'ridgeline' }
            if (data?.binSize !== undefined) {
              const binSize = parseInt(data.binSize)
              updates.binSize = isNaN(binSize) || binSize <= 0 ? 500 : binSize
            }
            if (data?.ridgelineScale !== undefined) {
              updates.ridgelineScale = parseFloat(data.ridgelineScale)
            }
            if (data?.timelineStart !== undefined) {
              updates.timelineStart = parseInt(data.timelineStart)
            }
            if (data?.timelineEnd !== undefined) {
              updates.timelineEnd = parseInt(data.timelineEnd)
            }
            onWorkspaceCommand({
              type: 'updateSettings',
              itemId: settings.id,
              source,
              settings: updates,
            })
          },
        },
      ],
    },
  ])

  // Legacy Alignment helpers removed

  // Calculate timeline min value
  const timelineMinValue = $derived.by(() => {
    // If global timeline start is set (> 0), use it
    if ((settings.timelineStart ?? 0) > 0) return settings.timelineStart!
    return settings.absoluteStimuliLimits[settings.stimulusId]?.[0] ?? 0
  })

  // Calculate timeline max value - if 0, check for synchronized max across plots with same width
  const timelineMaxValue = $derived.by(() => {
    const maxValue =
      settings.absoluteStimuliLimits[settings.stimulusId]?.[1] ?? 0

    // If global timeline end is set (> 0), use it
    if ((settings.timelineEnd ?? 0) > 0) return settings.timelineEnd!

    // If explicitly set via stimulus limits, use it
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
    engine.metadata // reactive dependency for AOI visibility/grouping
    untrack(() => {
      streamResult = getAoiStreamPlotData({
        ...settings,
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
        ridgelineScale={settings.ridgelineScale}
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
