import {
  MENU_WIDTH,
  MENU_MAX_HEIGHT,
  ITEM_HEIGHT,
  DIVIDER_HEIGHT,
} from './const'
import type { MenuItem } from './types'
import type { Dimensions } from '$lib/shared/placement'

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
