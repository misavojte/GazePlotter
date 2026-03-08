<script lang="ts">
  import { untrack } from 'svelte'

  // Core imports
  import {
    TransitionMatrixPlotFigure,
    TransitionMatrixButtonMenu,
  } from '$lib/plots/transition-matrix/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import Select, {
    type GroupSelectItem,
  } from '$lib/shared/components/GeneralSelect.svelte'

  // Utilities and stores
  import { PLOT_HEADER_HEIGHT } from '$lib/plots/shared'
  import { getTransitionMatrixData } from '$lib/plots/transition-matrix/core/transformer'
  import {
    MatrixAggregationMethod,
    TRANSITION_MATRIX_LEGEND_TITLES,
  } from '$lib/plots/transition-matrix/const'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
    PreviewSync,
  } from '$lib/plots/shared'
  import { interpolateColor } from '$lib/color/utility'
  import TransitionMatrixViewSettings from './TransitionMatrixViewSettings.svelte'

  // Types
  import type { TransitionMatrixGridType } from '$lib/workspace/type/gridType'
  import type { WorkspaceCommand } from '$lib/workspace/commands'

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
    settings: TransitionMatrixGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  // Data reactive sources
  const currentStimulusColorRange = $derived(
    settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0]
  )

  const colorMinSync = new PreviewSync(settings.colorScale?.[0] || '#f7fbff')
  const colorMaxSync = new PreviewSync(
    settings.colorScale?.length === 3
      ? settings.colorScale[2]
      : settings.colorScale?.[1] || '#08306b'
  )
  const colorMiddleSync = new PreviewSync(
    settings.colorScale?.length === 3
      ? settings.colorScale[1]
      : interpolateColor(
          settings.colorScale?.[0] || '#f7fbff',
          settings.colorScale?.[1] || '#08306b',
          0.5
        )
  )

  const minValueSync = new PreviewSync(currentStimulusColorRange[0])
  const maxValueSync = new PreviewSync(currentStimulusColorRange[1])

  $effect(() => {
    colorMinSync.updateCommitted(settings.colorScale?.[0] || '#f7fbff', true)
    colorMaxSync.updateCommitted(
      settings.colorScale?.length === 3
        ? settings.colorScale[2]
        : settings.colorScale?.[1] || '#08306b',
      true
    )
    colorMiddleSync.updateCommitted(
      settings.colorScale?.length === 3
        ? settings.colorScale[1]
        : interpolateColor(
            settings.colorScale?.[0] || '#f7fbff',
            settings.colorScale?.[1] || '#08306b',
            0.5
          ),
      true
    )
    minValueSync.updateCommitted(currentStimulusColorRange[0], true)
    maxValueSync.updateCommitted(currentStimulusColorRange[1], true)
  })

  const syncs = {
    colorMin: colorMinSync,
    colorMiddle: colorMiddleSync,
    colorMax: colorMaxSync,
    minValue: minValueSync,
    maxValue: maxValueSync,
  }

  const effectiveColorScale = $derived.by(() => {
    const min = colorMinSync.value
    const middle = colorMiddleSync.value
    const max = colorMaxSync.value

    const autoMiddle = interpolateColor(min, max, 0.5)
    if (middle === autoMiddle) {
      return [min, max]
    }
    return [min, middle, max]
  })

  function handleMenuClose() {
    untrack(() => {
      const updates: Partial<TransitionMatrixGridType> = {}

      if (
        colorMinSync.isDirty ||
        colorMiddleSync.isDirty ||
        colorMaxSync.isDirty
      ) {
        updates.colorScale = effectiveColorScale
      }

      if (minValueSync.isDirty || maxValueSync.isDirty) {
        const ranges = [...(settings.stimuliColorValueRanges || [])]
        ranges[settings.stimulusId] = [minValueSync.value, maxValueSync.value]
        updates.stimuliColorValueRanges = ranges
      }

      if (Object.keys(updates).length === 0) {
        colorMinSync.reset()
        colorMiddleSync.reset()
        colorMaxSync.reset()
        minValueSync.reset()
        maxValueSync.reset()
        return
      }

      onWorkspaceCommand({
        type: 'updateSettings',
        itemId: settings.id,
        source: $state.snapshot(source),
        settings: $state.snapshot(updates),
      })

      colorMinSync.reset()
      colorMiddleSync.reset()
      colorMaxSync.reset()
      minValueSync.reset()
      maxValueSync.reset()
    })
  }

  const source = untrack(() => createCommandSourcePlotPattern(settings, 'plot'))
  const modalSource = untrack(() =>
    createCommandSourcePlotPattern(settings, 'modal')
  )

  const transitionData = $derived.by(() => {
    return getTransitionMatrixData(
      settings.stimulusId,
      settings.groupId,
      settings.aggregationMethod as MatrixAggregationMethod
    )
  })

  // Destructure for cleaner access in template
  const { aoiLabels, matrix } = $derived(transitionData)

  // Handlers
  function updateSettings(updates: Partial<typeof settings>) {
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: updates,
      source,
    })
  }

  const selectItems = $derived<GroupSelectItem[]>([
    {
      label: 'Stimulus',
      options: (() => {
        return getStimuliOptions()
      })(),
      value: settings.stimulusId.toString(),
      onchange: (e: CustomEvent) =>
        updateSettings({ stimulusId: parseInt(e.detail) }),
    },
    {
      label: 'Group',
      options: (() => {
        return getParticipantsGroupOptions()
      })(),
      value: settings.groupId.toString(),
      onchange: (e: CustomEvent) =>
        updateSettings({ groupId: parseInt(e.detail) }),
    },
    {
      label: 'View',
      value: settings.aggregationMethod,
      onClose: handleMenuClose,
      options: AGGREGATION_OPTIONS.map(opt => ({
        ...opt,
        onSelect: (v: any) => {
          updateSettings({ aggregationMethod: v as MatrixAggregationMethod })
        },
        closeOnAction: false,
        component: TransitionMatrixViewSettings,
        componentHeight: 140,
        componentProps: {
          syncs,
        },
      })),
    },
  ])
</script>

<BasePlot
  {settings}
  hasData={settings?.stimulusId !== undefined && aoiLabels.length > 0}
>
  {#snippet header()}
    <div class="controls">
      <Select
        ariaLabel="Transition Matrix filters"
        items={selectItems}
        label="Transition Matrix"
        options={[]}
      />
      <div class="menu-button">
        <TransitionMatrixButtonMenu {settings} {onWorkspaceCommand} />
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
        colorValueRange={[minValueSync.value, maxValueSync.value]}
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
