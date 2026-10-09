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
  /**
   * `touch-action` while enabled. Defaults to 'none' (the session owns every
   * touch). The workspace frame passes 'pan-x pan-y' so one finger still
   * scrolls the page and only two-finger gestures belong to the canvas.
   */
  touchAction?: string
  /** Mouse buttons that may start the session. Defaults to primary only. */
  mouseButtons?: readonly number[]
  /**
   * Arm instead of start: the session begins only once the press travels past
   * the click threshold, so a plain click keeps its own target and default.
   */
  deferStart?: (event: PointerEvent) => boolean
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
  let armed = false
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
    if (
      event.pointerType === 'mouse' &&
      !(options.mouseButtons ?? [0]).includes(event.button)
    )
      return
    if (options.shouldStart && !options.shouldStart(event)) return

    activePointerId = event.pointerId
    downPoint = getPoint(event)
    beginTracking()
    if (options.deferStart?.(event)) {
      armed = true
      return
    }
    maybePreventStart(event)
    node.setPointerCapture?.(event.pointerId)
    options.onStart(getPoint(event), event)
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!isTracking || activePointerId !== event.pointerId) return
    if (armed) {
      if (!downPoint || !wasDrag(getPoint(event))) return
      armed = false
      node.setPointerCapture?.(event.pointerId)
      options.onStart(downPoint, event)
    }
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

  function disarm(): void {
    armed = false
    activePointerId = null
    downPoint = null
    endTracking()
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!isTracking || activePointerId !== event.pointerId) return
    if (armed) return disarm()
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
    if (armed) return disarm()
    node.releasePointerCapture?.(event.pointerId)
    activePointerId = null
    downPoint = null
    options.onCancel?.()
    options.onEnd(null, event)
    endTracking()
  }

  function bindStartListeners(): void {
    if (!options.enabled) return
    node.style.touchAction = options.touchAction ?? 'none'
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
