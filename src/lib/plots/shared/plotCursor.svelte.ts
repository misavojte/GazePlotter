/**
 * THE PLOT CURSOR — one shared "where is the pointer", in data terms.
 *
 * Two independent channels, published together from one hover:
 *   TIMES        — absolute ms from the participant's first sample on the stimulus.
 *                  Comparable only WITHIN one stimulus, so it is scope-gated.
 *   PARTICIPANTS — the participant ids under the pointer. Comparable everywhere
 *                  (that is the point: one person across stimuli), so NOT gated.
 * A publisher may carry either, both, or neither. Two comparability rules in one
 * record is deliberate: a pointer position genuinely has independent channels.
 *
 * BOTH channels are SETS, for one reason: a pointer can designate a PAIR. A
 * similarity-matrix cell is (row participant, column participant) and must mark
 * both people; a recurrence cell is (fixation i, fixation j) and must mark both
 * moments. A scalar would silently drop half of either datum. Arity is the
 * publisher's business, the diagonal dedupes to 1, and a pair is sorted because it
 * is a set.
 *
 * Vocabulary: PLOT CURSOR (this shared position) vs CROSSHAIR (a plot's own
 * pointer feedback) vs guide/outline (the marks). Never "sync" — that is
 * `PlotSyncRegistry`, a monotone max, and `0` is a real cursor position.
 *
 * No effects: publish from `onHover`, repaint by declaring `overlayDeps`. The
 * port retracts itself on destroy, so no recipe can forget to.
 *
 * Props carry the PORT, never the cursor's value — a per-move `props()` would
 * churn every figure's prop identity (scarf's fresh `margin` alone forces a
 * full render).
 *
 * Both channels are LIVE accessors, not snapshots: the pointer's pixel and row
 * are the ground truth, so a pan, an undo or a resize under a resting pointer
 * re-derives them instead of stranding a mark that matches nothing on screen. A
 * publisher's accessor must therefore never index blindly — the rows it captured
 * may be gone, and it must read back EMPTY, not throw into a sibling's effect.
 *
 * MARK PARITY: nothing in a mark encodes WHO designated the thing, so a plot's own
 * CROSSHAIR and this cursor draw the IDENTICAL mark and only their EXTENT differs.
 * One per shape: `markCrosshairStrip` (row/column), `markCrosshairNode` (a graph
 * node, a SPLOM dot), `strokeCrosshairPanel` (a plot that IS one participant),
 * `drawTimeGuide` (the time channel).
 */
import { onDestroy } from 'svelte'
import { sessionScoped } from '$lib/session/context'
import type { PlotScreenFactory } from '$lib/plots/definePlot'
import {
  alignToPixelCenter,
  strokeCrosshairGuides,
  strokeCrosshairRect,
} from './canvasUtils'

type PlotCursor = {
  plotId: number
  /** Null when the publisher's x is not elapsed ms (a scarf in 'ordinal'). */
  times: { scope: () => number | null; at: () => readonly number[] } | null
  /** Null when the publisher has no participant under the pointer (an AOI stream). */
  participants: (() => readonly number[]) | null
}

/** One shared empty set, so a cursor-less read is reference-stable. */
const NO_IDS: readonly number[] = []

/** One pointer, one cursor per session (never module state). */
export class PlotCursorState {
  current = $state.raw<PlotCursor | null>(null)
}

const usePlotCursor = sessionScoped(() => new PlotCursorState())

/** What the pointer is over, as live reads. Omit a channel the plot lacks. */
type PlotCursorPosition = {
  /** The instants under the pointer; a recurrence cell designates two. */
  times?: () => readonly number[]
  /** The ids under the pointer; may read back empty if the rows are gone. */
  participants?: () => readonly number[]
}

export interface PlotCursorPort {
  /** Publish the pointer's position; `null` when it leaves. */
  publish: (at: PlotCursorPosition | null) => void
  /** ANOTHER plot's instants when they are comparable here; empty when not. */
  readonly times: readonly number[]
  /** ANOTHER plot's participants under the pointer; empty when there are none. */
  readonly participants: readonly number[]
}

/**
 * One plot's end of the cursor, WITHOUT the destroy retraction — for tests and
 * for the rare owner that is not a component. Every plot wants
 * {@link plotCursorPort} instead.
 */
export function createPlotCursorPort(
  state: PlotCursorState,
  plotId: number,
  timeScope: () => number | null = () => null
): PlotCursorPort {
  // Self-exclusion: the publisher's own CROSSHAIR already marks the pointer, and
  // it is what stops a reader ever re-entering its own projection.
  const others = () => {
    const cursor = state.current
    return cursor === null || cursor.plotId === plotId ? null : cursor
  }
  return {
    publish(at) {
      // Publisher-scoped, so a stray leave can't erase the cursor under the
      // pointer, and last writer wins.
      if (at === null) {
        if (state.current?.plotId === plotId) state.current = null
        return
      }
      state.current = {
        plotId,
        times: at.times ? { scope: timeScope, at: at.times } : null,
        participants: at.participants ?? null,
      }
    },
    get times() {
      const c = others()
      const mine = timeScope()
      if (c?.times == null || mine === null) return NO_IDS
      return c.times.scope() === mine ? c.times.at() : NO_IDS
    },
    get participants() {
      return others()?.participants?.() ?? NO_IDS
    },
  }
}

/**
 * One plot's end of the cursor — build it ONCE in a screen-recipe body. It owns
 * its own retraction: a plot removed under the pointer gets no `mouseleave`, and
 * making that automatic is why this is the name recipes reach for.
 *
 * `timeScope` is this plot's stimulus id, or `null` while its x axis is not
 * absolute time: one gate, both directions of the TIME channel. Omit it entirely
 * for a plot with no time axis (a matrix); the participant channel is unaffected.
 */
export function plotCursorPort(
  plotId: number,
  timeScope?: () => number | null
): PlotCursorPort {
  const port = createPlotCursorPort(usePlotCursor(), plotId, timeScope)
  onDestroy(() => port.publish(null))
  return port
}

/**
 * The whole screen recipe for a plot whose only screen state is this port — one
 * recipe instead of one per plot.
 *
 * `timeScopeOf` is needed by any plot that READS the time channel, even one whose
 * own axes are not time: the scope gates reading as well as publishing, so a port
 * without it is permanently deaf to time (recurrence resolves a shared instant to
 * a fixation index while drawing ordinal axes). Omit it only when the plot neither
 * publishes nor reads a time.
 */
export function plotCursorScreen<S>(
  timeScopeOf?: (settings: S) => number | null
): PlotScreenFactory<S> {
  return ctx => {
    const plotCursor = plotCursorPort(
      ctx.item.id,
      timeScopeOf && (() => timeScopeOf(ctx.item.settings))
    )
    return { props: () => ({ plotCursor }) }
  }
}

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
 * `drawOverlay`'s first line, and a no-op on an empty set.
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
 * Whole-panel cursor mark, for a plot that IS one participant (scanpath,
 * recurrence). Inset 2px: `drawPlotArea` strokes exactly the frame and the
 * overlay runs after it, so a flush outline would repaint the axis border.
 */
export function strokeCrosshairPanel(
  ctx: CanvasRenderingContext2D,
  band: TimeGuideBand
): void {
  strokeCrosshairRect(ctx, band.x + 2, band.y + 2, band.width - 4, band.height - 4)
}

/**
 * The cursor's participants as positions in THIS plot's participant order,
 * ascending — rows, columns or nodes, whatever that order indexes; empty when it
 * shows none of them. Pass an id array the plot derives from its data (rebuilt on
 * a data change, never per pointer frame).
 *
 * Derive a `.join()` key off the result for `overlayDeps`: the array's identity
 * changes every pointer frame, but the key only changes when the marked positions
 * do, which is what keeps a plot from repainting while the cursor moves inside one.
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

/**
 * The cursor's read-side, as one derived bundle: guide `xs` from the TIME
 * channel ({@link timeGuideXs} over `band`) and `rows` from the PARTICIPANTS
 * channel ({@link cursorRows} over `rowIds`), each with its `.join()` repaint
 * key for `overlayDeps`. All inputs are live accessors; `band` returning null
 * gates the time channel off (a plot whose empty result carries a fabricated
 * timeline must not project into it). Omit `rowIds` for a plot with no
 * participant rows.
 */
export function cursorGuides(opts: {
  cursor: () => PlotCursorPort | null
  band: () => TimeGuideBand | null
  timeline: () => { minValue: number; maxValue: number }
  rowIds?: () => readonly number[]
}) {
  const xs = $derived.by(() => {
    const band = opts.band()
    if (band === null) return []
    return timeGuideXs(band, opts.timeline(), opts.cursor()?.times ?? [])
  })
  const rows = $derived.by(() =>
    opts.rowIds ? cursorRows(opts.rowIds(), opts.cursor()?.participants ?? []) : []
  )
  return {
    get xs() { return xs },
    get xsKey() { return xs.join(',') },
    get rows() { return rows },
    get rowsKey() { return rows.join(',') },
  }
}
