export type SlideFrom = 'top' | 'left'
export type Position = 'top' | 'bottom' | 'left' | 'right'
export type Alignment = 'start' | 'center' | 'end'

export interface Point {
  x: number
  y: number
}

export interface Dimensions {
  width: number
  height: number
}

import type { Component } from 'svelte'
import type { LucideIconComponent } from '$lib/shared/types/iconComponent'

interface MenuDisplayItem {
  label?: string
  icon?: LucideIconComponent
  isHighlighted?: boolean
  disabled?: boolean
  closeOnAction?: boolean
}

export interface MenuDividerItem {
  isDivider: true
}

export interface MenuActionItem extends MenuDisplayItem {
  value?: string
  onAction?: (value?: string) => void
  isDivider?: false
}

export interface MenuSubMenuItem extends MenuActionItem {
  children: MenuItem[]
  component?: never
  componentProps?: never
  componentHeight?: never
}

export interface MenuComponentBridgeProps {
  item: MenuItem
  onAction: (data?: unknown) => void
  close: () => void
}

export interface MenuComponentItem extends MenuActionItem {
  children?: never
  component: Component<Record<string, unknown>>
  componentProps?: Record<string, unknown>
  componentHeight?: number
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
export interface ContextMenuState {
  /** Whether the menu should be visible. */
  visible: boolean
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
  /** Placement preference used to compute the arrow direction (top/bottom/left/right). */
  position?: Position
  /** Anchor center in viewport coords used to align the pointer. */
  anchorCenter?: Point
  /** Symbol identifying which anchor currently controls the menu. */
  ownerId: symbol
  /** Z-index for the menu, automatically computed based on whether anchor is in a modal. */
  zIndex: number
}

export interface PlacementResult {
  left: number
  top: number
  isFlippedX: boolean
  isFlippedY: boolean
}

export function isMenuDivider(item: MenuItem): item is MenuDividerItem {
  return item.isDivider === true
}

export function isMenuSubMenuItem(item: MenuItem): item is MenuSubMenuItem {
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
