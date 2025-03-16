<script lang="ts">
  import { onMount } from 'svelte'
  import AoiTransitionMatrixPlotFigure from './AoiTransitionMatrixPlotFigure.svelte'
  import {
    calculateTransitionMatrix,
    AggregationMethod,
  } from '$lib/utils/aoiTransitionMatrixTransformations'
  import type { AOITransitionMatrixGridType } from '$lib/type/gridType'
  import ScarfPlotSelectStimulus from '../ScarfPlot/ScarfPlotSelect/ScarfPlotSelectStimulus.svelte'
  import ScarfPlotSelectGroup from '../ScarfPlot/ScarfPlotSelect/ScarfPlotSelectGroup.svelte'
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import AoiTransitionMatrixSelectStimulus from './AoiTransitionMatrixSelectStimulus.svelte'
  import AoiTransitionMatrixSelectGroup from './AoiTransitionMatrixSelectGroup.svelte'

  interface Props {
    settings: AOITransitionMatrixGridType
    settingsChange: (settings: Partial<AOITransitionMatrixGridType>) => void
  }

  let { settings, settingsChange }: Props = $props()

  // Visualization settings
  const width = 600
  const height = 600
  const cellSize = 60
  const colorScale = ['#f7fbff', '#08306b'] // Blue gradient
  let minThreshold = 0

  // Aggregation method selection
  let aggregationMethod = $state(AggregationMethod.SUM)
  const aggregationOptions = [
    { value: AggregationMethod.SUM, label: 'Sum' },
    { value: AggregationMethod.AVERAGE, label: 'Average' },
    { value: AggregationMethod.MEDIAN, label: 'Median' },
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
    aggregationMethod = event.detail as AggregationMethod
  }

  // Calculate matrix based on current settings
  $effect(() => {
    // This will re-run when settings change
  })
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
        value={aggregationMethod}
        onchange={handleAggregationChange}
        compact={true}
      />
    </div>
  </div>

  <div class="matrix-content">
    {#if settings?.stimulusId !== undefined}
      {#key `${settings.stimulusId}-${settings.groupId}-${aggregationMethod}`}
        {@const { matrix, aoiLabels } = calculateTransitionMatrix(
          settings.stimulusId,
          settings.groupId,
          aggregationMethod
        )}
        {#if aoiLabels.length > 0}
          <div class="matrix-wrapper">
            <AoiTransitionMatrixPlotFigure
              aoiTransitionMatrix={matrix}
              {aoiLabels}
              {width}
              {height}
              {cellSize}
              {colorScale}
              xLabel="To AOI"
              yLabel="From AOI"
              legendTitle={`Transition ${
                aggregationMethod === AggregationMethod.SUM
                  ? 'Count'
                  : aggregationMethod === AggregationMethod.AVERAGE
                    ? 'Average'
                    : 'Median'
              }`}
              {minThreshold}
              onThresholdChange={handleThresholdChange}
            />
          </div>
        {:else}
          <div class="no-data">
            No AOI data available for the selected stimulus.
          </div>
        {/if}
      {/key}
    {:else}
      <div class="no-data">
        Please select a stimulus to view transition data.
      </div>
    {/if}
  </div>
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

  .aggregation-control {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-left: 10px;
  }

  .aggregation-control select {
    padding: 2px 5px;
    border-radius: 3px;
    border: 1px solid var(--c-lightgrey);
  }

  .matrix-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: auto;
    position: relative;
  }

  .matrix-wrapper {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: auto;
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
