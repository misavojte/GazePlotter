import { MENU_WIDTH, MENU_MAX_HEIGHT, PADDING } from './const'
import type {
  MenuItem,
  Position,
  Alignment,
  ContextMenuOptions,
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
  menuSize: { width: number; height: number },
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
  preferred: { left: number; top: number },
  menuSize: { width: number; height: number },
  viewport: { width: number; height: number },
  anchorRect?: DOMRect,
  allowFlip = false
): PlacementResult => {
  let left = preferred.left
  let top = preferred.top
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
    // Each item renders as a simple button trigger (approx 40px)
    // even if it opens a complex submenu or component.
    return items.length * 40
  }
  return 0
}

export const getMenuSize = (
  items: MenuItem[] | undefined,
  hasContent: boolean
) => {
  const estimatedHeight = estimateMenuHeight(items, hasContent)
  return {
    width: MENU_WIDTH,
    height: Math.min(estimatedHeight, MENU_MAX_HEIGHT),
  }
}
