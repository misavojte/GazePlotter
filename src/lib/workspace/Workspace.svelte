<script lang="ts">
  import { onDestroy } from 'svelte'
  import { IndicatorEmpty, IndicatorLoading } from './'
  import Grid from './grid/Grid.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import Rail from './rail/Rail.svelte'
  import Ribbon from './ribbon/Ribbon.svelte'
  import { Pane } from './pane'

  import {
    MIN_WORKSPACE_HEIGHT,
    DEFAULT_GRID_CONFIG,
    calculateGridHeight,
    calculateGridWidth,
  } from './grid'
  import { GridInteractionController } from './grid/interaction'
  import { plotRegistry } from '$lib/plots/registry'
  import { clampZoom, ZOOM_WHEEL_SENSITIVITY, ZOOM_STEP } from './zoom'
  import type { WorkspaceCommandChain } from './commands'
  import type { GridItemSnapshot } from './'

  interface Props {
    onWorkspaceCommandChain: (command: WorkspaceCommandChain) => void
    initialLayoutState?: GridItemSnapshot[] | null
  }

  const { onWorkspaceCommandChain, initialLayoutState = null }: Props = $props()
  const { ingest, grid, workspace } = getGazePlotterSession()

  function handleWorkspaceBackgroundClick(event: MouseEvent): void {
    // Clicking anywhere in the workspace that isn't a grid item deselects
    // the currently selected plot (and closes the Pane). Clicks inside a
    // grid item keep bubbling — the item's own frame handler runs first
    // and sets selection; this outer handler then runs with a target
    // still inside `.grid-item`, so we no-op.
    const target = event.target as HTMLElement | null
    if (!target) return
    if (target.closest('.grid-item')) return
    grid.setSelectedItem(null)
  }

  const gridConfig = DEFAULT_GRID_CONFIG

  // ---------------------------------------------------
  // State tracking (Svelte 5 Runes)
  // ---------------------------------------------------

  // Sync external file processing state with the grid class
  $effect(() => {
    grid.isLoading = ingest.isLoading
  })

  let workspaceContainer: HTMLElement | null = $state(null)
  let zoom = $state(1)
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
    interaction.setZoom(zoom)
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

  // ---------------------------------------------------
  // Keyboard Shortcuts (Global)
  // ---------------------------------------------------

  function handleGlobalKeydown(event: KeyboardEvent): void {
    const isCtrlOrMeta = event.ctrlKey || event.metaKey
    if (!isCtrlOrMeta) return

    // Undo: Ctrl+Z
    if (event.code === 'KeyZ' && !event.shiftKey) {
      event.preventDefault()
      workspace.undo()
    }
    // Redo: Ctrl+Y or Ctrl+Shift+Z
    else if (
      (event.code === 'KeyY' && !event.shiftKey) ||
      (event.code === 'KeyZ' && event.shiftKey)
    ) {
      event.preventDefault()
      workspace.redo()
    }
    // Zoom In: Ctrl + Plus / Equal
    else if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoom = clampZoom(zoom + ZOOM_STEP)
    }
    // Zoom Out: Ctrl + Minus
    else if (event.key === '-') {
      event.preventDefault()
      zoom = clampZoom(zoom - ZOOM_STEP)
    }
    // Reset Zoom: Ctrl + 0
    else if (event.key === '0') {
      event.preventDefault()
      zoom = 1
    }
  }

  $effect(() => {
    document.addEventListener('keydown', handleGlobalKeydown)
    return () => {
      document.removeEventListener('keydown', handleGlobalKeydown)
    }
  })

  // ---------------------------------------------------
  // Ctrl+Wheel / Trackpad-pinch zoom
  // ---------------------------------------------------

  /**
   * Zoom toward / away from the pointer while keeping the point
   * under the cursor visually stationary (scroll-compensation).
   *
   * Browsers fire `ctrlKey = true` for both Ctrl+wheel and
   * trackpad pinch gestures, so this single handler covers
   * Windows, Mac, and touchpads.
   */
  function handleWheelZoom(event: WheelEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return
    event.preventDefault()

    const container = workspaceContainer
    if (!container) return

    const oldZoom = zoom
    const newZoom = clampZoom(oldZoom - event.deltaY * ZOOM_WHEEL_SENSITIVITY)
    if (newZoom === oldZoom) return

    // Pointer position relative to the container's padding box.
    const rect = container.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top

    // The grid-space coordinate under the cursor before zoom.
    const gridX = (container.scrollLeft + pointerX) / oldZoom
    const gridY = (container.scrollTop + pointerY) / oldZoom

    zoom = newZoom

    // After Svelte flushes the DOM with the new zoom, adjust
    // scroll so the same grid-space point stays under the cursor.
    requestAnimationFrame(() => {
      container.scrollLeft = gridX * newZoom - pointerX
      container.scrollTop = gridY * newZoom - pointerY
    })
  }

  let workspaceWrapper: HTMLElement | null = $state(null)

  $effect(() => {
    const wrapper = workspaceWrapper
    if (!wrapper) return

    // Must be { passive: false } to allow preventDefault on wheel.
    wrapper.addEventListener('wheel', handleWheelZoom, { passive: false })

    return () => {
      wrapper.removeEventListener('wheel', handleWheelZoom)
    }
  })

  // ---------------------------------------------------
  // Drag-and-drop file overlay
  // ---------------------------------------------------

  let dragCounter = $state(0)
  const isDraggingOver = $derived(dragCounter > 0)

  function handleDragEnter(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return
    event.preventDefault()
    dragCounter++
  }

  function handleDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleDragLeave(event: DragEvent): void {
    dragCounter--
  }

  async function handleDrop(event: DragEvent): Promise<void> {
    dragCounter = 0
    if (!event.dataTransfer?.files.length) return
    event.preventDefault()
    await ingest.loadFiles(event.dataTransfer.files)
  }

  const styleProps = `--min-workspace-height: ${MIN_WORKSPACE_HEIGHT}px; --grid-container-min-height: ${MIN_WORKSPACE_HEIGHT - 100}px;`
</script>

<div class="workspace-wrapper" style={styleProps} bind:this={workspaceWrapper}>
  <Ribbon />

  <div class="workspace-body">
    <Rail {initialLayoutState} {visualizations} bind:zoom />

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="workspace-container"
      bind:this={workspaceContainer}
      role="none"
      ondragenter={handleDragEnter}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      onclick={handleWorkspaceBackgroundClick}
    >
      {#if isDraggingOver}
        <div class="drop-indicator">
          <p class="drop-title">Drop files to load</p>
          <p class="drop-hint">Supported formats are detected and parsed automatically</p>
        </div>
      {:else if grid.isEmpty && !(ingest.isLoading || grid.isLoading)}
        <IndicatorEmpty {initialLayoutState} />
      {:else if ingest.isLoading || grid.isLoading}
        <IndicatorLoading />
      {:else}
        <div
          class="zoom-viewport"
          style="width: {gridWidth * zoom}px; height: {gridHeight * zoom}px;"
        >
          <div
            class="zoom-surface"
            style="transform: scale({zoom}); width: {gridWidth}px; height: {gridHeight}px;"
          >
            <Grid
              gridItems={grid.items}
              {gridConfig}
              {interaction}
              {gridHeight}
              {gridWidth}
              gridIsEmpty={grid.isEmpty}
              {workspaceContainer}
            />
          </div>
        </div>
      {/if}
    </div>

    <Pane />
  </div>
</div>

<style>
  .workspace-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: var(--min-workspace-height);
    background-color: #f1f5f9;
    border-top: 1px solid var(--c-border);
    border-bottom: 1px solid var(--c-border);
  }

  .workspace-body {
    position: relative;
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
    overflow-x: auto;
    overflow-y: auto;
    min-height: var(--min-workspace-height);
    padding: 35px;
    cursor: grab;
    background-color: var(--c-darkwhite);
    border-radius: 0 0 0 0; /* 20px 0 0 0 is an alternative*/
    border-left: 1px solid #cbd5e1;
    border-top: 1px solid #cbd5e1;
  }

  .zoom-viewport {
    position: relative;
  }

  .zoom-surface {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;
  }

  /* ---- drag-and-drop indicator ---- */

  .drop-indicator {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    z-index: 10;
  }

  .drop-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--c-text);
  }

  .drop-hint {
    margin: 0;
    font-size: 12px;
    color: var(--c-darkgrey);
  }
</style>
