import {
  MENU_WIDTH,
  MENU_MAX_HEIGHT,
  DEFAULT_Z_INDEX,
  MODAL_Z_INDEX,
  ITEM_HEIGHT,
  DIVIDER_HEIGHT,
} from './const'
import { portal } from '$lib/shared/actions/portal'
import type { MenuItem } from './types'
import type { Dimensions } from '$lib/shared/placement'

export { MENU_WIDTH, MENU_MAX_HEIGHT }
export { portal }

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
  return element.closest('[role="dialog"], [role="alertdialog"]') !== null
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
