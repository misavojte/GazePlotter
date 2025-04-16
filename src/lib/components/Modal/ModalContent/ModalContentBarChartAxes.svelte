<script lang="ts">
  import GeneralRadio from '$lib/components/General/GeneralRadio/GeneralRadio.svelte'
  import GeneralButtonMajor from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import type { BarPlotGridType } from '$lib/type/gridType'

  interface Props {
    settings: BarPlotGridType
    settingsChange: (settings: Partial<BarPlotGridType>) => void
  }

  let { settings, settingsChange }: Props = $props()

  // Local state to track changes before applying
  let barPlottingType = $state(settings.barPlottingType)
  let sortBars = $state(settings.sortBars)

  const handleSubmit = () => {
    settingsChange({
      barPlottingType,
      sortBars,
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

  .buttons-container {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
</style>
