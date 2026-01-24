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
  import { ModalContentMaxValue, ModalContentColorScale } from '$lib/modals'

  // Utilities and stores
  import { DEFAULT_GRID_CONFIG } from '$lib/workspace/grid'
  import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import { getTransitionMatrixData } from '$lib/plots/transition-matrix/core/transformer'
  import {
    MatrixAggregationMethod,
    TRANSITION_MATRIX_LAYOUT,
    TRANSITION_MATRIX_LEGEND_TITLES,
  } from '$lib/plots/transition-matrix/const'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '$lib/plots/shared'

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

  const source = untrack(() => createCommandSourcePlotPattern(settings, 'plot'))
  const modalSource = untrack(() =>
    createCommandSourcePlotPattern(settings, 'modal')
  )

  const plotDimensions = $derived(
    calculatePlotDimensionsWithHeader(
      settings.w,
      settings.h,
      DEFAULT_GRID_CONFIG,
      TRANSITION_MATRIX_LAYOUT.headerHeight
    )
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

  const cellSize = $derived.by(() => {
    const len = aoiLabels.length
    if (len > 0) {
      return Math.min(
        Math.floor(plotDimensions.width / len),
        Math.floor(plotDimensions.height / len)
      )
    }
    return 60
  })

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
      label: 'Aggregation',
      options: AGGREGATION_OPTIONS,
      value: settings.aggregationMethod,
      onchange: (e: CustomEvent) =>
        updateSettings({
          aggregationMethod: e.detail as MatrixAggregationMethod,
        }),
    },
  ])

  function handleGradientClick() {
    modalStore.open(ModalContentColorScale as any, 'Customize color scale', {
      settings,
      source: modalSource,
      onWorkspaceCommand,
    })
  }

  function handleValueClick(isMin: boolean) {
    modalStore.open(
      ModalContentMaxValue as any,
      'Set maximum color scale value',
      {
        settings,
        source: modalSource,
        onWorkspaceCommand,
      }
    )
  }
</script>

<BasePlot
  {settings}
  layoutConfig={TRANSITION_MATRIX_LAYOUT}
  hasData={settings?.stimulusId !== undefined && aoiLabels.length > 0}
  dimensions={plotDimensions}
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
        {cellSize}
        colorScale={settings.colorScale}
        xLabel="To AOI"
        yLabel="From AOI"
        legendTitle={TRANSITION_MATRIX_LEGEND_TITLES[
          settings.aggregationMethod
        ] ?? 'Transition Value'}
        colorValueRange={currentStimulusColorRange}
        belowMinColor={settings.belowMinColor}
        aboveMaxColor={settings.aboveMaxColor}
        showBelowMinLabels={settings.showBelowMinLabels}
        showAboveMaxLabels={settings.showAboveMaxLabels}
        onGradientClick={handleGradientClick}
        onValueClick={handleValueClick}
      />
    </div>
  {/snippet}
</BasePlot>

<style>
  .controls {
    display: flex;
    gap: 5px;
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
