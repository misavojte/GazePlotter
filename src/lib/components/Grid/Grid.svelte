<script lang="ts">
  import { onMount } from 'svelte'
  import {
    createGridSystem,
    type GridConfig,
    type GridItemPosition,
  } from './GridSystem'
  import { createEventDispatcher } from 'svelte'
  import { writable, type Writable } from 'svelte/store'

  // Grid configuration
  export let cellSize = { width: 40, height: 40 }
  export let gap = 10
  export let items: GridItemPosition[] = []
  export let minWidth = 1
  export let minHeight = 1

  // Create event dispatcher
  const dispatch = createEventDispatcher()

  // Local writable store for grid positions
  let positionsStore: Writable<GridItemPosition[]> = writable([])
  let gridSystem: any // Will be properly initialized in onMount

  // Calculate the grid height for the container
  let gridHeight = 0

  // Create the grid system on mount
  onMount(() => {
    const config: GridConfig = {
      cellSize,
      gap,
      minWidth,
      minHeight,
    }

    // Initialize the grid system
    const gridSystemData = createGridSystem(config, items)
    gridSystem = gridSystemData.system
    positionsStore = gridSystemData.positions

    // Initialize positions
    positionsStore.set(items)

    // Subscribe to position changes for height updates
    const unsubscribe = positionsStore.subscribe(positions => {
      updateGridHeight()
    })

    // Update height initially
    updateGridHeight()

    // Clean up subscription
    return unsubscribe
  })

  // Sync items prop with positionsStore
  $: if (gridSystem && items) {
    positionsStore.set(items)
    updateGridHeight()
  }

  function updateGridHeight() {
    if (!gridSystem) return
    gridHeight = gridSystem.getGridHeight()
  }

  // Handle item movement
  function handleMove(id: number, x: number, y: number) {
    if (!gridSystem) return

    // Update the grid system with collision detection
    gridSystem.updateItemPosition(id, x, y, true)

    // Dispatch the event to parent components
    dispatch('move', { id, x, y })
  }

  // Handle item resizing
  function handleResize(id: number, w: number, h: number) {
    if (!gridSystem) return

    // Update the grid system with collision detection
    gridSystem.updateItemSize(id, w, h, true)

    // Dispatch the event to parent components
    dispatch('resize', { id, w, h })
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
    background-color: var(--c-darkwhite, #f5f5f5);
    background-image: linear-gradient(
        var(--c-lightgrey, #ddd) 1px,
        transparent 1px
      ),
      linear-gradient(90deg, var(--c-lightgrey, #ddd) 1px, transparent 1px);
    background-size: 50px 50px;
    background-position: -21px -21px;
    box-shadow: inset 0 2px 10px rgb(0 0 0 / 15%);
    padding: 25px;
    transition: height 0.3s ease-out;
    overflow-x: auto;
    overflow-y: hidden;
  }
</style>
