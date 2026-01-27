import type { Action } from 'svelte/action'
import { contextMenuState, updateContextMenu } from './contextMenuState.svelte'
import {
  adjustPlacementForViewport,
  computePlacement,
  getMenuSize,
} from './utils'
import type {
  ContextMenuOptions,
  ContextMenuState,
  Position,
  Alignment,
  SlideFrom,
} from './types'
import { DEFAULT_OFFSET, DEFAULT_Z_INDEX, MODAL_Z_INDEX } from './const'

interface InternalState {
  anchor: HTMLElement
  position: Position
  vAlign: Alignment
  hAlign: Alignment
  offset: number
  slideFrom: SlideFrom
  disabled: boolean
}

const mergeContextMenuOptions = (
  base: ContextMenuOptions | undefined,
  incoming: ContextMenuOptions
): ContextMenuOptions => {
  const merged: ContextMenuOptions = { ...(base ?? {}) }
  const target = merged as Record<
    keyof ContextMenuOptions,
    ContextMenuOptions[keyof ContextMenuOptions]
  >
  for (const key of Object.keys(incoming) as (keyof ContextMenuOptions)[]) {
    const value = incoming[key]
    if (value !== undefined) {
      target[key] = value
    }
  }
  return merged
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

const isElementInModal = (element: HTMLElement): boolean => {
  let current: HTMLElement | null = element
  while (current && current !== document.body) {
    const role = current.getAttribute('role')
    if (role === 'dialog' || role === 'alertdialog') {
      return true
    }
    current = current.parentElement
  }
  return false
}

const computeZIndex = (anchor: HTMLElement): number => {
  return isElementInModal(anchor) ? MODAL_Z_INDEX : DEFAULT_Z_INDEX
}

const findScrollableParents = (
  element: HTMLElement
): (Window | HTMLElement)[] => {
  const scrollable: (Window | HTMLElement)[] = [window]
  let current: HTMLElement | null = element

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current)
    const overflow = style.overflow
    const overflowX = style.overflowX
    const overflowY = style.overflowY

    const isScrollable =
      overflow === 'auto' ||
      overflow === 'scroll' ||
      overflow === 'overlay' ||
      overflowX === 'auto' ||
      overflowX === 'scroll' ||
      overflowX === 'overlay' ||
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'overlay'

    const hasScrollableContent =
      current.scrollHeight > current.clientHeight ||
      current.scrollWidth > current.clientWidth

    if (isScrollable && hasScrollableContent) {
      scrollable.push(current)
    }

    current = current.parentElement
  }

  return scrollable
}

export const contextMenuAction: Action<HTMLElement, ContextMenuOptions> = (
  node,
  opts = {}
) => {
  let options = mergeContextMenuOptions(undefined, opts)
  let state = resolveInternalState(node, null, options)

  const ownerId = Symbol('context-menu-owner')
  const computedZIndex = computeZIndex(state.anchor)

  let ownsMenu = false
  let hasGlobalListeners = false
  let scrollableParents: (Window | HTMLElement)[] = []
  let scrollListeners: Array<{
    target: Window | HTMLElement
    handler: (e: Event) => void
  }> = []

  const isOwnedState = (
    value: ContextMenuState | null
  ): value is ContextMenuState => Boolean(value && value.ownerId === ownerId)

  const onScroll = (e: Event) => {
    const menuElement = document.querySelector('div.menu[role="menu"]')
    // Allow scrolling within the menu itself
    if (
      menuElement &&
      (e.target === menuElement || menuElement.contains(e.target as Node))
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
    document.addEventListener('click', onDocClick, true)
    hasGlobalListeners = true
  }

  const detachGlobalListeners = () => {
    if (!hasGlobalListeners) return
    for (const { target, handler } of scrollListeners) {
      target.removeEventListener('scroll', handler, true)
    }
    scrollListeners = []
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

  const onDocClick = (e: MouseEvent) => {
    const target = e.target as Node | null
    if (!target) {
      close()
      return
    }

    if (
      state.anchor &&
      (state.anchor === target || state.anchor.contains(target))
    ) {
      return
    }

    const menuElement = document.querySelector('div.menu[role="menu"]')
    if (
      menuElement &&
      (menuElement === target || menuElement.contains(target))
    ) {
      return
    }

    close()
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
      initialPlacement,
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
      options = mergeContextMenuOptions(options, next)
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
