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
    calculateGridWidth,
  } from '$lib/utils/gridSizingUtils'
  import {
    visualizationRegistry,
    getVisualizationConfig,
  } from '$lib/const/vizRegistry'
  import { throttleByRaf } from '$lib/utils/throttle'

  // --- Constants ---
  const WORKSPACE_BOTTOM_PADDING = 90
  const WORKSPACE_RIGHT_PADDING = 300
  const MIN_WORKSPACE_HEIGHT = 300 // Also used as fallback in height calculation
  const DEFAULT_WORKSPACE_WIDTH = 1000

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

  if (workspaceContainer) {
    ;(workspaceContainer as HTMLElement).scrollLeft = 0
  }

  // Store to track temporary height adjustment during drag operations
  const temporaryDragHeight = writable<number | null>(null)
  const temporaryDragWidth = writable<number | null>(null)

  // scroll Starting position
  let scrollStartX = 0
  let scrollStartY = 0 // this will change on Mount as the workspace is placed below the header in the DOM

  const getWorkspaceScrollX = () => {
    if (workspaceContainer) {
      return workspaceContainer.scrollLeft
    }
    return 0
  }

  const getWorkspaceScrollY = () => {
    // this is from window.scrollY
    if (window) {
      return window.scrollY
    }
    return 0
  }

  const setWorkspaceScrollX = (x: number) => {
    if (workspaceContainer) {
      workspaceContainer.scrollLeft = x
    }
  }

  const setWorkspaceScrollY = (y: number) => {
    if (window) {
      window.scrollTo(0, y)
    }
  }

  // ---------------------------------------------------
  // Utility functions
  // ---------------------------------------------------

  // Higher-order function for creating operation handlers with common behavior
  const createOperationHandler = <T extends { id: number }>(options: {
    operationType?: 'move' | 'resize' | 'preview' | 'start' | 'end'
    stateUpdater?: (id: number, isActive: boolean) => void
    heightUpdater?: (event: T) => void
    gridAction?: (event: T) => void
    shouldResolveCollisions?: boolean
  }) => {
    const {
      operationType,
      stateUpdater,
      heightUpdater,
      gridAction,
      shouldResolveCollisions = false,
    } = options

    return (event: T) => {
      const { id } = event

      // Update operation state if needed
      if (stateUpdater && operationType !== 'end') {
        stateUpdater(id, true)
      }

      // Update temporary height for preview operations
      if (
        heightUpdater &&
        (operationType === 'preview' ||
          operationType === 'move' ||
          operationType === 'resize')
      ) {
        heightUpdater(event)
      }

      // Perform grid action if provided
      if (gridAction) {
        gridAction(event)
      }

      // Reset states for end operations
      if (operationType === 'end') {
        isDragging.set(false)
        draggedItemId.set(null)
        isResizing.set(false)
        resizedItemId.set(null)
        temporaryDragHeight.set(null)
        temporaryDragWidth.set(null)
        // Resolve collisions if needed after a slight delay
        if (shouldResolveCollisions && id) {
          setTimeout(() => {
            gridStore.resolveItemPositionCollisions(id)
          }, 50)
        }
      }
    }
  }

  // Unified height calculation for preview operations
  const calculateWorkspaceHeight = (id: number, y: number, h: number) => {
    const currentItems = get(gridStore)

    // Calculate bottom edge of the item being manipulated
    const itemBottomEdge = calculateBottomEdgePosition(y, h, gridConfig)

    // Calculate maximum bottom edge of all OTHER items
    const otherItemsMaxBottom = Math.max(
      MIN_WORKSPACE_HEIGHT, // Use constant for minimum fallback
      ...currentItems
        .filter(item => item.id !== id)
        .map(item => calculateBottomEdgePosition(item.y, item.h, gridConfig))
    )

    // Return maximum + padding
    return (
      Math.max(otherItemsMaxBottom, itemBottomEdge) + WORKSPACE_BOTTOM_PADDING
    )
  }

  // Generate the default grid state with a centered scarf plot
  const createDefaultGridStateData = (): Array<
    Partial<AllGridTypes> & { type: string }
  > => {
    // Return data needed to create items, not the items themselves
    return [
      { type: 'scarf', x: 0, y: 0 },
      { type: 'AoiTransitionMatrix', x: 20, y: 0, w: 11, h: 12 },
    ]
  }

  // ---------------------------------------------------
  // Configuration and state
  // ---------------------------------------------------

  // Configuration for grid cells - use the default config
  const gridConfig: GridConfig = { ...DEFAULT_GRID_CONFIG }

  const initialItemData = createDefaultGridStateData()

  // Create our simplified grid store
  const gridStore = createGridStore(gridConfig, initialItemData)

  // set gridStore to context (old ScarfPlot dependency)
  setContext('gridStore', gridStore)

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
    if ($positions.length === 0) return DEFAULT_WORKSPACE_WIDTH // Use constant

    // Find the rightmost edge of all items
    const maxRightEdge = Math.max(
      ...$positions.map(
        item => (item.x + item.w) * (gridConfig.cellSize.width + gridConfig.gap)
      )
    )

    // Add padding and ensure minimum width
    return Math.max(
      DEFAULT_WORKSPACE_WIDTH,
      maxRightEdge + WORKSPACE_RIGHT_PADDING
    )
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
    ([$positions, $isEmpty, $isLoading, $temporaryDragHeight]) => {
      return calculateGridHeight(
        $positions,
        $isEmpty,
        $isLoading,
        $temporaryDragHeight,
        gridConfig
      )
    }
  )

  const gridWidth = derived(
    [positions, temporaryDragWidth],
    ([$positions, $temporaryDragWidth]) => {
      return calculateGridWidth($positions, $temporaryDragWidth, gridConfig)
    }
  )

  // ---------------------------------------------------
  // Event handlers created using the factory
  // ---------------------------------------------------

  // --- Preview handlers (visual feedback only) ---

  // Handle item movement preview
  const handleItemPreviewMove = createOperationHandler({
    operationType: 'preview',
    heightUpdater: (event: { id: number; previewY: number; h: number }) => {
      temporaryDragHeight.set(
        calculateWorkspaceHeight(event.id, event.previewY, event.h)
      )
    },
  })

  // Handle item resize preview
  const handleItemPreviewResize = createOperationHandler({
    operationType: 'preview',
    stateUpdater: id => {
      isResizing.set(true)
      resizedItemId.set(id)
    },
    heightUpdater: (event: { id: number; y: number; h: number }) => {
      temporaryDragHeight.set(
        calculateWorkspaceHeight(event.id, event.y, event.h)
      )
    },
  })

  // Handle workspace height updates
  const handleDragHeightUpdate = createOperationHandler({
    operationType: 'preview',
    heightUpdater: (event: { id: number; y: number; h: number }) => {
      temporaryDragHeight.set(
        calculateWorkspaceHeight(event.id, event.y, event.h)
      )
    },
  })

  // --- Operation start handlers ---

  // Handle drag operation start
  const handleDragStart = createOperationHandler({
    operationType: 'start',
    stateUpdater: id => {
      isDragging.set(true)
      draggedItemId.set(id)
    },
  })

  // --- Movement and resizing handlers ---

  // Handle drag movement
  const handleItemMove = createOperationHandler({
    operationType: 'move',
    gridAction: (event: { id: number; x: number; y: number }) => {
      gridStore.updateItemPosition(event.id, event.x, event.y, false)
    },
  })

  // Handle resize
  const handleItemResize = createOperationHandler({
    operationType: 'resize',
    gridAction: (event: { id: number; w: number; h: number }) => {
      const currentItem = get(gridStore).find(item => item.id === event.id)

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
      const constrainedW = Math.max(minWidth, event.w)
      const constrainedH = Math.max(minHeight, event.h)

      // Update without collision resolution
      gridStore.updateItemSize(event.id, constrainedW, constrainedH, false)
    },
  })

  // --- Operation end handlers ---

  // Handle drag end
  const handleDragEnd = createOperationHandler({
    operationType: 'end',
    gridAction: (event: {
      id: number
      x: number
      y: number
      dragComplete: boolean
    }) => {
      if (event.dragComplete) {
        gridStore.updateItemPosition(event.id, event.x, event.y, false)
      }
    },
    shouldResolveCollisions: true,
  })

  // Handle resize end
  const handleResizeEnd = createOperationHandler({
    operationType: 'end',
    gridAction: (event: {
      id: number
      w: number
      h: number
      resizeComplete: boolean
    }) => {
      if (event.resizeComplete) {
        const currentItem = get(gridStore).find(item => item.id === event.id)
        if (currentItem) {
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
          const constrainedW = Math.max(minWidth, event.w)
          const constrainedH = Math.max(minHeight, event.h)

          gridStore.updateItemSize(event.id, constrainedW, constrainedH, false)
        }
      }
    },
    shouldResolveCollisions: true,
  })

  // --- Simple action handlers ---

  // Handle item removal
  const handleItemRemove = createOperationHandler({
    gridAction: (event: { id: number }) => {
      gridStore.removeItem(event.id)
    },
  })

  // Handle item duplication
  const handleItemDuplicate = createOperationHandler({
    gridAction: (event: { id: number }) => {
      const itemToDuplicate = get(gridStore).find(item => item.id === event.id)
      if (itemToDuplicate) {
        gridStore.duplicateItem(itemToDuplicate)
      }
    },
  })

  // Handle toolbar actions
  const handleToolbarAction = (event: { id: string; vizType?: string }) => {
    const { id, vizType } = event

    if (id === 'add-visualization' && vizType) {
      // Add the new visualization at the first available position
      // instead of automatically placing it below all existing items
      gridStore.addItem(vizType)
    } else if (id === 'toggle-fullscreen') {
      // Delegate fullscreen toggle to the toolbar
      // The toolbar component will handle fullscreen functionality itself
    }
  }

  // --- Workspace panning handlers ---

  // Handle panning start when clicking on the workspace background
  const handleWorkspacePanStart = (event: MouseEvent | TouchEvent) => {
    // Handle both mouse and touch events
    const isTouchEvent = 'touches' in event

    // For mouse events, only handle primary button
    if (!isTouchEvent && (event as MouseEvent).button !== 0) return

    // Get the target element
    const targetEl = event.target as HTMLElement

    // Only handle clicks/touches on the workspace background, not on grid items
    if (
      targetEl.closest('.grid-item') ||
      targetEl.closest('.grid-item-content')
    )
      return

    // Prevent default to avoid text selection during panning
    event.preventDefault()

    // Set panning state
    isPanning.set(true)

    // Store initial position (handle both mouse and touch)
    if (isTouchEvent) {
      const touch = (event as TouchEvent).touches[0]
      lastPanX = touch.clientX
      lastPanY = touch.clientY
    } else {
      lastPanX = (event as MouseEvent).clientX
      lastPanY = (event as MouseEvent).clientY
    }

    // Set cursor directly for immediate feedback (mouse only)
    document.body.style.cursor = 'grabbing'
    if (workspaceContainer) {
      workspaceContainer.style.cursor = 'grabbing'
    }

    // Add appropriate event listeners based on event type
    if (isTouchEvent) {
      document.addEventListener('touchmove', handleWorkspacePanMove, {
        passive: false,
      })
      document.addEventListener('touchend', handleWorkspacePanEnd)
      document.addEventListener('touchcancel', handleWorkspacePanEnd)
    } else {
      document.addEventListener('mousemove', handleWorkspacePanMove)
      document.addEventListener('mouseup', handleWorkspacePanEnd)
    }
  }

  // Improved panning with smoothing and reduced sensitivity - NOW THROTTLED by RAF
  const handleWorkspacePanMove = throttleByRaf(
    (event: MouseEvent | TouchEvent) => {
      if (!get(isPanning) || !workspaceContainer) return

      // Prevent default for touch events to stop scrolling
      if ('touches' in event) {
        event.preventDefault()
      }

      // Get current position based on event type
      const isTouchEvent = 'touches' in event
      let currentX: number, currentY: number

      if (isTouchEvent) {
        const touch = (event as TouchEvent).touches[0]
        currentX = touch.clientX
        currentY = touch.clientY
      } else {
        currentX = (event as MouseEvent).clientX
        currentY = (event as MouseEvent).clientY
      }

      // Calculate raw delta
      const rawDeltaX = currentX - lastPanX
      const rawDeltaY = currentY - lastPanY

      // Apply damping factor to reduce sensitivity and smooth movement
      // Lower values make movement smoother but less responsive
      const dampingFactor = 0.6

      // Apply damping to create smoother motion
      const deltaX = rawDeltaX * dampingFactor
      const deltaY = rawDeltaY * dampingFactor

      // Update the last position for next calculation
      lastPanX = currentX
      lastPanY = currentY

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
  )

  // Handle panning end
  const handleWorkspacePanEnd = (event?: MouseEvent | TouchEvent) => {
    // Reset panning state
    isPanning.set(false)

    // Reset cursor styles
    document.body.style.cursor = ''
    if (workspaceContainer) {
      workspaceContainer.style.cursor = 'grab'
    }

    // Remove all event listeners
    document.removeEventListener('mousemove', handleWorkspacePanMove)
    document.removeEventListener('mouseup', handleWorkspacePanEnd)
    document.removeEventListener('touchmove', handleWorkspacePanMove)
    document.removeEventListener('touchend', handleWorkspacePanEnd)
    document.removeEventListener('touchcancel', handleWorkspacePanEnd)
  }

  // When the processing state changes, update the grid and loading state
  $effect(() => {
    if ($processingFileStateStore === 'done') {
      isLoading.set(false)
      // Reset by providing initial data to the store's set method
      // Note: The store doesn't have a reset method that accepts initial data directly.
      // We might need to adjust the store or handle reset differently.
      // For now, let's recreate the store or set the parsed initial items.
      // const defaultItems = createDefaultGridStateData().map(data =>
      //   gridStore.addItem(data.type, data) // This adds items one by one, might not be ideal reset
      // );
      // A better approach might be needed for a clean reset that uses the initial data pattern.
      // Option 1: Enhance gridStore.set to accept initial data.
      // Option 2: Re-initialize the gridStore (might be complex with reactivity).
      // Let's stick to clearing and adding for now, but note this could be improved.
      gridStore.reset(createDefaultGridStateData())
      processingFileStateStore.set('idle')
    } else if ($processingFileStateStore === 'processing') {
      isLoading.set(true)
      gridStore.reset([]) // Reset to empty state
    } else if ($processingFileStateStore === 'fail') {
      isLoading.set(false)
      gridStore.reset([]) // Reset to empty state
    }
  })

  // Note: Previously, we would add grid items for both empty and loading states.
  // Now we maintain a truly empty grid and display dedicated indicator components
  // when appropriate. This provides a more integrated and visually appealing user
  // experience without artificially creating grid items.

  // Make constants available as CSS variables
  const styleProps = `--min-workspace-height: ${MIN_WORKSPACE_HEIGHT}px; --grid-container-min-height: ${MIN_WORKSPACE_HEIGHT - 100}px;`
</script>

<div class="workspace-wrapper" style={styleProps}>
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

  <!-- Bind the workspace container and add mouse/touch events for panning -->
  <div
    class="workspace-container"
    style="height: {$gridHeight}px;"
    bind:this={workspaceContainer}
    on:mousedown={handleWorkspacePanStart}
    on:touchstart={handleWorkspacePanStart}
    class:is-panning={$isPanning}
  >
    <!-- Scrollable content layer with background pattern -->
    <div class="grid-container" style="width: {$gridWidth}px;">
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
                  settingsChange={(newSettings: Partial<AllGridTypes>) => {
                    gridStore.updateSettings({
                      ...item,
                      ...newSettings,
                    } as AllGridTypes)
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
    min-height: var(--min-workspace-height); /* Minimum height */
    display: grid;
    border: 1px solid #8888889c;
    grid-template-columns: 48px 1fr;
  }

  .workspace-container {
    box-sizing: border-box;
    position: relative;
    width: 100%;
    z-index: 1;
    transition: height 0.3s ease-out;
    overflow-x: auto; /* Allow horizontal scrolling */
    overflow-y: hidden; /* Prevent vertical scrolling */
    min-height: var(--min-workspace-height); /* Ensure minimum height */
    padding: 35px; /* Consistent padding throughout */
    /* Performance optimizations */
    will-change: height;
    border-left: 1px solid #88888862;
    transform: translateZ(0);
    /* Base cursor for empty areas */
    cursor: grab;
    /* Dynamic background pattern */
    background-color: var(--c-darkwhite);
    background-image: radial-gradient(
      circle,
      var(--c-grey) 2px,
      transparent 2px
    );
    background-size: 50px 50px;
    background-position: 5px 5px;
    background-attachment: local; /* Key property to make pattern scroll with content */
  }

  /* Cursor styling for panning */
  .workspace-container.is-panning {
    cursor: grabbing;
  }

  .grid-container {
    position: relative;
    width: 100%;
    min-height: var(--grid-container-min-height); /* Adjusted min height */
    background-color: transparent;
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
