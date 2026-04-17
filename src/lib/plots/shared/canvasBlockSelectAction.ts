import type { Action } from 'svelte/action'

export interface BlockedRegion {
  /** CSS-pixel x offset relative to the canvas's top-left. */
  x: number
  /** CSS-pixel y offset relative to the canvas's top-left. */
  y: number
  /** CSS-pixel width. */
  w: number
  /** CSS-pixel height. */
  h: number
}

export interface CanvasBlockSelectOptions {
  /**
   * Rectangular regions (CSS px, relative to canvas top-left) where
   * clicks should NOT toggle grid-item selection — typically the data
   * plot area and interactive legends. Pass an empty array to keep the
   * whole canvas clickable.
   */
  regions: BlockedRegion[]
}

/**
 * Spatial variant of `blockGridSelect` for canvas-drawn plots. Unlike
 * that action which statically flags a whole DOM subtree, this one
 * toggles the `data-block-select` attribute on the canvas itself based
 * on cursor position — because hit-testing inside a canvas has no DOM
 * structure to attach the flag to.
 *
 * Two effects flow from that attribute being present on the canvas
 * under the cursor:
 *   1. `GridItem.onFrameClick` skips selection toggling when the click
 *      target (the canvas) matches `[data-block-select]` via closest().
 *   2. `.grid-item-frame:hover:not(...):not(:has([data-block-select]:hover))`
 *      suppresses the dashed hover outline while the cursor sits in a
 *      blocked region, so the affordance honestly matches where the
 *      click would actually take effect.
 *
 * Outside the blocked regions the canvas is plain clickable surface —
 * clicks bubble up to the frame, selection toggles, hover shows the
 * preview outline. That's the whole point: only the data-bearing area
 * (and any interactive legend strip) reads as "don't click me to
 * select"; everything else — padding, title strip below axes, empty
 * chrome — now reads as "click me to open settings."
 */
export const canvasBlockSelect: Action<
  HTMLCanvasElement,
  CanvasBlockSelectOptions
> = (node, initial) => {
  let opts = initial

  function isInAnyRegion(cssX: number, cssY: number): boolean {
    for (const r of opts.regions) {
      if (
        cssX >= r.x &&
        cssX < r.x + r.w &&
        cssY >= r.y &&
        cssY < r.y + r.h
      ) {
        return true
      }
    }
    return false
  }

  function onMove(e: MouseEvent): void {
    const rect = node.getBoundingClientRect()
    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top
    if (isInAnyRegion(cssX, cssY)) {
      node.setAttribute('data-block-select', '')
    } else {
      node.removeAttribute('data-block-select')
    }
  }

  function onLeave(): void {
    node.removeAttribute('data-block-select')
  }

  node.addEventListener('mousemove', onMove)
  node.addEventListener('mouseleave', onLeave)

  return {
    update(next: CanvasBlockSelectOptions) {
      opts = next
    },
    destroy() {
      node.removeEventListener('mousemove', onMove)
      node.removeEventListener('mouseleave', onLeave)
      node.removeAttribute('data-block-select')
    },
  }
}
