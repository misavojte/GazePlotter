<script lang="ts">
  import { fade } from 'svelte/transition'
  import GridItem from './GridItem.svelte'
  import GeneralButtonMajor from '$lib/shared/components/GeneralButtonMajor.svelte'
  import {
    getPlotDisplayName,
    resolvePlotComponent,
  } from '$lib/plots/registry'
  import { getGazePlotterSession } from '$lib/session'
  import type { AllGridTypes } from '$lib/workspace/type/gridType'
  import type { GridConfig } from './types'
  import {
    commitGridItemDuplication,
    commitGridItemMove,
    commitGridItemRemoval,
    commitGridItemResize,
  } from './itemCommands'
  import {
    GridInteractionOverlay,
    panSurfaceAction,
    type GridInteractionController,
  } from './interaction'

  const { errorService, workspace } = getGazePlotterSession()

  interface Props {
    gridItems: AllGridTypes[]
    gridConfig: GridConfig
    gridHeight: number
    gridWidth: number
    gridIsEmpty: boolean
    interaction: GridInteractionController
    workspaceContainer: HTMLElement | null
  }

  const {
    gridItems,
    gridConfig,
    gridHeight,
    gridWidth,
    gridIsEmpty,
    interaction,
    workspaceContainer,
  }: Props = $props()

  function getPlotErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error
    }

    return 'Unknown rendering error'
  }

  function reportPlotRenderError(
    item: AllGridTypes,
    plotName: string,
    error: unknown
  ): void {
    errorService.report({
      origin: 'plot',
      severity: 'recoverable',
      userMessage: `Plot "${plotName}" failed to render. The workspace is still active.`,
      cause: error,
      context: {
        itemId: item.id,
        plotName,
        plotType: item.type,
      },
    })
  }
</script>

<div
  class="grid-container"
  class:pointer-events-none={interaction.isInteracting}
  class:is-panning={interaction.isPanning}
  style="width: {gridWidth}px; height: {gridHeight}px;"
  role="application"
>
  <div
    class="grid-pan-surface"
    use:panSurfaceAction={{
      enabled: !gridIsEmpty && workspaceContainer !== null,
      interaction,
      workspaceContainer,
    }}
    aria-hidden="true"
  ></div>

  {#if !gridIsEmpty}
    {#each gridItems as item (item.id)}
      {@const plotLabel = getPlotDisplayName(item.type)}
      <div transition:fade={{ duration: 300 }}>
        <GridItem
          id={item.id}
          x={item.x}
          y={item.y}
          w={item.w}
          h={item.h}
          minW={item.min?.w || gridConfig.minWidth}
          minH={item.min?.h || gridConfig.minHeight}
          cellSize={gridConfig.cellSize}
          gap={gridConfig.gap}
          resizable={true}
          draggable={true}
          {interaction}
          title={plotLabel}
          onmove={event => commitGridItemMove(workspace, gridItems, event)}
          onresize={event =>
            commitGridItemResize(workspace, gridItems, gridConfig, event)}
          onremove={event => commitGridItemRemoval(workspace, gridItems, event)}
          onduplicate={event =>
            commitGridItemDuplication(workspace, gridItems, event)}
        >
          {#snippet body()}
            <div class="grid-item-content">
              <svelte:boundary
                onerror={error => reportPlotRenderError(item, plotLabel, error)}
              >
                {@const PlotComponent = resolvePlotComponent(item.type)}
                <PlotComponent {item} />

                {#snippet failed(error, reset)}
                  <div class="plot-error-state">
                    <p class="plot-error-copy">
                      {plotLabel} could not be displayed. The rest of the
                      workspace is still available.
                    </p>
                    <p class="plot-error-detail">
                      {getPlotErrorMessage(error)}
                    </p>
                    <GeneralButtonMajor
                      size="sm"
                      variant="secondary"
                      onclick={() => reset()}
                    >
                      Retry plot
                    </GeneralButtonMajor>
                  </div>
                {/snippet}
              </svelte:boundary>
            </div>
          {/snippet}
        </GridItem>
      </div>
    {/each}
  {/if}

  <GridInteractionOverlay
    preview={interaction.previewRect}
    {gridConfig}
    mode={interaction.mode}
  />
</div>

<style>
  .grid-container.is-panning {
    cursor: grabbing;
  }

  .grid-container {
    position: relative;
  }

  .grid-pan-surface {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  .plot-error-state {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0;
  }

  .plot-error-copy,
  .plot-error-detail {
    margin: 0;
    color: var(--c-text);
    line-height: 1.45;
    font-size: 0.9rem;
  }

  .plot-error-detail {
    color: var(--c-midgrey);
    overflow-wrap: anywhere;
  }
</style>
