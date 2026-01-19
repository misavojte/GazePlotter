<script lang="ts">
  import { untrack } from 'svelte'

  // Local components
  import { BarPlotFigure, BarPlotButtonMenu } from '$lib/plots/bar/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import Select, {
    type GroupSelectItem,
  } from '$lib/shared/components/GeneralSelect.svelte'

  // Utilities and stores
  import { getBarPlotData } from '$lib/plots/bar/utils/barPlotUtils'
  import { getStimuliOptions } from '$lib/plots/shared/utils/sharedPlotUtils'
  import { getParticipantsGroups } from '$lib/gaze-data/front-process/stores/dataStore'

  // Types and constants
  import type { BarPlotGridType } from '$lib/workspace/type/gridType'
  import type { BarPlotAggregationMethodId } from '$lib/plots/bar/const'
  import { BAR_PLOT_AGGREGATION_METHODS } from '$lib/plots/bar/const'
  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  // CONSTANTS - centralized for easier maintenance
  const LAYOUT = {
    headerHeight: 150,
    horizontalPadding: 50,
    contentPadding: 0,
  }

  // Component Props using Svelte 5 $props() rune
  interface Props {
    settings: BarPlotGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  // Get bar plot data and timeline from utility function
  let barPlotResult = $state(getBarPlotData(settings))
  const labelededBarPlotData = $derived(barPlotResult.data)
  const timeline = $derived(barPlotResult.timeline)

  // source for the workspace commands directly from the plot
  const source = createCommandSourcePlotPattern(settings, 'plot')

  function handleStimulusChange(event: CustomEvent) {
    const newStimulusId = event.detail as string
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      source,
      settings: {
        stimulusId: parseInt(newStimulusId),
      },
    })
  }

  function handleGroupChange(event: CustomEvent) {
    const newGroupId = event.detail as string
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      source,
      settings: {
        groupId: parseInt(newGroupId),
      },
    })
  }

  function handleAggregationMethodChange(event: CustomEvent) {
    const newAggregationMethod = event.detail as BarPlotAggregationMethodId
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      source,
      settings: {
        aggregationMethod: newAggregationMethod,
      },
    })
  }

  let stimulusOptions =
    $state<{ label: string; value: string }[]>(getStimuliOptions())

  const getGroupOptions = () => {
    return getParticipantsGroups(true).map(group => ({
      value: group.id.toString(),
      label: group.name,
    }))
  }

  let groupOptions =
    $state<{ label: string; value: string }[]>(getGroupOptions())

  // Grouped selects like Scarf header: Stimulus, Group, Aggregation
  const selectItems = $derived<GroupSelectItem[]>([
    {
      label: 'Stimulus',
      options: stimulusOptions,
      value: settings.stimulusId.toString(),
      onchange: handleStimulusChange,
    },
    {
      label: 'Group',
      options: groupOptions,
      value: settings.groupId.toString(),
      onchange: handleGroupChange,
    },
    {
      label: 'Aggregation',
      options: BAR_PLOT_AGGREGATION_METHODS,
      value: settings.aggregationMethod,
      onchange: handleAggregationMethodChange,
    },
  ])

  /**
   * This is to prevent unnecessary recalculations when settings change in other components in the workspace
   */
  const redrawTimestamp = $derived.by(() => settings.redrawTimestamp)
  $effect(() => {
    redrawTimestamp // reactive dependency
    untrack(() => {
      barPlotResult = getBarPlotData(settings)
      stimulusOptions = getStimuliOptions()
      groupOptions = getGroupOptions()
    })
  })
</script>

<BasePlot {settings} {onWorkspaceCommand} layoutConfig={LAYOUT}>
  {#snippet header()}
    <div class="controls">
      <Select
        ariaLabel="Bar filters"
        items={selectItems}
        label="Bar"
        options={[]}
      />
      <div class="menu-button">
        <BarPlotButtonMenu {settings} {onWorkspaceCommand} />
      </div>
    </div>
  {/snippet}

  {#snippet figure({ width, height })}
    <BarPlotFigure
      {width}
      {height}
      data={labelededBarPlotData}
      {timeline}
      barPlottingType={settings.barPlottingType}
      barWidth={200}
      barSpacing={20}
      onDataHover={() => {}}
    />
  {/snippet}
</BasePlot>

<style>
  .controls {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    background: inherit;
  }
</style>
