/**
 * Display budget for windowed time-axis plots (AOI Timeline, Metric Timeline).
 *
 * A windowed metric at its configured step can produce tens of thousands of
 * windows over a long recording, but a plot can only SHOW about one column per
 * on-screen pixel. Evaluating and drawing the rest is cost that scales with
 * recording length instead of screen size: the dominant one on large datasets.
 *
 * The budget draws every Nth window (`N = stride`), so `displayStep = stride ×
 * stepSize` stays an integer multiple of the configured step and every drawn
 * window is a REAL one, never a fabricated sub-pixel step.
 */

/**
 * Ceiling on evaluated windows, and the budget when no on-screen width is known
 * (export, headless). The max realistic screen width in pixels: past it no
 * display resolves more columns, and it caps the worst case of several large
 * plots at once. NOT a resolution throttle: the interactive budget is the plot's
 * own pixel width, normally well under this.
 */
export const DEFAULT_MAX_COLUMNS = 4096

/**
 * The most windows worth evaluating for a plot of the given drawable width, in
 * CSS pixels (see `calculatePlotWidthPx`). There is deliberately no lower clamp:
 * a small plot genuinely has few columns to show, and inflating that would
 * re-introduce the wasted evaluation this exists to avoid. Errs slightly high,
 * taking the drawable width rather than the narrower in-axes rect, so visible
 * detail is never under-sampled.
 */
export function resolveColumnBudget(plotWidthPx: number | undefined): number {
  if (plotWidthPx === undefined || !(plotWidthPx > 0)) return DEFAULT_MAX_COLUMNS
  return Math.min(DEFAULT_MAX_COLUMNS, Math.round(plotWidthPx))
}

export interface DisplayStride {
  /** Configured windows per drawn column (>= 1; 1 = full resolution). */
  stride: number
  /** On-screen step between drawn windows = `stride × stepSize`. */
  displayStep: number
}

/**
 * Decimate a full-resolution window count to the column budget.
 * `fullWindowCount` and `stepSize` MUST share units: ms for time-windowed
 * metrics, fixation count for fixation-windowed.
 */
export function resolveDisplayStride(
  fullWindowCount: number,
  stepSize: number,
  maxColumns: number
): DisplayStride {
  const budget = Math.max(1, Math.floor(maxColumns))
  const fullW = Math.max(1, Math.floor(fullWindowCount))
  const stride = Math.max(1, Math.ceil(fullW / budget))
  return { stride, displayStep: stride * stepSize }
}
