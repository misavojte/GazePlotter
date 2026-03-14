import { updateContextMenu } from './contextMenuState.svelte'
import {
  type ContextMenuState,
  type MenuInteractiveItem,
  type MenuItem,
  isMenuDivider,
  isMenuFlyoutItem,
} from './types'

export function isOwnedContextMenuState(
  ownerId: symbol,
  value: ContextMenuState | null
): value is ContextMenuState {
  return Boolean(value && value.ownerId === ownerId)
}

export function clearOwnedContextMenu(ownerId: symbol): void {
  updateContextMenu(current =>
    isOwnedContextMenuState(ownerId, current) ? null : current
  )
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

export function isMenuActionActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' '
}
