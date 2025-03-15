<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import type { GridItemPosition } from './GridSystem'

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

  // Types for custom events
  type DragEvent = { id: number; x: number; y: number; w: number; h: number }
  type ResizeEvent = { id: number; x: number; y: number; w: number; h: number }

  // Create typed event dispatcher
  const dispatch = createEventDispatcher<{
    move: DragEvent
    resize: ResizeEvent
    dragstart: DragEvent
    dragend: DragEvent
    resizestart: ResizeEvent
    resizeend: ResizeEvent
    contextmenu: MouseEvent
  }>()

  // Handle rendering and interactions
  let element: HTMLElement
  let isDragging = false
  let isResizing = false
  let dragStartX = 0
  let dragStartY = 0
  let startX = 0
  let startY = 0
  let startW = 0
  let startH = 0

  // Calculate pixel positions and dimensions from grid units - memoized with reactive declarations
  $: transformX = x * (cellSize.width + gap)
  $: transformY = y * (cellSize.height + gap)
  $: width = w * cellSize.width + (w - 1) * gap
  $: height = h * cellSize.height + (h - 1) * gap

  // Use transform for better performance (avoids layout recalculation)
  $: style = `
    transform: translate(${transformX}px, ${transformY}px);
    width: ${width}px;
    height: ${height}px;
  `

  function handleMouseDown(event: MouseEvent) {
    // Handle context menu (right-click) separately
    if (event.button === 2) {
      // Allow default context menu behavior
      return
    }

    // Only handle left-button clicks for dragging
    if (event.button !== 0 || !draggable) return

    // Check if we're clicking on the resize handle
    const target = event.target as HTMLElement
    if (target.classList.contains('resize-handle') && resizable) {
      startResize(event)
      return
    }

    // Start dragging
    isDragging = true
    dragStartX = event.clientX
    dragStartY = event.clientY
    startX = x
    startY = y

    // Dispatch drag start event
    dispatch('dragstart', { id, x, y, w, h })

    // Add event listeners for drag tracking
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    // Prevent default to avoid text selection, etc
    event.preventDefault()
  }

  function handleMouseMove(event: MouseEvent) {
    if (isDragging) {
      // Calculate the delta movement in pixels
      const deltaX = event.clientX - dragStartX
      const deltaY = event.clientY - dragStartY

      // Convert to grid units (round to nearest cell)
      const gridDeltaX = Math.round(deltaX / (cellSize.width + gap))
      const gridDeltaY = Math.round(deltaY / (cellSize.height + gap))

      // Update the position
      const newX = Math.max(0, startX + gridDeltaX)
      const newY = Math.max(0, startY + gridDeltaY)

      // Update local state immediately for smooth UI
      if (newX !== x || newY !== y) {
        x = newX
        y = newY

        // Dispatch move event immediately for responsive drag
        dispatch('move', { id, x, y, w, h })
      }
    } else if (isResizing) {
      // Calculate the delta in pixels
      const deltaX = event.clientX - dragStartX
      const deltaY = event.clientY - dragStartY

      // Convert to grid units (round to nearest cell)
      const gridDeltaW = Math.round(deltaX / (cellSize.width + gap))
      const gridDeltaH = Math.round(deltaY / (cellSize.height + gap))

      // Update size with minimum constraints
      const newW = Math.max(minW, startW + gridDeltaW)
      const newH = Math.max(minH, startH + gridDeltaH)

      // Update local state immediately for smooth UI
      if (newW !== w || newH !== h) {
        w = newW
        h = newH

        // Dispatch resize event immediately for responsive resize
        dispatch('resize', { id, x, y, w, h })
      }
    }
  }

  function handleMouseUp() {
    if (isDragging) {
      isDragging = false
      dispatch('dragend', { id, x, y, w, h })
    } else if (isResizing) {
      isResizing = false
      dispatch('resizeend', { id, x, y, w, h })
    }

    // Remove event listeners
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }

  function startResize(event: MouseEvent) {
    if (!resizable) return

    isResizing = true
    dragStartX = event.clientX
    dragStartY = event.clientY
    startW = w
    startH = h

    // Dispatch resize start event
    dispatch('resizestart', { id, x, y, w, h })

    // Add event listeners for resize tracking
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    // Prevent default
    event.preventDefault()
  }

  onMount(() => {
    return () => {
      // Clean up event listeners if component is destroyed while dragging/resizing
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  })
</script>

<div
  class="grid-item"
  class:dragging={isDragging}
  class:resizing={isResizing}
  bind:this={element}
  on:mousedown={handleMouseDown}
  on:contextmenu
  {style}
  data-id={id}
  data-grid-x={x}
  data-grid-y={y}
  data-grid-w={w}
  data-grid-h={h}
>
  <div class="content">
    <slot />
  </div>

  {#if resizable}
    <div class="resize-handle" aria-hidden="true"></div>
  {/if}
</div>

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
    transition: box-shadow 0.2s ease;
    /* Prevent text selection during drag */
    user-select: none;
  }

  .grid-item.dragging,
  .grid-item.resizing {
    z-index: 10;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    transition: none;
  }

  .content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
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
</style>
