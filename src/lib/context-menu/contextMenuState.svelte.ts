import type { MenuItem, SlideFrom } from './contextMenuAction.svelte'

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
  /** Symbol identifying which anchor currently controls the menu. */
  ownerId: symbol
  /** Z-index for the menu, automatically computed based on whether anchor is in a modal. */
  zIndex: number
}

/** Reactive state for the active context menu. */
let _state = $state<ContextMenuState | null>(null);

/**
 * Global accessor for the context menu state.
 * Using a getter allows the state to remain reactive across module boundaries.
 */
export const contextMenuState = {
  get current() { return _state },
  set current(value: ContextMenuState | null) { _state = value }
}

/**
 * Update the context menu state with either a new value or a mutator.
 *
 * @param next - The next state or a function that maps the current state to the next state.
 */
export function updateContextMenu(
  next: ContextMenuState | null | ((curr: ContextMenuState | null) => ContextMenuState | null)
): void {
  if (typeof next === 'function') {
    _state = next(_state)
  } else {
    _state = next
  }
}
