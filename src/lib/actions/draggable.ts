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

    // Check if setPointerCapture is supported and the pointerId is valid
    if (node.setPointerCapture && pointerEvent.pointerId) {
      node.setPointerCapture(pointerEvent.pointerId)
    }
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

    // Check if releasePointerCapture is supported and the pointerId is valid
    if (node.releasePointerCapture && pointerEvent.pointerId) {
      node.releasePointerCapture(pointerEvent.pointerId)
    }
  }

  function handleTouchStart(event: TouchEvent) {
    event.preventDefault()
    const touch = event.touches[0]
    if (touch) {
      dragStartX = touch.clientX
      dragStartY = touch.clientY
      previousX = touch.clientX
      previousY = touch.clientY
    }
  }

  function handleTouchMove(event: TouchEvent) {
    event.preventDefault()
    if (
      dragStartX === null ||
      previousX === null ||
      dragStartY === null ||
      previousY === null
    )
      return

    const touch = event.touches[0]
    if (touch) {
      const currentX = touch.clientX
      const currentY = touch.clientY

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
  }

  function handleTouchEnd(event: TouchEvent) {
    event.preventDefault()
    if (
      dragStartX === null ||
      previousX === null ||
      dragStartY === null ||
      previousY === null
    )
      return

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
  }

  // Add event listeners
  node.addEventListener('mousedown', handlePointerDown)
  document.addEventListener('mousemove', handlePointerMove)
  document.addEventListener('mouseup', handlePointerUp)

  node.addEventListener('touchstart', handleTouchStart as EventListener, {
    passive: false,
  })
  document.addEventListener('touchmove', handleTouchMove as EventListener, {
    passive: false,
  })
  document.addEventListener('touchend', handleTouchEnd as EventListener, {
    passive: false,
  })
  document.addEventListener('touchcancel', handleTouchEnd as EventListener, {
    passive: false,
  })

  return {
    destroy() {
      // Clean up event listeners when the element is destroyed
      node.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('mousemove', handlePointerMove)
      document.removeEventListener('mouseup', handlePointerUp)

      node.removeEventListener('touchstart', handleTouchStart as EventListener)
      document.removeEventListener(
        'touchmove',
        handleTouchMove as EventListener
      )
      document.removeEventListener('touchend', handleTouchEnd as EventListener)
      document.removeEventListener(
        'touchcancel',
        handleTouchEnd as EventListener
      )
    },
  }
}
