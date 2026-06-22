<script lang="ts">
  import GridItem from './GridItem.svelte'
  import ButtonMajor from '$lib/shared/components/ButtonMajor.svelte'
  import {
    getPlotDisplayName,
    getPlotSubtitle,
    resolvePlotComponent,
  } from '$lib/plots/registry'
  import { getGazePlotterSession } from '$lib/session'
  import { generateUniqueId } from '$lib/shared/utils/idUtils'
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

  const { engine, errorService, workspace, grid } = getGazePlotterSession()

  // Mac's main "delete" key emits Backspace, so we handle both.
  $effect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      // Operate on the whole selection (single = a set of one). Reading the
      // set directly — not the single-only `selectedItemId` getter — keeps
      // Delete/Escape working for a multi-selection.
      const selectedIds = grid.selectedItemIds
      if (selectedIds.length === 0) return
      const target = event.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        )
          return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        // Snapshot first — removeItem mutates the selection set as it goes.
        for (const id of [...selectedIds]) {
          commitGridItemRemoval(workspace, gridItems, { id })
        }
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        // clearSelection (not the pane) owns deselect, so Escape works for a
        // multi-selection regardless of whether the bulk pane is mounted.
        grid.clearSelection()
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
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
      grid.setSelectedItem(newId)
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

  // Bounding box around all selected items (shown only for a multi-selection).
  // Mirrors GridItem's pixel math; a small margin sits it just outside the
  // members' outlines. Returns null when fewer than two are selected.
  function groupBoxStyle(
    items: Array<{ x: number; y: number; w: number; h: number }>,
    config: GridConfig
  ): string | null {
    if (items.length < 2) return null
    const cellW = config.cellSize.width
    const cellH = config.cellSize.height
    const gap = config.gap
    const minX = Math.min(...items.map(i => i.x))
    const minY = Math.min(...items.map(i => i.y))
    const maxX = Math.max(...items.map(i => i.x + i.w))
    const maxY = Math.max(...items.map(i => i.y + i.h))
    const wCells = maxX - minX
    const hCells = maxY - minY
    const left = minX * (cellW + gap)
    const top = minY * (cellH + gap)
    const width = wCells * cellW + (wCells - 1) * gap
    const height = hCells * cellH + (hCells - 1) * gap
    const margin = 6
    return `transform: translate(${left - margin}px, ${top - margin}px); width: ${width + 2 * margin}px; height: ${height + 2 * margin}px;`
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
          resizable={true}
          draggable={true}
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
                {@const PlotComponent = resolvePlotComponent(item.type)}
                <PlotComponent {item} />

                {#snippet failed(error, reset)}
                  <div class="plot-error-state">
                    <p class="plot-error-copy">
                      {plotLabel} could not be displayed. The rest of the workspace
                      is still available.
                    </p>
                    <p class="plot-error-detail">
                      {getPlotErrorMessage(error)}
                    </p>
                    <ButtonMajor
                      size="sm"
                      variant="secondary"
                      onclick={() => reset()}
                    >
                      Retry plot
                    </ButtonMajor>
                  </div>
                {/snippet}
              </svelte:boundary>
            </div>
          {/snippet}
        </GridItem>
    {/each}
  {/if}

  {#if grid.selectedItemIds.length > 1 && !interaction.isInteracting}
    {@const boxStyle = groupBoxStyle(grid.selectedItems, gridConfig)}
    {#if boxStyle}
      <div class="group-selection-box" style={boxStyle} aria-hidden="true"></div>
    {/if}
  {/if}

  <GridInteractionOverlay
    previews={interaction.previewRects}
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

  /* Solid bounding box around a multi-selection. Sits above unselected
     items (z-index 1) and below the interaction overlay (z-index 50);
     purely decorative, so it never intercepts pointer events (dragging
     any member frame moves the group). */
  .group-selection-box {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 6;
    pointer-events: none;
    border: 2px solid var(--c-info);
    border-radius: var(--rounded-lg);
    box-sizing: border-box;
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
