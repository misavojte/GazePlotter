<script lang="ts">
  import { untrack } from 'svelte'
  import GridItem from './GridItem.svelte'
  import Button from '$lib/shared/components/Button.svelte'
  import {
    getPlotDisplayName,
    getPlotSubtitle,
  } from '$lib/plots/registry'
  import PlotContainer from '$lib/plots/shared/components/PlotContainer.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { getDebugMessage } from '$lib/errors'
  import { generateUniqueId } from '$lib/shared/uniqueId'
  import type { AllGridTypes } from '$lib/workspace'
  import type { GridConfig } from './types'
  import {
    commitGridItemDuplication,
    commitGridItemGroupMove,
    commitGridItemRemoval,
    commitGridItemsDuplication,
    commitGridItemsRemoval,
    commitGridItemResize,
  } from './itemCommands'
  import ActionChip from './ActionChip.svelte'
  import {
    GridInteractionOverlay,
    type GridInteractionController,
  } from './interaction'
  import { responsive } from '../responsive.svelte'
  import { generateSelectionPath, selectionPathCorner } from './selectionPath'
  import { useContextMenu } from '$lib/context-menu'

  const contextMenuState = useContextMenu()
  import { isTextEntryTarget } from '../keys'

  const { engine, errorService, workspace, grid, modalState } =
    getGazePlotterSession()

  let gridEl = $state<HTMLDivElement>()

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
        // Only from the page or the grid: a focused pane or rail control owns the key.
        const target = event.target as Node | null
        if (target !== document.body && !gridEl?.contains(target)) return
        event.preventDefault()
        // Snapshot first: removeItem mutates the selection set as it goes.
        commitGridItemsRemoval(workspace, gridItems, [...selectedIds])
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
    /** The plots land one after another (after a load), not all at once. */
    entrance?: boolean
    gridConfig: GridConfig
    gridHeight: number
    gridWidth: number
    gridIsEmpty: boolean
    interaction: GridInteractionController
  }

  const {
    gridItems,
    entrance = false,
    gridConfig,
    gridHeight,
    gridWidth,
    gridIsEmpty,
    interaction,
  }: Props = $props()

  // Entrance delays in reading order, fixed at mount: the camera pulls back
  // first, then the plots land within ENTRANCE_SPREAD_MS whatever their count.
  // Plots added later are not in the map and keep their own fade.
  const ENTRANCE_START_MS = 350
  const ENTRANCE_STEP_MS = 40
  const ENTRANCE_SPREAD_MS = 400
  const entranceDelays = untrack(() => {
    const delays = new Map<number, number>()
    if (!entrance) return delays
    const order = [...gridItems].sort((a, b) => a.y - b.y || a.x - b.x)
    const step =
      order.length > 1
        ? Math.min(ENTRANCE_STEP_MS, ENTRANCE_SPREAD_MS / (order.length - 1))
        : 0
    order.forEach((item, rank) =>
      delays.set(item.id, ENTRANCE_START_MS + rank * step)
    )
    return delays
  })

  // The contour drawn around a multi-selection: how far outside the plots it
  // runs, and how round its corners are. The chip hangs off the same numbers.
  const SELECTION_CONTOUR_MARGIN = 6
  const SELECTION_CONTOUR_RADIUS = 26

  const selectionPath = $derived(
    generateSelectionPath(
      grid.selectedItems,
      gridConfig,
      SELECTION_CONTOUR_MARGIN,
      SELECTION_CONTOUR_RADIUS
    )
  )

  // Where the group's chip hangs: the contour's top-left corner, so the chip
  // floats above the outline with their left edges on one line.
  const groupChipAnchor = $derived(
    selectionPathCorner(
      grid.selectedItems,
      gridConfig,
      SELECTION_CONTOUR_MARGIN
    )
  )

  // The group's verbs show when the group's outline does, and never while a
  // selection rectangle is still gathering plots (see GridItem's isSettled).
  const showsGroupActions = $derived(
    grid.selectedCount > 1 &&
      !interaction.isTransforming &&
      interaction.mode !== 'selecting'
  )

  // The whole selection duplicates in one step, and the copies become the
  // selection, exactly as a single duplication hands over to its copy.
  function handleGroupDuplicate(): void {
    const commits = grid.selectedItems.map(item => ({
      id: item.id,
      duplicateId: generateUniqueId(),
    }))
    if (commitGridItemsDuplication(workspace, gridItems, commits)) {
      grid.setSelection(commits.map(commit => commit.duplicateId))
    }
  }

  function handleGroupRemove(): void {
    commitGridItemsRemoval(workspace, gridItems, [...grid.selectedItemIds])
  }

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
  bind:this={gridEl}
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
          enterDelay={entranceDelays.get(item.id)}
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
                      {getDebugMessage(error, 'Unknown rendering error')}
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

  {#if grid.selectedItemIds.length > 1 && !interaction.isTransforming && selectionPath}
    <svg class="group-selection-svg" aria-hidden="true">
      <path d={selectionPath} class="group-selection-path" />
    </svg>
  {/if}

  {#if showsGroupActions && groupChipAnchor}
    <div
      class="group-chip-anchor"
      style:left="{groupChipAnchor.x}px"
      style:top="{groupChipAnchor.y}px"
    >
      <ActionChip
        scope="{grid.selectedCount} plots"
        onDuplicate={handleGroupDuplicate}
        onRemove={handleGroupRemove}
      />
    </div>
  {/if}

  <GridInteractionOverlay
    previews={interaction.previewRects}
    {gridConfig}
    mode={interaction.mode}
  />

  {#if interaction.marqueeBounds}
    {@const bounds = interaction.marqueeBounds}
    <div
      class="marquee"
      style:transform="translate({bounds.left}px, {bounds.top}px)"
      style:width="{bounds.right - bounds.left}px"
      style:height="{bounds.bottom - bounds.top}px"
      aria-hidden="true"
    ></div>
  {/if}
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

  /* Where the group's action chip hangs, on the contour's top edge. */
  .group-chip-anchor {
    position: absolute;
    z-index: 7;
  }

  /* The selection rectangle being dragged across the desk. Grid-space, like
     every other overlay here: it is anchored to the plots it is drawn
     around, not to the screen. */
  .marquee {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 50;
    pointer-events: none;
    box-sizing: border-box;
    border: 1px solid var(--c-info);
    background: color-mix(in srgb, var(--c-info) 8%, transparent);
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
    gap: 8px;
    padding: 0;
  }

  .plot-error-copy,
  .plot-error-detail {
    margin: 0;
    color: var(--c-black);
    line-height: var(--leading-normal);
    font-size: var(--text-lg);
  }

  .plot-error-detail {
    color: var(--c-darkgrey);
    overflow-wrap: anywhere;
  }
</style>
