import type { Action } from 'svelte/action'
import { contextMenuState, updateContextMenu } from './contextMenuState.svelte'
import {
  adjustPlacementForViewport,
  computePlacement,
  getMenuSize,
  findScrollableParents,
  computeZIndex,
  getActualSide,
} from './utils'
import type {
  ContextMenuOptions,
  ContextMenuState,
  Position,
  Alignment,
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

export const contextMenuAction: Action<HTMLElement, ContextMenuOptions> = (
  node,
  opts = {}
) => {
  let options = { ...opts }
  let state = resolveInternalState(node, null, options)

  const ownerId = Symbol('context-menu-owner')

  let ownsMenu = false
  let hasGlobalListeners = false
  let lastMouseDownInside = false
  let scrollableParents: (Window | HTMLElement)[] = []
  let scrollListeners: Array<{
    target: Window | HTMLElement
    handler: (e: Event) => void
  }> = []

  const isOwnedState = (
    value: ContextMenuState | null
  ): value is ContextMenuState => Boolean(value && value.ownerId === ownerId)

  const onScroll = (e: Event) => {
    const target = e.target as HTMLElement | null
    if (!target) return

    // Allow scrolling within the menu itself
    if (target.closest?.(MENU_SELECTOR)) {
      return
    }
    close()
  }

  const onMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) {
      lastMouseDownInside = false
      return
    }

    const insideMenu = target.closest?.(MENU_SELECTOR)
    const insideAnchor =
      state.anchor && (state.anchor === target || state.anchor.contains(target))

    const shouldIgnore = target.closest?.('[data-context-menu-ignore]')

    lastMouseDownInside = Boolean(insideMenu || insideAnchor || shouldIgnore)
  }

  const onDocClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) {
      close()
      return
    }

    // If the click started inside the menu or anchor, don't close
    if (lastMouseDownInside) {
      return
    }

    // Double check if the released click target is inside the menu
    if (target.closest?.(MENU_SELECTOR)) {
      return
    }

    // Check if the released click is inside the anchor
    if (
      state.anchor &&
      (state.anchor === target || state.anchor.contains(target))
    ) {
      return
    }

    // Double check for ignored elements on click release
    if (target.closest?.('[data-context-menu-ignore]')) {
      return
    }

    close()
  }

  const attachGlobalListeners = () => {
    if (hasGlobalListeners) return
    scrollableParents = findScrollableParents(state.anchor)
    for (const parent of scrollableParents) {
      const handler = onScroll
      scrollListeners.push({ target: parent, handler })
      parent.addEventListener('scroll', handler, true)
    }
    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('click', onDocClick, true)
    hasGlobalListeners = true
  }

  const detachGlobalListeners = () => {
    if (!hasGlobalListeners) return
    for (const { target, handler } of scrollListeners) {
      target.removeEventListener('scroll', handler, true)
    }
    scrollListeners = []
    document.removeEventListener('mousedown', onMouseDown, true)
    document.removeEventListener('click', onDocClick, true)
    hasGlobalListeners = false
  }

  const finalizeClosure = () => {
    if (!ownsMenu) return
    ownsMenu = false
    // Remove the visual active marker from the anchor when menu closes
    try {
      if (state.anchor && state.anchor.classList) {
        state.anchor.classList.remove('context-menu-anchor-active')
      }
    } catch (e) {
      // defensive: ignore if node removed
    }
    detachGlobalListeners()
    options.onClose?.()
  }

  const close = () => {
    if (!ownsMenu) return
    updateContextMenu((curr: ContextMenuState | null) =>
      isOwnedState(curr) ? null : curr
    )
  }

  const openAt = () => {
    if (state.disabled) return

    ownsMenu = true
    const computedZIndex = computeZIndex(state.anchor)

    const rect = state.anchor.getBoundingClientRect()
    const hasContent = Boolean(options.content)
    const menuSize = getMenuSize(options.items, hasContent)
    const initialPlacement = computePlacement(
      rect,
      menuSize,
      state.position,
      state.offset,
      state.hAlign,
      state.vAlign
    )

    const adjustedPlacement = adjustPlacementForViewport(
      { x: initialPlacement.x, y: initialPlacement.y },
      menuSize,
      { width: window.innerWidth, height: window.innerHeight }
    )

    // Determine which side the menu actually landed on relative to the anchor
    // so the pointer can reflect reality (handles flipping/clamping cases).
    const actualSide = getActualSide(
      {
        left: adjustedPlacement.left,
        top: adjustedPlacement.top,
        width: menuSize.width,
        height: menuSize.height,
      },
      rect,
      state.position
    )

    updateContextMenu({
      visible: true,
      items: options.items,
      content: options.content,
      x: adjustedPlacement.left,
      y: adjustedPlacement.top,
      slideFrom: state.slideFrom,
      position: actualSide,
      anchorCenter: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      },
      ownerId,
      zIndex: computedZIndex + 1,
    })

    options.onOpen?.()
    attachGlobalListeners()
  }

  const onTriggerClick = (e: MouseEvent) => {
    if (state.disabled) return
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
    onTriggerClick(e)
  }

  node.addEventListener('click', onTriggerClick)
  node.addEventListener('contextmenu', onContextMenu)

  $effect(() => {
    const value = contextMenuState.current
    if (!isOwnedState(value)) {
      finalizeClosure()
      return
    }

    // Guard: If the anchor is removed from the DOM, close the menu
    if (!node.isConnected) {
      close()
    }
  })

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
