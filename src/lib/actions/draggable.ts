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
    /** How much horizontal movement bias is needed to consider it a drag vs scroll (0-1) */
    horizontalBias?: number
  } = {}
) {
  // Configuration
  const MIN_DRAG_DISTANCE = options.minDragDistance ?? 3

  // State (using immutable patterns where appropriate)
  type Point = Readonly<{ x: number; y: number }>
  type DragState = Readonly<{
    startPos: Point | null
    currentPos: Point | null
    previousPos: Point | null
    isDragging: boolean
    pointerId: number | null
    animationFrameId: number | null
    totalDeltaX: number
    totalDeltaY: number
  }>

  // Initial state
  let state: DragState = {
    startPos: null,
    currentPos: null,
    previousPos: null,
    isDragging: false,
    pointerId: null,
    animationFrameId: null,
    totalDeltaX: 0,
    totalDeltaY: 0,
  }

  // Flag to track if we should block scrolling - maintained separately for performance
  let blockAllScrolling = false

  /**
   * Updates state in a functional way, returning a new state object
   */
  const updateState = (newValues: Partial<DragState>): DragState => {
    return { ...state, ...newValues }
  }

  /**
   * Processes drag movement and calls step callbacks
   */
  const processDragMove = () => {
    if (!state.currentPos || !state.previousPos) return

    const stepChangeX = state.currentPos.x - state.previousPos.x
    const stepChangeY = state.currentPos.y - state.previousPos.y

    if (state.isDragging && (stepChangeX !== 0 || stepChangeY !== 0)) {
      options.onDragStep?.(stepChangeX, stepChangeY)
    }

    // Reset animation frame ID to allow future processing
    state = updateState({ animationFrameId: null })
  }

  /**
   * Starts a drag operation
   */
  const startDrag = (
    x: number,
    y: number,
    pointerId: number,
    pointerType?: string
  ): void => {
    blockAllScrolling = false
    const newPos = { x, y }
    state = updateState({
      startPos: newPos,
      currentPos: newPos,
      previousPos: newPos,
      isDragging: false,
      pointerId,
      totalDeltaX: 0,
      totalDeltaY: 0,
    })

    // Use pointer capture to improve performance and reliability for pointer events
    if (
      typeof node.setPointerCapture === 'function' &&
      pointerType !== 'touch'
    ) {
      try {
        node.setPointerCapture(pointerId)
      } catch (e) {
        // Some browsers might not fully support this
      }
    }
  }

  /**
   * Determines if the movement should be considered a drag based on direction and distance
   * This is critical for touch devices to distinguish between scrolling and dragging
   */
  const shouldBeDrag = (dx: number, dy: number): boolean => {
    // Always a drag if we've already decided it is
    if (blockAllScrolling) return true

    // Already dragging - continue dragging
    if (state.isDragging) return true

    // Not yet at threshold - not dragging yet
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    if (absDx < MIN_DRAG_DISTANCE && absDy < MIN_DRAG_DISTANCE) return false
    return true
  }

  /**
   * Updates a drag operation
   */
  const updateDrag = (x: number, y: number): void => {
    if (!state.startPos) return

    const previousPos = state.currentPos
    const currentPos = { x, y }

    // Calculate movement
    const dx = x - (state.startPos?.x ?? 0)
    const dy = y - (state.startPos?.y ?? 0)

    // Update total deltas
    const totalDeltaX = dx
    const totalDeltaY = dy

    // Determine if we should consider this a drag
    const isDragging = shouldBeDrag(totalDeltaX, totalDeltaY)

    // If we just started dragging, set the block scrolling flag
    if (isDragging && !state.isDragging) {
      blockAllScrolling = true
    }

    // Update state
    state = updateState({
      previousPos,
      currentPos,
      isDragging,
      totalDeltaX,
      totalDeltaY,
    })

    // Schedule movement processing on animation frame for better performance
    if (state.animationFrameId === null) {
      const frameId = requestAnimationFrame(processDragMove)
      state = updateState({ animationFrameId: frameId })
    }
  }

  /**
   * Ends a drag operation and cleans up
   */
  const endDrag = (): void => {
    if (state.animationFrameId !== null) {
      cancelAnimationFrame(state.animationFrameId)
    }

    if (state.isDragging && state.startPos && state.currentPos) {
      const totalDragDistanceX = state.currentPos.x - state.startPos.x
      const totalDragDistanceY = state.currentPos.y - state.startPos.y

      if (
        Math.abs(totalDragDistanceX) >= MIN_DRAG_DISTANCE ||
        Math.abs(totalDragDistanceY) >= MIN_DRAG_DISTANCE
      ) {
        options.onDragFinished?.(totalDragDistanceX, totalDragDistanceY)
      }
    }

    // Release pointer capture if used
    if (
      typeof node.releasePointerCapture === 'function' &&
      state.pointerId !== null
    ) {
      try {
        node.releasePointerCapture(state.pointerId)
      } catch (e) {
        // Ignore errors from releasing capture on pointers that no longer exist
      }
    }

    // Reset state
    blockAllScrolling = false
    state = updateState({
      startPos: null,
      currentPos: null,
      previousPos: null,
      isDragging: false,
      pointerId: null,
      animationFrameId: null,
      totalDeltaX: 0,
      totalDeltaY: 0,
    })
  }

  // Modern pointer events for unified mouse/touch handling
  const handlePointerDown = (event: Event): void => {
    const pointerEvent = event as PointerEvent
    if (pointerEvent.pointerType === 'touch') {
      // For touch pointers, we'll use touch-specific handling to better control
      // scroll vs. drag behavior
      return
    }

    // Only handle primary button (usually left mouse button)
    if (pointerEvent.button !== 0) return

    startDrag(
      pointerEvent.clientX,
      pointerEvent.clientY,
      pointerEvent.pointerId,
      pointerEvent.pointerType
    )
  }

  const handlePointerMove = (event: Event): void => {
    const pointerEvent = event as PointerEvent
    if (state.pointerId !== pointerEvent.pointerId) return

    updateDrag(pointerEvent.clientX, pointerEvent.clientY)
  }

  const handlePointerUp = (event: Event): void => {
    const pointerEvent = event as PointerEvent
    if (state.pointerId !== pointerEvent.pointerId) return

    endDrag()
  }

  // Touch-specific handling for better scroll discrimination
  const handleTouchStart = (event: Event): void => {
    const touchEvent = event as TouchEvent
    if (touchEvent.touches.length !== 1) {
      endDrag()
      return
    }

    const touch = touchEvent.touches[0]
    startDrag(touch.clientX, touch.clientY, touch.identifier)
  }

  const handleTouchMove = (event: Event): void => {
    // Immediately prevent default if we've previously determined this is a drag
    if (blockAllScrolling) {
      event.preventDefault()

      // Continue processing the touch for drag movement
      const touchEvent = event as TouchEvent
      if (touchEvent.touches.length === 1) {
        const touch = touchEvent.touches[0]
        updateDrag(touch.clientX, touch.clientY)
      }
      return
    }

    const touchEvent = event as TouchEvent
    if (touchEvent.touches.length !== 1) {
      endDrag()
      return
    }

    const touch = touchEvent.touches[0]
    updateDrag(touch.clientX, touch.clientY)

    // Prevent default if we just decided this is a drag
    if (state.isDragging) {
      event.preventDefault()
    }
  }

  const handleTouchEnd = (event: Event): void => {
    endDrag()
  }

  // Add event listeners using a functional approach
  const addEventListeners = () => {
    // Pointer events for mouse (and possibly some touch devices)
    node.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerUp)

    // Specific touch handlers that provide better control over scroll behavior
    node.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true })
  }

  const removeEventListeners = () => {
    node.removeEventListener('pointerdown', handlePointerDown)
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
    document.removeEventListener('pointercancel', handlePointerUp)

    node.removeEventListener('touchstart', handleTouchStart)
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleTouchEnd)
    document.removeEventListener('touchcancel', handleTouchEnd)

    // Clean up any pending animation frame
    if (state.animationFrameId !== null) {
      cancelAnimationFrame(state.animationFrameId)
    }
  }

  // Initialize
  addEventListeners()

  return {
    destroy() {
      removeEventListeners()
    },
  }
}
