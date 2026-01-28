import {
  MENU_WIDTH,
  MENU_MAX_HEIGHT,
  PADDING,
  DEFAULT_Z_INDEX,
  MODAL_Z_INDEX,
} from './const'
import type {
  MenuItem,
  Position,
  Alignment,
  Dimensions,
  Point,
  PlacementResult,
} from './types'

export { MENU_WIDTH, MENU_MAX_HEIGHT, PADDING }

/**
 * Compute aligned coordinate along an axis.
 */
export const aligned = (
  base: number,
  size: number,
  target: number,
  align: Alignment
): number => {
  if (align === 'start') return base
  if (align === 'center') return base + size / 2 - target / 2
  return base + size - target
}

/**
 * Compute absolute top/left for the menu given the anchor rect and options.
 */
export const computePlacement = (
  rect: DOMRect,
  menuSize: Dimensions,
  position: Position,
  offset: number,
  hAlign: Alignment,
  vAlign: Alignment
) => {
  const coords: Record<Position, { left: number; top: number }> = {
    top: {
      left: aligned(rect.left, rect.width, menuSize.width, hAlign),
      top: rect.top - offset - menuSize.height,
    },
    bottom: {
      left: aligned(rect.left, rect.width, menuSize.width, hAlign),
      top: rect.bottom + offset,
    },
    left: {
      left: rect.left - offset - menuSize.width,
      top: aligned(rect.top, rect.height, menuSize.height, vAlign),
    },
    right: {
      left: rect.right + offset,
      top: aligned(rect.top, rect.height, menuSize.height, vAlign),
    },
  }
  return coords[position]
}

/**
 * Adjust placement to avoid viewport collisions.
 *
 * @param preferred - The desired screen coordinates (left/top)
 * @param menuSize - Expected dimensions of the menu
 * @param viewport - Current viewport dimensions
 * @param anchorRect - Optional rect of the trigger element (used for flipping submenus)
 * @param allowFlip - Whether to try flipping to the other side of anchor if cut off
 */
export const adjustPlacementForViewport = (
  preferred: Point,
  menuSize: Dimensions,
  viewport: Dimensions,
  anchorRect?: DOMRect,
  allowFlip = false
): PlacementResult => {
  let left = preferred.x
  let top = preferred.y
  let isFlippedX = false
  let isFlippedY = false

  const vW = viewport.width
  const vH = viewport.height
  const p = PADDING

  // Horizontal check
  if (left + menuSize.width > vW - p) {
    if (allowFlip && anchorRect) {
      // Try to flip to the left of anchor
      const flippedX = anchorRect.left - menuSize.width
      if (flippedX >= p) {
        left = flippedX
        isFlippedX = true
      } else {
        // If flipping also fails, clamp to right edge
        left = vW - menuSize.width - p
      }
    } else {
      left = vW - menuSize.width - p
    }
  }

  if (left < p) {
    if (allowFlip && anchorRect) {
      // Try to flip to the right of anchor
      const flippedX = anchorRect.right
      if (flippedX + menuSize.width <= vW - p) {
        left = flippedX
        isFlippedX = false // Flipped back to right
      } else {
        left = p
      }
    } else {
      left = p
    }
  }

  // Vertical check: Favor clamping over flipping per user request
  // "try to place as much to the original position as possible"
  if (top + menuSize.height > vH - p) {
    // Clamping to bottom is the "minimal movement" strategy
    top = vH - menuSize.height - p
  }

  if (top < p) {
    top = p
  }

  return { left, top, isFlippedX, isFlippedY }
}

export const estimateMenuHeight = (
  items: MenuItem[] | undefined,
  hasContent: boolean
): number => {
  if (hasContent) return 50
  if (items && items.length > 0) {
    return items.reduce((acc, it) => {
      if (it.isDivider) return acc + 1 // Divider height
      return acc + 40 // Standard item height
    }, 0)
  }
  return 0
}

export const getMenuSize = (
  items: MenuItem[] | undefined,
  hasContent: boolean
): Dimensions => {
  const estimatedHeight = estimateMenuHeight(items, hasContent)
  return {
    width: MENU_WIDTH,
    height: Math.min(estimatedHeight, MENU_MAX_HEIGHT),
  }
}

/**
 * Check if the given element is inside a modal.
 */
export const isElementInModal = (element: HTMLElement): boolean => {
  let current: HTMLElement | null = element
  while (current && current !== document.body) {
    const role = current.getAttribute('role')
    if (role === 'dialog' || role === 'alertdialog') {
      return true
    }
    current = current.parentElement
  }
  return false
}

/**
 * Compute the z-index for the context menu based on the anchor's context.
 */
export const computeZIndex = (anchor: HTMLElement): number => {
  return isElementInModal(anchor) ? MODAL_Z_INDEX : DEFAULT_Z_INDEX
}

/**
 * Find all scrollable parent elements for the given element.
 */
export const findScrollableParents = (
  element: HTMLElement
): (Window | HTMLElement)[] => {
  const scrollable: (Window | HTMLElement)[] = [window]
  let current: HTMLElement | null = element

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current)
    const overflow = style.overflow
    const overflowX = style.overflowX
    const overflowY = style.overflowY

    const isScrollable =
      /auto|scroll|overlay/.test(overflow) ||
      /auto|scroll|overlay/.test(overflowX) ||
      /auto|scroll|overlay/.test(overflowY)

    const hasScrollableContent =
      current.scrollHeight > current.clientHeight ||
      current.scrollWidth > current.clientWidth

    if (isScrollable && hasScrollableContent) {
      scrollable.push(current)
    }

    current = current.parentElement
  }

  return scrollable
}
