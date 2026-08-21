import {
  type OpenContextMenu,
  type MenuInteractiveItem,
  type MenuItem,
  isMenuDivider,
  isMenuFlyoutItem,
} from './types'

export function isOwnedContextMenuState(
  ownerId: symbol,
  value: OpenContextMenu | null
): value is OpenContextMenu {
  return Boolean(value && value.ownerId === ownerId)
}

export function highlightMenuItem(
  items: MenuItem[] | undefined,
  activeLabel: string | undefined
): void {
  if (!items) {
    return
  }

  for (const item of items) {
    if (!isMenuDivider(item)) {
      item.isHighlighted = item.label === activeLabel
    }
  }
}

export function shouldCloseMenuOnAction(item: MenuInteractiveItem): boolean {
  return !isMenuFlyoutItem(item) && item.closeOnAction !== false
}
