import { writable } from 'svelte/store'
import type { MenuItem, SlideFrom } from '$lib/context-menu/components/contextMenuAction'

/**
 * Shape of the global context menu descriptor stored in Svelte.
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
  /** Symbol identifying which anchor currently controls the menu. */
  ownerId: symbol
  /** Z-index for the menu, automatically computed based on whether anchor is in a modal. */
  zIndex: number
}

/** Writable backing store for the active context menu. */
export const contextMenuStore = writable<ContextMenuState | null>(null)

/**
 * Update the context menu store with either a new value or a mutator.
 *
 * @param next - The next state or a function that maps the current state to the next state.
 */
export function updateContextMenu(
  next: ContextMenuState | null | ((curr: ContextMenuState | null) => ContextMenuState | null)
): void {
  if (typeof next === 'function') {
    contextMenuStore.update(next)
  } else {
    contextMenuStore.set(next)
  }
}


