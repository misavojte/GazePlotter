/**
 * Workspace zoom: the level, the ways to change it, and its bounds, in one
 * place. It was previously split across a constants module, `Workspace.svelte`
 * (state + wheel handler + key branches) and the rail slider, which is how
 * Ctrl+wheel and Ctrl+0 came to disagree about when zoom is available.
 */

/** Minimum zoom level (most zoomed out). */
export const ZOOM_MIN = 0.5

/** Maximum zoom level (no zoom, full scale). */
export const ZOOM_MAX = 1

/** Increment per slider step and per keyboard step. */
export const ZOOM_STEP = 0.05

/** Sensitivity multiplier for Ctrl+wheel zoom. Smaller = finer control. */
export const ZOOM_WHEEL_SENSITIVITY = 0.001

/** Clamp a value to the valid zoom range. */
export function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))
}

export class WorkspaceZoom {
  // Every write goes through the setter, so nothing can hold an out-of-range
  // level — including the rail slider's `bind:`.
  #value = $state(ZOOM_MAX)
  #viewport: HTMLElement | null = null

  get value(): number {
    return this.#value
  }

  set value(next: number) {
    this.#value = clampZoom(next)
  }

  /** The scroll container zoom is measured against (for wheel compensation). */
  setViewport(element: HTMLElement | null): void {
    this.#viewport = element
  }

  in(): void {
    this.value = this.#value + ZOOM_STEP
  }

  out(): void {
    this.value = this.#value - ZOOM_STEP
  }

  reset(): void {
    this.value = ZOOM_MAX
  }

  /**
   * Zoom toward / away from the pointer, keeping the point under the cursor
   * visually stationary. Browsers report Ctrl+wheel and trackpad pinch
   * identically, so this one path covers Windows, Mac and touchpads.
   */
  wheel(event: WheelEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return
    event.preventDefault()

    const container = this.#viewport
    if (!container) return

    const oldZoom = this.#value
    const newZoom = clampZoom(oldZoom - event.deltaY * ZOOM_WHEEL_SENSITIVITY)
    if (newZoom === oldZoom) return

    // Pointer position relative to the container's padding box.
    const rect = container.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top

    // The grid-space coordinate under the cursor before zoom.
    const gridX = (container.scrollLeft + pointerX) / oldZoom
    const gridY = (container.scrollTop + pointerY) / oldZoom

    this.#value = newZoom

    // After Svelte flushes the DOM with the new zoom, adjust scroll so the
    // same grid-space point stays under the cursor.
    requestAnimationFrame(() => {
      container.scrollLeft = gridX * newZoom - pointerX
      container.scrollTop = gridY * newZoom - pointerY
    })
  }
}

/**
 * Ctrl+wheel zoom on an element. Its own action because the listener must be
 * `{ passive: false }` to call `preventDefault`, which `onwheel` cannot be.
 */
export function wheelZoomAction(node: HTMLElement, initial: WorkspaceZoom) {
  let zoom = initial
  const onWheel = (event: WheelEvent) => zoom.wheel(event)

  node.addEventListener('wheel', onWheel, { passive: false })

  return {
    update(next: WorkspaceZoom) {
      zoom = next
    },
    destroy() {
      node.removeEventListener('wheel', onWheel)
    },
  }
}
