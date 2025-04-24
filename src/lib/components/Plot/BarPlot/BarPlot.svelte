<script lang="ts">
  import BarPlotFigure from './BarPlotFigure.svelte'
  import { calculatePlotDimensionsWithHeader } from '$lib/utils/plotSizeUtility'
  import { DEFAULT_GRID_CONFIG } from '$lib/utils/gridSizingUtils'
  import type { BarPlotGridType } from '$lib/type/gridType'
  import { getBarPlotData } from '$lib/utils/barPlotUtils'
  import GeneralSelect from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { getStimuli, getParticipantsGroups } from '$lib/stores/dataStore'
  import BarPlotButtonMenu from './BarPlotButtonMenu.svelte'

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
    forceRedraw: () => void
  }

  let { settings, settingsChange, forceRedraw }: Props = $props()

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
    const newAggregationMethod = event.detail as
      | 'absoluteTime'
      | 'relativeTime'
      | 'timeToFirstFixation'
      | 'avgFixationDuration'
      | 'avgFirstFixationDuration'
      | 'averageFixationCount'
    settingsChange({
      aggregationMethod: newAggregationMethod,
    })
  }

  // Handle all settings changes via this function to ensure consistent handling
  function handleSettingsChange(newSettings: Partial<BarPlotGridType>) {
    if (settingsChange) {
      settingsChange(newSettings)
    }
  }

  $effect(() => {
    console.log()
  })
</script>

<div class="bar-plot-container">
  <div class="header">
    <div class="controls">
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
        label="Aggregation"
        options={[
          { value: 'absoluteTime', label: 'Absolute Time' },
          { value: 'relativeTime', label: 'Relative Time' },
          { value: 'timeToFirstFixation', label: 'Time to First Fixation' },
          { value: 'avgFixationDuration', label: 'Avg Fixation Duration' },
          {
            value: 'avgFirstFixationDuration',
            label: 'Avg First Fixation Duration',
          },
          {
            value: 'averageFixationCount',
            label: 'Avg Fixation Count',
          },
        ]}
        compact
        value={settings.aggregationMethod}
        onchange={handleAggregationMethodChange}
      />
      <div class="menu-button">
        <BarPlotButtonMenu
          {settings}
          settingsChange={handleSettingsChange}
          {forceRedraw}
        />
      </div>
    </div>
  </div>

  <BarPlotFigure
    width={plotDimensions.width}
    height={plotDimensions.height}
    data={labelededBarPlotData}
    {timeline}
    barPlottingType={settings.barPlottingType}
    barWidth={200}
    barSpacing={20}
    onDataHover={() => {}}
  />
</div>

<style>
  .bar-plot-container {
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
</style>
