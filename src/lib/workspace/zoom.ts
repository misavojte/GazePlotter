/** Minimum zoom level (most zoomed out). */
export const ZOOM_MIN = 0.5

/** Maximum zoom level (no zoom, full scale). */
export const ZOOM_MAX = 1

/** Increment per slider step. */
export const ZOOM_STEP = 0.05

/**
 * Sensitivity multiplier for Ctrl+wheel zoom.
 * Smaller = finer control, larger = faster zoom.
 */
export const ZOOM_WHEEL_SENSITIVITY = 0.001

/** Clamp a value to the valid zoom range. */
export function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))
}
