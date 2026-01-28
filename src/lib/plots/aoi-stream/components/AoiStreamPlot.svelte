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
  import { HEADER_HEIGHT } from '../const'

  import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'
  import type { AoiStreamPlotResult } from '../types'
  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  import { grid } from '$lib/workspace/grid/store.svelte'
  import AoiStreamPlotAlignmentSettings from './AoiStreamPlotAlignmentSettings.svelte'

  const LAYOUT = {
    headerHeight: HEADER_HEIGHT,
  }

  interface Props {
    settings: AoiStreamPlotGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  // --- NO-EFFECT DRAFT STATE ---
  // We use a local draft that is NOT synced via $effect.
  // Instead, the plot RENDER uses an effective state that prefers localDraft values.
  let localDraft = $state<Partial<AoiStreamPlotGridType>>({})

  // Reset draft when common identity-changing props change (like stimulus)
  // This is handled in event handlers, not effects.

  const effectiveSettings = $derived({
    ...settings,
    ...localDraft,
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

  function handlePreview(data: Partial<AoiStreamPlotGridType>) {
    // Explicit re-assignment for perfect Svelte 5 proxy tracking
    localDraft = { ...localDraft, ...data }
  }

  function handleMenuClose() {
    untrack(() => {
      // If we have no session data, we are done
      const draftKeys = Object.keys(
        localDraft
      ) as (keyof AoiStreamPlotGridType)[]
      if (draftKeys.length === 0) return

      // Final reconciliation: Capture anything that differs from the authority
      const updates: Partial<AoiStreamPlotGridType> = {}

      for (const key of draftKeys) {
        const draftVal = localDraft[key]
        const authorityVal = settings[key]

        // If the draft value differs from the global authority (record transitions from undefined too)
        if (draftVal !== authorityVal) {
          ;(updates as any)[key] = draftVal
        }
      }

      // Only dispatch if there are actual diffs
      if (Object.keys(updates).length === 0) {
        localDraft = {}
        return
      }

      // Snapshot to ensure we send raw values, decoupling from reactive proxies
      // This ensures the command handler correctly records the PREVIOUS state for Undo.
      const snapshotUpdates = $state.snapshot(updates)
      const snapshotSource = $state.snapshot(source)

      onWorkspaceCommand({
        type: 'updateSettings',
        itemId: settings.id,
        source: snapshotSource,
        settings: snapshotUpdates,
      })

      // IMPORTANT: Clear draft AFTER dispatching to maintain visual continuity
      localDraft = {}
    })
  }

  const handleStimulusChange = (event: CustomEvent) => {
    const stimulusId = parseInt(event.detail as string)
    localDraft = {} // Reset preview on structural change
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
    localDraft = {} // Reset preview on structural change
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
          onSelect: (v: any) => handlePreview({ alignment: v }),
          closeOnAction: false,
          component: AoiStreamPlotAlignmentSettings,
          componentHeight: 170,
          componentProps: {
            currentValues: effectiveSettings,
            onPreview: handlePreview,
          },
        },
        {
          value: 'bottom',
          label: 'Bottom',
          onSelect: (v: any) => handlePreview({ alignment: v }),
          closeOnAction: false,
          component: AoiStreamPlotAlignmentSettings,
          componentHeight: 170,
          componentProps: {
            currentValues: effectiveSettings,
            onPreview: handlePreview,
          },
        },
        {
          value: 'ridgeline',
          label: 'Ridgeline',
          onSelect: (v: any) => handlePreview({ alignment: v }),
          closeOnAction: false,
          component: AoiStreamPlotAlignmentSettings,
          componentHeight: 240,
          componentProps: {
            currentValues: effectiveSettings,
            onPreview: handlePreview,
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
