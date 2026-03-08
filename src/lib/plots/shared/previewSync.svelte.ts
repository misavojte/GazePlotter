/**
 * A generic class to manage synchronization between a committed value and a preview value.
 * This ensures that submenus and other UI components can share the same "uncommitted" state
 * before it is finally applied.
 */
export class PreviewSync<T> {
  #getCommitted: () => T
  #preview: T | undefined = $state(undefined)

  constructor(getCommitted: () => T) {
    this.#getCommitted = getCommitted
  }

  /**
   * Takes the current value - preferring the preview if it exists,
   * otherwise falling back to the committed value.
   */
  get value(): T {
    return this.#preview !== undefined ? this.#preview : this.#getCommitted()
  }

  set value(v: T) {
    this.#preview = v
  }

  /**
   * Explicitly get the committed value, ignoring any preview.
   */
  get committed(): T {
    return this.#getCommitted()
  }

  /**
   * Explicitly get the preview value if it exists.
   */
  get preview(): T | undefined {
    return this.#preview
  }

  /**
   * Commits the current preview value logic.
   * NOTE: This does not update the underlying source (e.g. workspace store).
   * It is mostly useful for local-only state or manual overrides.
   * Usually, completion of a menu calls a command that updates the source,
   * which then updates #getCommitted() result.
   */
  commit() {
    this.#preview = undefined
  }

  /**
   * Discards the preview value, reverting .value to the committed state.
   */
  reset() {
    this.#preview = undefined
  }

  /**
   * Checks if there is an active preview that differs from the committed value.
   */
  get isDirty(): boolean {
    return this.#preview !== undefined && this.#preview !== this.#getCommitted()
  }
}

/**
 * Helper to manage a collection of PreviewSync objects, useful for
 * forms or complex menus that need to commit/reset multiple settings at once.
 */
export class PreviewGroup {
  #syncs = new Set<PreviewSync<any>>()

  add<T>(sync: PreviewSync<T>): PreviewSync<T> {
    this.#syncs.add(sync)
    return sync
  }

  commitAll() {
    for (const sync of this.#syncs) {
      sync.commit()
    }
  }

  resetAll() {
    for (const sync of this.#syncs) {
      sync.reset()
    }
  }

  get isDirty(): boolean {
    for (const sync of this.#syncs) {
      if (sync.isDirty) return true
    }
    return false
  }
}
