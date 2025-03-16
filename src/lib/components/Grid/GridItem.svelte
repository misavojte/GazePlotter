<script lang="ts">
  import { createBubbler } from 'svelte/legacy';

  const bubble = createBubbler();
  import { createEventDispatcher, onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import type { GridItemPosition } from '$lib/stores/gridStore'

  // GridItem properties
  interface Props {
    id: number;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    cellSize?: any;
    gap?: number;
    resizable?: boolean;
    draggable?: boolean;
    title?: string;
    header?: import('svelte').Snippet;
    body?: import('svelte').Snippet;
    children?: import('svelte').Snippet;
  }

  let {
    id,
    x = $bindable(),
    y = $bindable(),
    w = $bindable(),
    h = $bindable(),
    minW = 1,
    minH = 1,
    cellSize = { width: 40, height: 40 },
    gap = 10,
    resizable = true,
    draggable = true,
    title = '',
    header,
    body,
    children
  }: Props = $props();

  // Track state for visual feedback
  let isDragging = $state(false)
  let isResizing = $state(false)

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

      // Calculate new position
      const newX = Math.max(0, startPosX + gridDeltaX)
      const newY = Math.max(0, startPosY + gridDeltaY)

      // Update only if position changed
      if (newX !== x || newY !== y) {
        // Update local variables immediately for visual feedback
        x = newX
        y = newY

        // Dispatch move event to parent components
        dispatch('move', { id, x: newX, y: newY, w, h })
      }
    }

    function handleMouseUp() {
      if (!isDragging) return

      // Dispatch drag end event
      dispatch('dragend', {
        id,
        x,
        y,
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

  // Reactive styles using Svelte's reactivity
  let transformX = $derived(x * (cellSize.width + gap))
  let transformY = $derived(y * (cellSize.height + gap))
  let width = $derived(w * cellSize.width + (w - 1) * gap)
  let height = $derived(h * cellSize.height + (h - 1) * gap)
  let style = $derived(`
    transform: translate(${transformX}px, ${transformY}px);
    width: ${width}px;
    height: ${height}px;
  `)
</script>

<div
  class="grid-item"
  aria-label="Grid item"
  role="figure"
  class:dragging={isDragging}
  class:resizing={isResizing}
  {style}
  data-id={id}
  data-grid-x={x}
  data-grid-y={y}
  data-grid-w={w}
  data-grid-h={h}
  transition:fade={{ duration: 150 }}
  oncontextmenu={bubble('contextmenu')}
>
  <!-- PlotWrap header -->
  <div class="header">
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
      {@render header?.()}
    </div>
  </div>

  <!-- PlotWrap body -->
  <div class="body">
    {#if body}{@render body()}{:else}
      {@render children?.()}
    {/if}
  </div>

  {#if resizable}
    <div
      class="resize-handle"
      use:resizable_action={{ enabled: resizable }}
      aria-hidden="true"
    ></div>
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
    transition:
      box-shadow 0.2s ease,
      opacity 0.2s ease;
    /* Prevent text selection during drag */
    user-select: none;
  }

  .grid-item.dragging {
    z-index: 1000; /* Very high z-index during drag */
    opacity: 0.7; /* Reduced opacity */
    transition: none;
    background-color: rgba(
      255,
      245,
      245,
      1
    ); /* Slight red tint to the background */
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
    gap: 10px 20px;
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
    color: var(--c-grey, #666);
  }

  .drag-handle:hover {
    background-color: rgba(0, 0, 0, 0.05);
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
