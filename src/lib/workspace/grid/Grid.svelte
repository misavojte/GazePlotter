<script lang="ts">
  import GridItem from './GridItem.svelte'
  import Button from '$lib/shared/components/Button.svelte'
  import {
    getPlotDisplayName,
    getPlotSubtitle,
  } from '$lib/plots/registry'
  import PlotContainer from '$lib/plots/shared/components/PlotContainer.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { generateUniqueId } from '$lib/shared/uniqueId'
  import type { AllGridTypes } from '$lib/workspace'
  import type { GridConfig } from './types'
  import {
    commitGridItemDuplication,
    commitGridItemGroupMove,
    commitGridItemRemoval,
    commitGridItemResize,
  } from './itemCommands'
  import {
    GridInteractionOverlay,
    type GridInteractionController,
  } from './interaction'
  import { responsive } from '../responsive.svelte'
  import { generateSelectionPath } from './selectionPath'
  import { useContextMenu } from '$lib/context-menu'

  const contextMenuState = useContextMenu()
  import { isTextEntryTarget } from '../keys'

  const { engine, errorService, workspace, grid, modalState } =
    getGazePlotterSession()

  // Mac's main "delete" key emits Backspace, so we handle both.
  // Capture on `document`, like selectionSession's Esc unwinding: the modal and
  // the context menu bubble on `window` and clear the state this guard reads,
  // so phase must decide who reads first, never registration order.
  $effect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTextEntryTarget(event)) return
      // A surface in front owns the key: one Escape dismisses one surface, and
      // Delete never removes a plot the user cannot see.
      if (modalState.activeModal || contextMenuState.current) return
      // Operate on the whole selection (single = a set of one). Reading the
      // set directly — not the single-only `selectedItemId` getter — keeps
      // Delete/Escape working for a multi-selection.
      const selectedIds = grid.selectedItemIds
      if (selectedIds.length === 0) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        // Snapshot first — removeItem mutates the selection set as it goes.
        for (const id of [...selectedIds]) {
          commitGridItemRemoval(workspace, gridItems, { id })
        }
        return
      }
      if (event.key === 'Escape') {
        // The Pane owns Escape while it is up, for both cardinalities: on
        // mobile it closes the sheet and KEEPS the selection so the Edit FAB
        // returns, and its bulk close clears the selection itself.
        if (grid.paneOpenId !== null || grid.selectedCount > 1) return
        event.preventDefault()
        grid.clearSelection()
      }
    }
    document.addEventListener('keydown', onKeydown, { capture: true })
    return () =>
      document.removeEventListener('keydown', onKeydown, { capture: true })
  })

  interface Props {
    gridItems: AllGridTypes[]
    gridConfig: GridConfig
    gridHeight: number
    gridWidth: number
    gridIsEmpty: boolean
    interaction: GridInteractionController
  }

  const {
    gridItems,
    gridConfig,
    gridHeight,
    gridWidth,
    gridIsEmpty,
    interaction,
  }: Props = $props()

  const selectionPath = $derived(
    generateSelectionPath(grid.selectedItems, gridConfig, 6, 26)
  )

  // Duplicate commits immediately. The store's findOptimalPosition
  // places the copy adjacent-right of the source (falling back to
  // below, then any free cell), so the user sees the new item land
  // near the one they acted on.
  function handleDuplicate(event: { id: number }): void {
    const newId = generateUniqueId()
    if (
      commitGridItemDuplication(workspace, gridItems, {
        id: event.id,
        duplicateId: newId,
      })
    ) {
      grid.selectOnly(newId)
      if (!responsive.isMobile) {
        grid.openPane(newId)
      }
    }
  }

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
  class:is-interacting={interaction.isInteracting}
  class:is-panning={interaction.isPanning}
  style="width: {gridWidth}px; height: {gridHeight}px;"
  role="application"
>
  {#if !gridIsEmpty}
    {#each gridItems as item (item.id)}
      {@const plotLabel = getPlotDisplayName(item.type)}
      {@const plotSubtitle = getPlotSubtitle(item, engine)}
      <!-- No wrapper transition here: GridItem's root `.grid-item`
           already fades (150ms). An outer `transition:fade` would wrap
           the component in an opacity<1 stacking context with z-index
           auto, which paints below neighbors' `.grid-item { z-index: 1 }`
           — causing a freshly-duplicated item's action chip to sit
           behind the item above it until the fade completes and the
           stacking context dissolves. -->
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
          {interaction}
          title={plotLabel}
          subtitle={plotSubtitle}
          onmove={event => commitGridItemGroupMove(workspace, gridItems, event)}
          onresize={event =>
            commitGridItemResize(workspace, gridItems, gridConfig, event)}
          onremove={event => commitGridItemRemoval(workspace, gridItems, event)}
          onduplicate={handleDuplicate}
        >
          {#snippet body()}
            <div class="grid-item-content">
              <svelte:boundary
                onerror={error => reportPlotRenderError(item, plotLabel, error)}
              >
                <PlotContainer {item} />

                {#snippet failed(error, reset)}
                  <div class="plot-error-state">
                    <p class="plot-error-copy">
                      {plotLabel} could not be displayed. The rest of the workspace
                      is still available.
                    </p>
                    <p class="plot-error-detail">
                      {getPlotErrorMessage(error)}
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onclick={() => reset()}
                    >
                      Retry plot
                    </Button>
                  </div>
                {/snippet}
              </svelte:boundary>
            </div>
          {/snippet}
        </GridItem>
    {/each}
  {/if}

  {#if grid.selectedItemIds.length > 1 && !interaction.isInteracting && selectionPath}
    <svg class="group-selection-svg" aria-hidden="true">
      <path d={selectionPath} class="group-selection-path" />
    </svg>
  {/if}

  <GridInteractionOverlay
    previews={interaction.previewRects}
    {gridConfig}
    mode={interaction.mode}
  />
</div>


<style>
  .grid-container.is-interacting {
    pointer-events: none;
  }

  .grid-container.is-panning {
    cursor: grabbing;
  }

  .grid-container {
    position: relative;
  }

  /* Contour outline and fill around a multi-selection. Sits above unselected
     items (z-index 1) and below the interaction overlay (z-index 50);
     purely decorative, so it never intercepts pointer events (dragging
     any member frame moves the group). */
  .group-selection-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 6;
    pointer-events: none;
    overflow: visible;
  }

  .group-selection-path {
    fill: color-mix(in srgb, var(--c-info) 5%, transparent);
    stroke: var(--c-info);
    stroke-width: 2px;
    stroke-linejoin: round;
    stroke-linecap: round;
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
