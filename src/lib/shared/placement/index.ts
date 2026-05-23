import type {
  Position,
  Alignment,
  Point,
  Dimensions,
  PlacementResult,
} from './types'

export type { Position, Alignment, Point, Dimensions, PlacementResult }

/** Default padding from viewport edges during collision adjustment (px). */
const VIEWPORT_PADDING = 8

/**
 * Compute an aligned coordinate along a single axis.
 *
 * @param base   - Start of the anchor edge (e.g. `rect.left`).
 * @param size   - Size of the anchor along this axis.
 * @param target - Size of the floating element along this axis.
 * @param align  - Desired alignment.
 */
export const aligned = (
  base: number,
  size: number,
  target: number,
  align: Alignment
): number => {
  if (align === 'start') return base
  if (align === 'center') return base + size / 2 - target / 2
  return base + size - target
}

/**
 * Compute the initial absolute position for a floating element anchored to a
 * reference rect, before any viewport collision adjustment.
 */
export const computePlacement = (
  anchor: DOMRect,
  floatingSize: Dimensions,
  position: Position,
  offset: number,
  hAlign: Alignment,
  vAlign: Alignment
): Point => {
  switch (position) {
    case 'top':
      return {
        x: aligned(anchor.left, anchor.width, floatingSize.width, hAlign),
        y: anchor.top - offset - floatingSize.height,
      }
    case 'bottom':
      return {
        x: aligned(anchor.left, anchor.width, floatingSize.width, hAlign),
        y: anchor.bottom + offset,
      }
    case 'left':
      return {
        x: anchor.left - offset - floatingSize.width,
        y: aligned(anchor.top, anchor.height, floatingSize.height, vAlign),
      }
    case 'right':
      return {
        x: anchor.right + offset,
        y: aligned(anchor.top, anchor.height, floatingSize.height, vAlign),
      }
  }
}

/**
 * Adjust a preferred placement so that the floating element stays within the
 * viewport. Optionally flips horizontally when an anchor rect is provided.
 *
 * @param preferred  - Desired screen coordinates (left / top).
 * @param floatingSize - Dimensions of the floating element.
 * @param viewport   - Current viewport dimensions.
 * @param anchorRect - Optional anchor rect (enables flipping for submenus).
 * @param allowFlip  - Whether horizontal flipping is permitted.
 * @param padding    - Minimum distance from viewport edges.
 */
export const adjustForViewport = (
  preferred: Point,
  floatingSize: Dimensions,
  viewport: Dimensions,
  anchorRect?: DOMRect,
  allowFlip = false,
  padding = VIEWPORT_PADDING
): PlacementResult => {
  let left = preferred.x
  let top = preferred.y
  let isFlippedX = false
  const isFlippedY = false

  const vW = viewport.width
  const vH = viewport.height
  const p = padding

  // Horizontal: right overflow
  if (left + floatingSize.width > vW - p) {
    if (allowFlip && anchorRect) {
      const flippedX = anchorRect.left - floatingSize.width
      if (flippedX >= p) {
        left = flippedX
        isFlippedX = true
      } else {
        left = vW - floatingSize.width - p
      }
    } else {
      left = vW - floatingSize.width - p
    }
  }

  // Horizontal: left overflow
  if (left < p) {
    if (allowFlip && anchorRect) {
      const flippedX = anchorRect.right
      if (flippedX + floatingSize.width <= vW - p) {
        left = flippedX
        isFlippedX = false
      } else {
        left = p
      }
    } else {
      left = p
    }
  }

  // Vertical: clamp to viewport (minimal movement strategy)
  if (top + floatingSize.height > vH - p) {
    top = vH - floatingSize.height - p
  }
  if (top < p) {
    top = p
  }

  return { left, top, isFlippedX, isFlippedY }
}
