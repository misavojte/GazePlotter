import type { InteractionPoint } from './model'

type PointerSessionOptions = {
  enabled: boolean
  shouldStart?: (event: PointerEvent) => boolean
  onStart: (point: InteractionPoint, event: PointerEvent) => void
  onMove: (point: InteractionPoint, event: PointerEvent) => void
  onEnd: (point: InteractionPoint | null, event?: PointerEvent) => void
  onCancel?: () => void
  preventDefaultOnStart?: boolean
  preventDefaultOnMove?: boolean
  stopPropagationOnStart?: boolean
}

function getPoint(event: PointerEvent): InteractionPoint {
  return { x: event.clientX, y: event.clientY }
}

export function createPointerSession(
  node: HTMLElement,
  initialOptions: PointerSessionOptions
) {
  let options = initialOptions
  let activePointerId: number | null = null
  let isTracking = false
  const initialTouchAction = node.style.touchAction

  function beginTracking(): void {
    if (isTracking) return
    isTracking = true
    document.addEventListener('pointermove', handlePointerMove, {
      capture: true,
    })
    document.addEventListener('pointerup', handlePointerUp, { capture: true })
    document.addEventListener('pointercancel', handlePointerCancel, {
      capture: true,
    })
  }

  function endTracking(): void {
    if (!isTracking) return
    isTracking = false
    document.removeEventListener('pointermove', handlePointerMove, {
      capture: true,
    } as EventListenerOptions)
    document.removeEventListener('pointerup', handlePointerUp, {
      capture: true,
    } as EventListenerOptions)
    document.removeEventListener('pointercancel', handlePointerCancel, {
      capture: true,
    } as EventListenerOptions)
  }

  function maybePreventStart(event: PointerEvent): void {
    if (options.preventDefaultOnStart) event.preventDefault()
    if (options.stopPropagationOnStart) event.stopPropagation()
  }

  function maybeRestoreTouchAction(): void {
    node.style.touchAction = initialTouchAction
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!options.enabled || !event.isPrimary) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (options.shouldStart && !options.shouldStart(event)) return

    maybePreventStart(event)
    activePointerId = event.pointerId
    beginTracking()
    node.setPointerCapture?.(event.pointerId)
    options.onStart(getPoint(event), event)
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!isTracking || activePointerId !== event.pointerId) return
    if (options.preventDefaultOnMove) event.preventDefault()
    options.onMove(getPoint(event), event)
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!isTracking || activePointerId !== event.pointerId) return
    node.releasePointerCapture?.(event.pointerId)
    activePointerId = null
    options.onEnd(getPoint(event), event)
    endTracking()
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (!isTracking || activePointerId !== event.pointerId) return
    node.releasePointerCapture?.(event.pointerId)
    activePointerId = null
    options.onCancel?.()
    options.onEnd(null, event)
    endTracking()
  }

  function bindStartListeners(): void {
    if (!options.enabled) return
    node.style.touchAction = 'none'
    node.addEventListener('pointerdown', handlePointerDown)
  }

  function unbindStartListeners(): void {
    maybeRestoreTouchAction()
    node.removeEventListener('pointerdown', handlePointerDown)
  }

  bindStartListeners()

  return {
    update(nextOptions: PointerSessionOptions) {
      const wasEnabled = options.enabled
      options = nextOptions

      if (wasEnabled !== options.enabled) {
        if (wasEnabled) {
          unbindStartListeners()
        }
        if (options.enabled) {
          bindStartListeners()
        }
      }
    },
    destroy() {
      unbindStartListeners()
      endTracking()
    },
  }
}
