<script lang="ts">
  import {
    WorkspaceIndicatorEmpty,
    WorkspaceIndicatorLoading,
    WorkspaceToolbar,
    visualizationRegistry, // Constant
    getVisualizationConfig, // Constant
  } from '$lib/workspace'
  import { processingFileStateStore } from '$lib/workspace/stores'
  import { grid } from '$lib/workspace/grid'
  import Grid from '$lib/workspace/grid/Grid.svelte'
  import { generateUniqueId } from '$lib/shared/utils/idUtils'
  import { onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import {
    calculateBottomEdgePosition,
    WORKSPACE_BOTTOM_PADDING,
    MIN_WORKSPACE_HEIGHT,
    DEFAULT_GRID_CONFIG,
  } from '$lib/workspace/grid'
  import { throttleByRaf } from '$lib/shared/utils/throttle'
  import { addSuccessToast, addErrorToast } from '$lib/toaster'
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

  const gridConfig = DEFAULT_GRID_CONFIG

  // ---------------------------------------------------
  // State tracking (Svelte 5 Runes)
  // ---------------------------------------------------

  // Sync external file processing state with the grid class
  $effect(() => {
    grid.isLoading = $processingFileStateStore === 'processing'
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
    message => addSuccessToast(message),
    error => {
      console.error('Command error:', error)
      addErrorToast('Error applying changes. See console for details.')
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
    <Grid
      gridItems={grid.items}
      gridConfig={gridConfig}
      gridHeight={grid.height}
      gridWidth={grid.width}
      gridIsEmpty={grid.isEmpty}
      gridIsLoading={grid.isLoading}
      temporaryDragHeight={grid.temporaryDragHeight}
      temporaryDragWidth={grid.temporaryDragWidth}
      workspaceContainer={workspaceContainer}
      onWorkspaceCommand={handleWorkspaceCommand}
      processingFileStateStore={$processingFileStateStore}
    />

    {#if grid.isEmpty && !($processingFileStateStore === 'processing' || grid.isLoading)}
      <WorkspaceIndicatorEmpty
        {onReinitialize}
        onWorkspaceCommand={handleWorkspaceCommand}
        {initialLayoutState}
      />
    {/if}

    {#if $processingFileStateStore === 'processing' || grid.isLoading}
      <WorkspaceIndicatorLoading />
    {/if}
  </div>
</div>

<style>
  .workspace-wrapper {
    position: relative;
    display: flex;
    min-height: var(--min-workspace-height);
    border: 1px solid #8888889c;
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
    background-image: radial-gradient(
      circle,
      var(--c-grey) 2px,
      transparent 2px
    );
    background-size: 50px 50px;
    background-position: 5px 5px;
    background-attachment: local;
  }

  .workspace-container.is-panning {
    cursor: grabbing;
  }

  .grid-container {
    position: relative;
    width: 100%;
    min-height: var(--grid-container-min-height);
    background-color: transparent;
    transition: height 0.3s ease-out;
    overflow-x: visible;
    overflow-y: visible;
    will-change: contents;
    transform: translateZ(0);
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

  .pointer-events-blocker {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    background-color: transparent;
    pointer-events: all;
    cursor: grabbing;
  }
</style>
