/**
 * FadeIn action for Svelte components
 *
 * This action applies a simple fade-in effect to an element when it's mounted.
 * It sets initial opacity to 0 and then transitions to full opacity.
 *
 * @param node - The DOM element to apply the fade effect to
 * @param options - Configuration options for the fade behavior
 * @returns A Svelte action object with update and destroy methods
 */
export function fadeIn(
  node: HTMLElement | SVGElement,
  options: {
    /** Duration of the fade effect in milliseconds (default: 300) */
    duration?: number
    /** Timing function for the transition (default: 'ease-in-out') */
    easing?: string
    /** Delay before starting the fade in milliseconds (default: 0) */
    delay?: number
  } = {}
) {
  // Default options
  const duration = options.duration ?? 300
  const easing = options.easing ?? 'ease-in-out'
  const delay = options.delay ?? 0

  // Set initial styles
  node.style.opacity = '0'
  node.style.display = 'block'

  // Function to start the transition
  const startTransition = () => {
    node.style.transition = `opacity ${duration}ms ${easing} ${delay}ms`

    // Use requestAnimationFrame to ensure the browser has time to apply initial styles
    requestAnimationFrame(() => {
      node.style.opacity = '1'
    })
  }

  // Start the transition on the next frame
  setTimeout(startTransition, 0)

  return {
    update(newOptions: typeof options) {
      // No update needed for this simple action
    },
    destroy() {
      // Clean up if needed
      node.style.transition = ''
    },
  }
}
