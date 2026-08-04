/**
 * THE TIME CURSOR — one shared "where in time is the pointer".
 *
 * Hovering a plot whose x axis carries absolute time (ms from the participant's
 * first sample on the stimulus) publishes that position; every OTHER plot on the
 * same stimulus marks it with the shared dashed guide.
 *
 * Vocabulary: TIME CURSOR (this shared position) vs CROSSHAIR (a plot's own
 * pointer feedback) vs guide (the mark). Never "sync" — that is
 * `PlotSyncRegistry`, a monotone max, and `0` is a real cursor position.
 *
 * No effects, no lifecycle: publish from `onHover`, repaint by declaring
 * `overlayDeps`, retract in the port owner's `onDestroy`.
 *
 * Props carry the PORT, never the cursor's value — a per-move `props()` would
 * churn every figure's prop identity (scarf's fresh `margins` alone forces a
 * full render).
 *
 * Scope = stimulus id: absolute times are comparable only within one stimulus,
 * and across participants is the point. Ids not displayed names, so a plot
 * pinned to a MERGE tombstone sits in its own orphan scope. Horizontal only —
 * no registered plot puts absolute time on a vertical axis.
 */
import { alignToPixelCenter, strokeCrosshairGuides } from './canvasUtils'

/**
 * The publisher, as LIVE accessors rather than a snapshot: the pointer's pixel
 * is the ground truth, so pan/undo/resize under a resting pointer re-derive both
 * the time and the scope instead of stranding a stale mark on every sibling.
 */
type TimeCursor = { plotId: number; scope: () => number | null; timeOf: () => number }

// One pointer, one cursor: a module singleton like `tooltipState`.
let cursor = $state.raw<TimeCursor | null>(null)

export interface TimeCursorPort {
  /** Reads the pointer's absolute time (ms) on demand; `null` when it leaves. */
  publish: (timeOf: (() => number) | null) => void
  /** ANOTHER plot's current time when it is comparable here, else `null`. */
  readonly time: number | null
}

/**
 * One plot's end of the cursor — build it ONCE in a screen-recipe body.
 * `scope` is this plot's stimulus id, or `null` while its axis is not absolute
 * time (a scarf in 'ordinal'/'relative'): one gate, both directions.
 */
export function timeCursorPort(
  plotId: number,
  scope: () => number | null
): TimeCursorPort {
  return {
    publish(timeOf) {
      // Publisher-scoped, so a stray leave can't erase the cursor under the
      // pointer, and last writer wins.
      if (timeOf === null) {
        if (cursor?.plotId === plotId) cursor = null
        return
      }
      cursor = { plotId, scope, timeOf }
    },
    get time() {
      const c = cursor
      // Self-exclusion: the publisher's own CROSSHAIR is already there, and it is
      // what stops a reader ever re-entering its own projection.
      if (c === null || c.plotId === plotId) return null
      const mine = scope()
      return mine !== null && c.scope() === mine ? c.timeOf() : null
    },
  }
}

/** Where the mark spans. `PlotFrame` is assignable; scarf passes its row band. */
export interface TimeCursorBand {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Aligned canvas x, or `null` when there is nothing honest to draw: no cursor,
 * degenerate window, or a time outside this plot's window. Nobody clamps — a
 * clamped guide would claim a time the plot isn't showing. Also the repaint key.
 */
export function timeCursorX(
  band: TimeCursorBand,
  timeline: { minValue: number; maxValue: number },
  time: number | null
): number | null {
  if (time === null) return null
  const { minValue, maxValue } = timeline
  const range = maxValue - minValue
  // One negated conjunction so NaN fails it too.
  if (!(range > 0 && time >= minValue && time <= maxValue)) return null
  return alignToPixelCenter(band.x + ((time - minValue) / range) * band.width)
}

/** The inverse of {@link timeCursorX} (before its alignment), unclamped. */
export function timeAtX(
  band: TimeCursorBand,
  timeline: { minValue: number; maxValue: number },
  px: number
): number {
  const ratio = band.width > 0 ? (px - band.x) / band.width : 0
  return timeline.minValue + ratio * (timeline.maxValue - timeline.minValue)
}

/** The mark. Self-clipping, so it is safe as any `drawOverlay`'s first line. */
export function drawTimeCursor(
  ctx: CanvasRenderingContext2D,
  band: TimeCursorBand,
  x: number | null
): void {
  if (x === null) return
  ctx.save()
  ctx.beginPath()
  ctx.rect(band.x, band.y, band.width, band.height)
  ctx.clip()
  strokeCrosshairGuides(ctx, [x, band.y, x, band.y + band.height])
  ctx.restore()
}
