<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { createMenuComponentItem } from '$lib/context-menu'

  // Core imports
  import {
    TransitionMatrixPlotFigure,
    TransitionMatrixButtonMenu,
  } from '$lib/plots/transition-matrix/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import GroupSelect from '$lib/shared/components/GroupSelect.svelte'
  import type { GroupSelectItem } from '$lib/shared/components'

  // Utilities and stores
  import { getTransitionMatrixData } from '$lib/plots/transition-matrix/core/transformer'
  import {
    transitionMatrixColorSync,
    colorScaleToKey,
  } from '$lib/plots/transition-matrix/core/sync.svelte'
  import {
    MatrixAggregationMethod,
    TRANSITION_MATRIX_LEGEND_TITLES,
  } from '$lib/plots/transition-matrix/const'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    createStimulusGroupSelects,
    PreviewModel,
    createMenuCloseHandler,
    getColorScaleCommitted,
    buildColorScalePatch,
    buildValueRangePatch,
    deriveEffectiveColorScale,
  } from '$lib/plots/shared'
  import TransitionMatrixViewSettings from './TransitionMatrixViewSettings.svelte'

  // Types
  import type {
    TransitionMatrixPlotItem,
    TransitionMatrixPlotSettings,
  } from '$lib/plots/transition-matrix/types'

  const AGGREGATION_OPTIONS = [
    { value: MatrixAggregationMethod.SUM, label: 'Absolute frequency' },
    {
      value: MatrixAggregationMethod.FREQUENCY_RELATIVE,
      label: 'Relative frequency',
    },
    { value: MatrixAggregationMethod.PROBABILITY, label: '1-step probability' },
    {
      value: MatrixAggregationMethod.PROBABILITY_2,
      label: '2-step probability',
    },
    {
      value: MatrixAggregationMethod.PROBABILITY_3,
      label: '3-step probability',
    },
    { value: MatrixAggregationMethod.DWELL_TIME, label: 'Fixation duration' },
    {
      value: MatrixAggregationMethod.SEGMENT_DWELL_TIME,
      label: 'Dwell duration',
    },
  ]

  interface Props {
    item: TransitionMatrixPlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  // Data reactive sources
  const currentStimulusColorRange = $derived(
    settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0]
  )

  type TransitionMatrixPreview = {
    colorMin: string
    colorMiddle: string
    colorMax: string
    minValue: number
    maxValue: number
  }

  const preview = new PreviewModel<
    TransitionMatrixPreview,
    Partial<TransitionMatrixPlotSettings>
  >({
    getCommitted: () => ({
      ...getColorScaleCommitted(settings.colorScale, '#f7fbff', '#08306b'),
      minValue: currentStimulusColorRange[0],
      maxValue: currentStimulusColorRange[1],
    }),
    buildPatch: (draft, committed) => {
      const updates: Partial<TransitionMatrixPlotSettings> = {}

      const colorScale = buildColorScalePatch(draft, committed)
      if (colorScale) updates.colorScale = colorScale

      const valueRanges = buildValueRangePatch(draft, committed, settings.stimuliColorValueRanges, settings.stimulusId)
      if (valueRanges) updates.stimuliColorValueRanges = valueRanges

      return updates
    },
  })

  const syncs = preview.fields

  const effectiveColorScale = $derived(deriveEffectiveColorScale(preview.draft))

  const handleMenuClose = createMenuCloseHandler(preview, patch =>
    workspace.updateItemSettings(item.id, patch, $state.snapshot(source))
  )

  const source = untrack(() => createCommandSourcePlotPattern(item, 'plot'))

  const transitionData = $derived.by(() => {
    return getTransitionMatrixData(
      engine,
      settings.stimulusId,
      settings.groupId,
      settings.aggregationMethod as MatrixAggregationMethod
    )
  })

  // Destructure for cleaner access in template
  const { aoiLabels, matrix } = $derived(transitionData)

  // --- Cross-plot color-scale sync ---
  // Sync applies only when the user has left the per-stimulus color range at
  // its default [0, 0]; any custom min or max opts the plot out of the
  // sync group (no publish, no read). The sync key is
  // (aggregationMethod, colorScale, w, h) — same metric, same palette, same
  // grid footprint.
  const ownDataMax = $derived.by(() => {
    let max = 0
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[i] > max) max = matrix[i]
    }
    return Math.ceil(max)
  })

  const isDefaultColorRange = $derived(
    preview.draft.minValue === 0 && preview.draft.maxValue === 0
  )

  const effectiveColorScaleKey = $derived(colorScaleToKey(effectiveColorScale))

  $effect(() => {
    if (!isDefaultColorRange) {
      transitionMatrixColorSync.clearEntry(item.id)
      return
    }
    transitionMatrixColorSync.setEntry(item.id, {
      aggregationMethod: settings.aggregationMethod,
      colorScaleKey: effectiveColorScaleKey,
      w: item.w,
      h: item.h,
      dataMax: ownDataMax,
    })
  })
  onDestroy(() => transitionMatrixColorSync.clearEntry(item.id))

  // Value range passed to the figure: user's draft values when customized,
  // else [0, syncedMax] when sync contributes a larger max than own data.
  // The figure treats colorValueRange[1] !== 0 as "user-set" and uses it
  // verbatim instead of scanning the matrix — which is exactly the hook we
  // need to inject the synced max here.
  const effectiveColorValueRange = $derived.by<[number, number]>(() => {
    const manual: [number, number] = [preview.draft.minValue, preview.draft.maxValue]
    if (!isDefaultColorRange) return manual

    const syncedMax = transitionMatrixColorSync.getSyncedMax(
      settings.aggregationMethod,
      effectiveColorScaleKey,
      item.w,
      item.h
    )
    if (syncedMax <= ownDataMax) return manual
    return [0, syncedMax]
  })

  // Handlers
  function updateSettings(updates: Partial<typeof settings>) {
    workspace.updateItemSettings(item.id, updates, source)
  }

  const selectItems = $derived<GroupSelectItem[]>([
    ...createStimulusGroupSelects(
      engine, settings.stimulusId, settings.groupId,
      id => updateSettings({ stimulusId: id }),
      id => updateSettings({ groupId: id })
    ),
    {
      label: 'View',
      value: settings.aggregationMethod,
      onClose: handleMenuClose,
      options: AGGREGATION_OPTIONS.map(opt =>
        createMenuComponentItem({
          ...opt,
          onAction: v => {
            updateSettings({ aggregationMethod: v })
          },
          closeOnAction: false,
          component: TransitionMatrixViewSettings,
          componentHeight: 140,
          componentProps: {
            syncs,
          },
        })
      ),
    },
  ])
</script>

<BasePlot
  {item}
  hasData={settings?.stimulusId !== undefined && aoiLabels.length > 0}
>
  {#snippet header()}
    <div class="plot-controls">
      <GroupSelect
        ariaLabel="Transition Matrix filters"
        items={selectItems}
      />
      <div class="menu-button">
        <TransitionMatrixButtonMenu {item} />
      </div>
    </div>
  {/snippet}

  {#snippet figure({ width, height })}
    <div class="figure-container">
      <TransitionMatrixPlotFigure
        TransitionMatrix={matrix}
        {aoiLabels}
        {width}
        {height}
        colorScale={effectiveColorScale}
        xLabel="To AOI"
        yLabel="From AOI"
        legendTitle={TRANSITION_MATRIX_LEGEND_TITLES[
          settings.aggregationMethod
        ] ?? 'Transition Value'}
        colorValueRange={effectiveColorValueRange}
        belowMinColor={settings.belowMinColor}
        aboveMaxColor={settings.aboveMaxColor}
        showBelowMinLabels={settings.showBelowMinLabels}
        showAboveMaxLabels={settings.showAboveMaxLabels}
      />
    </div>
  {/snippet}
</BasePlot>

<style>
  .figure-container {
    flex: 1;
    position: relative;
    height: 100%;
    /* Previous CSS had height: calc(100% - 60px) or similar, but with BasePlot handling layout, 100% should be correct relative to figure area */
  }
</style>
