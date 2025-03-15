<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte'
  import type { GridItemPosition, GridConfig } from '$lib/stores/gridStore'
  import { writable, derived } from 'svelte/store'

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
    dragend: {
      id: number
      x: number
      y: number
      w: number
      h: number
      dragComplete: boolean
    }
    heightChange: number // Event to inform parent of height changes
  }>()

  // Local writable store for grid positions
  const positionsStore = writable<GridItemPosition[]>(items)

  // Update positions store when external items change
  $: positionsStore.set(items)

  // Reactive grid height calculation
  $: gridConfig = { cellSize, gap, minWidth, minHeight }
  $: gridHeight = calculateGridHeight($positionsStore)
  $: dispatch('heightChange', gridHeight)

  // Calculate grid height based on item positions
  function calculateGridHeight(positions: GridItemPosition[]): number {
    // Get the max grid unit
    let maxY = 0
    for (const item of positions) {
      maxY = Math.max(maxY, item.y + item.h)
    }

    // Convert to pixels and add padding
    return Math.max(
      200, // Minimum height
      maxY * (cellSize.height + gap) + gap + 40 // Add some padding
    )
  }
</script>

<div
  class="grid-container"
  style="height: {gridHeight}px;"
  aria-label="Grid container"
  role="figure"
  on:move={event => {
    const { id, x, y, w, h } = event.detail
    dispatch('move', { id, x, y, w, h })
  }}
  on:resize={event => {
    const { id, x, y, w, h } = event.detail
    dispatch('resize', { id, x, y, w, h })
  }}
  on:dragend={event => {
    const { id, x, y, w, h, dragComplete } = event.detail
    dispatch('dragend', { id, x, y, w, h, dragComplete })
  }}
>
  <slot />
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
