/**
 * Draggable action for Svelte components
 *
 * This action makes an element draggable, tracking both X and Y movements.
 * It handles both mouse and touch events, carefully distinguishing between
 * scrolling and dragging for touch interactions.
 *
 * @param node - The DOM element to make draggable
 * @param options - Configuration options for draggable behavior
 * @returns A Svelte action object with a destroy method
 */
export function draggable(
  node: HTMLElement | SVGElement,
  options: {
    /** Minimum distance required for a drag to be considered significant */
    minDragDistance?: number
    /** Callback fired on each drag step with the change in x and y */
    onDragStep?: (stepChangeX: number, stepChangeY: number) => void
    /** Callback fired when dragging finishes with total drag distances */
    onDragFinished?: (
      totalDragDistanceX: number,
      totalDragDistanceY: number
    ) => void
  } = {}
) {
  // Configuration
  const MIN_DRAG_DISTANCE = options.minDragDistance ?? 3

  // Simple state variables instead of complex objects for better performance
  let startX: number | null = null
  let startY: number | null = null
  let currentX: number | null = null
  let currentY: number | null = null
  let previousX: number | null = null
  let previousY: number | null = null
  let isDragging = false
  let touchId: number | null = null
  let animationFrameId: number | null = null

  /**
   * Process drag movement
   */
  const processDragMove = () => {
    if (!previousX || !previousY || !currentX || !currentY) return

    const stepChangeX = currentX - previousX
    const stepChangeY = currentY - previousY

    if (isDragging && (stepChangeX !== 0 || stepChangeY !== 0)) {
      try {
        // Apply visual transform to the element during drag
        //node.style.transition = 'none'
        //node.style.transform = `translate(${stepChangeX}px, ${stepChangeY}px)`

        // Call the callback
        options.onDragStep?.(stepChangeX, stepChangeY)
      } catch (e) {
        console.error('Error in drag step:', e)
      }
    }

    animationFrameId = null
  }

  /**
   * Start tracking a drag operation
   */
  const startDrag = (x: number, y: number, id?: number) => {
    startX = x
    startY = y
    currentX = x
    currentY = y
    previousX = x
    previousY = y
    isDragging = false
    touchId = id !== undefined ? id : null

    // Add visual feedback classes
    //document.body.classList.add('draggable-active')
  }

  /**
   * Update the drag position
   */
  const updateDrag = (x: number, y: number) => {
    if (startX === null || startY === null) return

    previousX = currentX
    previousY = currentY
    currentX = x
    currentY = y

    // Check if we should start dragging
    if (!isDragging) {
      const dx = Math.abs(x - startX)
      const dy = Math.abs(y - startY)

      if (dx > MIN_DRAG_DISTANCE || dy > MIN_DRAG_DISTANCE) {
        isDragging = true
        //node.classList.add('being-dragged')
      }
    }

    // Schedule movement processing
    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(processDragMove)
    }
  }

  /**
   * End the drag operation
   */
  const endDrag = () => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    // Only calculate total distance if we were actually dragging
    if (
      isDragging &&
      startX !== null &&
      startY !== null &&
      currentX !== null &&
      currentY !== null
    ) {
      const totalDragDistanceX = currentX - startX
      const totalDragDistanceY = currentY - startY

      if (
        Math.abs(totalDragDistanceX) >= MIN_DRAG_DISTANCE ||
        Math.abs(totalDragDistanceY) >= MIN_DRAG_DISTANCE
      ) {
        options.onDragFinished?.(totalDragDistanceX, totalDragDistanceY)
      }

      // Reset node styling
      //node.classList.remove('being-dragged')
      //node.style.transform = ''
      //node.style.transition = ''
    }

    // Clean up visual feedback
    //document.body.classList.remove('draggable-active')

    // Reset state
    startX = null
    startY = null
    currentX = null
    currentY = null
    previousX = null
    previousY = null
    isDragging = false
    touchId = null
  }

  // Mouse event handlers
  const handleMouseDown = (event: Event) => {
    const mouseEvent = event as MouseEvent
    // Only handle left mouse button
    if (mouseEvent.button !== 0) return

    // Start dragging
    startDrag(mouseEvent.clientX, mouseEvent.clientY)

    // Add document-level event listeners
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Prevent default to avoid text selection
    event.preventDefault()
  }

  const handleMouseMove = (event: Event) => {
    const mouseEvent = event as MouseEvent
    updateDrag(mouseEvent.clientX, mouseEvent.clientY)
  }

  const handleMouseUp = (event: Event) => {
    endDrag()

    // Remove document-level event listeners
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  // Touch event handlers
  const handleTouchStart = (event: Event) => {
    const touchEvent = event as TouchEvent
    if (touchEvent.touches.length !== 1) {
      endDrag()
      return
    }

    const touch = touchEvent.touches[0]
    startDrag(touch.clientX, touch.clientY, touch.identifier)

    // No need to prevent default on touchstart (to allow native scrolling to start)
  }

  const handleTouchMove = (event: Event) => {
    const touchEvent = event as TouchEvent
    // Find the touch that matches our ID
    let activeTouch: Touch | undefined

    for (let i = 0; i < touchEvent.touches.length; i++) {
      if (touchId === null || touchEvent.touches[i].identifier === touchId) {
        activeTouch = touchEvent.touches[i]
        break
      }
    }

    if (!activeTouch) {
      endDrag()
      return
    }

    updateDrag(activeTouch.clientX, activeTouch.clientY)

    // If we've determined this is a drag, prevent scrolling
    if (isDragging) {
      event.preventDefault()
    }
  }

  const handleTouchEnd = (event: Event) => {
    const touchEvent = event as TouchEvent
    // Check if our tracked touch is still active
    let touchActive = false

    if (touchId !== null) {
      for (let i = 0; i < touchEvent.touches.length; i++) {
        if (touchEvent.touches[i].identifier === touchId) {
          touchActive = true
          break
        }
      }
    }

    // End drag if our touch is gone
    if (!touchActive) {
      endDrag()
    }

    // No need to remove listeners - they stay active on the document
  }

  // Add all event listeners
  node.addEventListener('mousedown', handleMouseDown)

  // Use capture: true for touch events to ensure we get all events
  node.addEventListener('touchstart', handleTouchStart, { passive: true })
  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', handleTouchEnd, { passive: true })
  document.addEventListener('touchcancel', handleTouchEnd, { passive: true })

  // Use regular cursor on the node
  const originalCursor = getComputedStyle(node).cursor
  //node.style.cursor = 'grab'

  // Return the action object
  return {
    destroy() {
      // Clean up all event listeners
      node.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      node.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchEnd)

      // Cancel any pending animation
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }

      // Reset styles
      //node.style.cursor = originalCursor
      //node.classList.remove('being-dragged')
      //node.style.transform = ''
      //node.style.transition = ''

      // Remove any lingering body classes
      //document.body.classList.remove('draggable-active')
    },
  }
}
