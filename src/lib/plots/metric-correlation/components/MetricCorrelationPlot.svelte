<script lang="ts">
  import { createMenuComponentItem } from '$lib/context-menu'
  import { getGazePlotterSession } from '$lib/session'

  import MetricCorrelationHeatmap from './MetricCorrelationHeatmap.svelte'
  import MetricCorrelationSplom from './MetricCorrelationSplom.svelte'
  import MetricCorrelationButtonMenu from './MetricCorrelationButtonMenu.svelte'
  import MetricCorrelationViewSettings from './MetricCorrelationViewSettings.svelte'

  import { BasePlot } from '$lib/plots/shared/components'
  import GroupSelect from '$lib/shared/components/GroupSelect.svelte'
  import type { GroupSelectItem, SelectOption } from '$lib/shared/components'

  import {
    createStimulusGroupSelects,
    PreviewModel,
    createMenuCloseHandler,
  } from '$lib/plots/shared'
  import { getAois } from '$lib/data/engine'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { getMetricCorrelationData } from '../core/transformer'
  import { BAR_PLOT_AGGREGATION_METHODS } from '../const'
  import type {
    MetricCorrelationItem,
    MetricCorrelationSettings,
    MetricCorrelationView,
    CorrelationMethod,
  } from '../types'

  interface Props {
    item: MetricCorrelationItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  type MetricCorrelationPreview = {
    view: MetricCorrelationView
    selectedAoiId: number | null
    correlationMethod: CorrelationMethod
    enabledMetrics: string[]
    timelineStart: number | undefined
    timelineEnd: number | undefined
  }

  const defaultEnabled = BAR_PLOT_AGGREGATION_METHODS.map(m => m.value)

  const preview = new PreviewModel<
    MetricCorrelationPreview,
    Partial<MetricCorrelationSettings>
  >({
    getCommitted: () => ({
      view: settings.view ?? 'heatmap',
      selectedAoiId: settings.selectedAoiId ?? null,
      correlationMethod: settings.correlationMethod ?? 'spearman',
      enabledMetrics:
        settings.enabledMetrics && settings.enabledMetrics.length > 0
          ? settings.enabledMetrics
          : defaultEnabled,
      timelineStart: settings.timelineStart,
      timelineEnd: settings.timelineEnd,
    }),
    buildPatch: (draft, committed) =>
      PreviewModel.buildSimplePatch(draft, committed, [
        'view',
        'selectedAoiId',
        'correlationMethod',
        'enabledMetrics',
        'timelineStart',
        'timelineEnd',
      ]),
    equals: {
      enabledMetrics: (a, b) => {
        if (a.length !== b.length) return false
        const setB = new Set(b)
        for (const v of a) if (!setB.has(v)) return false
        return true
      },
    },
  })

  const syncs = preview.fields

  const effectiveSettings = $derived.by(() => {
    const draft = preview.draft
    return {
      ...settings,
      view: draft.view,
      selectedAoiId: draft.selectedAoiId,
      correlationMethod: draft.correlationMethod,
      enabledMetrics: draft.enabledMetrics,
      timelineStart: draft.timelineStart,
      timelineEnd: draft.timelineEnd,
    }
  })

  const includePoints = $derived(effectiveSettings.view === 'splom')

  const result = $derived(
    getMetricCorrelationData(engine, effectiveSettings, { includePoints })
  )

  const aoiOptions = $derived.by<SelectOption[]>(() => {
    try {
      return getAois(engine, settings.stimulusId).map(aoi => ({
        label: aoi.displayedName,
        value: String(aoi.id),
      }))
    } catch {
      return []
    }
  })

  const source = $derived.by(() => createCommandSourcePlotPattern(item, 'plot'))

  const handleMenuClose = createMenuCloseHandler(preview, patch =>
    workspace.updateItemSettings(item.id, patch, $state.snapshot(source))
  )

  function updateSetting(newSettings: Partial<MetricCorrelationSettings>) {
    workspace.updateItemSettings(item.id, newSettings, source)
  }

  function previewView(value?: string) {
    if (value !== 'heatmap' && value !== 'splom') return
    syncs.view.value = value
    return value
  }

  const selectItems = $derived<GroupSelectItem[]>([
    ...createStimulusGroupSelects(
      engine,
      settings.stimulusId,
      settings.groupId,
      id => updateSetting({ stimulusId: id }),
      id => updateSetting({ groupId: id })
    ),
    {
      label: 'View',
      value: effectiveSettings.view,
      onClose: handleMenuClose,
      options: [
        createMenuComponentItem({
          value: 'heatmap',
          label: 'Heatmap matrix',
          onAction: previewView,
          closeOnAction: false,
          component: MetricCorrelationViewSettings,
          componentHeight: 380,
          componentProps: {
            syncs,
            aoiOptions,
          },
        }),
        createMenuComponentItem({
          value: 'splom',
          label: 'Scatterplot matrix',
          onAction: previewView,
          closeOnAction: false,
          component: MetricCorrelationViewSettings,
          componentHeight: 380,
          componentProps: {
            syncs,
            aoiOptions,
          },
        }),
      ],
    },
  ])

  const hasData = $derived(result.metrics.length >= 2 && result.sampleSize > 0)
</script>

<BasePlot {item} {hasData}>
  {#snippet header()}
    <div class="plot-controls">
      <GroupSelect ariaLabel="Metric correlation filters" items={selectItems} />
      <div class="menu-button">
        <MetricCorrelationButtonMenu {item} />
      </div>
    </div>
  {/snippet}

  {#snippet figure({ width, height })}
    {#if effectiveSettings.view === 'splom'}
      <MetricCorrelationSplom {width} {height} {result} />
    {:else}
      <MetricCorrelationHeatmap {width} {height} {result} />
    {/if}
  {/snippet}
</BasePlot>

<style>
  .menu-button {
    display: flex;
    align-items: center;
  }
</style>
