import { findScrollableParents } from './dom'

export type OutsideDismissOptions = {
  /** Pointerdown targets for which the floating UI stays open. */
  isInside: (target: HTMLElement) => boolean
  onDismiss: () => void
  /** Dismiss on scroll in the anchor's scrollable parents, except where `keepWithin`. */
  scroll?: {
    anchor: HTMLElement
    keepWithin: (target: HTMLElement) => boolean
  }
}

/**
 * The one owner of outside-pointer dismissal for floating UI (context menu,
 * color popup). Capture-phase pointerdown: capture beats handlers that stop
 * propagation, and pointerdown survives flows that cancel the later
 * mousedown/click phases (e.g. grid panning). Callers attach after the
 * opening interaction's pointerdown has fired (open on click, or on mount of
 * the floating node), so the opening press can't reach the listener and no
 * attach delay is needed. Returns a detach function; safe to call twice.
 */
export const attachOutsideDismiss = (
  options: OutsideDismissOptions
): (() => void) => {
  const onPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null
    if (!target || !options.isInside(target)) options.onDismiss()
  }

  const onScroll = (e: Event) => {
    const target = e.target as HTMLElement | null
    if (!target || options.scroll!.keepWithin(target)) return
    options.onDismiss()
  }

  const scrollTargets = options.scroll
    ? findScrollableParents(options.scroll.anchor)
    : []

  document.addEventListener('pointerdown', onPointerDown, true)
  for (const parent of scrollTargets) {
    parent.addEventListener('scroll', onScroll, true)
  }

  let detached = false
  return () => {
    if (detached) return
    detached = true
    document.removeEventListener('pointerdown', onPointerDown, true)
    for (const parent of scrollTargets) {
      parent.removeEventListener('scroll', onScroll, true)
    }
  }
}
