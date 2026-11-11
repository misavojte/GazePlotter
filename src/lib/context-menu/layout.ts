import {
  MENU_WIDTH,
  MENU_MAX_HEIGHT,
  ITEM_HEIGHT,
  DIVIDER_HEIGHT,
  HEADING_HEIGHT,
  THUMBNAIL_ITEM_HEIGHT,
  SEARCH_HEIGHT,
} from './const'
import type { MenuItem } from './types'
import type { Dimensions } from '$lib/shared/placement'

const estimateMenuHeight = (
  items: MenuItem[] | undefined,
  hasContent: boolean
): number => {
  if (hasContent) return 50
  if (items && items.length > 0) {
    return items.reduce((acc, it) => {
      if (it.isDivider) return acc + (it.label ? HEADING_HEIGHT : DIVIDER_HEIGHT)
      return acc + (it.thumbnail ? THUMBNAIL_ITEM_HEIGHT : ITEM_HEIGHT)
    }, 0)
  }
  return 0
}

export const getMenuSize = (
  items: MenuItem[] | undefined,
  hasContent: boolean,
  options: { search?: string; maxHeight?: number } = {}
): Dimensions => {
  const estimatedHeight =
    estimateMenuHeight(items, hasContent) + (options.search ? SEARCH_HEIGHT : 0)
  return {
    width: MENU_WIDTH,
    height: Math.min(estimatedHeight, options.maxHeight ?? MENU_MAX_HEIGHT),
  }
}
