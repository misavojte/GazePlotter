<script lang="ts">
  import ScarfPlot from '$lib/components/Plot/ScarfPlot/ScarfPlot.svelte'
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
  import { onMount } from 'svelte'
  import ScarfPlotHeader from '$lib/components/Plot/ScarfPlot/ScarfPlotHeader/ScarfPlotHeader.svelte'
  import {
    createGridStore,
    type GridItemPosition,
    type GridConfig,
  } from '$lib/stores/gridStore'
  import AOITransitionMatrixPlot from '$lib/components/Plot/AOITransitionMatrixPlot/AOITransitionMatrixPlot.svelte'
  import AOITransitionMatrixHeader from '$lib/components/Plot/AOITransitionMatrixPlot/AOITransitionMatrixHeader/AOITransitionMatrixHeader.svelte'
  import {
    getTransitionMatrixHeight,
    getTransitionMatrixWidth,
  } from '$lib/utils/aoiTransitionMatrixTransformations'

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

  // Import visualization components and headers
  import type { ComponentType, SvelteComponent } from 'svelte'

  // Define a type for visualization registry entries
  type VisualizationConfig = {
    name: string
    component: ComponentType<SvelteComponent>
    headerComponent?: ComponentType<SvelteComponent>
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
        params?: { stimulusId?: number; groupId?: number } = {}
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
    aoiTransitionMatrix: {
      name: 'AOI Transition Matrix',
      component: AOITransitionMatrixPlot,
      getDefaultConfig: (
        params?: { stimulusId?: number; groupId?: number } = {}
      ) => ({
        stimulusId: params.stimulusId ?? 0,
        groupId: params.groupId ?? -1,
        min: { w: 4, h: 4 },
      }),
      getDefaultHeight: (stimulusId = 0) =>
        getTransitionMatrixHeight(stimulusId),
      getDefaultWidth: (stimulusId = 0) => getTransitionMatrixWidth(stimulusId),
    },
  }

  // Helper function to get visualization config
  const getVisualizationConfig = (type: string): VisualizationConfig => {
    return visualizationRegistry[type] || visualizationRegistry['empty']
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
      createGridItem('aoiTransitionMatrix', {
        x: 0, // Always start at x=0
        y: 0,
      }),
    ]
  }

  // ---------------------------------------------------
  // Configuration and state
  // ---------------------------------------------------

  // Configuration for grid cells
  const gridConfig: GridConfig = {
    cellSize: { width: 40, height: 40 },
    gap: 10,
    minWidth: 14,
    minHeight: 3,
  }

  const initialItems: AllGridTypes[] = [
    createGridItem('scarf', {
      x: 0, // Always start at x=0
      y: 0,
    }),
  ]

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

  // Reactive grid height calculation
  const gridHeight = derived(
    [positions, isEmpty, isLoading, temporaryDragHeight],
    ([$positions, $isEmpty, $isLoading, $temporaryDragHeight]) => {
      // If empty or loading, use fixed height for better performance
      if ($isEmpty || $isLoading) {
        return 500 // Fixed height for empty/loading state
      }

      // If we have a temporary drag height, use it to ensure the workspace extends during drag
      if ($temporaryDragHeight !== null) {
        return $temporaryDragHeight
      }

      // Only calculate max height when we have items
      const maxY =
        $positions.length > 0
          ? Math.max(...$positions.map(item => item.y + item.h))
          : 0

      // Convert to pixels and add padding
      return Math.max(
        300, // Minimum height
        maxY * (gridConfig.cellSize.height + gridConfig.gap) +
          gridConfig.gap +
          90 // Add padding
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
  const handleItemPreviewMove = (
    event: CustomEvent<{
      id: number
      previewX: number
      previewY: number
      currentX: number
      currentY: number
      w: number
      h: number
    }>
  ) => {
    // During drag preview, we don't update the actual position in the store
    // We can still check for collisions, etc. if needed, but we don't
    // modify the grid store
    const { id, previewX, previewY } = event.detail

    // For now, we don't need to do anything here except handle the event
    // This avoids updating the actual grid item during drag
  }

  // Handle actual item movement (only at the end of drag)
  const handleItemMove = (
    event: CustomEvent<{
      id: number
      x: number
      y: number
      w: number
      h: number
    }>
  ) => {
    const { id, x, y, w, h } = event.detail
    // Update position in store - when drag is complete
    gridStore.updateItemPosition(id, x, y, false)
  }

  // Handle drag start - set global dragging state
  const handleDragStart = (
    event: CustomEvent<{
      id: number
      x: number
      y: number
      w: number
      h: number
    }>
  ) => {
    const { id } = event.detail
    isDragging.set(true)
    draggedItemId.set(id)
  }

  // Handle drag end - now we resolve collisions
  const handleDragEnd = (
    event: CustomEvent<{
      id: number
      x: number
      y: number
      w: number
      h: number
      dragComplete: boolean
    }>
  ) => {
    const { id, x, y, dragComplete } = event.detail

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

  // Handle dynamic height adjustment during drag operations
  const handleDragHeightUpdate = (
    event: CustomEvent<{
      id: number
      y: number
      h: number
      bottomEdge: number
    }>
  ) => {
    const { bottomEdge } = event.detail

    // Calculate the required height based on the bottom edge of the dragged item
    const requiredHeight = Math.max(
      300, // Minimum height
      bottomEdge * (gridConfig.cellSize.height + gridConfig.gap) +
        gridConfig.gap +
        90 // Add padding
    )

    // Update the temporary drag height
    temporaryDragHeight.set(requiredHeight)
  }

  // Handle grid item resizing
  const handleItemResize = (
    event: CustomEvent<{
      id: number
      x: number
      y: number
      w: number
      h: number
    }>
  ) => {
    const { id, w, h } = event.detail

    // First update size without collision resolution
    gridStore.updateItemSize(id, w, h, false)

    // Then resolve collisions with a slight delay for better visual feedback
    setTimeout(() => {
      // Use the store's method to resolve collisions for this item
      gridStore.resolveItemPositionCollisions(id)
      // Reset temporary drag height after resize is complete
      temporaryDragHeight.set(null)
    }, 50)
  }

  // Handle resize end - clean up temporary height
  const handleResizeEnd = () => {
    // Reset temporary height after resize is complete
    temporaryDragHeight.set(null)
  }

  // Handle item removal
  const handleItemRemove = (event: CustomEvent<{ id: number }>) => {
    const { id } = event.detail
    gridStore.removeItem(id)
  }

  // Handle item duplication
  const handleItemDuplicate = (event: CustomEvent<{ id: number }>) => {
    const { id } = event.detail
    // Find the item to duplicate
    const itemToDuplicate = get(gridStore).find(item => item.id === id)
    if (itemToDuplicate) {
      // Use the duplicate method from the grid store
      gridStore.duplicateItem(itemToDuplicate)
    }
  }

  // Handle toolbar actions
  const handleToolbarAction = (
    event: CustomEvent<{ id: string; vizType?: string; event: MouseEvent }>
  ) => {
    const { id, vizType } = event.detail

    if (id === 'add-visualization' && vizType) {
      // Add the new visualization
      enhancedGridStore.addItem(vizType, {
        x: 0, // You might want to calculate a better position
        y: get(gridStore).length, // Place it below existing items
      })
    }
  }

  // When the processing state changes, update the grid and loading state
  $: if ($processingFileStateStore === 'done') {
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

  // Note: Previously, we would add grid items for both empty and loading states.
  // Now we maintain a truly empty grid and display dedicated indicator components
  // when appropriate. This provides a more integrated and visually appealing user
  // experience without artificially creating grid items.
</script>

<div class="workspace-wrapper">
  <!-- Update toolbar, removing drag-related props -->
  <WorkspaceToolbar on:action={handleToolbarAction} />

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
            resizable={item.resizable !== false}
            draggable={item.draggable !== false}
            title={visConfig.name}
            on:previewmove={handleItemPreviewMove}
            on:move={handleItemMove}
            on:resize={handleItemResize}
            on:resizeend={handleResizeEnd}
            on:dragstart={handleDragStart}
            on:dragend={handleDragEnd}
            on:drag-height-update={handleDragHeightUpdate}
            on:remove={handleItemRemove}
            on:duplicate={handleItemDuplicate}
          >
            <div slot="body">
              <svelte:component this={visConfig.component} settings={item} />
            </div>
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
    background-image: linear-gradient(var(--c-lightgrey) 1px, transparent 1px),
      linear-gradient(90deg, var(--c-lightgrey) 1px, transparent 1px);
    background-size: 50px 50px;
    background-position: -21px -21px;
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
