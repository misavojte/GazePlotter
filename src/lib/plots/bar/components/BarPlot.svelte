<script lang="ts">
  // Svelte core imports
  import { fade } from 'svelte/transition'
  import { untrack, onMount } from 'svelte'

  // Local components
  import { BarPlotFigure, BarPlotButtonMenu } from '$lib/plots/bar/components'
  import { PlotPlaceholder } from '$lib/plots/shared/components'
  import GeneralSelect from '$lib/shared/components/GeneralSelect.svelte'

  // Utilities and stores
  import { DEFAULT_GRID_CONFIG } from '$lib/shared/utils/gridSizingUtils'
  import { calculatePlotDimensionsWithHeader } from '$lib/plots/shared/utils/plotSizeUtility'
  import { getBarPlotData } from '$lib/plots/bar/utils/barPlotUtils'
  import { getStimuliOptions } from '$lib/plots/shared/utils/sharedPlotUtils'
  import { getParticipantsGroups } from '$lib/gaze-data/front-process/stores/dataStore'

  // Types
  import type { BarPlotGridType } from '$lib/workspace/type/gridType'

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
  let barPlotResult = $state(getBarPlotData(settings))
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

  let stimulusOptions =
    $state<{ label: string; value: string }[]>(getStimuliOptions())

  /**
   * This is to prevent unnecessary recalculations when settings change in other components in the workspace
   */
  const redrawTimestamp = $derived.by(() => settings.redrawTimestamp)
  $effect(() => {
    console.log('redrawTimestampBarPlot', redrawTimestamp)

    untrack(() => {
      barPlotResult = getBarPlotData(settings)
      stimulusOptions = getStimuliOptions()
    })
  })

  let mounted = $state(false)
  onMount(() => {
    mounted = true
  })
</script>

<div class="bar-plot-container">
  <div class="header">
    <div class="controls">
      <GeneralSelect
        label="Stimulus"
        options={stimulusOptions}
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

  <div class="figure" style="height: {plotDimensions.height}px">
    {#if mounted}
      <div
        class="figure-content"
        in:fade={{ duration: 300 }}
        style="height: {plotDimensions.height}px"
      >
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
    {:else}
      <div class="figure-content" style="height: {plotDimensions.height}px">
        <PlotPlaceholder
          width={plotDimensions.width}
          height={plotDimensions.height}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .figure {
    position: relative;
    overflow: hidden;
  }

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
