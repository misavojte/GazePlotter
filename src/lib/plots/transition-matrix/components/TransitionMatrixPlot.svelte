<script lang="ts">
  // Svelte core imports
  import { untrack, onDestroy } from 'svelte'

  // Local components
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
  import { calculateTransitionMatrix } from '$lib/plots/transition-matrix/utils'
  import { AggregationMethod } from '$lib/plots/transition-matrix/const'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '$lib/plots/shared'
  import { data } from '$lib/gaze-data/front-process/stores/dataStore'

  // Types
  import type { TransitionMatrixGridType } from '$lib/workspace/type/gridType'
  import type { WorkspaceCommand } from '$lib/workspace/commands'

  const LAYOUT = {
    headerHeight: 150,
    horizontalPadding: 50,
  }

  interface Props {
    settings: TransitionMatrixGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  // Get current stimulus-specific color range or use default values
  const currentStimulusColorRange = $derived.by(() => {
    const stimulusId = settings.stimulusId
    return settings.stimuliColorValueRanges?.[stimulusId] || [0, 0]
  })

  // source for workspace commands
  const source = createCommandSourcePlotPattern(settings, 'plot')

  // Visualization settings
  const plotDimensions = $derived.by(() =>
    calculatePlotDimensionsWithHeader(
      settings.w,
      settings.h,
      DEFAULT_GRID_CONFIG,
      LAYOUT.headerHeight,
      LAYOUT.horizontalPadding
    )
  )

  // For tracking AOI labels (needed for cell size calculation)
  let aoiLabels = $state<string[]>([])
  let matrix = $state<number[][]>([])

  let cellSize = $derived.by(() => {
    if (aoiLabels.length > 0) {
      return Math.min(
        Math.floor(plotDimensions.width / aoiLabels.length),
        Math.floor(plotDimensions.height / aoiLabels.length)
      )
    }
    return 60
  })

  // Simplified aggregation method options
  const aggregationOptions = [
    { value: AggregationMethod.SUM, label: 'Absolute frequency' },
    {
      value: AggregationMethod.FREQUENCY_RELATIVE,
      label: 'Relative frequency',
    },
    { value: AggregationMethod.PROBABILITY, label: '1-step probability' },
    { value: AggregationMethod.PROBABILITY_2, label: '2-step probability' },
    { value: AggregationMethod.PROBABILITY_3, label: '3-step probability' },
    { value: AggregationMethod.DWELL_TIME, label: 'Fixation duration' },
    {
      value: AggregationMethod.SEGMENT_DWELL_TIME,
      label: 'Dwell duration',
    },
  ]

  function handleAggregationChange(event: CustomEvent) {
    // Create workspace command for settings change
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: { aggregationMethod: event.detail as AggregationMethod },
      source,
    })
  }

  // Grouped selects like Scarf header: Stimulus, Group, Aggregation
  let selectedStimulusId = $state(settings.stimulusId.toString())
  let stimuliOptions =
    $state<{ label: string; value: string }[]>(getStimuliOptions())

  let selectedGroupId = $state(settings.groupId.toString())
  let groupOptions: { value: string; label: string }[] = $state([])

  // Sync from settings
  $effect(() => {
    selectedStimulusId = settings.stimulusId.toString()
    selectedGroupId = settings.groupId.toString()
    stimuliOptions = getStimuliOptions()
  })

  // Keep group options in sync with data store
  const unsubscribe = data.subscribe(() => {
    groupOptions = getParticipantsGroupOptions()
  })
  onDestroy(() => unsubscribe())

  function onStimulusChange(event: CustomEvent) {
    const stimulusId = parseInt(event.detail)
    selectedStimulusId = stimulusId.toString()
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: { stimulusId },
      source,
    })
  }

  function onGroupChange(event: CustomEvent) {
    const groupId = parseInt(event.detail)
    selectedGroupId = groupId.toString()
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: { groupId },
      source,
    })
  }

  const selectItems = $derived<GroupSelectItem[]>([
    {
      label: 'Stimulus',
      options: stimuliOptions,
      value: selectedStimulusId,
      onchange: onStimulusChange,
    },
    {
      label: 'Group',
      options: groupOptions,
      value: selectedGroupId,
      onchange: onGroupChange,
    },
    {
      label: 'Aggregation',
      options: aggregationOptions,
      value: settings.aggregationMethod,
      onchange: handleAggregationChange,
    },
  ])

  const redrawTimestamp = $derived.by(() => settings.redrawTimestamp)
  // Update AOI labels when data changes
  $effect(() => {
    redrawTimestamp // reactive dependency
    untrack(() => {
      // Logic that should run only when redrawTimestamp changes
      // This is to prevent unnecessary recalculations when settings change in other components in the workspace
      const { aoiLabels: labels, matrix: calculatedMatrix } =
        calculateTransitionMatrix(
          settings.stimulusId,
          settings.groupId,
          settings.aggregationMethod as AggregationMethod
        )

      aoiLabels = labels
      matrix = calculatedMatrix
    })
  })

  // Update the legend title based on the aggregation method
  function getLegendTitle(method: string): string {
    switch (method) {
      case AggregationMethod.SUM:
        return 'Absolute frequency'
      case AggregationMethod.FREQUENCY_RELATIVE:
        return 'Relative frequency %'
      case AggregationMethod.PROBABILITY:
        return '1-step probability (%)'
      case AggregationMethod.PROBABILITY_2:
        return '2-step probability (%)'
      case AggregationMethod.PROBABILITY_3:
        return '3-step probability (%)'
      case AggregationMethod.DWELL_TIME:
        return 'Fixation duration (ms)'
      case AggregationMethod.SEGMENT_DWELL_TIME:
        return 'Dwell duration (ms)'
      default:
        return 'Transition Value'
    }
  }

  const sourceForOpenedModals = createCommandSourcePlotPattern(
    settings,
    'modal'
  )
  function handleGradientClick() {
    try {
      modalStore.open(ModalContentColorScale as any, 'Customize color scale', {
        settings,
        source: sourceForOpenedModals,
        onWorkspaceCommand,
      })
    } catch (error) {
      console.error('Error opening color scale modal:', error)
    }
  }

  function handleValueClick(isMin: boolean) {
    try {
      modalStore.open(
        ModalContentMaxValue as any,
        'Set maximum color scale value',
        {
          settings,
          source: sourceForOpenedModals,
          onWorkspaceCommand,
        }
      )
    } catch (error) {
      console.error('Error opening modal:', error)
    }
  }
</script>

<BasePlot
  {settings}
  layoutConfig={LAYOUT}
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
        legendTitle={getLegendTitle(settings.aggregationMethod)}
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
