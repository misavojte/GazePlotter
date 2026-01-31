import {
  MENU_WIDTH,
  MENU_MAX_HEIGHT,
  PADDING,
  DEFAULT_Z_INDEX,
  MODAL_Z_INDEX,
  ITEM_HEIGHT,
  DIVIDER_HEIGHT,
  ARROW_WIDTH,
  ARROW_HEIGHT,
  ARROW_GUTTER,
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
): Point => {
  switch (position) {
    case 'top':
      return {
        x: aligned(rect.left, rect.width, menuSize.width, hAlign),
        y: rect.top - offset - menuSize.height,
      }
    case 'bottom':
      return {
        x: aligned(rect.left, rect.width, menuSize.width, hAlign),
        y: rect.bottom + offset,
      }
    case 'left':
      return {
        x: rect.left - offset - menuSize.width,
        y: aligned(rect.top, rect.height, menuSize.height, vAlign),
      }
    case 'right':
      return {
        x: rect.right + offset,
        y: aligned(rect.top, rect.height, menuSize.height, vAlign),
      }
  }
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
      if (it.isDivider) return acc + DIVIDER_HEIGHT
      return acc + ITEM_HEIGHT
    }, 0)
  }
  return 0
}

/**
 * Determine which side the menu actually landed on relative to the anchor rect.
 * This is used to correctly position the arrow/pointer.
 */
export const getActualSide = (
  menuRect: { left: number; top: number; width: number; height: number },
  anchorRect: DOMRect | Point,
  fallback: Position
): Position => {
  const menuLeft = menuRect.left
  const menuTop = menuRect.top
  const menuRight = menuLeft + menuRect.width
  const menuBottom = menuTop + menuRect.height

  const isDOMRect = (r: any): r is DOMRect => 'bottom' in r

  if (isDOMRect(anchorRect)) {
    // If menu sits below the anchor rect, it's a 'bottom' placement
    if (menuTop >= anchorRect.bottom - 1) return 'bottom'
    // If menu sits above the anchor rect, it's a 'top' placement
    if (menuBottom <= anchorRect.top + 1) return 'top'
    // If menu sits to the right of the anchor rect, it's 'right'
    if (menuLeft >= anchorRect.right - 1) return 'right'
    // If menu sits to the left of the anchor rect, it's 'left'
    if (menuRight <= anchorRect.left + 1) return 'left'
  }

  return fallback
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
/**
 * Simple action to portal an element to the document body.
 * This is useful for avoiding overflow/containment issues.
 */
export const portal = (node: HTMLElement, target?: HTMLElement | string) => {
  let destination: HTMLElement | null = null

  if (typeof target === 'string') {
    destination = document.getElementById(target)
  } else if (target instanceof HTMLElement) {
    destination = target
  }

  const finalDestination = destination || document.body
  finalDestination.appendChild(node)

  return {
    destroy() {
      if (node.parentNode) {
        node.parentNode.removeChild(node)
      }
    },
  }
}

/**
 * Compute the CSS style for the menu arrow based on its position and anchor.
 */
export const getArrowStyle = (
  position: Position | undefined,
  anchor: Point | undefined,
  menu: { x: number; y: number; width?: number; height?: number }
): string => {
  if (!position || !anchor) return ''

  if (position === 'bottom' || position === 'top') {
    let left = anchor.x - menu.x - ARROW_WIDTH / 2
    const min = ARROW_GUTTER
    const max = (menu.width ?? MENU_WIDTH) - ARROW_GUTTER - ARROW_WIDTH
    left = Math.max(min, Math.min(left, max))
    const vertical = position === 'bottom' ? 'bottom: 100%' : 'top: 100%'
    return `left:${left}px; ${vertical};`
  } else {
    let top = anchor.y - menu.y - ARROW_HEIGHT / 2
    const min = ARROW_GUTTER
    const max = (menu.height ?? 200) - ARROW_GUTTER - ARROW_HEIGHT
    top = Math.max(min, Math.min(top, max))
    const horizontal = position === 'right' ? 'right: 100%' : 'left: 100%'
    return `${horizontal}; top:${top}px;`
  }
}
