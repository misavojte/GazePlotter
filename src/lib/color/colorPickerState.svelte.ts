import { tick } from 'svelte'
import {
  computePlacement,
  adjustForViewport,
  attachOutsideDismiss,
} from '$lib/shared/placement'

/**
 * Manages the state and positioning logic for a color picker popup.
 * Detaches the floating UI logic from the input component.
 */
export class ColorPickerState {
  /** Whether the color picker popup is currently open. */
  isOpen = $state(false)
  /** Reference to the element that triggers the popup. */
  triggerElement = $state<HTMLElement | null>(null)
  /** Reference to the popup element itself. */
  popupElement = $state<HTMLElement | null>(null)
  /** The calculated viewport-relative position of the popup. */
  position = $state({ top: 0, left: 0 })

  /** Toggles the popup state and recalculates position if opening. */
  async toggle() {
    this.isOpen = !this.isOpen
    if (this.isOpen) {
      await this.calculatePosition()
    }
  }

  /** Closes the popup. */
  close() {
    this.isOpen = false
  }

  /** Calculates the optimal position for the popup relative to the trigger. */
  async calculatePosition() {
    if (!this.triggerElement) return

    // Wait for the popup to be rendered so we can measure it
    await tick()

    const triggerRect = this.triggerElement.getBoundingClientRect()
    const popupWidth = this.popupElement?.offsetWidth ?? 0
    const popupHeight = this.popupElement?.offsetHeight ?? 0
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

    this.position = { top, left }
  }

  /**
   * Svelte action to portal the popup to the document body and handle click-away/scroll.
   */
  portal = (node: HTMLElement) => {
    node.setAttribute('data-context-menu-ignore', 'true')
    document.body.appendChild(node)

    // The popup opens on the trigger's CLICK, so this mount runs after the
    // opening pointerdown already fired; the listener can attach immediately.
    const trigger = this.triggerElement
    const detach = attachOutsideDismiss({
      isInside: target =>
        node.contains(target) ||
        trigger === target ||
        Boolean(trigger?.contains(target)),
      onDismiss: () => this.close(),
      // Scrolling anywhere but within the popup itself closes it.
      ...(trigger
        ? {
            scroll: {
              anchor: trigger,
              keepWithin: target => node.contains(target),
            },
          }
        : {}),
    })

    return {
      destroy: () => {
        detach()
        node.remove()
      },
    }
  }
}
