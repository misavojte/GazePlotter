export const DEFAULT_Z_INDEX = 1000
export const MODAL_Z_INDEX = 1010

/**
 * Check if the given element is inside a modal.
 */
const isElementInModal = (element: HTMLElement): boolean => {
  return element.closest('[role="dialog"], [role="alertdialog"]') !== null
}

/**
 * Compute the z-index for a floating element based on the anchor's context.
 */
export const computeZIndex = (anchor: HTMLElement): number => {
  return isElementInModal(anchor) ? MODAL_Z_INDEX : DEFAULT_Z_INDEX
}
