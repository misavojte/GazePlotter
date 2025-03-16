<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import type { GridItemPosition } from '$lib/stores/gridStore'
  import { writable } from 'svelte/store'
  import WorkspaceItemButton from './WorkspaceItemButton.svelte'

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
    removable?: boolean;
    body?: import('svelte').Snippet;
    children?: import('svelte').Snippet;
    onmove?: (event: CustomEvent) => void;
    onpreviewmove?: (event: CustomEvent) => void;
    onpreviewresize?: (event: CustomEvent) => void;
    onresize?: (event: CustomEvent) => void;
    ondragstart?: (event: CustomEvent) => void;
    ondragend?: (event: CustomEvent) => void;
    onresizestart?: (event: CustomEvent) => void;
    onresizeend?: (event: CustomEvent) => void;
    onremove?: (event: CustomEvent) => void;
    onduplicate?: (event: CustomEvent) => void;
    ondrag_height_update?: (event: CustomEvent) => void;
  }

  let {
    id,
    x,
    y,
    w,
    h,
    minW = 1,
    minH = 1,
    cellSize = { width: 40, height: 40 },
    gap = 10,
    resizable = true,
    draggable = true,
    title = '',
    removable = true,
    body,
    children,
    onmove = () => {},
    onpreviewmove = () => {},
    onpreviewresize = () => {},
    onresize = () => {},
    ondragstart = () => {},
    ondragend = () => {},
    onresizestart = () => {},
    onresizeend = () => {},
    onremove = () => {},
    onduplicate = () => {},
    ondrag_height_update = () => {},
  }: Props = $props();

  // Track state for visual feedback
  let isDragging = $state(false)
  let isResizing = $state(false)
  let dragPosition = $state({ x: 0, y: 0 })
  let resizePosition = $state({ w: 0, h: 0 })
  let showDragPlaceholder = $state(false)
  let showResizePlaceholder = $state(false)

  let bodyNode: HTMLElement = $state()
  let placeholderNode: HTMLElement
  let itemNode: HTMLElement = $state()
  let workspaceElement: HTMLElement | null = null

  // Create a store to track scroll position (both window and workspace)
  const scrollPosition = writable({
    workspace: { x: 0, y: 0 },
    window: { x: 0, y: 0 },
  })

  // Helper to find the workspace container
  const findWorkspaceContainer = () => {
    if (!workspaceElement && itemNode) {
      workspaceElement = itemNode.closest('.workspace-container')
    }
    return workspaceElement
  }

  // Update scroll position store
  const updateScrollPosition = () => {
    const workspace = findWorkspaceContainer()

    scrollPosition.update(state => ({
      workspace: {
        x: workspace ? workspace.scrollLeft : 0,
        y: workspace ? workspace.scrollTop : 0,
      },
      window: {
        x:
          window.scrollX ||
          window.pageXOffset ||
          document.documentElement.scrollLeft,
        y:
          window.scrollY ||
          window.pageYOffset ||
          document.documentElement.scrollTop,
      },
    }))
  }

  // Set up scroll watchers once the component is mounted
  onMount(() => {
    const workspace = findWorkspaceContainer()

    // Initial scroll position
    updateScrollPosition()

    // Add scroll listener to the workspace if it exists
    if (workspace) {
      workspace.addEventListener('scroll', updateScrollPosition, {
        passive: true,
      })
    }

    // Add window scroll listener
    window.addEventListener('scroll', updateScrollPosition, { passive: true })

    // Return cleanup function
    return () => {
      if (workspace) {
        workspace.removeEventListener('scroll', updateScrollPosition)
      }
      window.removeEventListener('scroll', updateScrollPosition)
    }
  })

  // Cleanup on destroy
  onDestroy(() => {
    workspaceElement = null
  })

  // Calculate actual pixel dimensions and position
  let itemWidth = $derived(w * cellSize.width + (w - 1) * gap)
  let itemHeight = $derived(h * cellSize.height + (h - 1) * gap)
  let itemX = $derived(x * (cellSize.width + gap))
  let itemY = $derived(y * (cellSize.height + gap))

  // Style for the actual item (always at its real position)
  let itemStyle = $derived(`
    transform: translate(${itemX}px, ${itemY}px);
    width: ${itemWidth}px;
    height: ${itemHeight}px;
  `)

  // Style for the drag placeholder
  let placeholderStyle = $derived(showDragPlaceholder
    ? `
    transform: translate(${dragPosition.x * (cellSize.width + gap)}px, ${dragPosition.y * (cellSize.height + gap)}px);
    width: ${itemWidth}px;
    height: ${itemHeight}px;
  `
    : showResizePlaceholder
      ? `
    transform: translate(${itemX}px, ${itemY}px);
    width: ${resizePosition.w * cellSize.width + (resizePosition.w - 1) * gap}px;
    height: ${resizePosition.h * cellSize.height + (resizePosition.h - 1) * gap}px;
  `
      : '')

  // Svelte action for handling drag functionality
  function draggable_action(node: HTMLElement, options: { enabled: boolean }) {
    if (!options.enabled) return {}

    let startX: number
    let startY: number
    let startPosX: number
    let startPosY: number
    let startScrollX: number
    let startScrollY: number
    let startWindowScrollX: number
    let startWindowScrollY: number
    let workspaceElement: HTMLElement | null
    let autoScrollInterval: number | null = null
    let isDraggedOverToolbar = false

    // Auto-scroll configuration
    const autoScrollSettings = {
      edgeThreshold: 80, // pixels from edge to start scrolling
      maxSpeed: 15, // maximum scroll speed in pixels
      interval: 16, // ms between scroll updates (60fps)
    }

    // Helper function to handle auto-scrolling near edges
    function setupAutoScroll(clientX: number, clientY: number) {
      // Clear any existing interval
      if (autoScrollInterval !== null) {
        clearInterval(autoScrollInterval)
        autoScrollInterval = null
      }

      // First check workspace edges if workspace exists
      if (workspaceElement) {
        // Get workspace dimensions and position
        const rect = workspaceElement.getBoundingClientRect()
        const { left, right, top, bottom } = rect

        // Calculate distances from edges
        const distanceFromLeft = clientX - left
        const distanceFromRight = right - clientX
        const distanceFromTop = clientY - top
        const distanceFromBottom = bottom - clientY

        // Determine if we need to scroll and in which direction
        let scrollX = 0
        let scrollY = 0

        // Calculate horizontal scroll
        if (distanceFromLeft < autoScrollSettings.edgeThreshold) {
          // Scroll left - negative value
          scrollX = -calculateScrollSpeed(distanceFromLeft)
        } else if (distanceFromRight < autoScrollSettings.edgeThreshold) {
          // Scroll right - positive value
          scrollX = calculateScrollSpeed(distanceFromRight)
        }

        // Calculate vertical scroll
        if (distanceFromTop < autoScrollSettings.edgeThreshold) {
          // Scroll up - negative value
          scrollY = -calculateScrollSpeed(distanceFromTop)
        } else if (distanceFromBottom < autoScrollSettings.edgeThreshold) {
          // Scroll down - positive value
          scrollY = calculateScrollSpeed(distanceFromBottom)
        }

        // Only set interval if we need to scroll the workspace
        if (scrollX !== 0 || scrollY !== 0) {
          autoScrollInterval = setInterval(() => {
            if (workspaceElement) {
              workspaceElement.scrollLeft += scrollX
              workspaceElement.scrollTop += scrollY

              // Force a mousemove event to update drag position
              const mouseEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: clientX,
                clientY: clientY,
              })
              document.dispatchEvent(mouseEvent)
            }
          }, autoScrollSettings.interval) as unknown as number

          // We're already scrolling the workspace, so don't check window edges
          return
        }
      }

      // If we're not scrolling the workspace, check window edges
      // These are viewport edges
      const viewportWidth =
        window.innerWidth || document.documentElement.clientWidth
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight

      const distanceFromWindowLeft = clientX
      const distanceFromWindowRight = viewportWidth - clientX
      const distanceFromWindowTop = clientY
      const distanceFromWindowBottom = viewportHeight - clientY

      // Determine if we need to scroll the window
      let windowScrollX = 0
      let windowScrollY = 0

      // Calculate horizontal window scroll
      if (distanceFromWindowLeft < autoScrollSettings.edgeThreshold) {
        // Scroll window left
        windowScrollX = -calculateScrollSpeed(distanceFromWindowLeft)
      } else if (distanceFromWindowRight < autoScrollSettings.edgeThreshold) {
        // Scroll window right
        windowScrollX = calculateScrollSpeed(distanceFromWindowRight)
      }

      // Calculate vertical window scroll
      if (distanceFromWindowTop < autoScrollSettings.edgeThreshold) {
        // Scroll window up
        windowScrollY = -calculateScrollSpeed(distanceFromWindowTop)
      } else if (distanceFromWindowBottom < autoScrollSettings.edgeThreshold) {
        // Scroll window down
        windowScrollY = calculateScrollSpeed(distanceFromWindowBottom)
      }

      // Only set interval if we need to scroll the window
      if (windowScrollX !== 0 || windowScrollY !== 0) {
        autoScrollInterval = setInterval(() => {
          window.scrollBy(windowScrollX, windowScrollY)

          // Force a mousemove event to update drag position
          const mouseEvent = new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: clientX,
            clientY: clientY,
          })
          document.dispatchEvent(mouseEvent)
        }, autoScrollSettings.interval) as unknown as number
      }
    }

    // Helper to calculate scroll speed based on distance from edge
    function calculateScrollSpeed(distance: number): number {
      if (distance >= autoScrollSettings.edgeThreshold) return 0

      // Create a smooth curve from edge (max speed) to threshold (zero speed)
      const ratio = 1 - distance / autoScrollSettings.edgeThreshold
      return Math.ceil(ratio * ratio * autoScrollSettings.maxSpeed)
    }

    function handleMouseDown(event: MouseEvent) {
      // Only handle left-button clicks
      if (event.button !== 0) return

      // Find the workspace container for scroll position tracking
      workspaceElement = node.closest('.workspace-container')

      // Start dragging
      isDragging = true
      startX = event.clientX
      startY = event.clientY
      startPosX = x
      startPosY = y

      // Store initial scroll positions - both workspace and window
      startScrollX = workspaceElement ? workspaceElement.scrollLeft : 0
      startScrollY = workspaceElement ? workspaceElement.scrollTop : 0
      startWindowScrollX =
        window.scrollX ||
        window.pageXOffset ||
        document.documentElement.scrollLeft
      startWindowScrollY =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop

      // Initialize the drag position to the current position
      dragPosition = { x, y }
      showDragPlaceholder = true

      // Add semi-transparent highlight to the stationary item
      if (itemNode) {
        itemNode.classList.add('is-being-dragged')
      }

      // Dispatch drag start event
      ondragstart({ id, x, y, w, h })

      // Add drag tracking events to document instead of window
      // This ensures we always get the events, even with pointer-events blocking overlays
      document.addEventListener('mousemove', handleMouseMove, { capture: true })
      document.addEventListener('mouseup', handleMouseUp, { capture: true })

      event.preventDefault()
    }

    function handleMouseMove(event: MouseEvent) {
      if (!isDragging) return

      // Setup auto-scrolling if near edges
      setupAutoScroll(event.clientX, event.clientY)

      // Get current scroll positions - both workspace and window
      const currentScrollX = workspaceElement ? workspaceElement.scrollLeft : 0
      const currentScrollY = workspaceElement ? workspaceElement.scrollTop : 0
      const currentWindowScrollX =
        window.scrollX ||
        window.pageXOffset ||
        document.documentElement.scrollLeft
      const currentWindowScrollY =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop

      // Calculate total scroll deltas (both workspace and window)
      const scrollDeltaX =
        currentScrollX -
        startScrollX +
        (currentWindowScrollX - startWindowScrollX)
      const scrollDeltaY =
        currentScrollY -
        startScrollY +
        (currentWindowScrollY - startWindowScrollY)

      // Calculate delta movement in pixels, accounting for all scroll changes
      const deltaX = event.clientX - startX + scrollDeltaX
      const deltaY = event.clientY - startY + scrollDeltaY

      // Convert to grid units
      const gridDeltaX = Math.round(deltaX / (cellSize.width + gap))
      const gridDeltaY = Math.round(deltaY / (cellSize.height + gap))

      // Calculate new position for the placeholder
      const newX = Math.max(0, startPosX + gridDeltaX)
      const newY = Math.max(0, startPosY + gridDeltaY)

      // Only update the drag placeholder position, not the actual item
      dragPosition = { x: newX, y: newY }

      // Dispatch preview event instead of regular move - this should be handled differently by parent
      onpreviewmove({
        id,
        previewX: newX,
        previewY: newY,
        currentX: x,
        currentY: y,
        w,
        h,
      })

      // Also dispatch a workspace resize event to ensure workspace expands as needed
      // This will inform the parent Workspace component that it might need to adjust its height
      ondrag_height_update({ 
        id,
        y: newY,
        h,
        bottomEdge: newY + h
      })
      
      // Don't call onmove during drag - only on drag end
    }

    function handleMouseUp() {
      if (!isDragging) return

      // Clear auto-scroll interval if active
      if (autoScrollInterval !== null) {
        clearInterval(autoScrollInterval)
        autoScrollInterval = null
      }

      // Clean up visual effects
      showDragPlaceholder = false

      if (itemNode) {
        itemNode.classList.remove('is-being-dragged')
      }

      // Only now, at the end of drag, dispatch the actual move event with final position
      // This prevents the parent from updating the store during the drag
      onmove({ id, x: dragPosition.x, y: dragPosition.y, w, h })

      // Dispatch drag end event
      ondragend({
        id,
        x: dragPosition.x,
        y: dragPosition.y,
        w,
        h,
        dragComplete: true,
      })

      // Reset state
      isDragging = false
      workspaceElement = null

      // Clean up event listeners
      document.removeEventListener('mousemove', handleMouseMove, {
        capture: true,
      })
      document.removeEventListener('mouseup', handleMouseUp, { capture: true })
    }

    // Add initial event listener
    node.addEventListener('mousedown', handleMouseDown)

    // Return destroy method to clean up
    return {
      destroy() {
        // Clear auto-scroll interval if it was somehow left running
        if (autoScrollInterval !== null) {
          clearInterval(autoScrollInterval)
          autoScrollInterval = null
        }

        node.removeEventListener('mousedown', handleMouseDown)
        document.removeEventListener('mousemove', handleMouseMove, {
          capture: true,
        })
        document.removeEventListener('mouseup', handleMouseUp, {
          capture: true,
        })
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
    let startScrollX: number
    let startScrollY: number
    let startWindowScrollX: number
    let startWindowScrollY: number
    let workspaceElement: HTMLElement | null
    let lastW: number = w
    let lastH: number = h

    function handleMouseDown(event: MouseEvent) {
      // Only handle left-button clicks
      if (event.button !== 0) return

      // Find the workspace container for scroll position tracking
      workspaceElement = node.closest('.workspace-container')

      // Start resizing
      isResizing = true
      startX = event.clientX
      startY = event.clientY
      startW = w
      startH = h
      lastW = w
      lastH = h

      // Initialize resize placeholder with current dimensions
      resizePosition = { w, h }
      showResizePlaceholder = true

      // Add semi-transparent highlight to the stationary item
      if (itemNode) {
        itemNode.classList.add('is-being-resized')
      }

      // Store initial scroll positions - both workspace and window
      startScrollX = workspaceElement ? workspaceElement.scrollLeft : 0
      startScrollY = workspaceElement ? workspaceElement.scrollTop : 0
      startWindowScrollX =
        window.scrollX ||
        window.pageXOffset ||
        document.documentElement.scrollLeft
      startWindowScrollY =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop

      // Dispatch resize start event
      onresizestart({ id, x, y, w, h })

      // Add resize tracking events using document level listeners with capture
      document.addEventListener('mousemove', handleMouseMove, { capture: true })
      document.addEventListener('mouseup', handleMouseUp, { capture: true })

      event.preventDefault()
      event.stopPropagation()
    }

    function handleMouseMove(event: MouseEvent) {
      if (!isResizing) return

      // Get current scroll positions - both workspace and window
      const currentScrollX = workspaceElement ? workspaceElement.scrollLeft : 0
      const currentScrollY = workspaceElement ? workspaceElement.scrollTop : 0
      const currentWindowScrollX =
        window.scrollX ||
        window.pageXOffset ||
        document.documentElement.scrollLeft
      const currentWindowScrollY =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop

      // Calculate total scroll deltas (both workspace and window)
      const scrollDeltaX =
        currentScrollX -
        startScrollX +
        (currentWindowScrollX - startWindowScrollX)
      const scrollDeltaY =
        currentScrollY -
        startScrollY +
        (currentWindowScrollY - startWindowScrollY)

      // Calculate delta in pixels, accounting for all scroll changes
      const deltaX = event.clientX - startX + scrollDeltaX
      const deltaY = event.clientY - startY + scrollDeltaY

      // Convert to grid units with smarter rounding
      const gridDeltaW = Math.round(deltaX / (cellSize.width + gap))
      const gridDeltaH = Math.round(deltaY / (cellSize.height + gap))

      // Calculate new size with strict constraints
      const newW = Math.max(minW, startW + gridDeltaW)
      const newH = Math.max(minH, startH + gridDeltaH)

      // Only update if size changed AND exceeds minimum dimensions
      if ((newW !== lastW || newH !== lastH) && newW >= minW && newH >= minH) {
        // Update local variables for tracking
        lastW = newW
        lastH = newH

        // Update placeholder dimensions
        resizePosition = { w: newW, h: newH }

        // Dispatch preview resize event instead of actual resize
        onpreviewresize({
          id,
          x,
          y,
          w: newW,
          h: newH,
          currentW: w,
          currentH: h,
        })

        // Also dispatch height update event to ensure workspace extends during resize
        ondrag_height_update({ 
          id,
          y,
          h: newH,
          bottomEdge: y + newH
        })
        
        // Don't call onmove during resize - only on resize end
      }
    }

    function handleMouseUp() {
      if (!isResizing) return

      // Clean up visual effects
      showResizePlaceholder = false

      if (itemNode) {
        itemNode.classList.remove('is-being-resized')
      }

      // Only update the actual size at the end of resize
      onresize({ id, x, y, w: resizePosition.w, h: resizePosition.h })

      // Dispatch resize end event
      onresizeend({
        id,
        x,
        y,
        w: resizePosition.w,
        h: resizePosition.h,
        resizeComplete: true,
      })

      // Reset state
      isResizing = false
      workspaceElement = null

      // Clean up event listeners
      document.removeEventListener('mousemove', handleMouseMove, {
        capture: true,
      })
      document.removeEventListener('mouseup', handleMouseUp, { capture: true })
    }

    // Add initial event listener
    node.addEventListener('mousedown', handleMouseDown)

    // Return destroy method to clean up
    return {
      destroy() {
        node.removeEventListener('mousedown', handleMouseDown)
        document.removeEventListener('mousemove', handleMouseMove, {
          capture: true,
        })
        document.removeEventListener('mouseup', handleMouseUp, {
          capture: true,
        })
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
  bind:this={itemNode}
  role="figure"
>
  <!-- PlotWrap header -->
  <div class="header">
    {#if draggable}
      <WorkspaceItemButton
        tooltip="Drag to move"
        useAction={true}
        actionFn={draggable_action}
        actionParams={{ enabled: draggable }}
      >
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
      </WorkspaceItemButton>
      <WorkspaceItemButton
        action="duplicate"
        tooltip="Duplicate item"
        onclick={() => onduplicate({ id })}
      >
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
          <rect x="8" y="8" width="12" height="12" rx="2" ry="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
      </WorkspaceItemButton>
    {/if}
    <h3>{title}</h3>
    <div class="header-content">
      {#if removable}
        <WorkspaceItemButton
          action="remove"
          tooltip="Remove item"
          onclick={() => onremove({ id })}
        >
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </WorkspaceItemButton>
      {/if}
    </div>
  </div>

  <!-- PlotWrap body -->
  <div class="body" bind:this={bodyNode}>
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

<!-- Lightweight placeholder that moves during drag or resize -->
{#if showDragPlaceholder || showResizePlaceholder}
  <div
    class="grid-item placeholder"
    class:dragging={isDragging}
    class:resizing={isResizing}
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
    border: 1px solid #88888863;
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

  /* Styles for the actual item that's being dragged or resized */
  .grid-item.is-being-dragged,
  .grid-item.is-being-resized {
    z-index: 5;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    opacity: 0.3;
    pointer-events: none;
    border: 1px solid rgba(200, 180, 180, 0.3);
    transform-origin: center center;
  }

  /* Styles for the lightweight placeholder */
  .grid-item.placeholder {
    z-index: 1000;
    background-color: rgba(255, 235, 235, 0.85);
    border: 2px dashed rgba(200, 120, 120, 0.5);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
    opacity: 0.9;
    /* Allow the placeholder to receive pointer events during drag */
    pointer-events: none;
    transform-origin: center center;
    transition:
      transform 0.05s ease-out,
      width 0.15s ease-out,
      height 0.15s ease-out;
  }

  /* Enhance the placeholder during active dragging or resizing */
  .grid-item.placeholder.dragging,
  .grid-item.placeholder.resizing {
    animation: pulse 2s infinite ease-in-out;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
      border-color: rgba(200, 120, 120, 0.5);
    }
    50% {
      box-shadow: 0 8px 28px rgba(200, 100, 100, 0.25);
      border-color: rgba(200, 120, 120, 0.8);
    }
    100% {
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
      border-color: rgba(200, 120, 120, 0.5);
    }
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
    padding: 10px 20px;
    background: var(--c-lightgrey);
    flex-wrap: wrap;
    gap: 2px 5px;
  }

  .header-content {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  /* Apply drag-handle styles to the WorkspaceItemButton used for dragging */
  :global(.header > .tooltip-wrapper:first-child .workspace-item-button) {
    cursor: grab;
  }

  :global(.header > .tooltip-wrapper:first-child .workspace-item-button:hover) {
    transform: scale(1.1);
    background: var(--c-darkgrey);
    color: var(--c-white);
  }

  .body {
    padding: 20px;
    flex-grow: 1;
    overflow: auto;
  }

  .header h3 {
    margin: 0;
    flex-grow: 1;
    font-size: 14px;
    font-weight: 500;
  }
</style>
