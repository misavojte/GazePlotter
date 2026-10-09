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

/**
 * Two-finger pan and pinch on touch screens. One finger is left to the page
 * (the frame's `touch-action: pan-x pan-y`), so the workspace never traps
 * page scrolling, as with an embedded map.
 */
export function cameraTouchAction(node: HTMLElement, initial: WorkspaceCamera) {
  let camera = initial
  let last: { mid: Point; spread: number } | null = null

  const onStart = (event: TouchEvent) => {
    last =
      event.touches.length === 2
        ? { mid: midpoint(event.touches), spread: spread(event.touches) }
        : null
  }

  const onMove = (event: TouchEvent) => {
    if (event.touches.length !== 2 || !last) return
    event.preventDefault()
    const mid = midpoint(event.touches)
    const distance = spread(event.touches)
    camera.pinch(
      mid,
      { x: mid.x - last.mid.x, y: mid.y - last.mid.y },
      last.spread > 0 ? distance / last.spread : 1
    )
    last = { mid, spread: distance }
  }

  const onEnd = (event: TouchEvent) => {
    onStart(event)
  }

  node.addEventListener('touchstart', onStart, { passive: true })
  node.addEventListener('touchmove', onMove, { passive: false })
  node.addEventListener('touchend', onEnd, { passive: true })
  node.addEventListener('touchcancel', onEnd, { passive: true })

  return {
    update(next: WorkspaceCamera) {
      camera = next
    },
    destroy() {
      node.removeEventListener('touchstart', onStart)
      node.removeEventListener('touchmove', onMove)
      node.removeEventListener('touchend', onEnd)
      node.removeEventListener('touchcancel', onEnd)
    },
  }
}
