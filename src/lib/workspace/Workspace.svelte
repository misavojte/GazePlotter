<script lang="ts">
  import { onDestroy } from 'svelte'
  import { IndicatorEmpty, IndicatorLoading } from './'
  import Grid from './grid/Grid.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import Rail from './rail/Rail.svelte'
  import Ribbon from './ribbon/Ribbon.svelte'

  import {
    MIN_WORKSPACE_HEIGHT,
    DEFAULT_GRID_CONFIG,
    calculateGridHeight,
    calculateGridWidth,
  } from './grid'
  import { GridInteractionController } from './grid/interaction'
  import { plotRegistry } from '$lib/plots/registry'
  import type { WorkspaceCommandChain } from './commands'
  import type { GridItemSnapshot } from './'

  interface Props {
    onWorkspaceCommandChain: (command: WorkspaceCommandChain) => void
    initialLayoutState?: GridItemSnapshot[] | null
  }

  const {
    onWorkspaceCommandChain,
    initialLayoutState = null,
  }: Props = $props()
  const { ingest, grid, workspace } = getGazePlotterSession()

  const gridConfig = DEFAULT_GRID_CONFIG

  // ---------------------------------------------------
  // State tracking (Svelte 5 Runes)
  // ---------------------------------------------------

  // Sync external file processing state with the grid class
  $effect(() => {
    grid.isLoading = ingest.isLoading
  })

  let workspaceContainer: HTMLElement | null = $state(null)
  const interaction = new GridInteractionController()
  const positionsWithPreview = $derived.by(() =>
    interaction.getPositionsWithPreview(grid.positions)
  )
  const gridHeight = $derived.by(() => {
    const baseHeight = calculateGridHeight(
      positionsWithPreview,
      grid.isEmpty,
      grid.isLoading,
      gridConfig
    )

    return interaction.workspaceHeightHint === null
      ? baseHeight
      : Math.max(baseHeight, interaction.workspaceHeightHint)
  })
  const gridWidth = $derived.by(() => {
    const baseWidth = calculateGridWidth(positionsWithPreview, gridConfig)

    return interaction.workspaceWidthHint === null
      ? baseWidth
      : Math.max(baseWidth, interaction.workspaceWidthHint)
  })

  // ---------------------------------------------------
  // Initialization Logic
  // ---------------------------------------------------

  $effect(() => {
    if (workspaceContainer) {
      workspaceContainer.scrollLeft = 0
    }
  })

  $effect(() => {
    interaction.setGridConfig(gridConfig)
  })

  $effect(() => {
    interaction.setViewportElement(workspaceContainer)

    return () => {
      interaction.setViewportElement(null)
    }
  })

  const visualizations = Object.entries(plotRegistry).map(([id, config]) => ({
    id,
    label: config.name,
  }))

  $effect(() => {
    workspace.setCommandListener(onWorkspaceCommandChain)

    return () => {
      workspace.setCommandListener(() => {})
    }
  })

  onDestroy(() => {
    interaction.destroy()
  })

  const styleProps = `--min-workspace-height: ${MIN_WORKSPACE_HEIGHT}px; --grid-container-min-height: ${MIN_WORKSPACE_HEIGHT - 100}px;`
</script>

<div class="workspace-wrapper" style={styleProps}>
  <Ribbon />

  <div class="workspace-body">
    <Rail {initialLayoutState} {visualizations} />

    <div
      class="workspace-container"
      style="height: {gridHeight}px;"
      bind:this={workspaceContainer}
      role="none"
    >
      {#if grid.isEmpty && !(ingest.isLoading || grid.isLoading)}
        <IndicatorEmpty {initialLayoutState} />
      {:else if ingest.isLoading || grid.isLoading}
        <IndicatorLoading />
      {:else}
        <Grid
          gridItems={grid.items}
          {gridConfig}
          {interaction}
          {gridHeight}
          {gridWidth}
          gridIsEmpty={grid.isEmpty}
          {workspaceContainer}
        />
      {/if}
    </div>
  </div>
</div>

<style>
  .workspace-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: var(--min-workspace-height);
    border: 1px solid var(--c-border);
  }

  .workspace-body {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
  }

  .workspace-container {
    box-sizing: border-box;
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    z-index: 1;
    transition: height 0.3s ease-out;
    overflow-x: auto;
    overflow-y: hidden;
    min-height: var(--min-workspace-height);
    padding: 35px;
    will-change: height;
    cursor: grab;
    background-color: var(--c-darkwhite);
  }
</style>
