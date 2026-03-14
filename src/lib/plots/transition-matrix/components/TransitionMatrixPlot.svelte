<script lang="ts">
  import { untrack } from 'svelte'
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
    MatrixAggregationMethod,
    TRANSITION_MATRIX_LEGEND_TITLES,
  } from '$lib/plots/transition-matrix/const'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
    PreviewModel,
  } from '$lib/plots/shared'
  import { interpolateColor } from '$lib/color/utility'
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
      colorMin: settings.colorScale?.[0] || '#f7fbff',
      colorMax:
        settings.colorScale?.length === 3
          ? settings.colorScale[2]
          : settings.colorScale?.[1] || '#08306b',
      colorMiddle:
        settings.colorScale?.length === 3
          ? settings.colorScale[1]
          : interpolateColor(
              settings.colorScale?.[0] || '#f7fbff',
              settings.colorScale?.[1] || '#08306b',
              0.5
            ),
      minValue: currentStimulusColorRange[0],
      maxValue: currentStimulusColorRange[1],
    }),
    buildPatch: (draft, committed) => {
      const updates: Partial<TransitionMatrixPlotSettings> = {}

      const colorChanged =
        draft.colorMin !== committed.colorMin ||
        draft.colorMiddle !== committed.colorMiddle ||
        draft.colorMax !== committed.colorMax
      if (colorChanged) {
        const autoMiddle = interpolateColor(draft.colorMin, draft.colorMax, 0.5)
        updates.colorScale =
          draft.colorMiddle === autoMiddle
            ? [draft.colorMin, draft.colorMax]
            : [draft.colorMin, draft.colorMiddle, draft.colorMax]
      }

      if (
        draft.minValue !== committed.minValue ||
        draft.maxValue !== committed.maxValue
      ) {
        const ranges = [...(settings.stimuliColorValueRanges || [])]
        ranges[settings.stimulusId] = [draft.minValue, draft.maxValue]
        updates.stimuliColorValueRanges = ranges
      }

      return updates
    },
  })

  const syncs = preview.fields

  const effectiveColorScale = $derived.by(() => {
    const draft = preview.draft
    const min = draft.colorMin
    const middle = draft.colorMiddle
    const max = draft.colorMax

    const autoMiddle = interpolateColor(min, max, 0.5)
    if (middle === autoMiddle) {
      return [min, max]
    }
    return [min, middle, max]
  })

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

  // Handlers
  function updateSettings(updates: Partial<typeof settings>) {
    workspace.updateItemSettings(item.id, updates, source)
  }

  const selectItems = $derived<GroupSelectItem[]>([
    {
      label: 'Stimulus',
      options: (() => {
        return getStimuliOptions(engine)
      })(),
      value: settings.stimulusId.toString(),
      onchange: (e: CustomEvent) =>
        updateSettings({ stimulusId: parseInt(e.detail) }),
    },
    {
      label: 'Group',
      options: (() => {
        return getParticipantsGroupOptions(engine, true, settings.stimulusId)
      })(),
      value: settings.groupId.toString(),
      onchange: (e: CustomEvent) =>
        updateSettings({ groupId: parseInt(e.detail) }),
    },
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
    <div class="controls">
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
        colorValueRange={[syncs.minValue.value, syncs.maxValue.value]}
        belowMinColor={settings.belowMinColor}
        aboveMaxColor={settings.aboveMaxColor}
        showBelowMinLabels={settings.showBelowMinLabels}
        showAboveMaxLabels={settings.showAboveMaxLabels}
      />
    </div>
  {/snippet}
</BasePlot>

<style>
  .controls {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    background: inherit;
  }

  .figure-container {
    flex: 1;
    position: relative;
    height: 100%;
    /* Previous CSS had height: calc(100% - 60px) or similar, but with BasePlot handling layout, 100% should be correct relative to figure area */
  }
</style>
