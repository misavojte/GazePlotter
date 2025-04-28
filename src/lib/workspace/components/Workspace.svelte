<script lang="ts">
  import {
    WorkspaceItem,
    WorkspaceIndicatorEmpty,
    WorkspaceIndicatorLoading,
    WorkspaceToolbar,
    processingFileStateStore,
    createGridStore,
    type GridConfig,
  } from '$lib/workspace'
  import { fade } from 'svelte/transition'
  import { setContext } from 'svelte'
  import { writable, get, derived } from 'svelte/store'
  import type { AllGridTypes } from '$lib/type/gridType'
  import { onDestroy } from 'svelte'
  import {
    DEFAULT_GRID_CONFIG,
    calculateGridHeight,
    calculateRequiredWorkspaceHeight,
    calculateBottomEdgePosition,
    calculateGridWidth,
    WORKSPACE_BOTTOM_PADDING,
    WORKSPACE_RIGHT_PADDING,
    MIN_WORKSPACE_HEIGHT,
    DEFAULT_WORKSPACE_WIDTH,
  } from '$lib/shared/utils/gridSizingUtils'
  import {
    visualizationRegistry,
    getVisualizationConfig,
  } from '$lib/const/vizRegistry'
  import { throttleByRaf } from '$lib/shared/utils/throttle'

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

  // Add state for auto-scrolling
  const isAutoScrolling = writable(false)
  const autoScrollDirection = writable({ x: 0, y: 0 })
  let autoScrollInterval: number | null = null
  const AUTO_SCROLL_AMOUNT = 5 // Number of grid cells to scroll by

  // Track current scroll speeds outside interval function to preserve momentum
  let currentSpeedX = 0
  let currentSpeedY = 0

  let workspaceContainer: HTMLElement | null = null

  if (workspaceContainer) {
    ;(workspaceContainer as HTMLElement).scrollLeft = 0
  }

  // Store to track temporary height adjustment during drag operations
  const temporaryDragHeight = writable<number | null>(null)
  const temporaryDragWidth = writable<number | null>(null)

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

        // End auto-scrolling if active
        endItemEdgeScroll()

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
      { type: 'TransitionMatrix', x: 20, y: 0, w: 11, h: 12 },
      { type: 'barPlot', x: 0, y: 12, w: 11, h: 12 },
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

  // Monitor auto-scrolling state changes
  $effect(() => {
    if ($isAutoScrolling) {
      console.log('Auto-scrolling active, direction:', $autoScrollDirection)
    }
  })

  // Clean up auto-scrolling on component destroy
  onDestroy(() => {
    endItemEdgeScroll()
  })

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

  // Handle edge detection for auto-scrolling
  const handleItemEdgeDetection = (event: {
    id: number
    itemBounds: {
      left: number
      right: number
      top: number
      bottom: number
    }
    viewportBounds: {
      left: number
      right: number
      top: number
      bottom: number
    }
  }) => {
    handleItemEdgeScroll(event)
  }

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
      // Stop any active auto-scrolling
      endItemEdgeScroll()
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
      // Stop any active auto-scrolling
      endItemEdgeScroll()
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
    } else if (id === 'reset-layout') {
      // Reset the workspace to the default grid state
      processingFileStateStore.set('done')
    }
  }

  // --- Workspace panning handlers ---

  // Handle panning start when clicking on the workspace background
  // NO TOUCH SUPPORT - This is intentional as this would clash with the native touch events which effectively pans the workspace
  const handleWorkspacePanStart = (event: MouseEvent) => {
    // For mouse events, only handle primary button
    if ((event as MouseEvent).button !== 0) return

    // Get the target element
    const targetEl = event.target as HTMLElement

    // Only handle clicks/touches on the workspace background, not on grid items
    if (
      targetEl.closest('.grid-item') ||
      targetEl.closest('.grid-item-content')
    )
      return

    // Prevent default to avoid text selection during panning
    // This is important as without it
    event.preventDefault()

    // Set panning state
    isPanning.set(true)

    // Store initial position (handle both mouse and touch)
    lastPanX = (event as MouseEvent).clientX
    lastPanY = (event as MouseEvent).clientY

    // Set cursor directly for immediate feedback (mouse only)
    document.body.style.cursor = 'grabbing'
    if (workspaceContainer) {
      workspaceContainer.style.cursor = 'grabbing'
    }

    // Add appropriate event listeners based on event type

    document.addEventListener('mousemove', handleWorkspacePanMove)
    document.addEventListener('mouseup', handleWorkspacePanEnd)
  }

  // Improved panning with smoothing and reduced sensitivity - NOW THROTTLED by RAF
  const handleWorkspacePanMove = throttleByRaf((event: MouseEvent) => {
    if (!get(isPanning) || !workspaceContainer) return

    // Get current position based on event type
    const isTouchEvent = 'touches' in event
    let currentX: number, currentY: number

    currentX = (event as MouseEvent).clientX
    currentY = (event as MouseEvent).clientY
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
      // Get current X scroll position and update it
      const currentScrollX = getWorkspaceScrollX()
      setWorkspaceScrollX(currentScrollX - deltaX)
    }

    // Apply vertical scrolling to the window with threshold
    if (Math.abs(deltaY) > 0.5) {
      // Get current Y scroll position and update it
      const currentScrollY = getWorkspaceScrollY()
      setWorkspaceScrollY(currentScrollY - deltaY)
    }
  })

  // Handle panning end
  const handleWorkspacePanEnd = (event?: MouseEvent | TouchEvent) => {
    // Reset panning state
    isPanning.set(false)

    // Reset cursor styles
    document.body.style.cursor = ''
    if (workspaceContainer) {
      workspaceContainer.style.cursor = 'grab'
    }

    // Stop any active auto-scrolling
    endItemEdgeScroll()

    // Remove all event listeners
    document.removeEventListener('mousemove', handleWorkspacePanMove)
    document.removeEventListener('mouseup', handleWorkspacePanEnd)
  }

  // Handle auto-scrolling when an item is dragged to the edge of the workspace
  const handleItemEdgeScroll = (event: {
    id: number
    itemBounds: {
      left: number
      right: number
      top: number
      bottom: number
    }
    viewportBounds: {
      left: number
      right: number
      top: number
      bottom: number
    }
  }) => {
    // if no workspace container, return
    // if already panning, return
    if (!workspaceContainer || $isPanning) return

    const { itemBounds } = event
    // Make edge threshold smaller
    const edgeThreshold = 25 // Reduced from 150 to 80 for smaller edge detection area

    // Get the actual viewport bounds
    const viewportBounds = {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    }

    // Check if we're at special sentinel values (used to force stop auto-scrolling)
    if (itemBounds.left > 999999 || itemBounds.right < -999999) {
      // This is our signal to stop auto-scrolling
      if (autoScrollInterval !== null) {
        clearInterval(autoScrollInterval)
        autoScrollInterval = null
        isAutoScrolling.set(false)
        autoScrollDirection.set({ x: 0, y: 0 })
        currentSpeedX = 0
        currentSpeedY = 0
      }
      return
    }

    // Calculate scroll direction based on item bounds relative to viewport
    let scrollX = 0
    let scrollY = 0

    // Check if we're moving to the right edge - only trigger if item is near right edge
    if (itemBounds.right >= viewportBounds.right - edgeThreshold) {
      // Need to scroll right
      scrollX = 1

      // Expand workspace width if needed
      const gridCellWidth = gridConfig.cellSize.width + gridConfig.gap
      temporaryDragWidth.set(
        (get(gridWidth) / gridCellWidth + AUTO_SCROLL_AMOUNT) * gridCellWidth
      )
    }
    // Check if we're moving to the left edge - only trigger if item is near left edge
    else if (itemBounds.left <= edgeThreshold) {
      // Need to scroll left (only if we can scroll left)
      if (getWorkspaceScrollX() > 0) {
        scrollX = -1
      }
    }

    // Check if we're moving to the bottom edge - only trigger if item is near bottom edge
    if (itemBounds.bottom >= viewportBounds.bottom - edgeThreshold) {
      // Need to scroll down
      scrollY = 1

      // Expand workspace height if needed
      const gridCellHeight = gridConfig.cellSize.height + gridConfig.gap
      temporaryDragHeight.set(
        (get(gridHeight) / gridCellHeight + AUTO_SCROLL_AMOUNT) * gridCellHeight
      )
    }
    // Check if we're moving to the top edge - only trigger if item is near top edge and we can scroll up
    else if (itemBounds.top <= edgeThreshold && getWorkspaceScrollY() > 0) {
      scrollY = -1
    }

    // Only continue if we need to scroll
    if (scrollX !== 0 || scrollY !== 0) {
      // Check if we're already scrolling
      const wasAlreadyScrolling = !!autoScrollInterval

      // Update scroll direction if different from current
      const currentDirection = get(autoScrollDirection)
      if (currentDirection.x !== scrollX || currentDirection.y !== scrollY) {
        autoScrollDirection.set({ x: scrollX, y: scrollY })
      }

      // Always set the flag to true
      isAutoScrolling.set(true)

      // Get current scroll positions
      let currentScrollX = getWorkspaceScrollX()
      let currentScrollY = getWorkspaceScrollY()

      // Config values - adjusted for smoother feel
      const maxSpeed = 14 // Lower maximum speed for smoother scrolling
      const initialSpeed = 0.5 // Start with a small initial speed
      const acceleration = 0.1 // Lower acceleration for smoother ramp-up
      const deceleration = 0.1 // Lower deceleration for smoother slow-down

      // Only create a new interval if we weren't already scrolling
      if (!wasAlreadyScrolling) {
        // Set a small initial speed in the direction of scrolling
        currentSpeedX = scrollX * initialSpeed
        currentSpeedY = scrollY * initialSpeed

        autoScrollInterval = setInterval(() => {
          // Get fresh direction values from the store
          const scrollDirection = get(autoScrollDirection)

          // Calculate new speeds with smooth acceleration
          if (scrollDirection.x !== 0) {
            // Get current scroll position for edge detection
            const currentX = getWorkspaceScrollX()
            let effectiveMaxSpeed = maxSpeed

            // Create much more dramatic edge slow-down effect
            if (scrollDirection.x < 0 && currentX < 150) {
              // Make slow-down effect much stronger with a cubic curve
              const normalizedDistance = currentX / 150 // 0 at edge, 1 at threshold
              // Use a more dramatic curve - this will create a more visible slowdown
              const easeOutFactor = Math.pow(normalizedDistance, 2) // Stronger curve
              // Apply a much more drastic speed reduction near edges
              effectiveMaxSpeed = maxSpeed * easeOutFactor
            }

            // Calculate target speed with the dramatic max speed reduction
            const targetSpeed = scrollDirection.x * effectiveMaxSpeed

            // Apply smooth acceleration toward target, but faster to feel responsive
            currentSpeedX =
              currentSpeedX + (targetSpeed - currentSpeedX) * acceleration // Higher acceleration
          } else {
            // Gradual deceleration when not scrolling this direction
            currentSpeedX =
              Math.abs(currentSpeedX) > 0.1
                ? currentSpeedX * (1 - deceleration)
                : 0
          }

          if (scrollDirection.y !== 0) {
            // Get current scroll position for edge detection
            const currentY = getWorkspaceScrollY()
            let effectiveMaxSpeed = maxSpeed

            // Create much more dramatic edge slow-down effect
            if (scrollDirection.y < 0 && currentY < 150) {
              // Make slow-down effect much stronger with a cubic curve
              const normalizedDistance = currentY / 150 // 0 at edge, 1 at threshold
              // Use a more dramatic curve - this will create a more visible slowdown
              const easeOutFactor = Math.pow(normalizedDistance, 2) // Stronger curve
              // Apply a much more drastic speed reduction near edges
              effectiveMaxSpeed = maxSpeed * easeOutFactor
            }

            // Calculate target speed with the dramatic max speed reduction
            const targetSpeed = scrollDirection.y * effectiveMaxSpeed

            // Apply smooth acceleration toward target, but faster to feel responsive
            currentSpeedY =
              currentSpeedY + (targetSpeed - currentSpeedY) * acceleration // Higher acceleration
          } else {
            // Gradual deceleration when not scrolling this direction
            currentSpeedY =
              Math.abs(currentSpeedY) > 0.1
                ? currentSpeedY * (1 - deceleration)
                : 0
          }

          // Apply the current speed to scroll positions
          if (Math.abs(currentSpeedX) > 0.1) {
            currentScrollX += currentSpeedX
            setWorkspaceScrollX(currentScrollX)
          }

          if (Math.abs(currentSpeedY) > 0.1) {
            currentScrollY += currentSpeedY
            setWorkspaceScrollY(currentScrollY)
          }

          // Stop the interval if we've slowed down enough
          if (Math.abs(currentSpeedX) < 0.1 && Math.abs(currentSpeedY) < 0.1) {
            if (autoScrollInterval !== null) {
              clearInterval(autoScrollInterval)
              autoScrollInterval = null
              isAutoScrolling.set(false)
              autoScrollDirection.set({ x: 0, y: 0 })
            }
          }
        }, 16) as unknown as number // ~60fps for smooth animation
      }
    } else if (autoScrollInterval !== null) {
      // We're no longer at an edge but interval is running - let it decelerate naturally
      // by setting direction to zero
      autoScrollDirection.set({ x: 0, y: 0 })
    }
  }

  // End auto-scrolling
  const endItemEdgeScroll = () => {
    if (autoScrollInterval !== null) {
      clearInterval(autoScrollInterval)
      autoScrollInterval = null
      isAutoScrolling.set(false)
      autoScrollDirection.set({ x: 0, y: 0 })
      currentSpeedX = 0
      currentSpeedY = 0
    }
  }

  // on change of processingFileStateStore, set isInitialLoad to false
  // dont use $effect, use a subscribe
  // only trigger if DIFFERS from previous state
  processingFileStateStore.subscribe(newState => {
    if (newState === 'done') {
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
      //gridStore.reset(createDefaultGridStateData())
      gridStore.reset([])
      createDefaultGridStateData().forEach(item => {
        gridStore.addItem(item.type, item)
      })
      processingFileStateStore.set('idle')
    } else if (newState === 'processing') {
      isLoading.set(true)
      gridStore.reset([]) // Reset to empty state
    } else if (newState === 'fail') {
      isLoading.set(false)
      gridStore.reset([]) // Reset to empty state
    }
  })

  const getNewTimestamp = () => {
    return Date.now()
  }

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
    onmousedown={handleWorkspacePanStart}
    role="none"
    class:is-panning={$isPanning}
  >
    <!-- Scrollable content layer with background pattern -->
    <div class="grid-container" style="width: {$gridWidth}px;">
      {#each $gridStore as item (item.id)}
        {@const visConfig = getVisualizationConfig(item.type)}
        <div transition:fade={{ duration: 300 }}>
          <WorkspaceItem
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
            onedgedetection={handleItemEdgeDetection}
          >
            {#snippet body()}
              <div class="grid-item-content">
                <visConfig.component
                  settings={item}
                  forceRedraw={() => {
                    gridStore.triggerRedraw()
                  }}
                  settingsChange={(newSettings: Partial<AllGridTypes>) => {
                    gridStore.updateSettings({
                      ...item,
                      ...newSettings,
                      redrawTimestamp: getNewTimestamp(),
                    } as AllGridTypes)
                  }}
                />
              </div>
            {/snippet}
          </WorkspaceItem>
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
    border: 1px solid #8888889c;
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
    padding-left: 85px;
    /* Performance optimizations */
    will-change: height;
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
