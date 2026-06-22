import type { Action } from 'svelte/action'

/**
 * Marks the element and its subtree as a "no-select" zone for the grid-item
 * click-to-select behavior. Used for plot figures, legends, and any other
 * region that has its own click semantics — while the host is hovering or
 * clicking inside this region, the grid-item's dashed affordance is
 * suppressed and the click does not toggle selection.
 *
 * Consumers can equivalently set `data-block-select` directly on the
 * element; this action exists mostly so the intent is visible in code.
 *
 * Detection lives in `GridItem.svelte` (click handler + CSS `:has()` rule).
 */
const BLOCK_SELECT_ATTR = 'data-block-select'

export const blockGridSelect: Action<HTMLElement> = node => {
  node.setAttribute(BLOCK_SELECT_ATTR, '')
  return {
    destroy() {
      node.removeAttribute(BLOCK_SELECT_ATTR)
    },
  }
}
