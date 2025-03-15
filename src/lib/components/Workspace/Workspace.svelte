<script lang="ts">
  import EmptyPlot from '$lib/components/Plot/EmptyPlot/EmptyPlot.svelte'
  import ScarfPlot from '$lib/components/Plot/ScarfPlot/ScarfPlot.svelte'
  import LoadPlot from '$lib/components/Plot/LoadPlot/LoadPlot.svelte'
  import Grid from '$lib/components/Grid/Grid.svelte'
  import GridItem from '$lib/components/Grid/GridItem.svelte'
  import { fade } from 'svelte/transition'
  import { setContext } from 'svelte'
  import { writable, get } from 'svelte/store'
  import {
    createGridSystem,
    type GridItemPosition,
  } from '$lib/components/Grid/GridSystem'
  import type { AllGridTypes } from '$lib/type/gridType'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore'
  import { getScarfGridHeightFromCurrentData } from '$lib/services/scarfServices'
  import { onMount } from 'svelte'

  // Configuration for grid cells
  const cellSize = { width: 40, height: 40 }
  const gap = 10
  const minWidth = 14
  const minHeight = 3

  // Create a store to hold grid items
  const gridStore = writable<AllGridTypes[]>([])

  // Add the required functions to match the expected gridStore interface
  const enhancedGridStore = {
    subscribe: gridStore.subscribe,
    set: gridStore.set,
    update: gridStore.update,

    // Add the missing updateSettings function that ScarfPlotSelectStimulus is looking for
    updateSettings: (settings: AllGridTypes) => {
      gridStore.update(items =>
        items.map(item => {
          if (item.id === settings.id) {
            return { ...item, ...settings }
          }
          return item
        })
      )

      // Also update the grid system for layout
      const gridItems = convertToGridItems([settings])
      const item = gridItems[0]

      // If height changes, update the grid item size to match
      const currentPositions = get(positions)
      const currentItem = currentPositions.find(p => p.id === item.id)
      if (currentItem && currentItem.h !== item.h) {
        system.updateItemSize(item.id, item.w, item.h, true)
      }
    },

    // Add other functions from the original gridStore
    removeItem: (id: number) => {
      gridStore.update(items => items.filter(item => item.id !== id))
      if (get(gridStore).length === 0) {
        gridStore.set([])
      }

      // Also remove from grid system
      system.removeItem(id)
    },

    duplicateItem: (item: AllGridTypes) => {
      // generate new, unique id
      const newId = Date.now() + Math.floor(Math.random() * 1000)
      const newItem = { ...item, id: newId }

      // Get max grid width based on the workspace width
      const maxGridWidth = width
        ? Math.floor(width / (cellSize.width + gap))
        : 100

      // Find a smart position for the duplicate using the new method
      const newPosition = system.findDuplicationPosition(
        item.x,
        item.y,
        item.w,
        item.h,
        maxGridWidth
      )

      // Final safety check: Make sure we're not stacking items
      // This is a belt-and-suspenders approach to absolutely prevent stacking
      const currentItems = get(positions)
      let movedDown = false

      for (const existingItem of currentItems) {
        // Check if the new position would overlap with any existing item
        if (
          newPosition.x < existingItem.x + existingItem.w &&
          newPosition.x + newItem.w > existingItem.x &&
          newPosition.y < existingItem.y + existingItem.h &&
          newPosition.y + newItem.h > existingItem.y
        ) {
          // If overlap detected, find another position by shifting down
          newPosition.y = Math.max(...currentItems.map(i => i.y + i.h)) + 1
          movedDown = true
          break
        }
      }

      // Create the grid item first
      const gridItem = {
        id: newId,
        x: newPosition.x,
        y: newPosition.y,
        w: newItem.w,
        h: newItem.h,
      }

      // CRITICAL: Explicitly occupy the grid matrix BEFORE updating the stores
      // This ensures subsequent duplications will see this item and avoid stacking
      system.occupyItem(
        newId,
        newPosition.x,
        newPosition.y,
        newItem.w,
        newItem.h
      )

      // Then update the stores
      gridStore.update(items =>
        items.concat({
          ...newItem,
          x: newPosition.x,
          y: newPosition.y,
        })
      )

      // Update positions store last
      positions.update(pos => [...pos, gridItem])

      // Critical: Update the grid height calculation after adding a new item
      // This ensures the container expands when items are added to a new row at the bottom
      heightBasedOnGrid = system.getGridHeight()
    },
  }

  setContext('gridStore', enhancedGridStore)

  // Initialize the grid system with configuration
  const { system, positions } = createGridSystem({
    cellSize,
    gap,
    minWidth,
    minHeight,
  })

  // Track width for centered layout
  let width: number | null = null
  let heightBasedOnGrid = 615

  // Calculate the center position for the initial grid item
  const findCenterX = (width: number | null) => {
    if (!width) return 0
    return Math.max(0, Math.floor((width - 1190) / 2 / 40))
  }

  // Convert AllGridTypes to simple GridItemPosition
  const convertToGridItems = (items: AllGridTypes[]): GridItemPosition[] => {
    return items.map(item => ({
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }))
  }

  // Generate the default grid state with a centered scarf plot
  const createDefaultGridState = (): AllGridTypes[] => {
    return [
      {
        id: 0,
        x: findCenterX(width),
        y: 0,
        w: 20,
        h: getScarfGridHeightFromCurrentData(0, false, -1),
        min: { w: 14, h: 3 },
        type: 'scarf',
        stimulusId: 0,
        groupId: -1,
        zoomLevel: 0,
        timeline: 'absolute',
        absoluteGeneralLastVal: 0,
        absoluteStimuliLastVal: [],
        ordinalGeneralLastVal: 0,
        ordinalStimuliLastVal: [],
        dynamicAOI: true,
      },
    ]
  }

  // When the processing state changes to 'done', initialize the grid with default state
  $: if ($processingFileStateStore === 'done' && width) {
    const defaultState = createDefaultGridState()
    gridStore.set(defaultState)

    // Initialize the grid system with default items
    positions.set(convertToGridItems(defaultState))

    // Update the calculated height
    heightBasedOnGrid = system.getGridHeight()

    processingFileStateStore.set('idle')
  }

  // Handle grid item movement
  const handleItemMove = (event: CustomEvent) => {
    const { id, x, y } = event.detail

    // Update the grid system with collision detection
    system.updateItemPosition(id, x, y, true)

    // Get the updated positions after collision resolution
    const updatedPositions = get(positions)

    // Find the updated item
    const updatedItem = updatedPositions.find(item => item.id === id)
    if (!updatedItem) return

    // Update the gridStore with the new positions
    gridStore.update(items => {
      return items.map(item => {
        if (item.id === id) {
          return {
            ...item,
            x: updatedItem.x,
            y: updatedItem.y,
          }
        }

        // Also update any other items that might have been moved due to collision
        const positionItem = updatedPositions.find(pos => pos.id === item.id)
        if (
          positionItem &&
          (positionItem.x !== item.x || positionItem.y !== item.y)
        ) {
          return {
            ...item,
            x: positionItem.x,
            y: positionItem.y,
          }
        }

        return item
      })
    })

    // Update the calculated height
    heightBasedOnGrid = system.getGridHeight()
  }

  // Handle grid item resizing
  const handleItemResize = (event: CustomEvent) => {
    const { id, w, h } = event.detail

    // Update the grid system with collision detection
    system.updateItemSize(id, w, h, true)

    // Get the updated positions after collision resolution
    const updatedPositions = get(positions)

    // Find the updated item
    const updatedItem = updatedPositions.find(item => item.id === id)
    if (!updatedItem) return

    // Update the gridStore with the new dimensions
    gridStore.update(items => {
      return items.map(item => {
        if (item.id === id) {
          return {
            ...item,
            w: updatedItem.w,
            h: updatedItem.h,
          }
        }

        // Also update any other items that might have been moved due to collision
        const positionItem = updatedPositions.find(pos => pos.id === item.id)
        if (positionItem && positionItem.y !== item.y) {
          return {
            ...item,
            y: positionItem.y,
          }
        }

        return item
      })
    })

    // Update the calculated height
    heightBasedOnGrid = system.getGridHeight()
  }

  // Sync positions store with gridStore when the latter changes
  $: {
    if ($gridStore.length > 0) {
      const gridItems = convertToGridItems($gridStore)

      // Only update if there are actual changes to avoid loops
      const currentPositions = get(positions)
      const needsUpdate =
        gridItems.length !== currentPositions.length ||
        gridItems.some((item, index) => {
          const current = currentPositions[index]
          return (
            !current ||
            item.id !== current.id ||
            item.x !== current.x ||
            item.y !== current.y ||
            item.w !== current.w ||
            item.h !== current.h
          )
        })

      if (needsUpdate) {
        positions.set(gridItems)
        heightBasedOnGrid = system.getGridHeight()
      }
    }
  }

  // When the positions store changes, update the grid height
  $: {
    if ($positions && $positions.length > 0) {
      // Recalculate height whenever positions change
      heightBasedOnGrid = system.getGridHeight()
    }
  }

  onMount(() => {
    if (typeof window === 'undefined') return
    width = window.innerWidth
  })
</script>

<div class="workspace-container" style="height: {heightBasedOnGrid}px;">
  {#if width && ($processingFileStateStore === 'idle' || $processingFileStateStore === 'fail')}
    {#if $gridStore.length === 0 || $processingFileStateStore === 'fail'}
      <div class="empty-container">
        <EmptyPlot />
      </div>
    {:else}
      <Grid
        {cellSize}
        {gap}
        items={$positions}
        {minWidth}
        {minHeight}
        on:move={handleItemMove}
        on:resize={handleItemResize}
      >
        {#each $gridStore as item (item.id)}
          <div transition:fade={{ duration: 300 }}>
            <GridItem
              id={item.id}
              x={item.x}
              y={item.y}
              w={item.w}
              h={item.h}
              minW={item.min?.w || minWidth}
              minH={item.min?.h || minHeight}
              {cellSize}
              {gap}
              resizable={true}
              draggable={true}
              on:move={handleItemMove}
              on:resize={handleItemResize}
            >
              {#if item.type === 'scarf'}
                <ScarfPlot settings={item} />
              {/if}
              {#if item.type === 'empty'}
                <EmptyPlot />
              {/if}
            </GridItem>
          </div>
        {/each}
      </Grid>
    {/if}
  {:else}
    <div class="empty-container">
      <LoadPlot />
    </div>
  {/if}
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
    overflow-x: auto;
    overflow-y: hidden;
    min-height: 300px; /* Ensure minimum height for small grids */
    padding-bottom: 20px; /* Add some padding at the bottom */
  }

  .empty-container {
    max-width: 520px;
    margin: auto;
    margin-block: 8px;
    overflow: hidden;
    background-color: var(--c-white);
    border-radius: var(--rounded-lg) var(--rounded-lg) 0 0;
    box-shadow: 0 2px 10px rgb(0 0 0 / 15%);
  }
</style>
