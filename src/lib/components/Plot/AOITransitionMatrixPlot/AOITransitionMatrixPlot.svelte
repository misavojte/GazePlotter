<script lang="ts">
  import AoiTransitionMatrixPlotFigure from './AoiTransitionMatrixPlotFigure.svelte'
  import {
    calculateTransitionMatrix,
    AggregationMethod,
  } from '$lib/utils/aoiTransitionMatrixTransformations'
  import type { AOITransitionMatrixGridType } from '$lib/type/gridType'
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { DEFAULT_GRID_CONFIG } from '$lib/utils/gridSizingUtils'
  import { calculatePlotDimensionsWithHeader } from '$lib/utils/plotSizeUtility'
  import AoiTransitionMatrixSelectStimulus from './AoiTransitionMatrixSelectStimulus.svelte'
  import AoiTransitionMatrixSelectGroup from './AoiTransitionMatrixSelectGroup.svelte'
  import AoiTransitionMatrixButtonMenu from './AoiTransitionMatrixButtonMenu.svelte'

  interface Props {
    settings: AOITransitionMatrixGridType
    settingsChange: (settings: Partial<AOITransitionMatrixGridType>) => void
  }

  let { settings, settingsChange }: Props = $props()

  // Constants for space taken by headers, controls, and padding
  const HEADER_HEIGHT = 150 // Estimated space for header and controls
  const HORIZONTAL_PADDING = 50 // Horizontal padding inside the container
  const CONTENT_PADDING = 20 // Padding around the plot content

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

  let cellSize = $derived.by(() => {
    if (aoiLabels.length > 0) {
      return Math.min(
        Math.floor(plotDimensions.width / aoiLabels.length),
        Math.floor(plotDimensions.height / aoiLabels.length)
      )
    }
    return 60
  })

  const colorScale = ['#f7fbff', '#08306b'] // Blue gradient
  let minThreshold = $state(0)
  let calculatedMaxValue = $state(0)

  // Simplified aggregation method options
  const aggregationOptions = [
    { value: AggregationMethod.SUM, label: 'Transition Count' },
    { value: AggregationMethod.PROBABILITY, label: 'Transition Probability' },
    { value: AggregationMethod.DWELL_TIME, label: 'Avg Dwell Time' },
    {
      value: AggregationMethod.SEGMENT_DWELL_TIME,
      label: 'Segment Dwell Time',
    },
  ]

  function handleSettingsChange(
    newSettings: Partial<AOITransitionMatrixGridType>
  ) {
    settingsChange(newSettings)
  }

  function handleThresholdChange(threshold: number) {
    minThreshold = threshold
  }

  function handleAggregationChange(event: CustomEvent) {
    // Update the aggregation method in grid settings
    settingsChange({ aggregationMethod: event.detail })
  }

  function handleCalculatedMaxChange(value: number) {
    calculatedMaxValue = value
  }

  function handleMaxValueChange(value: number) {
    settingsChange({ maxColorValue: value })
  }

  // Update AOI labels when data changes
  $effect(() => {
    if (settings?.stimulusId !== undefined) {
      const { aoiLabels: labels } = calculateTransitionMatrix(
        settings.stimulusId,
        settings.groupId,
        settings.aggregationMethod
      )

      aoiLabels = labels
    }
  })

  // Update the legend title based on the aggregation method
  function getLegendTitle(method: string): string {
    switch (method) {
      case AggregationMethod.SUM:
        return 'Transition Count'
      case AggregationMethod.PROBABILITY:
        return 'Transition Probability (%)'
      case AggregationMethod.DWELL_TIME:
        return 'Dwell Time (ms)'
      case AggregationMethod.SEGMENT_DWELL_TIME:
        return 'Segment Dwell Time (ms)'
      default:
        return 'Transition Value'
    }
  }
</script>

<div class="aoi-matrix-container">
  <div class="header">
    <div class="controls">
      <AoiTransitionMatrixSelectStimulus
        {settings}
        settingsChange={handleSettingsChange}
      />
      <AoiTransitionMatrixSelectGroup
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
        <AoiTransitionMatrixButtonMenu
          {settings}
          settingsChange={handleSettingsChange}
          {calculatedMaxValue}
          onMaxValueChange={handleMaxValueChange}
        />
      </div>
    </div>
  </div>

  {#if settings?.stimulusId !== undefined}
    {#key `${settings.stimulusId}-${settings.groupId}-${settings.aggregationMethod}`}
      {@const { matrix, aoiLabels } = calculateTransitionMatrix(
        settings.stimulusId,
        settings.groupId,
        settings.aggregationMethod
      )}
      {#if aoiLabels.length > 0}
        <AoiTransitionMatrixPlotFigure
          aoiTransitionMatrix={matrix}
          {aoiLabels}
          width={plotDimensions.width}
          height={plotDimensions.height}
          {cellSize}
          {colorScale}
          xLabel="To AOI"
          yLabel="From AOI"
          legendTitle={getLegendTitle(settings.aggregationMethod)}
          {minThreshold}
          onThresholdChange={handleThresholdChange}
          customMaxValue={settings.maxColorValue}
          useAutoMax={settings.maxColorValue === 0}
          onMaxValueChange={handleCalculatedMaxChange}
        />
      {:else}
        <div class="no-data">
          No AOI data available for the selected stimulus.
        </div>
      {/if}
    {/key}
  {:else}
    <div class="no-data">Please select a stimulus to view transition data.</div>
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

  .no-data {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    font-size: 16px;
    color: var(--c-darkgrey);
  }
</style>
