/**
 * Draggable action for Svelte components
 * Tracks both X and Y movements and dispatches custom events for drag steps and completion
 */
export function draggable(node: HTMLElement | SVGElement) {
  let dragStartX: number | null = null
  let dragStartY: number | null = null
  let previousX: number | null = null
  let previousY: number | null = null

  // Minimum distance to consider a drag significant
  const MIN_DRAG_DISTANCE = 0

  // Custom event dispatchers
  function dispatchDragStepX(stepChange: number) {
    node.dispatchEvent(
      new CustomEvent('dragStepX', {
        detail: { stepChange },
      })
    )
  }

  function dispatchDragStepY(stepChange: number) {
    node.dispatchEvent(
      new CustomEvent('dragStepY', {
        detail: { stepChange },
      })
    )
  }

  function dispatchDragStep(stepChangeX: number, stepChangeY: number) {
    node.dispatchEvent(
      new CustomEvent('dragStep', {
        detail: { stepChangeX, stepChangeY },
      })
    )
  }

  function dispatchDragFinishedX(totalDragDistance: number) {
    if (Math.abs(totalDragDistance) >= MIN_DRAG_DISTANCE) {
      node.dispatchEvent(
        new CustomEvent('dragFinishedX', {
          detail: { totalDragDistance },
        })
      )
    }
  }

  function dispatchDragFinishedY(totalDragDistance: number) {
    if (Math.abs(totalDragDistance) >= MIN_DRAG_DISTANCE) {
      node.dispatchEvent(
        new CustomEvent('dragFinishedY', {
          detail: { totalDragDistance },
        })
      )
    }
  }

  function dispatchDragFinished(
    totalDragDistanceX: number,
    totalDragDistanceY: number
  ) {
    if (
      Math.abs(totalDragDistanceX) >= MIN_DRAG_DISTANCE ||
      Math.abs(totalDragDistanceY) >= MIN_DRAG_DISTANCE
    ) {
      node.dispatchEvent(
        new CustomEvent('dragFinished', {
          detail: { totalDragDistanceX, totalDragDistanceY },
        })
      )
    }
  }

  // Event handlers with proper type casting
  function handlePointerDown(event: Event) {
    const pointerEvent = event as PointerEvent
    dragStartX = pointerEvent.clientX
    dragStartY = pointerEvent.clientY
    previousX = pointerEvent.clientX
    previousY = pointerEvent.clientY

    // Capture pointer to ensure events are directed to this element
    node.setPointerCapture(pointerEvent.pointerId)
  }

  function handlePointerMove(event: Event) {
    if (
      dragStartX === null ||
      previousX === null ||
      dragStartY === null ||
      previousY === null
    )
      return

    const pointerEvent = event as PointerEvent
    const currentX = pointerEvent.clientX
    const currentY = pointerEvent.clientY

    const stepChangeX = currentX - previousX
    const stepChangeY = currentY - previousY

    // Dispatch individual direction events if there was movement
    if (stepChangeX !== 0) {
      dispatchDragStepX(stepChangeX)
    }

    if (stepChangeY !== 0) {
      dispatchDragStepY(stepChangeY)
    }

    // Dispatch combined event if there was movement in either direction
    if (stepChangeX !== 0 || stepChangeY !== 0) {
      dispatchDragStep(stepChangeX, stepChangeY)
    }

    previousX = currentX
    previousY = currentY
  }

  function handlePointerUp(event: Event) {
    if (
      dragStartX === null ||
      previousX === null ||
      dragStartY === null ||
      previousY === null
    )
      return

    const pointerEvent = event as PointerEvent
    const totalDragDistanceX = previousX - dragStartX
    const totalDragDistanceY = previousY - dragStartY

    // Dispatch individual direction completion events
    dispatchDragFinishedX(totalDragDistanceX)
    dispatchDragFinishedY(totalDragDistanceY)

    // Dispatch combined completion event
    dispatchDragFinished(totalDragDistanceX, totalDragDistanceY)

    // Reset state
    dragStartX = null
    dragStartY = null
    previousX = null
    previousY = null

    // Release pointer capture
    node.releasePointerCapture(pointerEvent.pointerId)
  }

  // Add event listeners
  node.addEventListener('pointerdown', handlePointerDown, { passive: true })
  node.addEventListener('pointermove', handlePointerMove, { passive: true })
  node.addEventListener('pointerup', handlePointerUp, { passive: true })
  node.addEventListener('pointercancel', handlePointerUp, { passive: true })

  return {
    destroy() {
      // Clean up event listeners when the element is destroyed
      node.removeEventListener('pointerdown', handlePointerDown)
      node.removeEventListener('pointermove', handlePointerMove)
      node.removeEventListener('pointerup', handlePointerUp)
      node.removeEventListener('pointercancel', handlePointerUp)
    },
  }
}
