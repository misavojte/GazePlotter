import { tick } from 'svelte'
import { computePlacement, adjustForViewport, findScrollableParents } from '$lib/shared/placement'

/**
 * Manages the state and positioning logic for a color picker popup.
 * Detaches the floating UI logic from the input component.
 */
export class ColorPickerManager {
  #isOpen = $state(false)
  #triggerElement = $state<HTMLElement | null>(null)
  #popupElement = $state<HTMLElement | null>(null)
  #position = $state({ top: 0, left: 0 })
  #scrollListeners: Array<{
    target: Window | HTMLElement
    handler: (e: Event) => void
  }> = []

  /** Whether the color picker popup is currently open. */
  get isOpen() {
    return this.#isOpen
  }
  set isOpen(value: boolean) {
    this.#isOpen = value
  }

  /** Reference to the element that triggers the popup. */
  get triggerElement() {
    return this.#triggerElement
  }
  set triggerElement(value: HTMLElement | null) {
    this.#triggerElement = value
  }

  /** Reference to the popup element itself. */
  get popupElement() {
    return this.#popupElement
  }
  set popupElement(value: HTMLElement | null) {
    this.#popupElement = value
  }

  /** The calculated viewport-relative position of the popup. */
  get position() {
    return this.#position
  }

  /** Toggles the popup state and recalculates position if opening. */
  async toggle() {
    this.#isOpen = !this.#isOpen
    if (this.#isOpen) {
      await this.calculatePosition()
    }
  }

  /** Closes the popup. */
  close() {
    this.#isOpen = false
  }

  /** Calculates the optimal position for the popup relative to the trigger. */
  async calculatePosition() {
    if (!this.#triggerElement) return

    // Wait for the popup to be rendered so we can measure it
    await tick()

    const triggerRect = this.#triggerElement.getBoundingClientRect()
    const popupWidth = this.#popupElement?.offsetWidth ?? 0
    const popupHeight = this.#popupElement?.offsetHeight ?? 0
    const floatingSize = { width: popupWidth, height: popupHeight }

    const preferred = computePlacement(
      triggerRect,
      floatingSize,
      'bottom',
      5,
      'start',
      'start'
    )
    const { left, top } = adjustForViewport(preferred, floatingSize, {
      width: window.innerWidth,
      height: window.innerHeight,
    })

    this.#position = { top, left }
  }

  /**
   * Svelte action to portal the popup to the document body and handle click-away/scroll.
   */
  portal = (node: HTMLElement) => {
    node.setAttribute('data-context-menu-ignore', 'true')
    document.body.appendChild(node)

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const isOutside =
        node &&
        !node.contains(target) &&
        this.#triggerElement !== target &&
        !this.#triggerElement?.contains(target)

      if (isOutside) {
        this.close()
      }
    }

    const handleScroll = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      // Allow scrolling within the popup itself
      if (node && (node === target || node.contains(target))) {
        return
      }

      this.close()
    }

    // Small delay to prevent the initial click from closing the popup immediately
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true)

      // Find scrollable parents and attach listeners
      if (this.#triggerElement) {
        const parents = findScrollableParents(this.#triggerElement)
        for (const parent of parents) {
          parent.addEventListener('scroll', handleScroll, true)
          this.#scrollListeners.push({ target: parent, handler: handleScroll })
        }
      }
    }, 100)

    return {
      destroy: () => {
        document.removeEventListener('mousedown', handleClickOutside, true)
        for (const { target, handler } of this.#scrollListeners) {
          target.removeEventListener('scroll', handler, true)
        }
        this.#scrollListeners = []

        node.remove()
      },
    }
  }
}

