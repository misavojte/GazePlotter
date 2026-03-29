import type { InteractionPoint, ScrollOffset } from './model'

type AutoScrollDirection = {
  x: -1 | 0 | 1
  y: -1 | 0 | 1
}

export class GridViewportController {
  #element: HTMLElement | null = null
  #autoScrollDirection: AutoScrollDirection = { x: 0, y: 0 }
  #autoScrollRafId: number | null = null
  #currentSpeedX = 0
  #currentSpeedY = 0
  #onAfterScroll: (() => void) | null = null

  setElement(element: HTMLElement | null): void {
    this.#element = element
  }

  getScrollOffset(): ScrollOffset {
    return {
      x: this.#getScrollX(),
      y: this.#getScrollY(),
    }
  }

  panBy(deltaX: number, deltaY: number): void {
    this.#setScrollX(this.#getScrollX() - deltaX * 0.6)
    this.#setScrollY(this.#getScrollY() - deltaY * 0.6)
  }

  updateAutoScroll(
    pointer: InteractionPoint,
    onAfterScroll?: () => void
  ): void {
    if (!this.#canAccessViewport()) return

    this.#onAfterScroll = onAfterScroll ?? null

    const edgeThreshold = 25
    const viewportBounds = {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    }

    let nextDirectionX: -1 | 0 | 1 = 0
    let nextDirectionY: -1 | 0 | 1 = 0

    if (pointer.x >= viewportBounds.right - edgeThreshold) {
      nextDirectionX = 1
    } else if (pointer.x <= edgeThreshold && this.#getScrollX() > 0) {
      nextDirectionX = -1
    }

    if (pointer.y >= viewportBounds.bottom - edgeThreshold) {
      nextDirectionY = 1
    } else if (pointer.y <= edgeThreshold && this.#getScrollY() > 0) {
      nextDirectionY = -1
    }

    this.#autoScrollDirection = {
      x: nextDirectionX,
      y: nextDirectionY,
    }

    if (
      (nextDirectionX !== 0 || nextDirectionY !== 0) &&
      this.#autoScrollRafId === null
    ) {
      this.#currentSpeedX = nextDirectionX * 0.5
      this.#currentSpeedY = nextDirectionY * 0.5
      this.#autoScrollRafId = requestAnimationFrame(() => this.#step())
    }
  }

  stopAutoScroll(): void {
    if (this.#autoScrollRafId !== null) {
      cancelAnimationFrame(this.#autoScrollRafId)
    }
    this.#autoScrollRafId = null
    this.#autoScrollDirection = { x: 0, y: 0 }
    this.#currentSpeedX = 0
    this.#currentSpeedY = 0
    this.#onAfterScroll = null
  }

  destroy(): void {
    this.stopAutoScroll()
    this.#element = null
  }

  #step(): void {
    if (!this.#canAccessViewport()) {
      this.stopAutoScroll()
      return
    }

    const maxSpeed = 8
    const acceleration = 0.08
    const deceleration = 0.15
    const direction = this.#autoScrollDirection

    if (direction.x !== 0) {
      const currentX = this.#getScrollX()
      let effectiveMaxSpeed = maxSpeed
      if (direction.x < 0 && currentX < 150) {
        effectiveMaxSpeed = maxSpeed * (currentX / 150)
      }
      const targetSpeed = direction.x * effectiveMaxSpeed
      this.#currentSpeedX =
        this.#currentSpeedX + (targetSpeed - this.#currentSpeedX) * acceleration
    } else {
      this.#currentSpeedX =
        Math.abs(this.#currentSpeedX) > 0.05
          ? this.#currentSpeedX * (1 - deceleration)
          : 0
    }

    if (direction.y !== 0) {
      const currentY = this.#getScrollY()
      let effectiveMaxSpeed = maxSpeed
      if (direction.y < 0 && currentY < 150) {
        effectiveMaxSpeed = maxSpeed * (currentY / 150)
      }
      const targetSpeed = direction.y * effectiveMaxSpeed
      this.#currentSpeedY =
        this.#currentSpeedY + (targetSpeed - this.#currentSpeedY) * acceleration
    } else {
      this.#currentSpeedY =
        Math.abs(this.#currentSpeedY) > 0.05
          ? this.#currentSpeedY * (1 - deceleration)
          : 0
    }

    if (Math.abs(this.#currentSpeedX) > 0.05) {
      this.#setScrollX(this.#getScrollX() + this.#currentSpeedX)
    }

    if (Math.abs(this.#currentSpeedY) > 0.05) {
      this.#setScrollY(this.#getScrollY() + this.#currentSpeedY)
    }

    this.#onAfterScroll?.()

    if (
      Math.abs(this.#currentSpeedX) < 0.05 &&
      Math.abs(this.#currentSpeedY) < 0.05 &&
      direction.x === 0 &&
      direction.y === 0
    ) {
      this.stopAutoScroll()
      return
    }

    this.#autoScrollRafId = requestAnimationFrame(() => this.#step())
  }

  #canAccessViewport(): boolean {
    return typeof window !== 'undefined'
  }

  #getScrollX(): number {
    return this.#element?.scrollLeft ?? 0
  }

  #setScrollX(value: number): void {
    if (this.#element) {
      this.#element.scrollLeft = value
    }
  }

  #getScrollY(): number {
    return typeof window !== 'undefined' ? window.scrollY : 0
  }

  #setScrollY(value: number): void {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, value)
    }
  }
}
