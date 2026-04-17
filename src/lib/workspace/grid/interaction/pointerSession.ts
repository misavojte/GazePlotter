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

// How far the pointer must travel between pointerdown and pointerup before
// we call it a "drag" and suppress the follow-up click. 3px absorbs
// incidental jitter from a plain click without eating real drags.
const DRAG_CLICK_THRESHOLD_PX = 3

/**
 * Cancels the next `click` event at the document level.
 *
 * The browser synthesizes a click after pointerup based on the pointer's
 * final position, which after a drag can be on a completely different
 * element than where the drag started — e.g. the workspace background,
 * which has its own click-to-deselect behavior. Consuming that one click
 * in the capture phase prevents the spurious side-effects without
 * affecting any future clicks.
 */
function suppressNextClick(): void {
  if (typeof document === 'undefined') return
  const handler = (event: MouseEvent) => {
    event.stopPropagation()
    event.stopImmediatePropagation()
    cleanup()
  }
  const cleanup = () => {
    document.removeEventListener(
      'click',
      handler,
      true as unknown as EventListenerOptions
    )
    window.clearTimeout(timeoutId)
  }
  document.addEventListener('click', handler, true)
  // Fallback: browsers don't always fire a click after pointerup (tap
  // cancelled, context menu, etc.). Tear the listener down so it can't
  // eat a legitimate click later.
  const timeoutId = window.setTimeout(cleanup, 50)
}

export function createPointerSession(
  node: HTMLElement,
  initialOptions: PointerSessionOptions
) {
  let options = initialOptions
  let activePointerId: number | null = null
  let isTracking = false
  let downPoint: InteractionPoint | null = null
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
    downPoint = getPoint(event)
    beginTracking()
    node.setPointerCapture?.(event.pointerId)
    options.onStart(getPoint(event), event)
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!isTracking || activePointerId !== event.pointerId) return
    if (options.preventDefaultOnMove) event.preventDefault()
    options.onMove(getPoint(event), event)
  }

  function wasDrag(endPoint: InteractionPoint): boolean {
    if (!downPoint) return false
    const dx = endPoint.x - downPoint.x
    const dy = endPoint.y - downPoint.y
    return (
      dx * dx + dy * dy > DRAG_CLICK_THRESHOLD_PX * DRAG_CLICK_THRESHOLD_PX
    )
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!isTracking || activePointerId !== event.pointerId) return
    node.releasePointerCapture?.(event.pointerId)
    activePointerId = null
    const upPoint = getPoint(event)
    if (wasDrag(upPoint)) suppressNextClick()
    downPoint = null
    options.onEnd(upPoint, event)
    endTracking()
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (!isTracking || activePointerId !== event.pointerId) return
    node.releasePointerCapture?.(event.pointerId)
    activePointerId = null
    downPoint = null
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
