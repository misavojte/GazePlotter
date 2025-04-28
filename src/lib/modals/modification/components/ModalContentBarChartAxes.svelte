<script lang="ts">
  import GeneralRadio from '$lib/shared/components/GeneralRadio.svelte'
  import {
    GeneralButtonMajor,
    GeneralInputNumber,
  } from '$lib/shared/components'
  import type { BarPlotGridType } from '$lib/workspace/type/gridType'
  import GeneralFieldset from '$lib/shared/components/GeneralFieldset.svelte'

  interface Props {
    settings: BarPlotGridType
    settingsChange: (settings: Partial<BarPlotGridType>) => void
  }

  let { settings, settingsChange }: Props = $props()

  // Local state to track changes before applying
  let barPlottingType = $state(settings.barPlottingType)
  let sortBars = $state(settings.sortBars)

  // Scale range settings
  let minValue = $state(
    settings.scaleRange ? parseFloat(settings.scaleRange[0].toString()) : 0
  )
  let maxValue = $state(
    settings.scaleRange ? parseFloat(settings.scaleRange[1].toString()) : 0
  )
  let useCustomScale = $state(
    settings.scaleRange &&
      !(settings.scaleRange[0] === 0 && settings.scaleRange[1] === 0)
  )

  const handleSubmit = () => {
    // Create a new scaleRange based on the inputs
    let newScaleRange: [number, number] = [0, 0] // Default to auto if not using custom scale

    // Use the numeric values directly
    newScaleRange = [minValue || 0, maxValue || 0]

    settingsChange({
      barPlottingType,
      sortBars,
      scaleRange: newScaleRange,
    })
  }
</script>

<div class="bar-chart-axes-container">
  <div class="axes-section">
    <GeneralRadio
      legend="Bar Orientation"
      options={[
        { value: 'vertical', label: 'Vertical' },
        { value: 'horizontal', label: 'Horizontal' },
      ]}
      userSelected={barPlottingType}
      onchange={(value) => { barPlottingType = value as 'vertical' | 'horizontal' }}
    />
  </div>

  <div class="axes-section">
    <GeneralRadio
      legend="Bar Sorting"
      options={[
        { value: 'none', label: 'None (Original Order)' },
        { value: 'ascending', label: 'Ascending (By Value)' },
        { value: 'descending', label: 'Descending (By Value)' },
      ]}
      userSelected={sortBars}
      onchange={(value) => { sortBars = value as 'none' | 'ascending' | 'descending' }}
    />
  </div>

  <div class="axes-section">
    <GeneralFieldset legend="Scale Range">
      <div class="scale-range-section">
        <div class="scale-inputs">
          <GeneralInputNumber label="Min Value" bind:value={minValue} min={0} />

          <div class="max-value-container">
            <GeneralInputNumber
              label="Max Value"
              bind:value={maxValue}
              min={0}
            />
            <div class="hint-text">Use 0 for automatic max scale</div>
          </div>
        </div>
      </div></GeneralFieldset
    >
  </div>

  <div class="buttons-container">
    <GeneralButtonMajor onclick={handleSubmit}>Apply</GeneralButtonMajor>
  </div>
</div>

<style>
  .bar-chart-axes-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .axes-section {
    margin-bottom: 8px;
  }

  .scale-range-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .scale-inputs {
    display: flex;
    gap: 16px;
    margin-top: 8px;
  }

  .max-value-container {
    display: flex;
    flex-direction: column;
  }

  .hint-text {
    font-size: 12px;
    color: #666;
    margin-top: 4px;
  }

  .buttons-container {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
</style>
