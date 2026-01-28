import { tick } from 'svelte'

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

    // Default: position below the trigger
    let top = triggerRect.bottom + 5
    let left = triggerRect.left

    if (this.#popupElement) {
      const popupWidth = this.#popupElement.offsetWidth
      const popupHeight = this.#popupElement.offsetHeight

      // Adjust to prevent overflow on the right
      if (left + popupWidth > window.innerWidth - 10) {
        left = window.innerWidth - popupWidth - 10
      }

      // Adjust to prevent overflow on the bottom
      if (top + popupHeight > window.innerHeight - 10) {
        // Position above the trigger if there's no space below
        top = Math.max(10, triggerRect.top - popupHeight - 5)
      }
    }

    this.#position = { top, left }
  }

  /**
   * Svelte action to portal the popup to the document body and handle click-away/scroll.
   */
  portal = (node: HTMLElement) => {
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

        if (node.parentNode) {
          node.parentNode.removeChild(node)
        }
      },
    }
  }
}

/**
 * Find all scrollable parent elements for the given element.
 */
function findScrollableParents(element: HTMLElement): (Window | HTMLElement)[] {
  const scrollable: (Window | HTMLElement)[] = [window]
  let current: HTMLElement | null = element

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current)
    const overflow = style.overflow
    const overflowX = style.overflowX
    const overflowY = style.overflowY

    const isScrollable =
      /auto|scroll|overlay/.test(overflow) ||
      /auto|scroll|overlay/.test(overflowX) ||
      /auto|scroll|overlay/.test(overflowY)

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
