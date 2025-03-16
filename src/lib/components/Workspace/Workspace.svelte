<script lang="ts">
  import ScarfPlot from '$lib/components/Plot/ScarfPlot/ScarfPlot.svelte'
  import AoiTransitionMatrixPlot from '$lib/components/Plot/AoiTransitionMatrixPlot/AoiTransitionMatrixPlot.svelte'
  import GridItem from '$lib/components/Workspace/WorkspaceItem.svelte'
  import WorkspaceIndicatorEmpty from '$lib/components/Workspace/WorkspaceIndicatorEmpty.svelte'
  import WorkspaceIndicatorLoading from '$lib/components/Workspace/WorkspaceIndicatorLoading.svelte'
  import WorkspaceToolbar from '$lib/components/Workspace/WorkspaceToolbar.svelte'
  import { fade } from 'svelte/transition'
  import { setContext } from 'svelte'
  import { writable, get, derived } from 'svelte/store'
  import type { AllGridTypes } from '$lib/type/gridType'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore'
  import { getScarfGridHeightFromCurrentData } from '$lib/services/scarfServices'
  import { createGridStore, type GridConfig } from '$lib/stores/gridStore'
  import {
    DEFAULT_GRID_CONFIG,
    calculateGridHeight,
    calculateRequiredWorkspaceHeight,
    calculateBottomEdgePosition,
  } from '$lib/utils/gridSizingUtils'

  // ---------------------------------------------------
  // State tracking
  // ---------------------------------------------------

  // Create a store to track if we're in loading state
  const isLoading = writable(false)

  // Create a store to track if an item is being dragged
  const isDragging = writable(false)
  const draggedItemId = writable<number | null>(null)

  // Store to track temporary height adjustment during drag operations
  const temporaryDragHeight = writable<number | null>(null)

  // ---------------------------------------------------
  // Visualization Registry - Central configuration for plot types
  // ---------------------------------------------------

  // Define a type for visualization registry entries
  type VisualizationConfig = {
    name: string
    component: any
    getDefaultConfig: (params?: any) => Partial<AllGridTypes>
    getDefaultHeight: (params?: any) => number
    getDefaultWidth: (params?: any) => number
  }

  // Visualization registry - a map of all available visualization types
  const visualizationRegistry: Record<string, VisualizationConfig> = {
    scarf: {
      name: 'Scarf Plot',
      component: ScarfPlot,
      getDefaultConfig: (
        params: { stimulusId?: number; groupId?: number } = {}
      ) => ({
        stimulusId: params.stimulusId ?? 0,
        groupId: params.groupId ?? -1,
        zoomLevel: 0,
        timeline: 'absolute',
        absoluteGeneralLastVal: 0,
        absoluteStimuliLastVal: [],
        ordinalGeneralLastVal: 0,
        ordinalStimuliLastVal: [],
        dynamicAOI: true,
        min: { w: 14, h: 3 },
      }),
      getDefaultHeight: (stimulusId = 0) =>
        getScarfGridHeightFromCurrentData(stimulusId, false, -1),
      getDefaultWidth: (stimulusId = 0) => 20,
    },
    AoiTransitionMatrix: {
      name: 'AOI Transition Matrix',
      component: AoiTransitionMatrixPlot,
      getDefaultConfig: (
        params: { stimulusId?: number; groupId?: number } = {}
      ) => ({
        stimulusId: params.stimulusId ?? 0,
        groupId: params.groupId ?? -1,
        min: { w: 11, h: 12 },
      }),
      getDefaultHeight: () => 12, // Default square size
      getDefaultWidth: () => 12,
    },
  }

  // Helper function to get visualization config
  const getVisualizationConfig = (type: string): VisualizationConfig => {
    return (
      visualizationRegistry[type] ||
      new Error(`Visualization config not found for type: ${type}`)
    )
  }

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

  // Handle item movement preview during drag (doesn't update actual position)
  const handleItemPreviewMove = (event: {
    id: number
    previewX: number
    previewY: number
    currentX: number
    currentY: number
    w: number
    h: number
  }) => {
    // During drag preview, we don't update the actual position in the store
    // We can still check for collisions, etc. if needed, but we don't
    // modify the grid store
    const { id, previewX, previewY } = event

    // For now, we don't need to do anything here except handle the event
    // This avoids updating the actual grid item during drag
  }

  // Handle actual item movement (only at the end of drag)
  const handleItemMove = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
  }) => {
    const { id, x, y } = event
    // Update position in store - when drag is complete
    gridStore.updateItemPosition(id, x, y, false)
  }

  // Handle drag start - set global dragging state
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

  // Handle drag end - now we resolve collisions
  const handleDragEnd = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
    dragComplete: boolean
  }) => {
    const { id, x, y, dragComplete } = event

    // Reset dragging state
    isDragging.set(false)
    draggedItemId.set(null)
    // Reset temporary drag height
    temporaryDragHeight.set(null)

    if (!dragComplete) return

    // First update position with the final coordinates
    gridStore.updateItemPosition(id, x, y, false)

    // Then explicitly resolve any collisions
    // This two-step approach ensures we get good visual feedback
    // First the item moves to where the user dropped it, then it resolves collisions
    setTimeout(() => {
      gridStore.resolveItemPositionCollisions(id)
    }, 50) // Short delay for better visual feedback
  }

  // Handle dynamic height adjustment during drag operations with safety check
  const handleDragHeightUpdate = (event: {
    id: number
    y: number
    h: number
    bottomEdge: number
  }) => {
    const { bottomEdge, id } = event
    const currentItems = get(gridStore)

    // Calculate the bottom edge of the item being moved
    const itemBottomEdge = calculateBottomEdgePosition(
      event.y,
      event.h,
      gridConfig
    )

    // Calculate the maximum bottom edge of all OTHER items (not the one being dragged)
    const otherItemsMaxBottom = Math.max(
      300, // Minimum fallback
      ...currentItems
        .filter(item => item.id !== id)
        .map(item => calculateBottomEdgePosition(item.y, item.h, gridConfig))
    )

    // Calculate required height - taking maximum of dragged item bottom edge and other items' max bottom edge
    const requiredHeight = Math.max(otherItemsMaxBottom, itemBottomEdge) + 90 // Add padding

    // Update the temporary drag height
    temporaryDragHeight.set(requiredHeight)
  }

  // Handle item resize preview with safety check
  const handleItemPreviewResize = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
    currentW: number
    currentH: number
  }) => {
    const { id, y, h } = event
    const currentItems = get(gridStore)

    // Calculate bottom edge position of the resizing item
    const itemBottomEdge = calculateBottomEdgePosition(y, h, gridConfig)

    // Calculate the maximum bottom edge of all OTHER items
    const otherItemsMaxBottom = Math.max(
      300, // Minimum fallback
      ...currentItems
        .filter(item => item.id !== id)
        .map(item => calculateBottomEdgePosition(item.y, item.h, gridConfig))
    )

    // Use the maximum of these values to ensure we don't shrink below what's needed
    const requiredHeight = Math.max(otherItemsMaxBottom, itemBottomEdge) + 90 // Add padding

    // Update the temporary height
    temporaryDragHeight.set(requiredHeight)
  }

  // Enhanced handleItemResize to ensure we respect other elements' space needs
  const handleItemResize = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
  }) => {
    const { id, w, h } = event
    const currentItems = get(gridStore)
    const currentItem = currentItems.find(item => item.id === id)

    if (!currentItem) return

    // Enforce minimum dimensions based on the item's type
    const minWidth = Math.max(
      gridConfig.minWidth,
      currentItem.min?.w || gridConfig.minWidth
    )
    const minHeight = Math.max(
      gridConfig.minHeight,
      currentItem.min?.h || gridConfig.minHeight
    )

    // Ensure we don't resize below minimum dimensions
    const constrainedW = Math.max(minWidth, w)
    const constrainedH = Math.max(minHeight, h)

    // Update size without collision resolution first
    gridStore.updateItemSize(id, constrainedW, constrainedH, false)

    // Then resolve collisions with a slight delay for better visual feedback
    setTimeout(() => {
      // Use the store's method to resolve collisions for this item
      gridStore.resolveItemPositionCollisions(id)
      // Reset temporary drag height after resize is complete
      temporaryDragHeight.set(null)
    }, 50)
  }

  // Handle resize end - clean up and resolve collisions
  const handleResizeEnd = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
    resizeComplete: boolean
  }) => {
    // Reset temporary height after resize is complete
    temporaryDragHeight.set(null)

    const { id, resizeComplete } = event

    if (!resizeComplete) return

    // Explicitly resolve any collisions
    setTimeout(() => {
      gridStore.resolveItemPositionCollisions(id)
    }, 50) // Short delay for better visual feedback
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
    }
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

  <div class="workspace-container" style="height: {$gridHeight}px;">
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
                  settingsChange={newSettings => {
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

    {#if $isDragging}
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
    background-color: var(--c-darkwhite);
    background-image: radial-gradient(
      circle,
      var(--c-grey) 2px,
      transparent 2px
    );
    background-size: 50px 50px;
    background-position: 5px 5px;
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
  }

  .grid-container {
    position: relative;
    width: 100%;
    min-height: 200px;
    background-color: transparent;
    transition: height 0.3s ease-out;
    overflow-x: visible; /* Allow content to flow naturally */
    overflow-y: visible; /* Allow content to expand the container */
    /* Prevent unnecessary repaints */
    will-change: contents;
    transform: translateZ(0);
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
