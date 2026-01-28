import type { Action } from 'svelte/action'
import { contextMenuState, updateContextMenu } from './contextMenuState.svelte'
import {
  adjustPlacementForViewport,
  computePlacement,
  getMenuSize,
  findScrollableParents,
  computeZIndex,
} from './utils'
import type {
  ContextMenuOptions,
  ContextMenuState,
  Position,
  Alignment,
  SlideFrom,
} from './types'
import { DEFAULT_OFFSET } from './const'

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
  const computedZIndex = computeZIndex(state.anchor)

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
    if (target.closest?.('div.menu[role="menu"]')) {
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

    const insideMenu = target.closest?.('div.menu[role="menu"]')
    const insideAnchor =
      state.anchor && (state.anchor === target || state.anchor.contains(target))

    lastMouseDownInside = Boolean(insideMenu || insideAnchor)
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
    if (target.closest?.('div.menu[role="menu"]')) {
      return
    }

    // Check if the released click is inside the anchor
    if (
      state.anchor &&
      (state.anchor === target || state.anchor.contains(target))
    ) {
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
      { x: initialPlacement.left, y: initialPlacement.top },
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
      ownerId,
      zIndex: computedZIndex,
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
