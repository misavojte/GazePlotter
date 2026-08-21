import { sessionScoped } from '$lib/session/context'
import { isOwnedContextMenuState } from './behavior'
import type { OpenContextMenu } from './types'

/** Per-session context-menu state (`useContextMenu`). */
export class ContextMenuState {
  current = $state<OpenContextMenu | null>(null)

  /** Set, or map the current menu to the next; runs the outgoing cleanup. */
  update(
    next:
      | OpenContextMenu
      | null
      | ((curr: OpenContextMenu | null) => OpenContextMenu | null)
  ): void {
    const previous = this.current
    const incoming = typeof next === 'function' ? next(previous) : next
    if (previous && previous.cleanup && previous.ownerId !== incoming?.ownerId) {
      previous.cleanup()
    }
    this.current = incoming
  }

  /** Clear the current menu state. */
  reset(): void {
    this.update(null)
  }

  /** Clear only when `ownerId` owns the open menu. */
  clearOwned(ownerId: symbol): void {
    this.update(curr => (isOwnedContextMenuState(ownerId, curr) ? null : curr))
  }
}

/** This session's context menu; resolve at component init. */
export const useContextMenu = sessionScoped(() => new ContextMenuState())
