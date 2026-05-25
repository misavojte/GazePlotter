import type { ContextMenuState } from './types'

/** Reactive state for the active context menu. */
let _state = $state<ContextMenuState | null>(null)

/**
 * Global accessor for the context menu state.
 * Using a getter allows the state to remain reactive across module boundaries.
 */
export const contextMenuState = {
  get current() {
    return _state
  },
  set current(value: ContextMenuState | null) {
    updateContextMenu(value)
  },
  /** Clear the current menu state. */
  reset() {
    updateContextMenu(null)
  },
}

/**
 * Update the context menu state with either a new value or a mutator.
 *
 * @param next - The next state or a function that maps the current state to the next state.
 */
export function updateContextMenu(
  next:
    | ContextMenuState
    | null
    | ((curr: ContextMenuState | null) => ContextMenuState | null)
): void {
  const previous = _state
  let incoming: ContextMenuState | null = null

  if (typeof next === 'function') {
    incoming = next(_state)
  } else {
    incoming = next
  }

  if (previous && previous.cleanup && previous.ownerId !== incoming?.ownerId) {
    previous.cleanup()
  }

  _state = incoming
}
