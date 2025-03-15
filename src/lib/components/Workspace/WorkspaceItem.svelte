<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import type { GridItemPosition } from '$lib/stores/gridStore'

  // GridItem properties
  export let id: number
  export let x: number
  export let y: number
  export let w: number
  export let h: number
  export let minW: number = 1
  export let minH: number = 1
  export let cellSize = { width: 40, height: 40 }
  export let gap = 10
  export let resizable = true
  export let draggable = true
  export let title: string = ''

  // Track state for visual feedback
  let isDragging = false
  let isResizing = false
  let dragPosition = { x: 0, y: 0 }
  let showDragPlaceholder = false

  // DOM nodes for manipulation
  let headerNode: HTMLElement
  let bodyNode: HTMLElement
  let placeholderNode: HTMLElement
  let itemNode: HTMLElement

  // Calculate actual pixel dimensions and position
  $: itemWidth = w * cellSize.width + (w - 1) * gap
  $: itemHeight = h * cellSize.height + (h - 1) * gap
  $: itemX = x * (cellSize.width + gap)
  $: itemY = y * (cellSize.height + gap)

  // Style for the actual item (always at its real position)
  $: itemStyle = `
    transform: translate(${itemX}px, ${itemY}px);
    width: ${itemWidth}px;
    height: ${itemHeight}px;
  `

  // Style for the drag placeholder
  $: placeholderStyle = showDragPlaceholder
    ? `
    transform: translate(${dragPosition.x * (cellSize.width + gap)}px, ${dragPosition.y * (cellSize.height + gap)}px);
    width: ${itemWidth}px;
    height: ${itemHeight}px;
  `
    : ''

  // Svelte action for handling drag functionality
  function draggable_action(node: HTMLElement, options: { enabled: boolean }) {
    if (!options.enabled) return {}

    let startX: number
    let startY: number
    let startPosX: number
    let startPosY: number

    function handleMouseDown(event: MouseEvent) {
      // Only handle left-button clicks
      if (event.button !== 0) return

      // Start dragging
      isDragging = true
      startX = event.clientX
      startY = event.clientY
      startPosX = x
      startPosY = y

      // Initialize the drag position to the current position
      dragPosition = { x, y }
      showDragPlaceholder = true

      // Add semi-transparent highlight to the stationary item
      if (itemNode) {
        itemNode.classList.add('is-being-dragged')
      }

      // Dispatch drag start event
      dispatch('dragstart', { id, x, y, w, h })

      // Add drag tracking events
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)

      event.preventDefault()
    }

    function handleMouseMove(event: MouseEvent) {
      if (!isDragging) return

      // Calculate delta movement in pixels
      const deltaX = event.clientX - startX
      const deltaY = event.clientY - startY

      // Convert to grid units
      const gridDeltaX = Math.round(deltaX / (cellSize.width + gap))
      const gridDeltaY = Math.round(deltaY / (cellSize.height + gap))

      // Calculate new position for the placeholder
      const newX = Math.max(0, startPosX + gridDeltaX)
      const newY = Math.max(0, startPosY + gridDeltaY)

      // Only update the drag placeholder position, not the actual item
      dragPosition = { x: newX, y: newY }

      // Dispatch preview event instead of regular move - this should be handled differently by parent
      dispatch('previewmove', {
        id,
        previewX: newX,
        previewY: newY,
        currentX: x,
        currentY: y,
        w,
        h,
      })
    }

    function handleMouseUp() {
      if (!isDragging) return

      // Clean up visual effects
      showDragPlaceholder = false

      if (itemNode) {
        itemNode.classList.remove('is-being-dragged')
      }

      // Only now, at the end of drag, dispatch the actual move event with final position
      // This prevents the parent from updating the store during the drag
      dispatch('move', { id, x: dragPosition.x, y: dragPosition.y, w, h })

      // Dispatch drag end event
      dispatch('dragend', {
        id,
        x: dragPosition.x,
        y: dragPosition.y,
        w,
        h,
        dragComplete: true,
      })

      // Reset state
      isDragging = false

      // Clean up event listeners
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    // Add initial event listener
    node.addEventListener('mousedown', handleMouseDown)

    // Return destroy method to clean up
    return {
      destroy() {
        node.removeEventListener('mousedown', handleMouseDown)
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      },
      update(newOptions: { enabled: boolean }) {
        if (!newOptions.enabled) {
          node.removeEventListener('mousedown', handleMouseDown)
        } else if (!options.enabled) {
          node.addEventListener('mousedown', handleMouseDown)
        }
        options = newOptions
      },
    }
  }

  // Svelte action for handling resize functionality
  function resizable_action(node: HTMLElement, options: { enabled: boolean }) {
    if (!options.enabled) return {}

    let startX: number
    let startY: number
    let startW: number
    let startH: number

    function handleMouseDown(event: MouseEvent) {
      // Only handle left-button clicks
      if (event.button !== 0) return

      // Start resizing
      isResizing = true
      startX = event.clientX
      startY = event.clientY
      startW = w
      startH = h

      // Dispatch resize start event
      dispatch('resizestart', { id, x, y, w, h })

      // Add resize tracking events
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)

      event.preventDefault()
      event.stopPropagation()
    }

    function handleMouseMove(event: MouseEvent) {
      if (!isResizing) return

      // Calculate delta in pixels
      const deltaX = event.clientX - startX
      const deltaY = event.clientY - startY

      // Convert to grid units
      const gridDeltaW = Math.round(deltaX / (cellSize.width + gap))
      const gridDeltaH = Math.round(deltaY / (cellSize.height + gap))

      // Calculate new size with constraints
      const newW = Math.max(minW, startW + gridDeltaW)
      const newH = Math.max(minH, startH + gridDeltaH)

      // Update only if size changed
      if (newW !== w || newH !== h) {
        // Update local variables immediately for visual feedback
        w = newW
        h = newH

        // Dispatch resize event to parent components
        dispatch('resize', { id, x, y, w: newW, h: newH })
      }
    }

    function handleMouseUp() {
      if (!isResizing) return

      // Dispatch resize end event
      dispatch('resizeend', { id, x, y, w, h })

      // Reset state
      isResizing = false

      // Clean up event listeners
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    // Add initial event listener
    node.addEventListener('mousedown', handleMouseDown)

    // Return destroy method to clean up
    return {
      destroy() {
        node.removeEventListener('mousedown', handleMouseDown)
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      },
      update(newOptions: { enabled: boolean }) {
        if (!newOptions.enabled) {
          node.removeEventListener('mousedown', handleMouseDown)
        } else if (!options.enabled) {
          node.addEventListener('mousedown', handleMouseDown)
        }
        options = newOptions
      },
    }
  }

  // Create typed event dispatcher
  const dispatch = createEventDispatcher<{
    move: { id: number; x: number; y: number; w: number; h: number }
    previewmove: {
      id: number
      previewX: number
      previewY: number
      currentX: number
      currentY: number
      w: number
      h: number
    }
    resize: { id: number; x: number; y: number; w: number; h: number }
    dragstart: { id: number; x: number; y: number; w: number; h: number }
    dragend: {
      id: number
      x: number
      y: number
      w: number
      h: number
      dragComplete: boolean
    }
    resizestart: { id: number; x: number; y: number; w: number; h: number }
    resizeend: { id: number; x: number; y: number; w: number; h: number }
    contextmenu: MouseEvent
  }>()
</script>

<!-- Actual grid item (stays in place until drag is complete) -->
<div
  class="grid-item"
  class:is-being-dragged={isDragging}
  class:resizing={isResizing}
  style={itemStyle}
  data-id={id}
  data-grid-x={x}
  data-grid-y={y}
  data-grid-w={w}
  data-grid-h={h}
  transition:fade={{ duration: 150 }}
  on:contextmenu
  bind:this={itemNode}
>
  <!-- PlotWrap header -->
  <div class="header" bind:this={headerNode}>
    {#if draggable}
      <div class="drag-handle" use:draggable_action={{ enabled: draggable }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="16" r="1.5" />
          <circle cx="16" cy="8" r="1.5" />
          <circle cx="16" cy="16" r="1.5" />
        </svg>
      </div>
    {/if}
    <h3>{title}</h3>
    <!-- Slot for additional header content -->
    <div class="header-content">
      <slot name="header" />
    </div>
  </div>

  <!-- PlotWrap body -->
  <div class="body" bind:this={bodyNode}>
    <slot name="body">
      <slot />
    </slot>
  </div>

  {#if resizable}
    <div
      class="resize-handle"
      use:resizable_action={{ enabled: resizable }}
      aria-hidden="true"
    ></div>
  {/if}
</div>

<!-- Lightweight placeholder that moves during drag -->
{#if showDragPlaceholder}
  <div
    class="grid-item placeholder"
    style={placeholderStyle}
    data-id={`placeholder-${id}`}
    transition:fade={{ duration: 100 }}
  ></div>
{/if}

<style>
  .grid-item {
    position: absolute;
    box-sizing: border-box;
    background-color: var(--c-white, white);
    border-radius: var(--rounded-lg, 8px) var(--rounded-lg, 8px) 0 0;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    z-index: 1;
    /* Add GPU acceleration but in a way that doesn't interfere with events */
    will-change: transform;
    transition: all 0.15s ease-out;
    /* Prevent text selection during drag */
    user-select: none;
  }

  /* Styles for the actual item that's being dragged */
  .grid-item.is-being-dragged {
    z-index: 5;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    opacity: 0.3;
    pointer-events: none;
    border: 1px solid rgba(200, 180, 180, 0.3);
  }

  /* Styles for the lightweight placeholder */
  .grid-item.placeholder {
    z-index: 1000;
    background-color: rgba(255, 235, 235, 0.85);
    border: 2px dashed rgba(200, 120, 120, 0.5);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
    opacity: 0.9;
    pointer-events: none;
  }

  .grid-item.resizing {
    z-index: 10;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    transition: none;
  }

  .resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 16px;
    height: 16px;
    cursor: se-resize;
    background: transparent;
    /* Increase touch target for mobile */
    touch-action: none;
  }

  .resize-handle::after {
    content: '';
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 8px;
    height: 8px;
    border-right: 2px solid rgba(0, 0, 0, 0.2);
    border-bottom: 2px solid rgba(0, 0, 0, 0.2);
  }

  /* PlotWrap styles */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 30px;
    background: var(--c-lightgrey);
    flex-wrap: wrap;
    gap: 2px 5px;
  }

  .header-content {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .drag-handle {
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 10px;
    padding: 5px;
    border-radius: 4px;
    color: var(--c-darkgrey, #666);
    background: var(--c-grey);
    stroke: var(--c-darkgrey);
    stroke-width: 1px;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: var(--c-grey);
    transition: all 0.15s ease-out;
  }

  .drag-handle:hover {
    transform: scale(1.1);
    background: var(--c-darkgrey);
    color: var(--c-white);
  }

  .body {
    padding: 30px;
    flex-grow: 1;
    overflow: auto;
  }

  h3 {
    margin: 0;
    flex-grow: 1;
  }
</style>
