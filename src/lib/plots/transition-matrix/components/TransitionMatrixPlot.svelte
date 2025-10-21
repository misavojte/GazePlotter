<script lang="ts">
  // Svelte core imports
  import { fade } from 'svelte/transition'
  import { untrack } from 'svelte'

  // Local components
  import {
    TransitionMatrixPlotFigure,
    TransitionMatrixSelectStimulus,
    TransitionMatrixSelectGroup,
    TransitionMatrixButtonMenu,
  } from '$lib/plots/transition-matrix/components'
  import Select from '$lib/shared/components/GeneralSelect.svelte'
  import { PlotPlaceholder } from '$lib/plots/shared/components'
  import { ModalContentMaxValue, ModalContentColorScale } from '$lib/modals'

  // Utilities and stores
  import { DEFAULT_GRID_CONFIG } from '$lib/shared/utils/gridSizingUtils'
  import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared/utils'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import { calculateTransitionMatrix } from '$lib/plots/transition-matrix/utils'
  import { AggregationMethod } from '$lib/plots/transition-matrix/const'

  // Types
  import type { TransitionMatrixGridType } from '$lib/workspace/type/gridType'

  interface Props {
    settings: TransitionMatrixGridType
    settingsChange: (settings: Partial<TransitionMatrixGridType>) => void
    forceRedraw: () => void
  }

  let { settings, settingsChange, forceRedraw }: Props = $props()

  // Constants for space taken by headers, controls, and padding
  const HEADER_HEIGHT = 150 // Estimated space for header and controls
  const HORIZONTAL_PADDING = 50 // Horizontal padding inside the container

  // Get current stimulus-specific color range or use default values
  const currentStimulusColorRange = $derived.by(() => {
    const stimulusId = settings.stimulusId
    return settings.stimuliColorValueRanges?.[stimulusId] || [0, 0]
  })

  // Visualization settings (now reactive)
  let plotDimensions = $derived.by(() =>
    calculatePlotDimensionsWithHeader(
      settings.w,
      settings.h,
      DEFAULT_GRID_CONFIG,
      HEADER_HEIGHT,
      HORIZONTAL_PADDING
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
    { value: AggregationMethod.SUM, label: 'Transition Count' },
    { value: AggregationMethod.PROBABILITY, label: 'Transition Probability (1-step)' },
    { value: AggregationMethod.PROBABILITY_2, label: 'Transition Probability (2-step)' },
    { value: AggregationMethod.PROBABILITY_3, label: 'Transition Probability (3-step)' },
    { value: AggregationMethod.DWELL_TIME, label: 'Avg Dwell Time' },
    {
      value: AggregationMethod.SEGMENT_DWELL_TIME,
      label: 'Segment Dwell Time',
    },
  ]

  function handleSettingsChange(
    newSettings: Partial<TransitionMatrixGridType>
  ) {
    settingsChange(newSettings)
  }

  function handleAggregationChange(event: CustomEvent) {
    // Update the aggregation method in grid settings
    settingsChange({ aggregationMethod: event.detail as AggregationMethod })
  }

  const redrawTimestamp = $derived.by(() => settings.redrawTimestamp)
  // Update AOI labels when data changes
  $effect(() => {
    console.log('redrawTimestampTransitionMatrix', redrawTimestamp)

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
        return 'Transition Count'
      case AggregationMethod.PROBABILITY:
        return '1-Step Probability (%)'
      case AggregationMethod.PROBABILITY_2:
        return '2-Step Probability (%)'
      case AggregationMethod.PROBABILITY_3:
        return '3-Step Probability (%)'
      case AggregationMethod.DWELL_TIME:
        return 'Dwell Time (ms)'
      case AggregationMethod.SEGMENT_DWELL_TIME:
        return 'Segment Dwell Time (ms)'
      default:
        return 'Transition Value'
    }
  }

  function handleGradientClick() {
    try {
      modalStore.open(ModalContentColorScale as any, 'Customize color scale', {
        settings,
        settingsChange,
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
          settingsChange,
        }
      )
    } catch (error) {
      console.error('Error opening modal:', error)
    }
  }
</script>

<div class="aoi-matrix-container">
  <div class="header">
    <div class="controls">
      <TransitionMatrixSelectStimulus
        {settings}
        settingsChange={handleSettingsChange}
      />
      <TransitionMatrixSelectGroup
        {settings}
        settingsChange={handleSettingsChange}
      />
      <Select
        label="Aggregation"
        options={aggregationOptions}
        value={settings.aggregationMethod}
        onchange={handleAggregationChange}
        compact={true}
      />
      <div class="menu-button">
        <TransitionMatrixButtonMenu
          {settings}
          settingsChange={handleSettingsChange}
          {forceRedraw}
        />
      </div>
    </div>
  </div>

  {#if settings?.stimulusId !== undefined}
    {#if aoiLabels.length > 0}
      <div class="figure-container" in:fade={{ duration: 300 }}>
        <TransitionMatrixPlotFigure
          TransitionMatrix={matrix}
          {aoiLabels}
          width={plotDimensions.width}
          height={plotDimensions.height}
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
    {:else}
      <div class="figure-container" style="height: {plotDimensions.height}px">
        <PlotPlaceholder
          width={plotDimensions.width}
          height={plotDimensions.height}
        />
      </div>
    {/if}
  {:else}
    <div class="figure-container" style="height: {plotDimensions.height}px">
      <PlotPlaceholder
        width={plotDimensions.width}
        height={plotDimensions.height}
      />
    </div>
  {/if}
</div>

<style>
  .aoi-matrix-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }

  .header {
    padding: 0 0 10px 0;
    margin-bottom: 10px;
    background-color: var(--c-white);
  }

  .controls {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    background: inherit;
  }

  .figure-container {
    flex: 1;
    position: relative;
    height: calc(100% - 60px);
  }
</style>
