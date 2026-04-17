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
    commitGridItemMove,
    commitGridItemRemoval,
    commitGridItemResize,
  } from './itemCommands'
  import {
    GridInteractionOverlay,
    panSurfaceAction,
    type GridInteractionController,
  } from './interaction'
  import { isPointerInWorkspace } from './interaction/coords'

  const { engine, errorService, workspace, grid } = getGazePlotterSession()

  // Mac's main "delete" key emits Backspace, so we handle both.
  $effect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const selectedId = grid.selectedItemId
      if (selectedId === null) return
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
        commitGridItemRemoval(workspace, gridItems, { id: selectedId })
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        grid.setSelectedItem(null)
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

  /**
   * Duplicate click no longer commits immediately. It opens a placement
   * session so the user picks the target cell themselves — the ghost
   * tracks the cursor via the document-level listeners installed by the
   * `$effect` below, and the next click commits at the preview
   * position. Collision resolution pushes overlapping items aside the
   * same way it does on a move commit.
   */
  function handleDuplicate(event: {
    id: number
    clientX: number
    clientY: number
  }): void {
    const source = gridItems.find(i => i.id === event.id)
    if (!source) return
    interaction.beginPlacement(
      { kind: 'duplicate', sourceItemId: source.id },
      { w: source.w, h: source.h },
      { x: event.clientX, y: event.clientY }
    )
  }

  // Placement mode: while the session is 'placing', intercept pointer
  // and keyboard events at the document level so the cursor-follow
  // ghost works no matter where the mouse is, and so commit/cancel
  // clicks don't bubble to whatever element happens to be under the
  // pointer (other grid items, toolbar buttons, workspace background).
  $effect(() => {
    if (interaction.mode !== 'placing') return

    document.body.style.cursor = 'copy'

    // Note we do NOT gate pointermove on `isPointerInWorkspace`: the
    // controller's `updatePlacement` also triggers viewport auto-scroll
    // and workspace-growth hints, and those need to see pointer events
    // all the way to the viewport edge (that's what drives the grid
    // extending during a drag — same as a move gesture).
    function onPointerMove(e: PointerEvent): void {
      interaction.updatePlacement({ x: e.clientX, y: e.clientY })
    }

    function onClick(e: MouseEvent): void {
      // Swallow this click so it doesn't also toggle selection on a
      // grid item, activate a ribbon button, etc. In placement mode
      // the click's only meaning is "commit here" (or "cancel" if out
      // of bounds).
      e.preventDefault()
      e.stopPropagation()
      if (
        !workspaceContainer ||
        !isPointerInWorkspace(e.clientX, e.clientY, workspaceContainer)
      ) {
        interaction.cancel()
        return
      }
      const commit = interaction.finishPlacement()
      if (!commit) return
      // Reserve the new item's id up front so it becomes the selected
      // item as soon as the command lands — matches Figma behavior:
      // the thing you just placed is the thing you're about to tweak,
      // so the Pane opens on it without a second click. Both placement
      // flavors (duplicate / add) share this selection behavior; the
      // difference is only which workspace command we dispatch.
      const newId = generateUniqueId()
      let ok = false
      if (commit.payload.kind === 'duplicate') {
        ok = commitGridItemDuplication(
          workspace,
          gridItems,
          { id: commit.payload.sourceItemId },
          { x: commit.x, y: commit.y },
          newId
        )
      } else {
        ok = workspace.addVisualization(
          commit.payload.vizType,
          'rail',
          newId,
          { x: commit.x, y: commit.y }
        )
      }
      if (ok) grid.setSelectedItem(newId)
    }

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        interaction.cancel()
      }
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('click', onClick, { capture: true })
    document.addEventListener('keydown', onKeyDown, { capture: true })

    return () => {
      document.body.style.cursor = ''
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('click', onClick, {
        capture: true,
      } as EventListenerOptions)
      document.removeEventListener('keydown', onKeyDown, {
        capture: true,
      } as EventListenerOptions)
    }
  })

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
          onmove={event => commitGridItemMove(workspace, gridItems, event)}
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
