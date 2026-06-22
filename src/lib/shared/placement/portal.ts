/**
 * Svelte action that moves a node out of its current DOM position and
 * appends it to a designated host element, avoiding overflow/containment
 * and stacking-context issues.
 *
 * @param node   - The element to portal.
 * @param target - Optional destination: an HTMLElement, a CSS id string, or
 *                 undefined (defaults to document.body).
 */
export const portal = (
  node: HTMLElement,
  target?: HTMLElement | string
): { destroy(): void } => {
  let destination: HTMLElement | null = null

  if (typeof target === 'string') {
    destination = document.getElementById(target)
  } else if (target instanceof HTMLElement) {
    destination = target
  }

  ;(destination ?? document.body).appendChild(node)

  return {
    destroy() {
      node.remove()
    },
  }
}
