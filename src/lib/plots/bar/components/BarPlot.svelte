<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import { createMenuComponentItem } from '$lib/context-menu'

  // Local components
  import { BarPlotFigure, BarPlotButtonMenu } from '$lib/plots/bar/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import GroupSelect from '$lib/shared/components/GroupSelect.svelte'
  import type { GroupSelectItem } from '$lib/shared/components'

  // Utilities and stores
  import { getBarPlotData } from '$lib/plots/bar/core/transformer'
  import { createStimulusGroupSelects } from '$lib/plots/shared'

  // Types and constants
  import type {
    BarPlotItem,
    BarPlotSettings,
    StatisticalOverlayType,
  } from '$lib/plots/bar/types'
  import {
    BAR_PLOT_AGGREGATION_METHODS,
    getBarPlotAxisLabel,
    type BarPlotAggregationMethodId,
  } from '$lib/plots/bar/const'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { PreviewModel, createMenuCloseHandler } from '$lib/plots/shared'
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
    statisticalOverlay: StatisticalOverlayType
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
      statisticalOverlay: settings.statisticalOverlay ?? 'none',
    }),
    buildPatch: (draft, committed) => {
      const updates: Partial<BarPlotSettings> = {
        ...PreviewModel.buildSimplePatch(draft, committed, [
          'orderBy', 'orderDirection', 'barPlottingType',
          'timelineStart', 'timelineEnd', 'statisticalOverlay',
        ]),
      }

      if (draft.minScale !== committed.minScale || draft.maxScale !== committed.maxScale) {
        updates.scaleRange = [draft.minScale, draft.maxScale]
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
      statisticalOverlay: draft.statisticalOverlay,
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
      effectiveSettings.timelineEnd,
      effectiveSettings.statisticalOverlay
    )
  )

  // source for the workspace commands directly from the plot
  const source = $derived.by(() => createCommandSourcePlotPattern(item, 'plot'))

  const handleMenuClose = createMenuCloseHandler(preview, patch =>
    workspace.updateItemSettings(item.id, patch, $state.snapshot(source))
  )

  function updateSetting(newSettings: Partial<BarPlotSettings>) {
    workspace.updateItemSettings(item.id, newSettings, source)
  }

  // Grouped selects like Scarf header: Stimulus, Group, Aggregation
  const selectItems = $derived<GroupSelectItem[]>([
    ...createStimulusGroupSelects(
      engine, settings.stimulusId, settings.groupId,
      id => updateSetting({ stimulusId: id }),
      id => updateSetting({ groupId: id })
    ),
    {
      label: 'View',
      value: settings.aggregationMethod,
      onClose: handleMenuClose,
      options: BAR_PLOT_AGGREGATION_METHODS.map(method =>
        createMenuComponentItem({
          ...method,
          onAction: v => {
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
    <div class="plot-controls">
      <GroupSelect ariaLabel="Bar filters" items={selectItems} />
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
      statisticalOverlay={effectiveSettings.statisticalOverlay}
    />
  {/snippet}
</BasePlot>

