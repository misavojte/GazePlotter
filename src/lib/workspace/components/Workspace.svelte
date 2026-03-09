<script lang="ts">
  import {
    WorkspaceIndicatorEmpty,
    WorkspaceIndicatorLoading,
    WorkspaceToolbar,
  } from '$lib/workspace'
  import Grid from '$lib/workspace/grid/Grid.svelte'
  import { getGazePlotterSession } from '$lib/session'

  import {
    MIN_WORKSPACE_HEIGHT,
    DEFAULT_GRID_CONFIG,
  } from '$lib/workspace/grid'
  import { visualizationRegistry } from '$lib/plots/registry'
  import { createCommandHandler } from '$lib/workspace/commands'
  import type {
    WorkspaceCommand,
    WorkspaceCommandChain,
  } from '$lib/workspace/commands'
  import { createRootCommand } from '$lib/workspace/commands'
  import type { AllGridTypes } from '$lib/workspace/type/gridType'

  interface Props {
    onReinitialize: () => void
    onWorkspaceCommandChain: (command: WorkspaceCommandChain) => void
    initialLayoutState?: Array<Partial<AllGridTypes> & { type: string }> | null
  }

  const {
    onReinitialize,
    onWorkspaceCommandChain,
    initialLayoutState = null,
  }: Props = $props()
  const { engine, ingest, grid, toastState } = getGazePlotterSession()

  const gridConfig = DEFAULT_GRID_CONFIG

  // ---------------------------------------------------
  // State tracking (Svelte 5 Runes)
  // ---------------------------------------------------

  // Sync external file processing state with the grid class
  $effect(() => {
    grid.isLoading = ingest.isLoading
  })

  let workspaceContainer: HTMLElement | null = $state(null)

  // ---------------------------------------------------
  // Initialization Logic
  // ---------------------------------------------------

  $effect(() => {
    if (workspaceContainer) {
      workspaceContainer.scrollLeft = 0
    }
  })

  const visualizations = Object.entries(visualizationRegistry).map(
    ([id, config]) => ({
      id,
      label: config.name,
    })
  )

  // ---------------------------------------------------
  // Command Orchestration
  // ---------------------------------------------------

  // ---------------------------------------------------
  // Command Orchestration
  // ---------------------------------------------------

  const handleCommand = createCommandHandler(
    grid, // Synchronous class instance
    engine,
    message => toastState.addSuccess(message),
    error => {
      console.error('Command error:', error)
      toastState.addError('Error applying changes. See console for details.')
    },
    command => onWorkspaceCommandChain(command)
  )

  const handleWorkspaceCommand = (
    command: WorkspaceCommand | WorkspaceCommandChain
  ) => {
    if ('chainId' in command) {
      handleCommand(command)
      return
    }
    handleCommand(createRootCommand(command))
  }

  const styleProps = `--min-workspace-height: ${MIN_WORKSPACE_HEIGHT}px; --grid-container-min-height: ${MIN_WORKSPACE_HEIGHT - 100}px;`
</script>

<div class="workspace-wrapper" style={styleProps}>
  <WorkspaceToolbar
    onWorkspaceCommand={handleWorkspaceCommand}
    {initialLayoutState}
    {visualizations}
  />

  <div
    class="workspace-container"
    style="height: {grid.height}px;"
    bind:this={workspaceContainer}
    role="none"
  >
    {#if grid.isEmpty && !(ingest.isLoading || grid.isLoading)}
      <WorkspaceIndicatorEmpty
        {onReinitialize}
        onWorkspaceCommand={handleWorkspaceCommand}
        {initialLayoutState}
      />
    {:else if ingest.isLoading || grid.isLoading}
      <WorkspaceIndicatorLoading />
    {:else}
      <Grid
        gridItems={grid.items}
        {gridConfig}
        gridHeight={grid.height}
        gridWidth={grid.width}
        gridIsEmpty={grid.isEmpty}
        {workspaceContainer}
        onWorkspaceCommand={handleWorkspaceCommand}
      />
    {/if}
  </div>
</div>

<style>
  .workspace-wrapper {
    position: relative;
    display: flex;
    min-height: var(--min-workspace-height);
    border: 1px solid var(--c-border);
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

  :global(.grid-item) {
    cursor: default;
  }

  :global(.resize-handle) {
    cursor: se-resize !important;
    z-index: 100 !important;
  }

  :global(.header > .tooltip-wrapper:first-child .workspace-item-button) {
    cursor: grab !important;
  }

  :global(
    .header > .tooltip-wrapper:first-child .workspace-item-button:active
  ) {
    cursor: grabbing !important;
  }
</style>
