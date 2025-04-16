<script lang="ts">
  import BarPlotFigure from './BarPlotFigure.svelte'
  import { calculatePlotDimensionsWithHeader } from '$lib/utils/plotSizeUtility'
  import { DEFAULT_GRID_CONFIG } from '$lib/utils/gridSizingUtils'
  import type { BarPlotGridType } from '$lib/type/gridType'
  import { getBarPlotData } from '$lib/utils/barPlotUtils'
  import GeneralSelect from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { getStimuli, getParticipantsGroups } from '$lib/stores/dataStore'
  // CONSTANTS - centralized for easier maintenance
  const LAYOUT = {
    HEADER_HEIGHT: 150,
    HORIZONTAL_PADDING: 50,
    CONTENT_PADDING: 0,
  }

  // Component Props using Svelte 5 $props() rune
  interface Props {
    settings: BarPlotGridType
    settingsChange: (settings: Partial<BarPlotGridType>) => void
  }

  let { settings, settingsChange }: Props = $props()

  // Calculate plot dimensions using a more descriptive approach
  const plotDimensions = $derived.by(() =>
    calculatePlotDimensionsWithHeader(
      settings.w,
      settings.h,
      DEFAULT_GRID_CONFIG,
      LAYOUT.HEADER_HEIGHT,
      LAYOUT.HORIZONTAL_PADDING,
      LAYOUT.CONTENT_PADDING
    )
  )

  // Get bar plot data and timeline from utility function
  const barPlotResult = $derived.by(() => getBarPlotData(settings))
  const labelededBarPlotData = $derived(barPlotResult.data)
  const timeline = $derived(barPlotResult.timeline)
  const barPlottingType = $derived(settings.barPlottingType)

  function handleBarPlottingTypeChange(event: CustomEvent) {
    const newType = event.detail as 'vertical' | 'horizontal'
    settingsChange({
      barPlottingType: newType,
    })
  }

  function handleStimulusChange(event: CustomEvent) {
    const newStimulusId = event.detail as string
    settingsChange({
      stimulusId: parseInt(newStimulusId),
    })
  }

  function handleGroupChange(event: CustomEvent) {
    const newGroupId = event.detail as string
    settingsChange({
      groupId: parseInt(newGroupId),
    })
  }

  function handleAggregationMethodChange(event: CustomEvent) {
    const newAggregationMethod = event.detail as 'absoluteTime' | 'relativeTime'
    settingsChange({
      aggregationMethod: newAggregationMethod,
    })
  }
  $effect(() => {
    console.log()
  })
</script>

<div class="bar-plot-container">
  <GeneralSelect
    label="Stimulus"
    options={getStimuli().map(stimulus => ({
      value: stimulus.id.toString(),
      label: stimulus.displayedName,
    }))}
    compact
    value={settings.stimulusId.toString()}
    onchange={handleStimulusChange}
  />
  <GeneralSelect
    label="Group"
    options={getParticipantsGroups(true).map(group => ({
      value: group.id.toString(),
      label: group.name,
    }))}
    compact
    value={settings.groupId.toString()}
    onchange={handleGroupChange}
  />
  <GeneralSelect
    label="Aggregation Method"
    options={[
      { value: 'absoluteTime', label: 'Absolute Time' },
      { value: 'relativeTime', label: 'Relative Time' },
    ]}
    compact
    value={settings.aggregationMethod}
    onchange={handleAggregationMethodChange}
  />
  <GeneralSelect
    label="Bar Plotting Type"
    options={[
      { value: 'vertical', label: 'Vertical' },
      { value: 'horizontal', label: 'Horizontal' },
    ]}
    compact
    value={barPlottingType}
    onchange={handleBarPlottingTypeChange}
  />
</div>

<BarPlotFigure
  width={plotDimensions.width}
  height={plotDimensions.height}
  data={labelededBarPlotData}
  {timeline}
  {barPlottingType}
  barWidth={200}
  barSpacing={20}
  onDataHover={() => {}}
/>

<style>
  .bar-plot-container {
    display: flex;
    background-color: white;
    gap: 5px;
  }
</style>
