<script lang="ts">
  import { untrack } from 'svelte'

  // Local components
  import { BarPlotFigure, BarPlotButtonMenu } from '$lib/plots/bar/components'
  import { BasePlot } from '$lib/plots/shared/components'
  import Select, {
    type GroupSelectItem,
  } from '$lib/shared/components/GeneralSelect.svelte'

  // Utilities and stores
  import { getBarPlotData } from '$lib/plots/bar/core/transformer'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '$lib/plots/shared'

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

  function updateSetting(newSettings: Partial<BarPlotGridType>) {
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      source,
      settings: newSettings,
    })
  }

  const stimulusOptions = $derived(getStimuliOptions())
  const groupOptions = $derived(getParticipantsGroupOptions())

  // Grouped selects like Scarf header: Stimulus, Group, Aggregation
  const selectItems = $derived<GroupSelectItem[]>([
    {
      label: 'Stimulus',
      options: stimulusOptions,
      value: settings.stimulusId.toString(),
      onchange: (e: CustomEvent) =>
        updateSetting({ stimulusId: parseInt(e.detail) }),
    },
    {
      label: 'Group',
      options: groupOptions,
      value: settings.groupId.toString(),
      onchange: (e: CustomEvent) =>
        updateSetting({ groupId: parseInt(e.detail) }),
    },
    {
      label: 'Aggregation',
      options: BAR_PLOT_AGGREGATION_METHODS,
      value: settings.aggregationMethod,
      onchange: (e: CustomEvent) =>
        updateSetting({
          aggregationMethod: e.detail as BarPlotAggregationMethodId,
        }),
    },
  ])

  /**
   * This is to prevent unnecessary recalculations when settings change in other components in the workspace
   */
  $effect(() => {
    settings.redrawTimestamp // reactive dependency
    untrack(() => {
      barPlotResult = getBarPlotData(settings)
    })
  })
</script>

<BasePlot {settings} layoutConfig={LAYOUT}>
  {#snippet header()}
    <div class="controls">
      <Select ariaLabel="Bar filters" items={selectItems} label="Bar" />
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
