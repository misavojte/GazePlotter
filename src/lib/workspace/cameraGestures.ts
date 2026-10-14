import type { Point, WorkspaceCamera } from './camera.svelte'

type WheelParams = {
  camera: WorkspaceCamera
  /**
   * Canvas-first mode: which targets a plain wheel pans over. Null keeps the
   * cooperative mode, where a plain wheel always belongs to the page.
   */
  panTarget?: ((target: Node) => boolean) | null
  /** A plain wheel the camera left alone: the caller may hint. */
  onPlainWheel?: (event: WheelEvent) => void
}

/**
 * Ctrl/Cmd+wheel and trackpad pinch zoom the camera. Its own action because
 * the listener must be `{ passive: false }` to call `preventDefault`, which
 * `onwheel` cannot be. A plain wheel pans in canvas-first mode and is left
 * to the page otherwise.
 */
export function cameraWheelAction(node: HTMLElement, initial: WheelParams) {
  let params = initial
  const onWheel = (event: WheelEvent) => {
    if (params.camera.wheel(event)) return
    if (params.panTarget?.(event.target as Node)) {
      params.camera.wheelPan(event)
      return
    }
    params.onPlainWheel?.(event)
  }

  node.addEventListener('wheel', onWheel, { passive: false })

  return {
    update(next: WheelParams) {
      params = next
    },
    destroy() {
      node.removeEventListener('wheel', onWheel)
    },
  }
}

function pointOf(touch: Touch): Point {
  return { x: touch.clientX, y: touch.clientY }
}

function midpoint(touches: TouchList): Point {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  }
}

function spread(touches: TouchList): number {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  )
}

function travelled(from: Point, to: Point): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) > TAP_SLACK_PX
}

/**
 * Two fingers must spread or close by this much before the gesture zooms.
 * No real two-finger drag holds an even spread, so without the slack every
 * pan drifts in and out of zoom.
 */
const PINCH_SLACK = 1.15

/** A one-finger press travels this far before it pans instead of tapping. */
const TAP_SLACK_PX = 8

type TouchParams = {
  camera: WorkspaceCamera
  /**
   * Canvas-first mode: which targets one finger pans from. Null keeps the
   * cooperative mode, where one finger always belongs to the page.
   */
  panTarget?: ((target: Node) => boolean) | null
}

type Gesture = {
  /** The finger, or the midpoint of two. */
  point: Point
  fingers: number
  /** Two fingers: how far apart they are, and where they landed. */
  spread: number
  origin: number
  zooming: boolean
  /** One finger: where it landed, until the press becomes a pan. */
  down: Point | null
}

/**
 * Touch gestures over the camera: two fingers pan and pinch, and in
 * canvas-first mode one finger pans as well. Cooperative mode leaves one
 * finger to the page (the frame's `touch-action: pan-x pan-y`), so an
 * embedded workspace never traps page scrolling, as an embedded map does.
 */
export function cameraTouchAction(node: HTMLElement, initial: TouchParams) {
  let params = initial
  let gesture: Gesture | null = null

  const onStart = (event: TouchEvent) => {
    const touches = event.touches
    if (touches.length === 2) {
      const distance = spread(touches)
      gesture = {
        fingers: 2,
        point: midpoint(touches),
        spread: distance,
        origin: distance,
        zooming: false,
        down: null,
      }
      return
    }
    if (touches.length === 1 && params.panTarget?.(touches[0].target as Node)) {
      const point = pointOf(touches[0])
      gesture = {
        fingers: 1,
        point,
        spread: 0,
        origin: 0,
        zooming: false,
        // A pinch that lost a finger goes on panning with the one left; a
        // fresh press waits out the tap slack.
        down: gesture ? null : point,
      }
      return
    }
    gesture = null
  }

  const onMove = (event: TouchEvent) => {
    const touches = event.touches
    if (!gesture || touches.length !== gesture.fingers) return

    if (gesture.fingers === 1) {
      const point = pointOf(touches[0])
      if (gesture.down && !travelled(gesture.down, point)) return
      // Past the slack the finger is panning, not tapping: the page must not
      // scroll with it, and no click may follow it onto the plot underneath.
      event.preventDefault()
      gesture.down = null
      params.camera.panBy(point.x - gesture.point.x, point.y - gesture.point.y)
      gesture.point = point
      return
    }

    event.preventDefault()
    const point = midpoint(touches)
    const distance = spread(touches)
    const drift = gesture.origin > 0 ? distance / gesture.origin : 1
    const zooming =
      gesture.zooming || drift > PINCH_SLACK || drift < 1 / PINCH_SLACK
    // The frame the pinch engages on still only pans: scale is read from the
    // previous frame, so crossing the slack never jumps the view.
    const scale =
      gesture.zooming && gesture.spread > 0 ? distance / gesture.spread : 1
    params.camera.pinch(
      point,
      { x: point.x - gesture.point.x, y: point.y - gesture.point.y },
      scale
    )
    gesture = { ...gesture, point, spread: distance, zooming }
  }

  // A lifted finger restarts the gesture from the fingers still down.
  node.addEventListener('touchstart', onStart, { passive: true })
  node.addEventListener('touchmove', onMove, { passive: false })
  node.addEventListener('touchend', onStart, { passive: true })
  node.addEventListener('touchcancel', onStart, { passive: true })

  return {
    update(next: TouchParams) {
      params = next
    },
    destroy() {
      node.removeEventListener('touchstart', onStart)
      node.removeEventListener('touchmove', onMove)
      node.removeEventListener('touchend', onStart)
      node.removeEventListener('touchcancel', onStart)
    },
  }
}
