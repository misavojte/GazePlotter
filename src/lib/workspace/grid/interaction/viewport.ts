import type { InteractionPoint, ScrollOffset } from './model'

type AutoPanDirection = {
  x: -1 | 0 | 1
  y: -1 | 0 | 1
}

/** The camera as the interaction layer sees it: an offset it can move. */
export type InteractionCamera = {
  readonly x: number
  readonly y: number
  panTo(x: number, y: number): void
}

/**
 * The workspace frame and its camera, as the drag/resize/pan gestures need
 * them. The frame never scrolls: "scroll offset" here is the camera offset
 * negated (content moves left as the view moves right), which keeps the
 * gesture model's pointer + scroll arithmetic unchanged.
 */
export class GridViewportController {
  #element: HTMLElement | null = null
  #camera: InteractionCamera | null = null
  #direction: AutoPanDirection = { x: 0, y: 0 }
  #rafId: number | null = null
  #speedX = 0
  #speedY = 0
  #onAfterPan: (() => void) | null = null

  setElement(element: HTMLElement | null): void {
    this.#element = element
  }

  setCamera(camera: InteractionCamera | null): void {
    this.#camera = camera
  }

  getElement(): HTMLElement | null {
    return this.#element
  }

  getScrollOffset(): ScrollOffset {
    return { x: -(this.#camera?.x ?? 0), y: -(this.#camera?.y ?? 0) }
  }

  scrollTo(offset: ScrollOffset): void {
    this.#camera?.panTo(-offset.x, -offset.y)
  }

  /**
   * The part of the screen the workspace shows through: the frame's box
   * clipped to the window. Edge auto-pan measures against this.
   */
  getVisibleBounds(): {
    left: number
    top: number
    right: number
    bottom: number
  } {
    const windowW = typeof window !== 'undefined' ? window.innerWidth : 0
    const windowH = typeof window !== 'undefined' ? window.innerHeight : 0
    const rect = this.#element?.getBoundingClientRect()
    if (!rect) return { left: 0, top: 0, right: windowW, bottom: windowH }
    return {
      left: Math.max(0, rect.left),
      top: Math.max(0, rect.top),
      right: Math.min(windowW, rect.right),
      bottom: Math.min(windowH, rect.bottom),
    }
  }

  /** Pan the camera while a dragged plot is held near a frame edge. */
  updateAutoScroll(pointer: InteractionPoint, onAfterPan?: () => void): void {
    if (typeof window === 'undefined' || !this.#camera) return

    this.#onAfterPan = onAfterPan ?? null

    const edge = 25
    const bounds = this.getVisibleBounds()
    const x: -1 | 0 | 1 =
      pointer.x >= bounds.right - edge
        ? 1
        : pointer.x <= bounds.left + edge
          ? -1
          : 0
    const y: -1 | 0 | 1 =
      pointer.y >= bounds.bottom - edge
        ? 1
        : pointer.y <= bounds.top + edge
          ? -1
          : 0

    this.#direction = { x, y }

    if ((x !== 0 || y !== 0) && this.#rafId === null) {
      this.#speedX = x * 0.5
      this.#speedY = y * 0.5
      this.#rafId = requestAnimationFrame(() => this.#step())
    }
  }

  stopAutoScroll(): void {
    if (this.#rafId !== null) cancelAnimationFrame(this.#rafId)
    this.#rafId = null
    this.#direction = { x: 0, y: 0 }
    this.#speedX = 0
    this.#speedY = 0
    this.#onAfterPan = null
  }

  destroy(): void {
    this.stopAutoScroll()
    this.#element = null
    this.#camera = null
  }

  // Accelerate toward the direction's top speed; decay toward 0 when idle.
  #nextSpeed(direction: -1 | 0 | 1, speed: number): number {
    const maxSpeed = 8
    const acceleration = 0.08
    const deceleration = 0.15
    if (direction === 0) {
      return Math.abs(speed) > 0.05 ? speed * (1 - deceleration) : 0
    }
    return speed + (direction * maxSpeed - speed) * acceleration
  }

  #step(): void {
    const camera = this.#camera
    if (!camera) {
      this.stopAutoScroll()
      return
    }

    this.#speedX = this.#nextSpeed(this.#direction.x, this.#speedX)
    this.#speedY = this.#nextSpeed(this.#direction.y, this.#speedY)

    if (Math.abs(this.#speedX) > 0.05 || Math.abs(this.#speedY) > 0.05) {
      camera.panTo(camera.x - this.#speedX, camera.y - this.#speedY)
    }

    this.#onAfterPan?.()

    if (
      Math.abs(this.#speedX) < 0.05 &&
      Math.abs(this.#speedY) < 0.05 &&
      this.#direction.x === 0 &&
      this.#direction.y === 0
    ) {
      this.stopAutoScroll()
      return
    }

    this.#rafId = requestAnimationFrame(() => this.#step())
  }
}
