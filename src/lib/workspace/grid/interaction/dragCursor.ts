/**
 * The cursor a canvas drag wears, and the text selection it must not leave
 * behind: a deferred drag never prevented its press, so a selection may have
 * started under it.
 *
 * The body always carries the cursor. Extra targets carry it as well, for
 * surfaces whose own CSS cursor would otherwise win; a function is read on
 * each call, since the host may bind its element later. A caller that passes
 * none keeps whatever cursor its CSS already states (the grid item's `move`).
 */
export function createDragCursor(
  ...targets: (HTMLElement | (() => HTMLElement | null | undefined))[]
): (cursor: string) => void {
  return cursor => {
    document.body.style.cursor = cursor
    document.body.style.userSelect = cursor ? 'none' : ''
    if (cursor) window.getSelection?.()?.removeAllRanges()
    for (const target of targets) {
      const element = typeof target === 'function' ? target() : target
      if (element) element.style.cursor = cursor
    }
  }
}
