<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte'
  import {
    createGridSystem,
    type GridConfig,
    type GridItemPosition,
  } from './GridSystem'
  import { writable, type Writable, derived } from 'svelte/store'

  // Grid configuration
  export let cellSize = { width: 40, height: 40 }
  export let gap = 10
  export let items: GridItemPosition[] = []
  export let minWidth = 1
  export let minHeight = 1

  // Create event dispatcher
  const dispatch = createEventDispatcher<{
    move: { id: number; x: number; y: number; w: number; h: number }
    resize: { id: number; x: number; y: number; w: number; h: number }
    heightChange: number // New event to inform parent of height changes
  }>()

  // Local writable store for grid positions
  let positionsStore: Writable<GridItemPosition[]> = writable([])
  let gridSystem: ReturnType<typeof createGridSystem>['system']
  let gridHeight = 200 // Initialize with default value

  // Reactive grid height calculation
  $: gridConfig = { cellSize, gap, minWidth, minHeight }
  $: {
    gridHeight = calculateGridHeight($positionsStore)
    // Dispatch height change event whenever grid height changes
    if (gridSystem) {
      dispatch('heightChange', gridHeight)
    }
  }

  // Helper function for grid height
  function calculateGridHeight(positions: GridItemPosition[]): number {
    if (!gridSystem) return 200
    return gridSystem.getGridHeight()
  }

  // Create the grid system on mount
  onMount(() => {
    // Initialize the grid system
    const gridSystemData = createGridSystem(gridConfig, items)
    gridSystem = gridSystemData.system
    positionsStore = gridSystemData.positions

    // Initialize positions
    positionsStore.set(items)

    return () => {
      // Make sure we clean up any observers or event listeners
    }
  })

  // Sync items prop with positionsStore
  $: if (gridSystem && items) {
    positionsStore.set(items)
  }

  // Handle item movement
  function handleMove(id: number, x: number, y: number) {
    if (!gridSystem) return

    // Update the grid system with collision detection
    gridSystem.updateItemPosition(id, x, y, true)

    // Get updated item values
    const updatedItem = $positionsStore.find(item => item.id === id)
    if (!updatedItem) return

    // Dispatch the event to parent components
    dispatch('move', {
      id,
      x: updatedItem.x,
      y: updatedItem.y,
      w: updatedItem.w,
      h: updatedItem.h,
    })
  }

  // Handle item resizing
  function handleResize(id: number, w: number, h: number) {
    if (!gridSystem) return

    // Update the grid system with collision detection
    gridSystem.updateItemSize(id, w, h, true)

    // Get updated item values
    const updatedItem = $positionsStore.find(item => item.id === id)
    if (!updatedItem) return

    // Dispatch the event to parent components
    dispatch('resize', {
      id,
      x: updatedItem.x,
      y: updatedItem.y,
      w: updatedItem.w,
      h: updatedItem.h,
    })
  }
</script>

<div class="grid-container" style="height: {gridHeight}px;">
  <slot {handleMove} {handleResize} />
</div>

<style>
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
