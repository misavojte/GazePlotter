<script lang="ts">
  import { untrack } from 'svelte'

  // Local components
  import { BarPlotFigure, BarPlotButtonMenu } from '$lib/plots/bar/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import Select, {
    type GroupSelectItem,
  } from '$lib/shared/components/GeneralSelect.svelte'

  // Utilities and stores
  import { getBarPlotData } from '$lib/plots/bar/core/transformer'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '$lib/plots/shared'

  // Types and constants
  import type { BarPlotGridType } from '$lib/workspace/type/gridType'
  import {
    BAR_PLOT_AGGREGATION_METHODS,
    getBarPlotAxisLabel,
    type BarPlotAggregationMethodId,
  } from '$lib/plots/bar/const'
  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { PreviewSync } from '$lib/plots/shared'
  import BarPlotViewSettings from './BarPlotViewSettings.svelte'

  // CONSTANTS - centralized for easier maintenance
  const LAYOUT = {
    headerHeight: 150,
    horizontalPadding: 50,
    contentPadding: 0,
  }

  // Component Props using Svelte 5 $props() rune
  interface Props {
    settings: BarPlotGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  // --- PREVIEW SYNC STATE ---
  const orderBySync = new PreviewSync(settings.orderBy)
  const orderDirectionSync = new PreviewSync(settings.orderDirection)
  const minScaleSync = new PreviewSync(settings.scaleRange?.[0] ?? 0)
  const maxScaleSync = new PreviewSync(settings.scaleRange?.[1] ?? 0)
  const barPlottingTypeSync = new PreviewSync(settings.barPlottingType)
  const timelineStartSync = new PreviewSync(settings.timelineStart ?? 0)
  const timelineEndSync = new PreviewSync(settings.timelineEnd ?? 0)

  $effect(() => {
    orderBySync.updateCommitted(settings.orderBy, true)
    orderDirectionSync.updateCommitted(settings.orderDirection, true)
    minScaleSync.updateCommitted(settings.scaleRange?.[0] ?? 0, true)
    maxScaleSync.updateCommitted(settings.scaleRange?.[1] ?? 0, true)
    barPlottingTypeSync.updateCommitted(settings.barPlottingType, true)
    timelineStartSync.updateCommitted(settings.timelineStart ?? 0, true)
    timelineEndSync.updateCommitted(settings.timelineEnd ?? 0, true)
  })

  // Grouping for the component
  const syncs = {
    orderBy: orderBySync,
    orderDirection: orderDirectionSync,
    minScale: minScaleSync,
    maxScale: maxScaleSync,
    barPlottingType: barPlottingTypeSync,
    timelineStart: timelineStartSync,
    timelineEnd: timelineEndSync,
  }

  const effectiveSettings = $derived({
    ...settings,
    orderBy: orderBySync.value,
    orderDirection: orderDirectionSync.value,
    barPlottingType: barPlottingTypeSync.value,
    scaleRange: [minScaleSync.value, maxScaleSync.value] as [number, number],
    timelineStart: timelineStartSync.value,
    timelineEnd: timelineEndSync.value,
  })

  // Get bar plot data and timeline from utility function
  const barPlotResult = $derived(getBarPlotData(effectiveSettings))
  const labelededBarPlotData = $derived(barPlotResult.data)
  const timeline = $derived(barPlotResult.timeline)

  const axisLabel = $derived(
    getBarPlotAxisLabel(
      effectiveSettings.aggregationMethod as BarPlotAggregationMethodId,
      effectiveSettings.timelineStart,
      effectiveSettings.timelineEnd
    )
  )

  // source for the workspace commands directly from the plot
  const source = $derived.by(() =>
    createCommandSourcePlotPattern(effectiveSettings, 'plot')
  )

  function handleMenuClose() {
    untrack(() => {
      const updates: Partial<BarPlotGridType> = {}

      if (orderBySync.isDirty) updates.orderBy = orderBySync.value
      if (orderDirectionSync.isDirty)
        updates.orderDirection = orderDirectionSync.value

      if (minScaleSync.isDirty || maxScaleSync.isDirty) {
        updates.scaleRange = [minScaleSync.value, maxScaleSync.value]
      }

      if (barPlottingTypeSync.isDirty)
        updates.barPlottingType = barPlottingTypeSync.value

      if (timelineStartSync.isDirty)
        updates.timelineStart = timelineStartSync.value

      if (timelineEndSync.isDirty) updates.timelineEnd = timelineEndSync.value

      if (Object.keys(updates).length === 0) {
        orderBySync.reset()
        orderDirectionSync.reset()
        minScaleSync.reset()
        maxScaleSync.reset()
        barPlottingTypeSync.reset()
        timelineStartSync.reset()
        timelineEndSync.reset()
        return
      }

      onWorkspaceCommand({
        type: 'updateSettings',
        itemId: settings.id,
        source: $state.snapshot(source),
        settings: $state.snapshot(updates),
      })

      orderBySync.reset()
      orderDirectionSync.reset()
      minScaleSync.reset()
      maxScaleSync.reset()
      barPlottingTypeSync.reset()
      timelineStartSync.reset()
      timelineEndSync.reset()
    })
  }

  function updateSetting(newSettings: Partial<BarPlotGridType>) {
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      source,
      settings: newSettings,
    })
  }

  const stimulusOptions = $derived(getStimuliOptions())
  const groupOptions = $derived(getParticipantsGroupOptions())

  // Grouped selects like Scarf header: Stimulus, Group, Aggregation
  const selectItems = $derived<GroupSelectItem[]>([
    {
      label: 'Stimulus',
      options: stimulusOptions,
      value: settings.stimulusId.toString(),
      onchange: (e: CustomEvent) =>
        updateSetting({ stimulusId: parseInt(e.detail) }),
    },
    {
      label: 'Group',
      options: groupOptions,
      value: settings.groupId.toString(),
      onchange: (e: CustomEvent) =>
        updateSetting({ groupId: parseInt(e.detail) }),
    },
    {
      label: 'View',
      value: settings.aggregationMethod,
      onClose: handleMenuClose,
      options: BAR_PLOT_AGGREGATION_METHODS.map(method => ({
        ...method,
        onSelect: (v: any) => {
          updateSetting({
            aggregationMethod: v as BarPlotAggregationMethodId,
          })
        },
        closeOnAction: false,
        component: BarPlotViewSettings,
        componentHeight: 225,
        componentProps: {
          syncs,
        },
      })),
    },
  ])
</script>

<BasePlot {settings} layoutConfig={LAYOUT}>
  {#snippet header()}
    <div class="controls">
      <Select ariaLabel="Bar filters" items={selectItems} label="Bar" />
      <div class="menu-button">
        <BarPlotButtonMenu {settings} {onWorkspaceCommand} />
      </div>
    </div>
  {/snippet}

  {#snippet figure({ width, height })}
    <BarPlotFigure
      {width}
      {height}
      data={labelededBarPlotData}
      {timeline}
      {axisLabel}
      barPlottingType={effectiveSettings.barPlottingType}
      barWidth={200}
      barSpacing={20}
      onDataHover={() => {}}
    />
  {/snippet}
</BasePlot>

<style>
  .controls {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    background: inherit;
  }
</style>
