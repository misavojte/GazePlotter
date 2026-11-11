import type { Component } from 'svelte'
import type { LucideIconComponent } from '$lib/shared/icon'
import type { Position, Alignment } from '$lib/shared/placement/types'

export type SlideFrom = 'top' | 'left'


interface MenuDisplayItem {
  label?: string
  icon?: LucideIconComponent
  /** Secondary line rendered below the label in muted style. */
  detail?: string
  /** Keyboard shortcut, shown muted at the row's end ("Ctrl+D"). */
  shortcut?: string
  /** Leading 48×32 picture: trusted, static SVG markup (never user data). */
  thumbnail?: string
  /** Extra words a searchable menu matches besides label and detail. */
  keywords?: string
  isHighlighted?: boolean
  disabled?: boolean
  /** Why a disabled item is unavailable; shown in its detail's place, as a warning. */
  disabledReason?: string
  closeOnAction?: boolean
  /** Optional hover/focus-only trailing action. Click is independent of the
   *  row's main onAction and does NOT trigger row selection; the menu
   *  auto-closes after invoking it. */
  secondaryAction?: {
    icon: LucideIconComponent
    label: string
    onAction: () => void
  }
}

/** A rule between items; with a `label`, a section heading instead. */
export interface MenuDividerItem {
  isDivider: true
  label?: string
}

export interface MenuActionItem extends MenuDisplayItem {
  value?: string
  onAction?: (value?: string) => void
  isDivider?: false
}

export interface MenuSubMenuItem extends MenuActionItem {
  children: MenuItem[]
  /** Width of the flyout in px; MENU_WIDTH when unset. */
  childrenWidth?: number
  component?: never
  componentProps?: never
  componentHeight?: never
  componentWidth?: never
}

export interface MenuComponentBridgeProps {
  item: MenuItem
  onAction: (data?: unknown) => void
  close: () => void
}

export interface MenuComponentItem extends MenuActionItem {
  children?: never
  childrenWidth?: never
  component: Component<Record<string, unknown>>
  componentProps?: Record<string, unknown>
  componentHeight?: number
  componentWidth?: number
}

export type MenuInteractiveItem =
  | MenuActionItem
  | MenuSubMenuItem
  | MenuComponentItem

export type MenuFlyoutItem = MenuSubMenuItem | MenuComponentItem

export type MenuItem = MenuDividerItem | MenuInteractiveItem

export interface ContextMenuOptions {
  items?: MenuItem[]
  content?: string
  anchor?: HTMLElement
  position?: Position
  verticalAlign?: Alignment
  horizontalAlign?: Alignment
  offset?: number
  slideFrom?: SlideFrom
  /** When set, items with a `value` field render a leading radio/checkbox
   *  affordance, checked iff `isHighlighted`. Used by Select; action menus
   *  leave it unset. */
  selectionMode?: 'radio' | 'checkbox'
  /** Placeholder of a search box above the items; the box filters them
   *  (label, detail, keywords) and keeps a heading while its section has a
   *  match. Unset: no search box. */
  search?: string
  /** Override the menu height cap in px (MENU_MAX_HEIGHT). */
  maxHeight?: number
  /** Override the menu width in px. Default falls back to MENU_WIDTH.
   *  Width sourcing (e.g. matching a trigger) is the consumer's responsibility. */
  width?: number
  /** 'pointer': only a right-click opens the menu, at the pointer, and plain
   *  clicks pass through to the element. Default 'anchor': click or
   *  right-click opens it against the element. */
  trigger?: 'anchor' | 'pointer'
  disabled?: boolean
  onOpen?: () => void
  onClose?: () => void
}

/**
 * Shape of the global context menu descriptor stored in Svelte state.
 *
 * @remarks
 * The `ownerId` allows multiple context menu anchors to coordinate access to
 * the single rendered menu instance so that an anchor can recognise whether it
 * currently "owns" the menu.
 */
export interface OpenContextMenu {
  /** The menu entries rendered for actionable items. */
  items?: MenuItem[]
  /** Optional custom markup content. */
  content?: string
  /** Absolute X position in the viewport. */
  x: number
  /** Absolute Y position in the viewport. */
  y: number
  /** Direction the menu slides in from. */
  slideFrom: SlideFrom
  /** When set, value-bearing items render a leading radio/checkbox indicator. */
  selectionMode?: 'radio' | 'checkbox'
  /** Resolved menu width in px (overrides MENU_WIDTH when set). */
  width?: number
  /** Search box placeholder; unset means no search box. */
  search?: string
  /** Height cap in px (overrides MENU_MAX_HEIGHT when set). */
  maxHeight?: number
  /** Symbol identifying which anchor currently controls the menu. */
  ownerId: symbol
  /** Z-index for the menu, automatically computed based on whether anchor is in a modal. */
  zIndex: number
  /** Cleanup callback to run when this menu is closed or replaced. */
  cleanup?: () => void
}

export function isMenuDivider(item: MenuItem): item is MenuDividerItem {
  return item.isDivider === true
}

function isMenuSubMenuItem(item: MenuItem): item is MenuSubMenuItem {
  return 'children' in item && Array.isArray(item.children)
}

export function isMenuComponentItem(
  item: MenuItem
): item is MenuComponentItem {
  return 'component' in item && item.component !== undefined
}

export function isMenuFlyoutItem(
  item: MenuItem
): item is MenuFlyoutItem {
  return isMenuSubMenuItem(item) || isMenuComponentItem(item)
}

type MenuComponentItemDefinition<
  TComponentProps extends Record<string, unknown>,
> = Omit<MenuComponentItem, 'component' | 'componentProps' | 'label' | 'value'> & {
  label: string
  value: string
  component: Component<TComponentProps & MenuComponentBridgeProps>
  componentProps?: TComponentProps
}

export function createMenuComponentItem<
  TComponentProps extends Record<string, unknown> = Record<string, never>,
>(
  item: MenuComponentItemDefinition<TComponentProps>
): MenuComponentItemDefinition<TComponentProps> {
  return item
}

