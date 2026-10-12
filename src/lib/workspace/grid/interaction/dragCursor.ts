/**
 * The cursor a canvas drag wears, on the body and on the surface itself.
 * A deferred drag never prevented its press, so a text selection may have
 * started under it: dropping it here is what keeps the drag clean.
 *
 * `also` names a second element to carry the cursor (the pan reaches the
 * scroll container as well); it is read on each call, since the host may
 * bind it later.
 */
export function createDragCursor(
  node: HTMLElement,
  also?: () => HTMLElement | null | undefined
): (cursor: string) => void {
  return cursor => {
    document.body.style.cursor = cursor
    document.body.style.userSelect = cursor ? 'none' : ''
    if (cursor) window.getSelection?.()?.removeAllRanges()
    node.style.cursor = cursor
    const second = also?.()
    if (second) second.style.cursor = cursor
  }
}
