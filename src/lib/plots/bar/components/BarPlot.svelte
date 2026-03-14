<script lang="ts">
  import { untrack } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { createMenuComponentItem } from '$lib/context-menu'

  // Local components
  import { BarPlotFigure, BarPlotButtonMenu } from '$lib/plots/bar/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import Select from '$lib/shared/components/GeneralSelectGroup.svelte'
  import type { GroupSelectItem } from '$lib/shared/components'

  // Utilities and stores
  import { getBarPlotData } from '$lib/plots/bar/core/transformer'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '$lib/plots/shared'

  // Types and constants
  import type { BarPlotItem, BarPlotSettings } from '$lib/plots/bar/types'
  import {
    BAR_PLOT_AGGREGATION_METHODS,
    getBarPlotAxisLabel,
    type BarPlotAggregationMethodId,
  } from '$lib/plots/bar/const'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { PreviewModel } from '$lib/plots/shared'
  import BarPlotViewSettings from './BarPlotViewSettings.svelte'

  // Component Props using Svelte 5 $props() rune
  interface Props {
    item: BarPlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  type BarPlotPreview = {
    orderBy: 'value' | 'aoi'
    orderDirection: 'desc' | 'asc'
    minScale: number
    maxScale: number
    barPlottingType: 'horizontal' | 'vertical'
    timelineStart: number | undefined
    timelineEnd: number | undefined
  }

  const preview = new PreviewModel<BarPlotPreview, Partial<BarPlotSettings>>({
    getCommitted: () => ({
      orderBy: settings.orderBy ?? 'value',
      orderDirection: settings.orderDirection ?? 'desc',
      minScale: settings.scaleRange?.[0] ?? 0,
      maxScale: settings.scaleRange?.[1] ?? 0,
      barPlottingType: settings.barPlottingType ?? 'horizontal',
      timelineStart: settings.timelineStart,
      timelineEnd: settings.timelineEnd,
    }),
    buildPatch: (draft, committed) => {
      const updates: Partial<BarPlotSettings> = {}

      if (draft.orderBy !== committed.orderBy) updates.orderBy = draft.orderBy
      if (draft.orderDirection !== committed.orderDirection) {
        updates.orderDirection = draft.orderDirection
      }
      if (
        draft.minScale !== committed.minScale ||
        draft.maxScale !== committed.maxScale
      ) {
        updates.scaleRange = [draft.minScale, draft.maxScale]
      }
      if (draft.barPlottingType !== committed.barPlottingType) {
        updates.barPlottingType = draft.barPlottingType
      }
      if (draft.timelineStart !== committed.timelineStart) {
        updates.timelineStart = draft.timelineStart
      }
      if (draft.timelineEnd !== committed.timelineEnd) {
        updates.timelineEnd = draft.timelineEnd
      }

      return updates
    },
  })

  // Grouping for the component
  const syncs = preview.fields

  const effectiveSettings = $derived.by(() => {
    const draft = preview.draft

    return {
      ...settings,
      orderBy: draft.orderBy,
      orderDirection: draft.orderDirection,
      barPlottingType: draft.barPlottingType,
      scaleRange: [draft.minScale, draft.maxScale] as [number, number],
      timelineStart: draft.timelineStart,
      timelineEnd: draft.timelineEnd,
    }
  })

  // Get bar plot data and timeline from utility function
  const barPlotResult = $derived(getBarPlotData(engine, effectiveSettings))
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
  const source = $derived.by(() => createCommandSourcePlotPattern(item, 'plot'))

  function handleMenuClose() {
    untrack(() => {
      const updates = preview.buildPatch()

      if (!updates || Object.keys(updates).length === 0) {
        preview.resetAll()
        return
      }

      workspace.updateItemSettings(
        item.id,
        $state.snapshot(updates),
        $state.snapshot(source)
      )

      preview.resetAll()
    })
  }

  function updateSetting(newSettings: Partial<BarPlotSettings>) {
    workspace.updateItemSettings(item.id, newSettings, source)
  }

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, settings.stimulusId)
  )

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
      options: BAR_PLOT_AGGREGATION_METHODS.map(method =>
        createMenuComponentItem({
          ...method,
          onSelect: v => {
            updateSetting({ aggregationMethod: v })
          },
          closeOnAction: false,
          component: BarPlotViewSettings,
          componentHeight: 225,
          componentProps: {
            syncs,
          },
        })
      ),
    },
  ])
</script>

<BasePlot {item}>
  {#snippet header()}
    <div class="controls">
      <Select ariaLabel="Bar filters" items={selectItems} />
      <div class="menu-button">
        <BarPlotButtonMenu {item} />
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
    gap: 6px;
    flex-wrap: wrap;
    background: inherit;
  }
</style>
