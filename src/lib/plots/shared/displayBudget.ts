/**
 * Display budget for windowed time-axis plots (AOI Timeline, Metric Timeline).
 *
 * A windowed metric evaluated at its configured step over a long recording can
 * produce tens of thousands of windows, but a plot can only SHOW about one
 * column per on-screen pixel. Evaluating, retaining and drawing more windows
 * than that is wasted work that scales with recording length instead of screen
 * size — the dominant cost on large datasets.
 *
 * The budget decimates the configured windows by drawing every Nth one
 * (`N = stride`): `displayStep = stride × stepSize` is an integer multiple of
 * the configured step, so every drawn window is a REAL configured-step window
 * (no fabricated sub-pixel step) — resolution is simply capped to what the
 * screen can show. With `stride === 1` the full configured resolution is kept.
 *
 * Two composable steps, because width and window count live in different layers:
 *   - {@link resolveColumnBudget} — the view knows the on-screen width (compute
 *     the real drawable pixel width via `calculatePlotWidthPx`).
 *   - {@link resolveDisplayStride} — the transformer knows the metric's window
 *     count and configured step.
 */

/**
 * Ceiling on evaluated windows, and the budget when no on-screen width is known
 * (export / headless). It is the max realistic screen width in pixels: beyond
 * this, more columns can't be resolved on any display, and it caps worst-case
 * cost (e.g. several large plots at once). NOT a resolution throttle — the
 * interactive budget is the plot's actual pixel width, which is normally well
 * under this.
 */
export const DEFAULT_MAX_COLUMNS = 4096

/**
 * The most windows worth evaluating for a plot of the given drawable width: one
 * window per on-screen pixel, since anything finer is sub-pixel and can't be
 * shown. `plotWidthPx` is the real canvas width in CSS pixels (see
 * `calculatePlotWidthPx`); `undefined`/non-positive (export / headless, or an
 * unmeasured plot) yields {@link DEFAULT_MAX_COLUMNS}. There is deliberately no
 * lower clamp — a small plot genuinely has few columns to show, and inflating
 * that would only re-introduce the wasted evaluation the budget exists to avoid.
 * Errs slightly high (drawable width, not the narrower in-axes plotting rect) to
 * avoid ever under-sampling visible detail.
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
 * Decimate a full-resolution window count to the column budget. `fullWindowCount`
 * and `stepSize` MUST share units — ms for time-windowed metrics, fixation count
 * for fixation-windowed. Returns `stride === 1` (full resolution) when the count
 * already fits the budget.
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
