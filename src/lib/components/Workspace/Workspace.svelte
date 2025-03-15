<script lang="ts">
  import EmptyPlot from '$lib/components/Plot/EmptyPlot/EmptyPlot.svelte'
  import ScarfPlot from '$lib/components/Plot/ScarfPlot/ScarfPlot.svelte'
  import LoadPlot from '$lib/components/Plot/LoadPlot/LoadPlot.svelte'
  import GridItem from '$lib/components/Workspace/WorkspaceItem.svelte'
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
    getDefaultWidth: () => number
  }

  // Visualization registry - a map of all available visualization types
  const visualizationRegistry: Record<string, VisualizationConfig> = {
    scarf: {
      name: 'Scarf Plot',
      component: ScarfPlot,
      headerComponent: ScarfPlotHeader,
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
      getDefaultWidth: () => 20,
    },
    empty: {
      name: 'Empty Plot',
      component: EmptyPlot,
      getDefaultConfig: () => ({
        min: { w: 14, h: 3 },
      }),
      getDefaultHeight: () => 5,
      getDefaultWidth: () => 14,
    },
    load: {
      name: 'Loading...',
      component: LoadPlot,
      getDefaultConfig: () => ({
        min: { w: 14, h: 3 },
      }),
      getDefaultHeight: () => 5,
      getDefaultWidth: () => 14,
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

    // Get default dimensions from config
    const defaultWidth = config.getDefaultWidth()
    const defaultHeight = config.getDefaultHeight(options.stimulusId)

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

  // Ensure there's always at least one item in the grid store
  const ensureGridContent = () => {
    if ($gridStore.length === 0) {
      if ($processingFileStateStore === 'processing') {
        // Show loading plot when processing
        gridStore.addItem(
          createGridItem('load', {
            id: -1,
            x: 0,
            y: 0,
            resizable: false,
            draggable: false,
          })
        )
      } else if ($processingFileStateStore === 'fail') {
        // Show empty plot on failure
        gridStore.addItem(
          createGridItem('empty', {
            id: -1,
            x: 0,
            y: 0,
            resizable: false,
            draggable: false,
          })
        )
      } else {
        // Default empty state
        gridStore.addItem(
          createGridItem('empty', {
            id: -1,
            x: 0,
            y: 0,
            resizable: false,
            draggable: false,
          })
        )
      }
    }
  }

  // Generate the default grid state with a centered scarf plot
  const createDefaultGridState = (): AllGridTypes[] => {
    return [
      createGridItem('scarf', {
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
  const gridHeight = derived(positions, $positions => {
    // Get the max grid unit
    const maxY =
      $positions.length > 0
        ? Math.max(...$positions.map(item => item.y + item.h))
        : 0

    // Convert to pixels and add padding
    return Math.max(
      300, // Minimum height
      maxY * (gridConfig.cellSize.height + gridConfig.gap) + gridConfig.gap + 40 // Add some padding
    )
  })

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

  // Handle item movement
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
    // Update position in store - during drag, don't check for collisions
    gridStore.updateItemPosition(id, x, y, false)
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
    }, 50)
  }

  // When the processing state changes, update the grid
  $: if ($processingFileStateStore === 'done') {
    enhancedGridStore.resetGrid(createDefaultGridState())
    processingFileStateStore.set('idle')
  } else if ($processingFileStateStore === 'processing') {
    enhancedGridStore.resetGrid([
      createGridItem('load', {
        id: -1,
        x: 0,
        y: 0,
        resizable: false,
        draggable: false,
      }),
    ])
  } else if ($processingFileStateStore === 'fail') {
    enhancedGridStore.resetGrid([
      createGridItem('empty', {
        id: -1,
        x: 0,
        y: 0,
        resizable: false,
        draggable: false,
      }),
    ])
  }

  // Ensure there's always at least one item in the grid
  $: if ($gridStore.length === 0) {
    ensureGridContent()
  }
</script>

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
          on:move={handleItemMove}
          on:resize={handleItemResize}
          on:dragend={handleDragEnd}
        >
          <div slot="header">
            {#if visConfig.headerComponent}
              <svelte:component
                this={visConfig.headerComponent}
                bind:settings={item}
              />
            {/if}
          </div>

          <div slot="body">
            <svelte:component this={visConfig.component} settings={item} />
          </div>
        </GridItem>
      </div>
    {/each}
  </div>
</div>

<style>
  .workspace-container {
    position: relative;
    width: 100%;
    background-color: var(--c-darkwhite);
    background-image: linear-gradient(var(--c-lightgrey) 1px, transparent 1px),
      linear-gradient(90deg, var(--c-lightgrey) 1px, transparent 1px);
    background-size: 50px 50px;
    background-position: -21px -21px;
    box-shadow: inset 0 2px 10px rgb(0 0 0 / 15%);
    z-index: 1;
    transition: height 0.3s ease-out;
    overflow-x: auto; /* Allow horizontal scrolling */
    overflow-y: hidden; /* Prevent vertical scrolling */
    min-height: 300px; /* Ensure minimum height for small grids */
    padding: 25px; /* Consistent padding throughout */
  }

  .grid-container {
    position: relative;
    width: 100%;
    min-height: 200px;
    background-color: transparent;
    transition: height 0.3s ease-out;
    overflow-x: visible; /* Allow content to flow naturally */
    overflow-y: visible; /* Allow content to expand the container */
  }
</style>
