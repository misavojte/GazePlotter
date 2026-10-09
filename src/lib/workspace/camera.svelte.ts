/**
 * The workspace camera: where the grid sits in the workspace frame and how
 * large it is drawn. The frame never scrolls; the grid is moved with one
 * `translate(x, y) scale(zoom)`, as in canvas tools. Panning is unbounded in
 * every direction except for a soft wall that keeps some content in view, and
 * "Zoom to fit" always brings the whole layout back.
 *
 * By default gestures are cooperative, as in an embedded map: the page
 * around the workspace keeps the plain mouse wheel, so the camera answers
 * Ctrl/Cmd+wheel and pinch (zoom), drags on empty space (pan) and two-finger
 * touch (pan and zoom). A host that gives GazePlotter the whole screen can
 * switch to canvas-first, where the plain wheel pans as well (`wheelPan`).
 */

/** Minimum zoom level (most zoomed out). */
export const ZOOM_MIN = 0.25

/** Maximum zoom level (full scale; plots render at 1:1). */
export const ZOOM_MAX = 1

/** Increment per zoom button and keyboard step. */
export const ZOOM_STEP = 0.05

/** Sensitivity multiplier for Ctrl+wheel zoom. Smaller = finer control. */
export const ZOOM_WHEEL_SENSITIVITY = 0.001

/**
 * The smallest zoom a fresh load opens at: below it plots stop being
 * readable, so a larger layout opens here and the rest is a pan away.
 */
export const OPEN_ZOOM_MIN = 0.5

/** Margin the grid keeps from the frame's edges at rest and after "fit". */
export const FRAME_INSET = { left: 24, right: 24, top: 24, bottom: 24 }

/** Content that always stays inside the frame when panning, in screen px. */
const VISIBLE_MARGIN = 120

/** Duration of animated camera moves (zoom steps, reset, fit, reveal). */
const ANIMATION_MS = 200

/** Clamp a value to the valid zoom range. */
export function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))
}

export type Point = { x: number; y: number }

/** A rectangle in grid space (unscaled px from the grid origin). */
export type GridBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

type CameraState = { x: number; y: number; zoom: number }

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export class WorkspaceCamera {
  #x = $state(FRAME_INSET.left)
  #y = $state(FRAME_INSET.top)
  #zoom = $state(ZOOM_MAX)
  #frame: HTMLElement | null = null
  #contentBounds: () => GridBounds | null = () => null
  #animation: number | null = null
  // Where a running animation ends, so repeated steps build on it rather than
  // on a half-finished frame.
  #target: CameraState | null = null

  /** Grid origin, in px from the frame's top-left corner. */
  get x(): number {
    return this.#x
  }

  get y(): number {
    return this.#y
  }

  get zoom(): number {
    return this.#zoom
  }

  /**
   * Direct write (host API): immediate, around the
   * middle of the frame. Every write is clamped.
   */
  set zoom(next: number) {
    this.#stop()
    this.#apply(this.#zoomedAround(this.#state(), next, this.#frameCentre()))
  }

  setFrame(element: HTMLElement | null): void {
    this.#frame = element
  }

  /** The layout's extent in grid px, for the soft wall and for "fit". */
  setContentBounds(read: () => GridBounds | null): void {
    this.#contentBounds = read
  }

  /**
   * The view a fresh load opens with: the whole layout at the largest zoom
   * that shows it (never below OPEN_ZOOM_MIN, never above 1:1), centred
   * horizontally and starting at the top, like a document opened at its
   * first page. A layout still wider than the frame starts at its left
   * edge instead. Immediate, no animation.
   */
  open(): void {
    this.#stop()
    const bounds = this.#contentBounds()
    const size = this.#frameSize()
    let zoom = ZOOM_MAX
    let centring = 0
    if (bounds && size) {
      const width = Math.max(1, bounds.right - bounds.left)
      const height = Math.max(1, bounds.bottom - bounds.top)
      const roomW = size.width - FRAME_INSET.left - FRAME_INSET.right
      const roomH = size.height - FRAME_INSET.top - FRAME_INSET.bottom
      const fit = Math.min(roomW / width, roomH / height)
      zoom = Math.min(ZOOM_MAX, Math.max(OPEN_ZOOM_MIN, fit))
      centring = Math.max(0, (roomW - width * zoom) / 2)
    }
    this.#zoom = zoom
    this.#x = FRAME_INSET.left + centring - (bounds?.left ?? 0) * zoom
    this.#y = FRAME_INSET.top - (bounds?.top ?? 0) * zoom
  }

  /** Put the grid origin at (x, y) in frame px, within the soft wall. */
  panTo(x: number, y: number): void {
    this.#stop()
    this.#apply({ x, y, zoom: this.#zoom })
  }

  panBy(dx: number, dy: number): void {
    this.panTo(this.#x + dx, this.#y + dy)
  }

  /**
   * Follow a shift of the whole layout by (dx, dy) grid px so nothing moves
   * on screen. Not clamped: the content did not move, only its coordinates.
   */
  followShift(dx: number, dy: number): void {
    const target = this.#target
    this.#stop()
    this.#x -= dx * this.#zoom
    this.#y -= dy * this.#zoom
    if (target) {
      // A running animation was heading somewhere; keep heading there.
      this.#animateTo({
        x: target.x - dx * target.zoom,
        y: target.y - dy * target.zoom,
        zoom: target.zoom,
      })
    }
  }

  in(): void {
    this.#stepTo((this.#target ?? this.#state()).zoom + ZOOM_STEP)
  }

  out(): void {
    this.#stepTo((this.#target ?? this.#state()).zoom - ZOOM_STEP)
  }

  reset(): void {
    this.#stepTo(ZOOM_MAX)
  }

  /** Zoom and pan so the whole layout fits the frame (never above 1:1). */
  fit(): void {
    const bounds = this.#contentBounds()
    const size = this.#frameSize()
    if (!bounds || !size) return
    const width = Math.max(1, bounds.right - bounds.left)
    const height = Math.max(1, bounds.bottom - bounds.top)
    const inset = FRAME_INSET
    const roomW = size.width - inset.left - inset.right
    const roomH = size.height - inset.top - inset.bottom
    const zoom = clampZoom(Math.min(roomW / width, roomH / height))
    this.#animateTo({
      zoom,
      x: inset.left + (roomW - width * zoom) / 2 - bounds.left * zoom,
      y: inset.top + (roomH - height * zoom) / 2 - bounds.top * zoom,
    })
  }

  /** Bring a grid-space rectangle to the middle of the frame, same zoom. */
  reveal(rect: GridBounds): void {
    const size = this.#frameSize()
    if (!size) return
    const zoom = this.#zoom
    this.#animateTo({
      zoom,
      x: size.width / 2 - ((rect.left + rect.right) / 2) * zoom,
      y: size.height / 2 - ((rect.top + rect.bottom) / 2) * zoom,
    })
  }

  /**
   * Ctrl/Cmd+wheel (and trackpad pinch, which browsers report the same way)
   * zooms around the pointer. Returns false for a plain wheel, which belongs
   * to the page: the caller may show the "Ctrl + scroll to zoom" hint.
   */
  wheel(event: WheelEvent): boolean {
    if (!(event.ctrlKey || event.metaKey)) return false
    event.preventDefault()
    if (!this.#frame) return true
    this.#stop()
    const anchor = this.#toFrame({ x: event.clientX, y: event.clientY })
    const zoom = this.#zoom - event.deltaY * ZOOM_WHEEL_SENSITIVITY
    this.#apply(this.#zoomedAround(this.#state(), zoom, anchor))
    return true
  }

  /**
   * Canvas-first mode: a plain wheel (or two-finger trackpad scroll) pans.
   * Shift+wheel pans sideways on mice that only scroll vertically.
   */
  wheelPan(event: WheelEvent): void {
    event.preventDefault()
    // deltaMode 1 = lines (Firefox with some mice), 2 = pages.
    const page = this.#frameSize()?.height ?? 600
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? page : 1
    let dx = event.deltaX * unit
    let dy = event.deltaY * unit
    if (event.shiftKey && dx === 0) {
      dx = dy
      dy = 0
    }
    this.panBy(-dx, -dy)
  }

  /**
   * One step of a two-finger touch gesture: the midpoint moved by `delta`
   * (screen px) and the finger distance changed by `scale`.
   */
  pinch(midpoint: Point, delta: Point, scale: number): void {
    this.#stop()
    const anchor = this.#toFrame(midpoint)
    const moved = {
      x: this.#x + delta.x,
      y: this.#y + delta.y,
      zoom: this.#zoom,
    }
    this.#apply(this.#zoomedAround(moved, this.#zoom * scale, anchor))
  }

  /** Stop any running animation where it is (a new gesture takes over). */
  stop(): void {
    this.#stop()
  }

  destroy(): void {
    this.#stop()
    this.#frame = null
  }

  #stepTo(zoom: number): void {
    const from = this.#target ?? this.#state()
    this.#animateTo(this.#zoomedAround(from, zoom, this.#frameCentre()))
  }

  #state(): CameraState {
    return { x: this.#x, y: this.#y, zoom: this.#zoom }
  }

  /** `state` zoomed to `next`, keeping the grid point under `anchor` still. */
  #zoomedAround(
    state: CameraState,
    next: number,
    anchor: Point | null
  ): CameraState {
    const zoom = clampZoom(next)
    if (!anchor) return { ...state, zoom }
    const ratio = zoom / state.zoom
    return {
      zoom,
      x: anchor.x - (anchor.x - state.x) * ratio,
      y: anchor.y - (anchor.y - state.y) * ratio,
    }
  }

  /**
   * The soft wall: at least VISIBLE_MARGIN px of the layout (or a quarter of
   * the frame, if smaller) stays inside the frame on each axis.
   */
  #clamped(state: CameraState): CameraState {
    const bounds = this.#contentBounds()
    const size = this.#frameSize()
    if (!bounds || !size) return state
    const axis = (
      position: number,
      start: number,
      end: number,
      frame: number
    ) => {
      const margin = Math.min(VISIBLE_MARGIN, frame / 4)
      const min = margin - end * state.zoom
      const max = frame - margin - start * state.zoom
      if (min > max) return (min + max) / 2
      return Math.min(max, Math.max(min, position))
    }
    return {
      zoom: state.zoom,
      x: axis(state.x, bounds.left, bounds.right, size.width),
      y: axis(state.y, bounds.top, bounds.bottom, size.height),
    }
  }

  #apply(state: CameraState): void {
    const next = this.#clamped(state)
    this.#x = next.x
    this.#y = next.y
    this.#zoom = next.zoom
  }

  #animateTo(state: CameraState): void {
    const to = this.#clamped(state)
    const from = this.#state()
    this.#stop()
    const raf = globalThis.requestAnimationFrame
    if (!raf || prefersReducedMotion()) {
      this.#apply(to)
      return
    }
    this.#target = to
    const start = globalThis.performance?.now() ?? Date.now()
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS)
      const k = easeOutCubic(t)
      this.#x = from.x + (to.x - from.x) * k
      this.#y = from.y + (to.y - from.y) * k
      this.#zoom = from.zoom + (to.zoom - from.zoom) * k
      if (t < 1) {
        this.#animation = raf(frame)
      } else {
        this.#animation = null
        this.#target = null
      }
    }
    this.#animation = raf(frame)
  }

  #stop(): void {
    if (this.#animation !== null) {
      globalThis.cancelAnimationFrame?.(this.#animation)
    }
    this.#animation = null
    this.#target = null
  }

  #frameSize(): { width: number; height: number } | null {
    if (!this.#frame) return null
    const width = this.#frame.clientWidth
    const height = this.#frame.clientHeight
    return width > 0 && height > 0 ? { width, height } : null
  }

  #frameCentre(): Point | null {
    const size = this.#frameSize()
    return size ? { x: size.width / 2, y: size.height / 2 } : null
  }

  /** Client (viewport) coordinates to frame (padding-box) coordinates. */
  #toFrame(point: Point): Point {
    const frame = this.#frame
    if (!frame) return point
    const rect = frame.getBoundingClientRect()
    return {
      x: point.x - rect.left - frame.clientLeft,
      y: point.y - rect.top - frame.clientTop,
    }
  }
}
