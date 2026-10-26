import type { Action } from 'svelte/action'
import {
  useContextMenu,
  type ContextMenuState,
} from './contextMenuState.svelte'
import {
  getMenuSize,
} from './layout'
import {
  placeInViewport,
  attachOutsideDismiss,
  computeZIndex,
} from '$lib/shared/placement'
import type { Position, Alignment } from '$lib/shared/placement'
import type {
  ContextMenuOptions,
  SlideFrom,
} from './types'
import { DEFAULT_OFFSET, MENU_SELECTOR } from './const'

interface InternalState {
  anchor: HTMLElement
  position: Position
  vAlign: Alignment
  hAlign: Alignment
  offset: number
  slideFrom: SlideFrom
  disabled: boolean
}

const resolveInternalState = (
  node: HTMLElement,
  previous: InternalState | null,
  options: ContextMenuOptions
): InternalState => ({
  anchor: options.anchor ?? previous?.anchor ?? node,
  position: options.position ?? previous?.position ?? 'bottom',
  vAlign: options.verticalAlign ?? previous?.vAlign ?? 'start',
  hAlign: options.horizontalAlign ?? previous?.hAlign ?? 'start',
  offset: options.offset ?? previous?.offset ?? DEFAULT_OFFSET,
  slideFrom: options.slideFrom ?? previous?.slideFrom ?? 'top',
  disabled: options.disabled ?? previous?.disabled ?? false,
})

/** Session-bound action; resolve at init, use as `use:contextMenuAction`. */
export function useContextMenuAction(): Action<HTMLElement, ContextMenuOptions> {
  const menu = useContextMenu()
  return (node, opts) => contextMenuAction(menu, node, opts)
}

const contextMenuAction = (
  menu: ContextMenuState,
  node: HTMLElement,
  opts: ContextMenuOptions = {}
) => {
  let options = { ...opts }
  let state = resolveInternalState(node, null, options)

  const ownerId = Symbol('context-menu-owner')

  let ownsMenu = false
  let detachDismiss: (() => void) | null = null
  const atPointer = () => options.trigger === 'pointer'

  const attachGlobalListeners = () => {
    if (detachDismiss) return
    detachDismiss = attachOutsideDismiss({
      isInside: target =>
        Boolean(
          target.closest?.(MENU_SELECTOR) ||
            (!atPointer() &&
              state.anchor &&
              (state.anchor === target || state.anchor.contains(target))) ||
            target.closest?.('[data-context-menu-ignore]')
        ),
      onDismiss: close,
      // Scrolling anywhere but within the menu itself closes it.
      scroll: {
        anchor: state.anchor,
        keepWithin: target => Boolean(target.closest?.(MENU_SELECTOR)),
      },
    })
  }

  const detachGlobalListeners = () => {
    detachDismiss?.()
    detachDismiss = null
  }

  const finalizeClosure = () => {
    if (!ownsMenu) return
    ownsMenu = false
    detachGlobalListeners()
    options.onClose?.()
  }

  const close = () => {
    if (!ownsMenu) return
    menu.clearOwned(ownerId)
  }

  const openAt = (rect: DOMRect = state.anchor.getBoundingClientRect()) => {
    if (state.disabled) return

    ownsMenu = true
    const computedZIndex = computeZIndex(state.anchor)

    const hasContent = Boolean(options.content)
    const baseSize = getMenuSize(options.items, hasContent)
    const menuSize =
      options.width !== undefined
        ? { ...baseSize, width: options.width }
        : baseSize
    const { left, top } = placeInViewport(rect, menuSize, state)

    menu.update({
      items: options.items,
      content: options.content,
      x: left,
      y: top,
      slideFrom: state.slideFrom,
      selectionMode: options.selectionMode,
      width: options.width,
      ownerId,
      zIndex: computedZIndex + 1,
      cleanup: finalizeClosure,
    })

    options.onOpen?.()
    attachGlobalListeners()
  }

  const onTriggerClick = (e: MouseEvent) => {
    if (state.disabled || atPointer()) return
    e.preventDefault()
    e.stopPropagation()

    if (ownsMenu) {
      close()
      return
    }

    openAt()
  }

  const onContextMenu = (e: MouseEvent) => {
    if (state.disabled) return
    e.preventDefault()
    if (atPointer()) {
      // Each right-click reopens the menu where it happened.
      e.stopPropagation()
      openAt(new DOMRect(e.clientX, e.clientY, 0, 0))
      return
    }
    onTriggerClick(e)
  }

  node.addEventListener('click', onTriggerClick)
  node.addEventListener('contextmenu', onContextMenu)

  return {
    update(next: ContextMenuOptions) {
      options = { ...options, ...next }
      state = resolveInternalState(node, state, options)

      if (state.disabled) {
        close()
      }
    },
    destroy() {
      close()
      node.removeEventListener('click', onTriggerClick)
      node.removeEventListener('contextmenu', onContextMenu)
      detachGlobalListeners()
    },
  }
}
