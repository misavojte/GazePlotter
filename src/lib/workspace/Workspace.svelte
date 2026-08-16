<script lang="ts">
  import { onDestroy } from 'svelte'
  import { IndicatorEmpty, IndicatorLoading } from './'
  import Grid from './grid/Grid.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import Rail from './rail/Rail.svelte'
  import Ribbon from './ribbon/Ribbon.svelte'
  import { Pane } from './pane'
  import SelectionIndicator from './SelectionIndicator.svelte'
  import { responsive } from './responsive.svelte'

  import {
    MIN_WORKSPACE_HEIGHT,
    DEFAULT_GRID_CONFIG,
    calculateGridHeight,
    calculateGridWidth,
  } from './grid'
  import {
    GridInteractionController,
    panSurfaceAction,
  } from './grid/interaction'
  import { plotRegistry } from '$lib/plots/registry'
  import { generateUniqueId } from '$lib/shared/utils/idUtils'
  import { WorkspaceZoom, wheelZoomAction } from './zoom.svelte'
  import { FileDropTarget } from './fileDrop.svelte'
  import { isTextEntryTarget, resolveWorkspaceShortcut } from './keys'
  import type { WorkspaceCommandChain } from './commands'
  import type { GridItemSnapshot, PlotType } from './'

  interface Props {
    onWorkspaceCommandChain: (command: WorkspaceCommandChain) => void
    initialLayoutState?: GridItemSnapshot[] | null
  }

  const { onWorkspaceCommandChain, initialLayoutState = null }: Props = $props()
  const { ingest, grid, workspace, modalState } = getGazePlotterSession()

  // Single upload owner for the workspace: the drag-drop handler below and the
  // click entry points (ribbon item, empty-state button) all feed ingest here.
  let fileUploadInput = $state<HTMLInputElement>()

  const handleFileUpload = async (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!(files instanceof FileList) || files.length === 0) return
    await ingest.loadFiles(files)
    if (fileUploadInput) fileUploadInput.value = ''
  }

  const triggerUpload = () => fileUploadInput?.click()

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

  // Drag-to-pan starts from anywhere in the scroll container's empty
  // space — including the 35px padding band and any blank area past the
  // grid content, not just the content box. Bail when the gesture begins
  // on a grid item (it owns its own move/select gesture) or on an
  // interactive overlay control (e.g. the off-screen SelectionIndicator
  // arrow), so those keep their own pointer semantics.
  function shouldStartPan(event: PointerEvent): boolean {
    const target = event.target as HTMLElement | null
    if (!target) return false
    return !target.closest(
      '.grid-item, button, a, input, select, textarea, [role="button"]'
    )
  }

  const gridConfig = DEFAULT_GRID_CONFIG

  // ---------------------------------------------------
  // State tracking (Svelte 5 Runes)
  // ---------------------------------------------------

  // "No grid on screen": ingest owns this state, and it is read straight from
  // there. A mirror on GridState would lag it by a flush for no other reader.
  const isLoading = $derived(ingest.isLoading)

  let workspaceContainer: HTMLElement | null = $state(null)
  let mobileRailElement: HTMLElement | null = $state(null)
  const zoom = new WorkspaceZoom()
  const fileDrop = new FileDropTarget()
  const interaction = new GridInteractionController()
  const positionsWithPreview = $derived.by(() =>
    interaction.getPositionsWithPreview(grid.positions)
  )
  const gridHeight = $derived.by(() => {
    const baseHeight = calculateGridHeight(
      positionsWithPreview,
      grid.isEmpty,
      isLoading,
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
    interaction.setZoom(zoom.value)
  })

  $effect(() => {
    zoom.setViewport(workspaceContainer)
  })

  $effect(() => {
    interaction.setViewportElement(workspaceContainer)

    return () => {
      interaction.setViewportElement(null)
    }
  })

  const visualizations = (Object.keys(plotRegistry) as PlotType[]).map(id => ({
    id,
    label: plotRegistry[id].name,
    group: plotRegistry[id].group,
  }))

  function handleAddVisualization(vizType: PlotType): void {
    const newId = generateUniqueId()
    if (workspace.addGridItem(vizType, 'rail', newId)) {
      grid.setSelectedItem(newId)
      if (!responsive.isMobile) {
        grid.openPane(newId)
      }
    }
  }

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

  // History acts on the grid, so it waits for the screen that shows it: the
  // load replaces grid and history, a modal is in front, a field owns its own
  // undo. Zoom answers always — it is the workspace's own state, and skipping
  // its `preventDefault` would hand Ctrl+-/0 to the browser's page zoom.
  const canEditHistory = $derived(!isLoading && !modalState.activeModal)

  function handleGlobalKeydown(event: KeyboardEvent): void {
    const shortcut = resolveWorkspaceShortcut(event)
    if (shortcut === null) return

    if (shortcut === 'undo' || shortcut === 'redo') {
      if (!canEditHistory || isTextEntryTarget(event)) return
      event.preventDefault()
      if (shortcut === 'undo') workspace.undo()
      else workspace.redo()
      return
    }

    event.preventDefault()
    if (shortcut === 'zoom-in') zoom.in()
    else if (shortcut === 'zoom-out') zoom.out()
    else zoom.reset()
  }

  $effect(() => {
    document.addEventListener('keydown', handleGlobalKeydown)
    return () => {
      document.removeEventListener('keydown', handleGlobalKeydown)
    }
  })

  async function handleDrop(event: DragEvent): Promise<void> {
    const files = fileDrop.drop(event)
    if (files) await ingest.loadFiles(files)
  }

  const styleProps = `--min-workspace-height: ${MIN_WORKSPACE_HEIGHT}px; --grid-container-min-height: ${MIN_WORKSPACE_HEIGHT - 100}px;`
</script>

{#snippet dropHint()}
  <div class="drop-indicator">
    <div class="drop-copy">
      <p class="drop-title">Drop files to load</p>
      <p class="drop-hint">Supported formats are detected and parsed automatically</p>
    </div>
  </div>
{/snippet}

<div class="workspace-wrapper" style={styleProps} use:wheelZoomAction={zoom}>
  <input
    type="file"
    multiple
    accept=".csv,.txt,.tsv,.json,.zip,.xml"
    onchange={handleFileUpload}
    bind:this={fileUploadInput}
    hidden
  />
  <Ribbon onUpload={triggerUpload} />

  <div class="workspace-body" class:mobile={responsive.isMobile}>
    {#if !responsive.isMobile}
      <!-- Desktop: Rail is a flex item on the left edge of the -->
      <!-- workspace-body row, next to the scrolling container. -->
      <Rail
        {initialLayoutState}
        {visualizations}
        bind:zoom={zoom.value}
        onAddVisualization={handleAddVisualization}
      />
    {/if}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="workspace-container"
      class:is-drop-target={fileDrop.isActive}
      bind:this={workspaceContainer}
      role="none"
      ondragenter={fileDrop.enter}
      ondragover={fileDrop.over}
      ondragleave={fileDrop.leave}
      ondrop={handleDrop}
      onclick={handleWorkspaceBackgroundClick}
      use:panSurfaceAction={{
        enabled: !grid.isEmpty && !isLoading,
        interaction,
        workspaceContainer,
        shouldStart: shouldStartPan,
      }}
    >
      {#if fileDrop.isActive && (grid.isEmpty || isLoading)}
        <!-- Replaces an indicator card rather than stacking on it: both are
             centred at inset 0, and there are no plots here to preserve. -->
        {@render dropHint()}
      {:else if grid.isEmpty && !isLoading}
        <IndicatorEmpty {initialLayoutState} onUpload={triggerUpload} />
      {:else if isLoading}
        <IndicatorLoading />
      {:else}
        <!-- Lives with the grid it points into, so no branch can strand it.
             Outside .zoom-surface: a transformed ancestor would become the
             containing block for its `position: fixed`. -->
        <SelectionIndicator
          {workspaceContainer}
          zoom={zoom.value}
          {gridConfig}
          bottomOcclusionElement={mobileRailElement}
        />
        <div
          class="zoom-viewport"
          style="width: {gridWidth * zoom.value}px; height: {gridHeight *
            zoom.value}px;"
        >
          <div
            class="zoom-surface"
            style="transform: scale({zoom.value}); width: {gridWidth}px; height: {gridHeight}px;"
          >
            <Grid
              gridItems={grid.items}
              {gridConfig}
              {interaction}
              {gridHeight}
              {gridWidth}
              gridIsEmpty={grid.isEmpty}
            />
          </div>
        </div>
        <!-- Overlays the plots, never replaces them: dragging a file across
             the way must not unmount every canvas and lose the scroll
             position. -->
        {#if fileDrop.isActive}
          {@render dropHint()}
        {/if}
      {/if}
    </div>

    <Pane />
  </div>

  {#if responsive.isMobile}
    <!-- Mobile: Rail lives as the LAST child of .workspace-wrapper -->
    <!-- (not .workspace-body) so its sticky containing block is the -->
    <!-- full-height wrapper. The wrapper extends below the viewport -->
    <!-- as long as the user is scrolled within the workspace, which -->
    <!-- gives `position: sticky; bottom: 0` on the rail the range it -->
    <!-- needs to pin to the viewport bottom. When the user scrolls -->
    <!-- past the workspace on the page, the wrapper's bottom edge -->
    <!-- enters the viewport and the rail scrolls away with it. -->
    <Rail
      {initialLayoutState}
      {visualizations}
      bind:zoom={zoom.value}
      bind:element={mobileRailElement}
      onAddVisualization={handleAddVisualization}
    />
  {/if}
</div>

<style>
  .workspace-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: var(--min-workspace-height);
    background-color: var(--c-lightgrey);
    border-top: 1px solid var(--c-border);
    border-bottom: 1px solid var(--c-border);
  }

  .workspace-body {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    /* Intentionally `overflow: visible` — Rail's `.rail-content` and
       Pane's `.pane-content` both use `position: sticky` against the
       page's viewport scroll to stay in view. Adding overflow:hidden
       here would create a new scroll container and break the sticky
       behaviour. Clipping of the collapse animations is done locally
       on .rail (when .is-hidden) and on .pane (when closed) instead. */
  }

  /* Mobile: workspace-body keeps flex-row; the Rail mounts outside
     workspace-body (as a sibling) directly inside .workspace-wrapper
     so its sticky containing block is the full-height wrapper. */

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
    border-left: 1px solid var(--c-border);
    border-top: 1px solid var(--c-border);
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

  /* On the container itself: a scroll container paints background and outline
     on its visible box, so the cue survives any scroll position. */
  .workspace-container.is-drop-target {
    background-color: color-mix(in srgb, var(--c-info) 5%, var(--c-darkwhite));
    outline: 2px dashed var(--c-info);
    outline-offset: -12px;
  }

  /* Carded so it reads over plots, and inert so the container keeps the drop
     and its enter/leave counter. In content space, so it scrolls with the
     grid: the frame above is the cue that always holds. */
  .drop-indicator {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    z-index: 10;
    pointer-events: none;
  }

  .drop-copy {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 20px;
    border-radius: var(--rounded-md);
    background-color: var(--c-lightgrey);
    border: 1px solid var(--c-border);
    box-shadow: var(--shadow-sm);
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
