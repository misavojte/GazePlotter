<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { fade } from 'svelte/transition'
  import { IndicatorEmpty, IndicatorLoading } from './'
  import Grid from './grid/Grid.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import WorkspaceControls from './controls/WorkspaceControls.svelte'
  import { responsive } from './responsive.svelte'
  import { Pane } from './pane'
  import SelectionIndicator from './SelectionIndicator.svelte'
  import { stickyBanner } from './stickyBanner.svelte'

  import {
    MIN_WORKSPACE_HEIGHT,
    DEFAULT_GRID_CONFIG,
    calculateGridHeight,
    calculateGridWidth,
    gridToPixelDimensions,
    gridToPixelPosition,
  } from './grid'
  import {
    GridInteractionController,
    panSurfaceAction,
  } from './grid/interaction'
  import type { WorkspaceCamera, GridBounds } from './camera.svelte'
  import { cameraTouchAction, cameraWheelAction } from './cameraGestures'
  import { FileDropTarget } from './fileDrop.svelte'
  import { isTextEntryTarget, MODIFIER_LABEL, resolveWorkspaceShortcut } from './keys'
  import type { WorkspaceCommandChain } from './commands'

  interface Props {
    onWorkspaceCommandChain: (command: WorkspaceCommandChain) => void
    /** The view onto the grid; owned by GazePlotter so hosts can drive it. */
    camera: WorkspaceCamera
    /** How the wheel behaves over the workspace (see GazePlotter). */
    gestures?: 'cooperative' | 'canvas'
    /** Show the built-in floating controls (see GazePlotter). */
    controls?: boolean
  }

  const {
    onWorkspaceCommandChain,
    camera,
    gestures = 'cooperative',
    controls = true,
  }: Props = $props()
  const { ingest, grid, workspace, modalState } = getGazePlotterSession()

  // Single upload owner: the drag-drop handler below and the click entry
  // points (the host's import trigger, the empty-state button) all feed
  // ingest.
  const triggerUpload = () => ingest.openAndLoadFiles()

  function handleWorkspaceBackgroundClick(event: MouseEvent): void {
    // Clicking anywhere in the workspace that isn't a grid item deselects
    // the currently selected plot (and closes the Pane). Clicks inside a
    // grid item keep bubbling — the item's own frame handler runs first
    // and sets selection; this outer handler then runs with a target
    // still inside `.grid-item`, so we no-op.
    const target = event.target as HTMLElement | null
    if (!target) return
    if (target.closest('.grid-item')) return
    grid.clearSelection()
  }

  // Drag-to-pan starts from empty space and from unselected plots, whose drag
  // is otherwise unused (a selected plot's drag moves it). Controls and
  // canvases that declare their own drag keep their pointer semantics.
  function shouldStartPan(event: PointerEvent): boolean {
    const target = event.target as HTMLElement | null
    if (!target) return false
    return !target.closest(
      '.grid-item.selected, [data-owns-drag], button, a, input, select, textarea, [role="button"]'
    )
  }

  // On a plot the pan waits for a drag, so a click still selects it.
  function deferPan(event: PointerEvent): boolean {
    return (event.target as HTMLElement | null)?.closest('.grid-item') != null
  }

  const gridConfig = DEFAULT_GRID_CONFIG

  // ---------------------------------------------------
  // State tracking (Svelte 5 Runes)
  // ---------------------------------------------------

  // "No grid on screen": ingest owns this state, and it is read straight from
  // there. A mirror on GridState would lag it by a flush for no other reader.
  const isLoading = $derived(ingest.isLoading)

  let workspaceContainer: HTMLElement | null = $state(null)
  let gridSurface: HTMLElement | null = $state(null)
  const fileDrop = new FileDropTarget()
  const interaction = new GridInteractionController()
  const positionsWithPreview = $derived.by(() =>
    interaction.getPositionsWithPreview(grid.positions)
  )
  const gridHeight = $derived(
    calculateGridHeight(positionsWithPreview, grid.isEmpty, isLoading, gridConfig)
  )
  const gridWidth = $derived(
    calculateGridWidth(positionsWithPreview, gridConfig)
  )

  // The layout's extent in grid px (live previews included, so a dragged
  // plot can pull the view with it): the camera's soft wall and "fit" use it.
  const contentBounds = $derived.by((): GridBounds | null => {
    if (positionsWithPreview.length === 0) return null
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    for (const item of positionsWithPreview) {
      const pos = gridToPixelPosition(item.x, item.y, gridConfig)
      const size = gridToPixelDimensions(item.w, item.h, gridConfig)
      left = Math.min(left, pos.left)
      top = Math.min(top, pos.top)
      right = Math.max(right, pos.left + size.width)
      bottom = Math.max(bottom, pos.top + size.height)
    }
    return { left, top, right, bottom }
  })

  // ---------------------------------------------------
  // Initialization Logic
  // ---------------------------------------------------

  $effect(() => {
    camera.setContentBounds(() => contentBounds)
  })

  // Armed by the loading card, so only the grid a load hands over makes an
  // entrance; one that appears from the empty state just opens.
  let entrance = $state(false)
  $effect(() => {
    if (isLoading) entrance = true
    else if (grid.isEmpty) entrance = false
  })

  // A freshly shown grid (first load, a new dataset, a restored workspace)
  // opens showing the whole layout, as far as it stays readable.
  $effect(() => {
    if (!gridSurface) return
    untrack(() => {
      if (entrance) camera.enter()
      else camera.open()
      entrance = false
    })
  })

  $effect(() => {
    interaction.setGridConfig(gridConfig)
  })

  $effect(() => {
    interaction.setZoom(camera.zoom)
  })

  $effect(() => {
    camera.setFrame(workspaceContainer)
    interaction.setCamera(camera)
    return () => {
      interaction.setCamera(null)
    }
  })

  $effect(() => {
    interaction.setViewportElement(workspaceContainer)

    return () => {
      interaction.setViewportElement(null)
    }
  })

  // A layout shift (a plot dropped past the origin, or its undo) moves every
  // plot inside the grid; move the camera the other way so none moves on
  // screen. Same flush as the layout change, so no frame shows the jump.
  function followLayoutShift(command: WorkspaceCommandChain): void {
    if (command.type !== 'translateLayout') return
    camera.followShift(
      command.dx * (gridConfig.cellSize.width + gridConfig.gap),
      command.dy * (gridConfig.cellSize.height + gridConfig.gap)
    )
  }

  const isFrameTarget = (target: Node) =>
    !!workspaceContainer?.contains(target)

  // Cooperative gestures: a plain wheel scrolls the page, so say how to zoom
  // instead, as an embedded map does.
  let wheelHintVisible = $state(false)
  let wheelHintTimer: ReturnType<typeof setTimeout> | undefined
  function showWheelHint(event: WheelEvent): void {
    if (grid.isEmpty || isLoading) return
    if (!workspaceContainer?.contains(event.target as Node)) return
    // Sideways wheels (Shift+wheel, horizontal swipes) are not page scrolls.
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return
    wheelHintVisible = true
    clearTimeout(wheelHintTimer)
    wheelHintTimer = setTimeout(() => (wheelHintVisible = false), 1200)
  }

  $effect(() => {
    workspace.setCommandListener(command => {
      followLayoutShift(command)
      onWorkspaceCommandChain(command)
    })

    return () => {
      workspace.setCommandListener(() => {})
    }
  })

  onDestroy(() => {
    interaction.destroy()
    clearTimeout(wheelHintTimer)
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
    // Saving is the session's (GazePlotter.svelte), not the view's.
    if (shortcut === null || shortcut === 'save' || shortcut === 'save-as') return

    if (shortcut === 'zoom-fit') {
      // A bare key, unlike the chords below: a field or a modal keeps it.
      if (!canEditHistory || isTextEntryTarget(event)) return
      event.preventDefault()
      camera.fit()
      return
    }

    if (shortcut === 'undo' || shortcut === 'redo') {
      if (!canEditHistory || isTextEntryTarget(event)) return
      event.preventDefault()
      if (shortcut === 'undo') workspace.undo()
      else workspace.redo()
      return
    }

    event.preventDefault()
    if (shortcut === 'zoom-in') camera.in()
    else if (shortcut === 'zoom-out') camera.out()
    else camera.reset()
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

  const styleProps = $derived(
    `--min-workspace-height: ${MIN_WORKSPACE_HEIGHT}px; --sticky-banner-height: ${stickyBanner.height}px;`
  )

  // Whole-pixel camera offset: a fractional translate smears every plot's
  // text and hairlines across two pixels.
  const screenX = $derived(Math.round(camera.x))
  const screenY = $derived(Math.round(camera.y))

  // Fine paper riding the camera: a line every fifth of a cell, aligned to
  // the gap centres; fades out on zoom-out before it turns to mesh.
  const latticeStyle = $derived.by(() => {
    const pitch = ((gridConfig.cellSize.width + gridConfig.gap) / 5) * camera.zoom
    const lead = (gridConfig.cellSize.width + gridConfig.gap / 2) * camera.zoom
    const ink = Math.max(0, camera.zoom - 0.5) * 8
    const x = screenX + Math.round(lead)
    const y = screenY + Math.round(lead)
    return `--lattice-pitch: ${pitch}px; --lattice-x: ${x}px; --lattice-y: ${y}px; --lattice-ink: ${ink.toFixed(1)}%;`
  })
</script>

{#snippet dropHint()}
  <div class="drop-indicator">
    <div class="drop-copy">
      <p class="drop-title">Drop files to load</p>
      <p class="drop-hint">Supported formats are detected and parsed automatically</p>
    </div>
  </div>
{/snippet}

<div
  class="workspace-wrapper"
  style={styleProps}
  use:cameraWheelAction={{
    camera,
    // Canvas-first: a plain wheel over the frame pans (never over the pane,
    // which scrolls its own settings). Cooperative: the page keeps it.
    panTarget: gestures === 'canvas' ? isFrameTarget : null,
    onPlainWheel: showWheelHint,
  }}
>
  <div class="workspace-body">
    {#if controls && !responsive.isMobile}
      <WorkspaceControls {camera} />
    {/if}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="workspace-container"
      class:is-drop-target={fileDrop.isActive}
      style={latticeStyle}
      bind:this={workspaceContainer}
      role="none"
      ondragenter={fileDrop.enter}
      ondragover={fileDrop.over}
      ondragleave={fileDrop.leave}
      ondrop={handleDrop}
      onclick={handleWorkspaceBackgroundClick}
      use:cameraTouchAction={camera}
      use:panSurfaceAction={{
        enabled: !grid.isEmpty && !isLoading,
        interaction,
        workspaceContainer,
        shouldStart: shouldStartPan,
        deferStart: deferPan,
      }}
    >
      {#if fileDrop.isActive && (grid.isEmpty || isLoading)}
        <!-- Replaces an indicator card rather than stacking on it: both are
             centred at inset 0, and there are no plots here to preserve. -->
        {@render dropHint()}
      {:else if grid.isEmpty && !isLoading}
        <IndicatorEmpty onUpload={triggerUpload} />
      {:else if isLoading}
        <IndicatorLoading />
      {:else}
        <!-- Lives with the grid it points into, so no branch can strand it.
             Outside .zoom-surface: a transformed ancestor would become the
             containing block for its `position: fixed`. -->
        <SelectionIndicator
          frame={workspaceContainer}
          {camera}
          {gridConfig}
        />
        <div
          class="grid-surface"
          bind:this={gridSurface}
          style="transform: translate({screenX}px, {screenY}px) scale({camera.zoom}); width: {gridWidth}px; height: {gridHeight}px;"
        >
          <Grid
            gridItems={grid.items}
            {gridConfig}
            {interaction}
            {gridHeight}
            {gridWidth}
            gridIsEmpty={grid.isEmpty}
            {entrance}
          />
        </div>
        {#if wheelHintVisible}
          <div class="wheel-hint" transition:fade={{ duration: 150 }}>
            Hold {MODIFIER_LABEL} and scroll to zoom. Drag empty space to move around.
          </div>
        {/if}
        <!-- Overlays the plots, never replaces them: dragging a file across
             the way must not unmount every canvas and lose the view. -->
        {#if fileDrop.isActive}
          {@render dropHint()}
        {/if}
      {/if}
    </div>

    <Pane />
  </div>

  {#if controls && responsive.isMobile}
    <WorkspaceControls {camera} />
  {/if}
</div>

<style>
  .workspace-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: var(--min-workspace-height);
    /* One screen tall (below the host's sticky banner, if any): the frame the
       camera looks through. Hosts embedding GazePlotter can set their own
       height with --gp-workspace-height. */
    height: var(
      --gp-workspace-height,
      calc(100dvh - var(--sticky-banner-height, 0px))
    );
    background-color: var(--c-white);
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
    /* The frame never scrolls: the camera moves the grid inside it. */
    overflow: hidden;
    cursor: grab;
    /* Tinted desk, so the white plot bodies lift off it like paper. */
    background-color: var(--c-darkwhite);
  }

  /* Own layer so the vignette masks only the paper, never the plots. */
  .workspace-container::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    --lattice-line: color-mix(in srgb, var(--c-black) var(--lattice-ink), transparent);
    background-image:
      linear-gradient(to right, var(--lattice-line) 1px, transparent 1px),
      linear-gradient(to bottom, var(--lattice-line) 1px, transparent 1px);
    background-size: var(--lattice-pitch) var(--lattice-pitch);
    background-position: var(--lattice-x) var(--lattice-y);
    /* Paper settles toward the edges, so the frame has no hard grid cut. */
    mask-image: radial-gradient(
      ellipse 85% 85% at 50% 45%,
      #000 40%,
      rgb(0 0 0 / 0.3) 100%
    );
  }

  .grid-surface {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;
    will-change: transform;
  }

  .wheel-hint {
    position: absolute;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    z-index: 20;
    padding: 8px 14px;
    border-radius: var(--rounded-md);
    background-color: color-mix(in srgb, var(--c-black) 85%, transparent);
    color: var(--c-darkwhite);
    font-size: var(--text-md);
    white-space: nowrap;
    pointer-events: none;
  }

  /* ---- drag-and-drop indicator ---- */

  /* On the frame itself, so the cue holds wherever the camera is. */
  .workspace-container.is-drop-target {
    background-color: color-mix(in srgb, var(--c-info) 5%, var(--c-darkwhite));
    outline: 2px dashed var(--c-info);
    outline-offset: -12px;
  }

  /* Carded so it reads over plots, and inert so the frame keeps the drop
     and its enter/leave counter. */
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
    font-size: var(--text-md);
    font-weight: 600;
    color: var(--c-black);
    text-wrap: balance;
  }

  .drop-hint {
    margin: 0;
    font-size: var(--text-sm);
    font-family: var(--font-small);
    color: var(--c-darkgrey);
    text-wrap: pretty;
  }
</style>
