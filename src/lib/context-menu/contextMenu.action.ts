import { clearOwnedContextMenu, isOwnedContextMenuState } from './behavior'
import type { Action } from 'svelte/action'
import { contextMenuState, updateContextMenu } from './contextMenuState.svelte'
import {
  getMenuSize,
} from './layout'
import {
  computePlacement,
  adjustForViewport,
  findScrollableParents,
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

  const onScroll = (e: Event) => {
    const target = e.target as HTMLElement | null
    if (!target) return

    // Allow scrolling within the menu itself
    if (target.closest?.(MENU_SELECTOR)) {
      return
    }
    close()
  }

  const onPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) {
      lastMouseDownInside = false
      close()
      return
    }

    const insideMenu = target.closest?.(MENU_SELECTOR)
    const insideAnchor =
      state.anchor && (state.anchor === target || state.anchor.contains(target))

    const shouldIgnore = target.closest?.('[data-context-menu-ignore]')

    lastMouseDownInside = Boolean(insideMenu || insideAnchor || shouldIgnore)

    // Proactively close on pointerdown if strictly outside.
    // This is more robust than mousedown/click as it works even if
    // subsequent events are blocked or modified (e.g. by grid panning).
    if (!lastMouseDownInside) {
      close()
    }
  }

  const attachGlobalListeners = () => {
    if (hasGlobalListeners) return
    scrollableParents = findScrollableParents(state.anchor)
    for (const parent of scrollableParents) {
      const handler = onScroll
      scrollListeners.push({ target: parent, handler })
      parent.addEventListener('scroll', handler, true)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    hasGlobalListeners = true
  }

  const detachGlobalListeners = () => {
    if (!hasGlobalListeners) return
    for (const { target, handler } of scrollListeners) {
      target.removeEventListener('scroll', handler, true)
    }
    scrollListeners = []
    document.removeEventListener('pointerdown', onPointerDown, true)
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
    clearOwnedContextMenu(ownerId)
  }

  const openAt = () => {
    if (state.disabled) return

    ownsMenu = true
    const computedZIndex = computeZIndex(state.anchor)

    const rect = state.anchor.getBoundingClientRect()
    const hasContent = Boolean(options.content)
    const baseSize = getMenuSize(options.items, hasContent)
    const menuSize =
      options.width !== undefined
        ? { ...baseSize, width: options.width }
        : baseSize
    const initialPlacement = computePlacement(
      rect,
      menuSize,
      state.position,
      state.offset,
      state.hAlign,
      state.vAlign
    )

    const adjustedPlacement = adjustForViewport(
      { x: initialPlacement.x, y: initialPlacement.y },
      menuSize,
      { width: window.innerWidth, height: window.innerHeight }
    )

    updateContextMenu({
      visible: true,
      items: options.items,
      content: options.content,
      x: adjustedPlacement.left,
      y: adjustedPlacement.top,
      slideFrom: state.slideFrom,
      selectionMode: options.selectionMode,
      width: options.width,
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
    if (!isOwnedContextMenuState(ownerId, value)) {
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
