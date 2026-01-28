/**
 * A generic class to manage synchronization between a committed value and a preview value.
 * This ensures that submenus and other UI components can share the same "uncommitted" state
 * before it is finally applied.
 */
export class PreviewSync<T> {
  #committed: T = $state() as T
  #preview: T | undefined = $state(undefined)

  constructor(initialValue: T) {
    this.#committed = initialValue
  }

  /**
   * Takes the current value - preferring the preview if it exists,
   * otherwise falling back to the committed value.
   */
  get value(): T {
    return this.#preview !== undefined ? this.#preview : this.#committed
  }

  set value(v: T) {
    this.#preview = v
  }

  /**
   * Explicitly get the committed value, ignoring any preview.
   */
  get committed(): T {
    return this.#committed
  }

  /**
   * Explicitly get the preview value if it exists.
   */
  get preview(): T | undefined {
    return this.#preview
  }

  /**
   * Updates the base committed value.
   * @param v New committed value
   * @param keepPreview If true, existing preview is preserved. If false (default), preview is cleared.
   */
  updateCommitted(v: T, keepPreview = false) {
    this.#committed = v
    if (!keepPreview) {
      this.#preview = undefined
    }
  }

  /**
   * Commits the current preview value to be the new committed value.
   * Clears the preview state.
   */
  commit() {
    if (this.#preview !== undefined) {
      this.#committed = this.#preview
      this.#preview = undefined
    }
  }

  /**
   * Discards the preview value, reverting .value to the committed state.
   */
  reset() {
    this.#preview = undefined
  }

  /**
   * Checks if there is an active preview that differs from the committed value.
   * Note: This uses simple equality check. For objects, you might want a custom comparator
   * but for primitives (settings) this is usually sufficient.
   */
  get isDirty(): boolean {
    return this.#preview !== undefined && this.#preview !== this.#committed
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
