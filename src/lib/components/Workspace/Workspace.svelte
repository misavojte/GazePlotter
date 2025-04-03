<script lang="ts">
  import GridItem from '$lib/components/Workspace/WorkspaceItem.svelte'
  import WorkspaceIndicatorEmpty from '$lib/components/Workspace/WorkspaceIndicatorEmpty.svelte'
  import WorkspaceIndicatorLoading from '$lib/components/Workspace/WorkspaceIndicatorLoading.svelte'
  import WorkspaceToolbar from '$lib/components/Workspace/WorkspaceToolbar.svelte'
  import { fade } from 'svelte/transition'
  import { setContext } from 'svelte'
  import { writable, get, derived } from 'svelte/store'
  import type { AllGridTypes } from '$lib/type/gridType'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore'
  import { createGridStore, type GridConfig } from '$lib/stores/gridStore'
  import {
    DEFAULT_GRID_CONFIG,
    calculateGridHeight,
    calculateRequiredWorkspaceHeight,
    calculateBottomEdgePosition,
  } from '$lib/utils/gridSizingUtils'
  import {
    visualizationRegistry,
    getVisualizationConfig,
  } from '$lib/const/vizRegistry'

  // ---------------------------------------------------
  // State tracking
  // ---------------------------------------------------

  // Create a store to track if we're in loading state
  const isLoading = writable(false)

  // Create a store to track if an item is being dragged
  const isDragging = writable(false)
  const draggedItemId = writable<number | null>(null)

  // Add state for tracking resize operations
  const isResizing = writable(false)
  const resizedItemId = writable<number | null>(null)

  // Add state for workspace panning
  const isPanning = writable(false)
  let lastPanX = 0
  let lastPanY = 0
  let workspaceContainer: HTMLElement | null = null

  // Store to track temporary height adjustment during drag operations
  const temporaryDragHeight = writable<number | null>(null)

  // ---------------------------------------------------
  // Utility functions
  // ---------------------------------------------------

  // Calculate the center position for the initial grid item
  const findCenterX = (width: number | null): number => {
    return 0 // Always start from x=0
  }

  // Generate a new unique ID
  const getNewId = () => {
    return Date.now() + Math.floor(Math.random() * 1000)
  }

  // Factory function to create grid items with proper defaults based on type
  const createGridItem = (
    type: string,
    options: Partial<AllGridTypes> = {}
  ): AllGridTypes => {
    const config = getVisualizationConfig(type)
    const id = options.id || getNewId()
    const stimulusId = options.stimulusId ?? 0

    // Get default dimensions from config
    const defaultWidth = config.getDefaultWidth(stimulusId)
    const defaultHeight = config.getDefaultHeight(stimulusId)

    // Set default position if not provided
    const x = options.x !== undefined ? options.x : 0 // Always start at x=0
    const y = options.y !== undefined ? options.y : 0

    // Merge defaults with provided options
    return {
      id,
      type,
      x,
      y,
      w: options.w || defaultWidth,
      h: options.h || defaultHeight,
      ...config.getDefaultConfig(options),
      ...options,
    } as AllGridTypes
  }

  // Generate the default grid state with a centered scarf plot
  const createDefaultGridState = (): AllGridTypes[] => {
    return [
      createGridItem('scarf', {
        x: 0, // Always start at x=0
        y: 0,
      }),
      createGridItem('AoiTransitionMatrix', {
        x: 20,
        y: 0,
        w: 11,
        h: 12,
      }),
    ]
  }

  // ---------------------------------------------------
  // Configuration and state
  // ---------------------------------------------------

  // Configuration for grid cells - use the default config
  const gridConfig: GridConfig = { ...DEFAULT_GRID_CONFIG }

  const initialItems: AllGridTypes[] = createDefaultGridState()

  // Create our simplified grid store
  const gridStore = createGridStore(gridConfig, initialItems)

  // Reactive derivation of grid positions for the Grid component
  const positions = derived(gridStore, $gridStore =>
    $gridStore.map(item => ({
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }))
  )

  // Reactive derivation of whether the grid is empty
  const isEmpty = derived(gridStore, $gridStore => $gridStore.length === 0)

  // Calculate the required workspace width based on grid items
  const requiredWorkspaceWidth = derived(positions, $positions => {
    if ($positions.length === 0) return 1000 // Default minimum width

    // Find the rightmost edge of all items
    const maxRightEdge = Math.max(
      ...$positions.map(
        item => (item.x + item.w) * (gridConfig.cellSize.width + gridConfig.gap)
      )
    )

    // Add padding and ensure minimum width
    return Math.max(1000, maxRightEdge + 300) // Extra padding for new items
  })

  // Create store to track minimum workspace height required by all items
  const requiredWorkspaceHeight = derived(positions, $positions => {
    return calculateRequiredWorkspaceHeight($positions, gridConfig)
  })

  // Enhanced gridHeight calculation to respect minimum required height
  const gridHeight = derived(
    [
      positions,
      isEmpty,
      isLoading,
      temporaryDragHeight,
      requiredWorkspaceHeight,
    ],
    ([
      $positions,
      $isEmpty,
      $isLoading,
      $temporaryDragHeight,
      $requiredWorkspaceHeight,
    ]) => {
      return calculateGridHeight(
        $positions,
        $isEmpty,
        $isLoading,
        $temporaryDragHeight,
        gridConfig
      )
    }
  )

  // ---------------------------------------------------
  // Enhanced grid store with additional methods
  // ---------------------------------------------------

  // Add the required functions to match the expected gridStore interface
  const enhancedGridStore = {
    subscribe: gridStore.subscribe,
    set: gridStore.set,
    update: gridStore.update,
    updateSettings: gridStore.updateSettings,
    removeItem: gridStore.removeItem,
    duplicateItem: (item: AllGridTypes) => {
      return gridStore.duplicateItem(item)
    },
    // Add batch duplication support
    batchDuplicateItems: (items: AllGridTypes[]) => {
      return gridStore.batchDuplicateItems(items)
    },
    addItem: (type: string, options: Partial<AllGridTypes> = {}) => {
      const newItem = createGridItem(type, options)
      // Let the grid store handle layout and collision resolution
      // Our unified system will intelligently place items and resolve any conflicts
      return gridStore.addItem(newItem)
    },
    resetGrid: (newState: AllGridTypes[] = []) => {
      gridStore.set(newState)
    },
  }

  // Make the enhanced store available to child components
  setContext('gridStore', enhancedGridStore)

  // Also make visualization registry available to child components
  setContext('visualizationRegistry', visualizationRegistry)

  // ---------------------------------------------------
  // Event handlers and reactivity
  // ---------------------------------------------------

  // Unified height calculation for preview operations
  const calculateWorkspaceHeight = (id: number, y: number, h: number) => {
    const currentItems = get(gridStore)

    // Calculate bottom edge of the item being manipulated
    const itemBottomEdge = calculateBottomEdgePosition(y, h, gridConfig)

    // Calculate maximum bottom edge of all OTHER items
    const otherItemsMaxBottom = Math.max(
      300, // Minimum fallback
      ...currentItems
        .filter(item => item.id !== id)
        .map(item => calculateBottomEdgePosition(item.y, item.h, gridConfig))
    )

    // Return maximum + padding
    return Math.max(otherItemsMaxBottom, itemBottomEdge) + 90 // Add padding
  }

  // --- Preview handlers (visual feedback only) ---

  // Handle item movement preview - no actual state changes
  const handleItemPreviewMove = (event: {
    id: number
    previewX: number
    previewY: number
    currentX: number
    currentY: number
    w: number
    h: number
  }) => {
    // Update height during preview to ensure workspace expands as needed
    temporaryDragHeight.set(
      calculateWorkspaceHeight(event.id, event.previewY, event.h)
    )
  }

  // Handle item resize preview
  const handleItemPreviewResize = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
    currentW: number
    currentH: number
  }) => {
    // Update height during preview
    isResizing.set(true)
    resizedItemId.set(event.id)
    temporaryDragHeight.set(
      calculateWorkspaceHeight(event.id, event.y, event.h)
    )
  }

  // Handle workspace height updates (unified for both drag & resize)
  const handleDragHeightUpdate = (event: {
    id: number
    y: number
    h: number
    bottomEdge: number
  }) => {
    temporaryDragHeight.set(
      calculateWorkspaceHeight(event.id, event.y, event.h)
    )
  }

  // --- Operation start handlers ---

  // Handle operation start (sets global state)
  const handleDragStart = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
  }) => {
    const { id } = event
    isDragging.set(true)
    draggedItemId.set(id)
  }

  // --- Operation end handlers ---

  // Unified handler for completing operations with collision resolution
  const completeOperation = (
    id: number,
    updateFn: () => void,
    complete: boolean = true
  ) => {
    // Reset states
    isDragging.set(false)
    draggedItemId.set(null)
    isResizing.set(false)
    resizedItemId.set(null)
    temporaryDragHeight.set(null)

    if (!complete) return

    // Apply update first without collision resolution
    updateFn()

    // Then resolve collisions with a slight delay for better UX
    setTimeout(() => {
      gridStore.resolveItemPositionCollisions(id)
    }, 50) // Short delay for better visual feedback
  }

  // Handle drag completion
  const handleItemMove = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
  }) => {
    const { id, x, y } = event
    // Update position without resolving collisions
    gridStore.updateItemPosition(id, x, y, false)
  }

  // Handle drag end
  const handleDragEnd = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
    dragComplete: boolean
  }) => {
    const { id, x, y, dragComplete } = event

    completeOperation(
      id,
      () => gridStore.updateItemPosition(id, x, y, false),
      dragComplete
    )
  }

  // Handle resize
  const handleItemResize = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
  }) => {
    const { id, w, h } = event
    const currentItem = get(gridStore).find(item => item.id === id)

    if (!currentItem) return

    // Enforce minimum dimensions
    const minWidth = Math.max(
      gridConfig.minWidth,
      currentItem.min?.w || gridConfig.minWidth
    )
    const minHeight = Math.max(
      gridConfig.minHeight,
      currentItem.min?.h || gridConfig.minHeight
    )

    // Apply constraints
    const constrainedW = Math.max(minWidth, w)
    const constrainedH = Math.max(minHeight, h)

    // Update without collision resolution
    gridStore.updateItemSize(id, constrainedW, constrainedH, false)
  }

  // Handle resize end
  const handleResizeEnd = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
    resizeComplete: boolean
  }) => {
    const { id, w, h, resizeComplete } = event

    completeOperation(
      id,
      () => {
        const currentItem = get(gridStore).find(item => item.id === id)
        if (currentItem) {
          // Ensure dimensions are constrained
          const minWidth = Math.max(
            gridConfig.minWidth,
            currentItem.min?.w || gridConfig.minWidth
          )
          const minHeight = Math.max(
            gridConfig.minHeight,
            currentItem.min?.h || gridConfig.minHeight
          )

          const constrainedW = Math.max(minWidth, w)
          const constrainedH = Math.max(minHeight, h)

          gridStore.updateItemSize(id, constrainedW, constrainedH, false)
        }
      },
      resizeComplete
    )
  }

  // Handle item removal
  const handleItemRemove = (event: { id: number }) => {
    const { id } = event
    gridStore.removeItem(id)
  }

  // Handle item duplication
  const handleItemDuplicate = (event: { id: number }) => {
    const { id } = event
    // Find the item to duplicate
    const itemToDuplicate = get(gridStore).find(item => item.id === id)
    if (itemToDuplicate) {
      // Use the duplicate method from the grid store
      gridStore.duplicateItem(itemToDuplicate)
    }
  }

  // Handle toolbar actions
  const handleToolbarAction = (event: { id: string; vizType?: string }) => {
    const { id, vizType } = event

    console.log('handleToolbarAction', event)

    if (id === 'add-visualization' && vizType) {
      // Add the new visualization
      enhancedGridStore.addItem(vizType, {
        x: 0, // You might want to calculate a better position
        y: get(gridStore).length, // Place it below existing items
      })
    } else if (id === 'toggle-fullscreen') {
      // Delegate fullscreen toggle to the toolbar
      // The toolbar component will handle fullscreen functionality itself
    }
  }

  // --- Workspace panning handlers ---

  // Handle panning start when clicking on the workspace background
  const handleWorkspacePanStart = (event: MouseEvent) => {
    // Only handle primary mouse button
    if (event.button !== 0) return

    // Only handle clicks on the workspace background, not on grid items
    const targetEl = event.target as HTMLElement
    if (
      targetEl.closest('.grid-item') ||
      targetEl.closest('.grid-item-content')
    )
      return

    // Prevent default to avoid text selection during panning
    event.preventDefault()

    // Set panning state
    isPanning.set(true)

    // Store initial position
    lastPanX = event.clientX
    lastPanY = event.clientY

    // Set cursor directly for immediate feedback
    document.body.style.cursor = 'grabbing'
    if (workspaceContainer) {
      workspaceContainer.style.cursor = 'grabbing'
    }

    // Add move and end event listeners
    document.addEventListener('mousemove', handleWorkspacePanMove)
    document.addEventListener('mouseup', handleWorkspacePanEnd)
  }

  // Improved panning with smoothing and reduced sensitivity
  const handleWorkspacePanMove = (event: MouseEvent) => {
    if (!get(isPanning) || !workspaceContainer) return

    // Calculate raw delta
    const rawDeltaX = event.clientX - lastPanX
    const rawDeltaY = event.clientY - lastPanY

    // Apply damping factor to reduce sensitivity and smooth movement
    // Lower values make movement smoother but less responsive
    const dampingFactor = 0.6

    // Apply damping to create smoother motion
    const deltaX = rawDeltaX * dampingFactor
    const deltaY = rawDeltaY * dampingFactor

    // Update the last position for next calculation
    lastPanX = event.clientX
    lastPanY = event.clientY

    // Apply horizontal scrolling to the workspace container
    if (Math.abs(deltaX) > 0.5) {
      // Small threshold to ignore tiny movements
      workspaceContainer.scrollLeft -= deltaX
    }

    // Apply vertical scrolling to the window with threshold
    if (Math.abs(deltaY) > 0.5) {
      window.scrollBy(0, -deltaY)
    }
  }

  // Handle panning end
  const handleWorkspacePanEnd = () => {
    // Reset panning state
    isPanning.set(false)

    // Reset cursor styles
    document.body.style.cursor = ''
    if (workspaceContainer) {
      workspaceContainer.style.cursor = 'grab'
    }

    // Remove event listeners
    document.removeEventListener('mousemove', handleWorkspacePanMove)
    document.removeEventListener('mouseup', handleWorkspacePanEnd)
  }

  // When the processing state changes, update the grid and loading state
  $effect(() => {
    if ($processingFileStateStore === 'done') {
      isLoading.set(false)
      enhancedGridStore.resetGrid(createDefaultGridState())
      processingFileStateStore.set('idle')
    } else if ($processingFileStateStore === 'processing') {
      isLoading.set(true)
      enhancedGridStore.resetGrid([]) // Clear the grid while loading
    } else if ($processingFileStateStore === 'fail') {
      isLoading.set(false)
      enhancedGridStore.resetGrid([]) // Set to empty grid - the empty indicator will show
    }
  })

  // Note: Previously, we would add grid items for both empty and loading states.
  // Now we maintain a truly empty grid and display dedicated indicator components
  // when appropriate. This provides a more integrated and visually appealing user
  // experience without artificially creating grid items.
</script>

<div class="workspace-wrapper">
  <!-- Update toolbar, removing drag-related props -->
  <WorkspaceToolbar
    onaction={handleToolbarAction}
    visualizations={Object.entries(visualizationRegistry).map(
      ([id, config]) => ({
        id,
        label: config.name,
      })
    )}
  />

  <!-- Bind the workspace container and add mousedown for panning -->
  <div
    class="workspace-container"
    style="height: {$gridHeight}px;"
    bind:this={workspaceContainer}
    on:mousedown={handleWorkspacePanStart}
    class:is-panning={$isPanning}
  >
    <!-- Fixed background pattern layer -->
    <div
      class="background-pattern"
      style="width: {$requiredWorkspaceWidth}px;"
    ></div>

    <!-- Scrollable content layer -->
    <div class="grid-container">
      {#each $gridStore as item (item.id)}
        {@const visConfig = getVisualizationConfig(item.type)}
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
            title={visConfig.name}
            class={item.id === $resizedItemId ? 'is-being-resized' : ''}
            onpreviewmove={handleItemPreviewMove}
            onmove={handleItemMove}
            onpreviewresize={handleItemPreviewResize}
            onresize={handleItemResize}
            onresizeend={handleResizeEnd}
            ondragstart={handleDragStart}
            ondragend={handleDragEnd}
            ondrag_height_update={handleDragHeightUpdate}
            onremove={handleItemRemove}
            onduplicate={handleItemDuplicate}
          >
            {#snippet body()}
              <div class="grid-item-content">
                <visConfig.component
                  settings={item}
                  settingsChange={(newSettings: any) => {
                    gridStore.updateSettings({
                      ...item,
                      ...newSettings,
                    })
                  }}
                />
              </div>
            {/snippet}
          </GridItem>
        </div>
      {/each}
    </div>

    {#if $isDragging || $isPanning}
      <div
        class="pointer-events-blocker"
        transition:fade={{ duration: 50 }}
      ></div>
    {/if}

    {#if $isEmpty && !$isLoading}
      <WorkspaceIndicatorEmpty />
    {/if}

    {#if $isLoading}
      <WorkspaceIndicatorLoading />
    {/if}
  </div>
</div>

<style>
  .workspace-wrapper {
    position: relative;
    display: flex;
    min-height: 300px; /* Minimum height to ensure toolbar is visible */
    display: grid;
    border: 1px solid #8888889c;
    grid-template-columns: 48px 1fr;
  }

  .workspace-container {
    box-sizing: border-box;
    position: relative;
    width: 100%;
    background-color: transparent; /* Remove background from container */
    z-index: 1;
    transition: height 0.3s ease-out;
    overflow-x: auto; /* Allow horizontal scrolling */
    overflow-y: hidden; /* Prevent vertical scrolling */
    min-height: 300px; /* Ensure minimum height for small grids */
    padding: 35px; /* Consistent padding throughout */
    /* Performance optimizations */
    will-change: height;
    border-left: 1px solid #88888862;
    transform: translateZ(0);
    /* Base cursor for empty areas */
    cursor: grab;
  }

  /* Fixed background pattern that doesn't scroll */
  .background-pattern {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    background-color: var(--c-darkwhite);
    background-image: radial-gradient(
      circle,
      var(--c-grey) 2px,
      transparent 2px
    );
    background-size: 50px 50px;
    background-position: 5px 5px;
    z-index: -1; /* Place behind content */
    pointer-events: none; /* Allow clicking through to container */
    min-width: 100%; /* Always at least as wide as the container */
  }

  /* Cursor styling for panning */
  .workspace-container.is-panning {
    cursor: grabbing;
  }

  .grid-container {
    position: relative;
    width: 100%;
    min-height: 200px;
    background-color: transparent; /* Keep transparent to show fixed background */
    transition: height 0.3s ease-out;
    overflow-x: visible; /* Allow content to flow naturally */
    overflow-y: visible; /* Allow content to expand the container */
    /* Prevent unnecessary repaints */
    will-change: contents;
    transform: translateZ(0);
  }

  /* Override cursor for all grid items */
  :global(.grid-item) {
    cursor: default;
  }

  /* Allow specific cursors for functional handles */
  :global(.resize-handle) {
    cursor: se-resize !important;
    z-index: 100 !important; /* Ensure it's above other elements */
  }

  /* Allow specific cursor for drag handle button */
  :global(.header > .tooltip-wrapper:first-child .workspace-item-button) {
    cursor: grab !important;
  }

  /* Show grabbing cursor when actively dragging */
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
    z-index: 5; /* Above regular items but below the placeholder */
    background-color: transparent;
    /* Block all pointer events */
    pointer-events: all;
    /* Visual feedback that interaction is blocked */
    cursor: grabbing;
  }
</style>
