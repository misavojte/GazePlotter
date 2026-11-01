/**
 * The PLOT CURSOR's marks, as plain functions over plain values: time guides
 * from the TIME channel, positions from the PARTICIPANTS channel. Kits import
 * these; the reactive port that publishes and reads the cursor stays in
 * `plotCursor.svelte.ts`.
 */
import { alignToPixelCenter, strokeCrosshairGuides } from './canvasUtils'

/** The cursor as a kit sees it: the port's two channels as plain sets (`plotCursor.svelte.ts`). */
export interface CursorRead {
  readonly times: readonly number[]
  readonly participants: readonly number[]
}

/** What a plot's pointer is over, as live reads. Omit a channel the plot lacks. */
export type CursorPosition = {
  /** The instants under the pointer; a recurrence cell designates two. */
  times?: () => readonly number[]
  /** The ids under the pointer; may read back empty if the rows are gone. */
  participants?: () => readonly number[]
}

const NONE: readonly number[] = []

/** No cursor: export, a plot without a port, or nothing under the pointer elsewhere. */
export const NO_CURSOR: CursorRead = { times: NONE, participants: NONE }

/** Where the time guide spans. `PlotFrame` is assignable; scarf passes its row band. */
export interface TimeGuideBand {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Aligned canvas x for the time guide, or `null` when there is nothing honest to
 * draw: no cursor, degenerate window, or a time outside this plot's window.
 * Nobody clamps — a clamped guide would claim a time the plot isn't showing.
 * Also the repaint key.
 */
export function timeGuideX(
  band: TimeGuideBand,
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

/**
 * The drawable guide positions for a set of instants, in order, dropping any this
 * plot's window excludes. The `.join()` of the result is the repaint key.
 */
export function timeGuideXs(
  band: TimeGuideBand,
  timeline: { minValue: number; maxValue: number },
  times: readonly number[]
): number[] {
  const xs: number[] = []
  for (const t of times) {
    const x = timeGuideX(band, timeline, t)
    if (x !== null) xs.push(x)
  }
  return xs
}

/** The inverse of {@link timeGuideX} (before its alignment), unclamped. */
export function timeAtX(
  band: TimeGuideBand,
  timeline: { minValue: number; maxValue: number },
  px: number
): number {
  const ratio = band.width > 0 ? (px - band.x) / band.width : 0
  return timeline.minValue + ratio * (timeline.maxValue - timeline.minValue)
}

/**
 * The time guides, one per instant. Self-clipping, so it is safe as any
 * overlay's first line, and a no-op on an empty set.
 */
export function drawTimeGuides(
  ctx: CanvasRenderingContext2D,
  band: TimeGuideBand,
  xs: readonly number[]
): void {
  if (xs.length === 0) return
  const segments: number[] = []
  for (const x of xs) segments.push(x, band.y, x, band.y + band.height)
  ctx.save()
  ctx.beginPath()
  ctx.rect(band.x, band.y, band.width, band.height)
  ctx.clip()
  strokeCrosshairGuides(ctx, segments)
  ctx.restore()
}

/**
 * The cursor's participants as positions in THIS plot's participant order,
 * ascending — rows, columns or nodes, whatever that order indexes; empty when it
 * shows none of them. Pass an id array the plot derives from its data (rebuilt on
 * a data change, never per pointer frame); key an overlay on the result's `.join()`.
 */
export function cursorRows(
  ids: readonly number[],
  participants: readonly number[]
): number[] {
  if (participants.length === 0) return []
  const rows: number[] = []
  for (let i = 0; i < ids.length; i++) {
    if (participants.includes(ids[i])) rows.push(i)
  }
  return rows
}

/** Where a time-axis plot projects time, and who its rows are. Its scene carries one as `timeAxis`. */
export interface TimeAxis {
  /**
   * Where time runs, in canvas px. Null gates the TIME channel off both ways:
   * an empty result's fabricated timeline must not be projected into.
   */
  readonly band: TimeGuideBand | null
  readonly timeline: { minValue: number; maxValue: number }
  /** The participant id per row, for plots whose rows are participants. */
  readonly rowIds?: readonly number[]
}

/** A scene a time-axis plot builds: anything carrying its {@link TimeAxis}. */
export interface TimeAxisScene {
  readonly timeAxis: TimeAxis
}

/** Guide columns from the TIME channel, marked rows from the PARTICIPANTS channel. */
function timeMarks(axis: TimeAxis, cursor: CursorRead) {
  return {
    xs: axis.band === null ? [] : timeGuideXs(axis.band, axis.timeline, cursor.times),
    rows: cursorRows(axis.rowIds ?? NONE, cursor.participants),
  }
}

/**
 * The PLOT CURSOR wiring every time-axis plot shares (scarf, AOI timeline,
 * metric timeline), over a scene carrying its `timeAxis`.
 */
export const timeCursor = {
  /**
   * The overlay's repaint key: positions, never the cursor arrays, so moving
   * inside one pixel column or row repaints nothing.
   */
  key(scene: TimeAxisScene, cursor: CursorRead): string {
    const { xs, rows } = timeMarks(scene.timeAxis, cursor)
    return `${xs.join(',')}:${rows.join(',')}`
  },

  /** Draws the time guides; returns the marked rows for the plot's own row mark. */
  draw(ctx: CanvasRenderingContext2D, scene: TimeAxisScene, cursor: CursorRead): number[] {
    const { band } = scene.timeAxis
    const { xs, rows } = timeMarks(scene.timeAxis, cursor)
    if (band !== null) drawTimeGuides(ctx, band, xs)
    return rows
  },

  /**
   * Publishes the hovered pixel `x` (and `row`, when the rows are participants)
   * as live reads of the CURRENT scene's axis, so a pan, an undo or a resize
   * under a resting pointer re-derives them; a null `x` retracts. Slices, never
   * indexes: a row gone under a resting pointer reads back empty.
   */
  publish(
    act: { scene(): TimeAxisScene | null; publish(at: CursorPosition | null): void },
    x: number | null,
    row: number | null = null
  ): void {
    if (x === null) return act.publish(null)
    const axis = () => act.scene()?.timeAxis
    act.publish({
      times: () => {
        const a = axis()
        return a?.band ? [timeAtX(a.band, a.timeline, x)] : []
      },
      participants:
        row === null ? undefined : () => axis()?.rowIds?.slice(row, row + 1) ?? [],
    })
  },
}
