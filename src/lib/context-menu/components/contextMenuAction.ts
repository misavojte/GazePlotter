import type { Action } from 'svelte/action'
import type { Component } from 'svelte'
import type { ContextMenuState } from '$lib/context-menu/stores'
import { contextMenuStore, updateContextMenu } from '$lib/context-menu/stores'

export type SlideFrom = 'top' | 'left'
export interface MenuItem {
  label: string
  action: () => void
  icon?: Component<any, any, any>
}

type Position = 'top' | 'bottom' | 'left' | 'right'
type Alignment = 'start' | 'center' | 'end'

export interface ContextMenuOptions {
  items?: MenuItem[]
  content?: string
  anchor?: HTMLElement
  position?: Position
  verticalAlign?: Alignment
  horizontalAlign?: Alignment
  offset?: number
  slideFrom?: SlideFrom
  disabled?: boolean
  onOpen?: () => void
  onClose?: () => void
}

interface InternalState {
  anchor: HTMLElement
  position: Position
  vAlign: Alignment
  hAlign: Alignment
  offset: number
  slideFrom: SlideFrom
  disabled: boolean
}

const MENU_WIDTH = 220
const MENU_HEIGHT_FALLBACK = 0
const DEFAULT_OFFSET = 8
const DEFAULT_Z_INDEX = 1000
const MODAL_Z_INDEX = 1010 // Higher than modal's z-index of 1001

/**
 * Compute aligned coordinate along an axis.
 *
 * @param base - The starting coordinate of the bounding box.
 * @param size - The size of the bounding box.
 * @param target - The size of the element that should be aligned within the bounding box.
 * @param align - Alignment strategy along the chosen axis.
 */
const aligned = (base: number, size: number, target: number, align: Alignment): number => {
  if (align === 'start') return base
  if (align === 'center') return base + size / 2 - target / 2
  return base + size - target
}

/**
 * Compute absolute top/left for the menu given the anchor rect and options.
 * Uses getBoundingClientRect() coordinates directly since they are already viewport-relative,
 * accounting for all scrolling (window and parent containers).
 *
 * @param rect - The bounding rectangle from getBoundingClientRect() (viewport-relative coordinates).
 * @param menuSize - Dimensions of the menu to position.
 * @param position - Which side of the anchor to place the menu.
 * @param offset - Spacing between anchor and menu.
 * @param hAlign - Horizontal alignment within the anchor's width.
 * @param vAlign - Vertical alignment within the anchor's height.
 */
const computePlacement = (
  rect: DOMRect,
  menuSize: { width: number; height: number },
  position: Position,
  offset: number,
  hAlign: Alignment,
  vAlign: Alignment
) => {
  // getBoundingClientRect() already returns viewport coordinates, so we use them directly
  // without adding window scroll offsets, which correctly handles absolute elements
  // and elements within scrollable containers.
  const coords: Record<Position, { left: number; top: number }> = {
    top: {
      left: aligned(rect.left, rect.width, menuSize.width, hAlign),
      top: rect.top - offset - menuSize.height,
    },
    bottom: {
      left: aligned(rect.left, rect.width, menuSize.width, hAlign),
      top: rect.bottom + offset,
    },
    left: {
      left: rect.left - offset - menuSize.width,
      top: aligned(rect.top, rect.height, menuSize.height, vAlign),
    },
    right: {
      left: rect.right + offset,
      top: aligned(rect.top, rect.height, menuSize.height, vAlign),
    },
  }
  return coords[position]
}

/**
 * Merge user provided options onto the existing set while ignoring undefined values.
 */
const mergeContextMenuOptions = (
  base: ContextMenuOptions | undefined,
  incoming: ContextMenuOptions
): ContextMenuOptions => {
  const merged: ContextMenuOptions = { ...(base ?? {}) }
  const target = merged as Record<keyof ContextMenuOptions, ContextMenuOptions[keyof ContextMenuOptions]>
  for (const key of Object.keys(incoming) as (keyof ContextMenuOptions)[]) {
    const value = incoming[key]
    // Ignore undefined entries so callers can perform partial option updates without losing existing values.
    if (value !== undefined) {
      target[key] = value
    }
  }
  return merged
}

/**
 * Resolve the internal, fully populated state used by the action based on the latest options.
 */
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

/**
 * Fallback dimensions used during placement calculations before the menu is measured.
 */
const getMenuSize = () => ({ width: MENU_WIDTH, height: MENU_HEIGHT_FALLBACK })

/**
 * Detect if an element is contained within a modal by traversing up the DOM tree.
 * Looks for elements with role="dialog" or role="alertdialog" which indicate modal containers.
 * This check is performed once during action registration and is not reactive.
 *
 * @param element - The element to check for modal containment.
 * @returns True if the element is inside a modal, false otherwise.
 */
const isElementInModal = (element: HTMLElement): boolean => {
  let current: HTMLElement | null = element
  // Traverse up the DOM tree until we reach the document body or find a modal indicator.
  while (current && current !== document.body) {
    const role = current.getAttribute('role')
    // Check for dialog roles which indicate modals or dialogs.
    if (role === 'dialog' || role === 'alertdialog') {
      return true
    }
    // Move to the parent element for the next iteration.
    current = current.parentElement
  }
  // No modal ancestor found in the traversal.
  return false
}

/**
 * Compute the appropriate z-index for the context menu based on whether its anchor is inside a modal.
 * If the anchor is in a modal, returns a value higher than typical modal z-index values.
 * Otherwise, returns the default z-index for context menus.
 * This computation happens once during action initialization and is not reactive.
 *
 * @param anchor - The anchor element that triggers the context menu.
 * @returns The z-index value to apply to the context menu.
 */
const computeZIndex = (anchor: HTMLElement): number => {
  return isElementInModal(anchor) ? MODAL_Z_INDEX : DEFAULT_Z_INDEX
}

/**
 * Find all scrollable parent containers of the given element by traversing up the DOM tree.
 * Checks if elements have scrollable overflow by examining computed styles and scroll dimensions.
 * Includes the window as a scrollable container.
 *
 * @param element - The element to start searching from.
 * @returns Array of scrollable containers, including window and all scrollable parent elements.
 */
const findScrollableParents = (element: HTMLElement): (Window | HTMLElement)[] => {
  const scrollable: (Window | HTMLElement)[] = [window]
  let current: HTMLElement | null = element

  // Traverse up the DOM tree to find all scrollable parents.
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current)
    const overflow = style.overflow
    const overflowX = style.overflowX
    const overflowY = style.overflowY

    // Check if element is scrollable in any direction.
    const isScrollable =
      (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') ||
      (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') ||
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')

    // Also check if element actually has scrollable content.
    const hasScrollableContent =
      current.scrollHeight > current.clientHeight || current.scrollWidth > current.clientWidth

    if (isScrollable && hasScrollableContent) {
      scrollable.push(current)
    }

    // Move to the parent element for the next iteration.
    current = current.parentElement
  }

  return scrollable
}

/** Svelte action: context menu with anchored positioning */
export const contextMenuAction: Action<HTMLElement, ContextMenuOptions> = (node, opts = {}) => {
  let options = mergeContextMenuOptions(undefined, opts)
  let state = resolveInternalState(node, null, options)

  const ownerId = Symbol('context-menu-owner')
  // Compute z-index once during initialization based on whether the anchor is in a modal.
  // This is not reactive and will not change even if the DOM structure changes later.
  const computedZIndex = computeZIndex(state.anchor)

  let ownsMenu = false
  let hasGlobalListeners = false
  let scrollableParents: (Window | HTMLElement)[] = []
  let scrollListeners: Array<{ target: Window | HTMLElement; handler: () => void }> = []

  const isOwnedState = (value: ContextMenuState | null): value is ContextMenuState =>
    Boolean(value && value.ownerId === ownerId)

  /**
   * Handler for scroll events that closes the menu when any scroll occurs.
   */
  const onScroll = () => {
    close()
  }

  /**
   * Attach scroll listeners to all scrollable parents (including window) and document click listener.
   * Finds scrollable parents each time the menu opens to account for dynamic DOM changes.
   */
  const attachGlobalListeners = () => {
    if (hasGlobalListeners) return

    // Find all scrollable parents of the anchor element.
    scrollableParents = findScrollableParents(state.anchor)

    // Attach scroll listener to each scrollable parent (including window).
    for (const parent of scrollableParents) {
      const handler = onScroll
      scrollListeners.push({ target: parent, handler })
      parent.addEventListener('scroll', handler, true)
    }

    // Attach click listener for outside click detection.
    document.addEventListener('click', onDocClick, true)
    hasGlobalListeners = true
  }

  /**
   * Remove all scroll listeners from scrollable parents and document click listener.
   */
  const detachGlobalListeners = () => {
    if (!hasGlobalListeners) return

    // Remove all scroll listeners.
    for (const { target, handler } of scrollListeners) {
      target.removeEventListener('scroll', handler, true)
    }
    scrollListeners = []

    // Remove click listener.
    document.removeEventListener('click', onDocClick, true)
    hasGlobalListeners = false
  }

  /**
   * Finalize closure when the store reports that the menu is no longer owned by this anchor.
   */
  const finalizeClosure = () => {
    if (!ownsMenu) return
    ownsMenu = false
    detachGlobalListeners()
    options.onClose?.()
  }

  /** Close the menu if this anchor currently controls it. */
  const close = () => {
    if (!ownsMenu) return
    updateContextMenu((curr) => (isOwnedState(curr) ? null : curr))
  }

  /**
   * Handle clicks outside the menu and trigger element.
   * Only closes the menu if the click target is not within the anchor or menu element.
   *
   * @param e - Click event from the document.
   */
  const onDocClick = (e: MouseEvent) => {
    const target = e.target as Node | null
    if (!target) {
      close()
      return
    }

    // Don't close if clicking on the trigger element or its children
    if (state.anchor && (state.anchor === target || state.anchor.contains(target))) {
      return
    }

    // Don't close if clicking on the menu element itself
    const menuElement = document.querySelector('div.menu[role="menu"]')
    if (menuElement && (menuElement === target || menuElement.contains(target))) {
      return
    }

    close()
  }

  /**
   * Open the menu positioned relative to the anchor element.
   * Position is calculated once on creation based on the position and alignment options,
   * and the menu will be closed on any scroll event.
   */
  const openAt = () => {
    if (state.disabled) return

    ownsMenu = true

    // Calculate position based on anchor element's bounding rect and positioning options.
          const rect = state.anchor.getBoundingClientRect()
    const placement = computePlacement(rect, getMenuSize(), state.position, state.offset, state.hAlign, state.vAlign)

    updateContextMenu({
      visible: true,
      items: options.items,
      content: options.content,
      x: placement.left,
      y: placement.top,
      slideFrom: state.slideFrom,
      ownerId,
      zIndex: computedZIndex,
    })

    options.onOpen?.()
    attachGlobalListeners()
  }

  /**
   * Handle click events on the trigger element to toggle the menu.
   * Provides better touch support compared to contextmenu events.
   *
   * @param e - Click or contextmenu event from the trigger element.
   */
  const onTriggerClick = (e: MouseEvent) => {
    if (state.disabled) return
    e.preventDefault()
    e.stopPropagation()

    // Toggle menu: close if already open, otherwise open positioned relative to anchor.
    if (ownsMenu) {
      close()
      return
    }

    // Open menu positioned relative to anchor element based on position and alignment options.
    openAt()
  }

  /**
   * Handle native context menu events as a fallback for right-click support.
   */
  const onContextMenu = (e: MouseEvent) => {
    if (state.disabled) return
    e.preventDefault()
    onTriggerClick(e)
  }

  // Support both click (for touch/mobile) and contextmenu (for right-click)
  node.addEventListener('click', onTriggerClick)
  node.addEventListener('contextmenu', onContextMenu)

  const unsubscribe = contextMenuStore.subscribe((value) => {
    if (isOwnedState(value)) return
    finalizeClosure()
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
      unsubscribe()
      node.removeEventListener('click', onTriggerClick)
      node.removeEventListener('contextmenu', onContextMenu)
      detachGlobalListeners()
    },
  }
}


