/**
 * THE PLOT CURSOR — one shared "where is the pointer", in data terms.
 *
 * Two independent channels, published together from one hover:
 *   TIMES        — absolute ms from the participant's first sample on the stimulus.
 *                  Comparable only WITHIN one stimulus, so it is scope-gated.
 *   PARTICIPANTS: the participant ids under the pointer, gated by what the set
 *                  means (`ParticipantScope`). 'identity' (a row, a node, a pair)
 *                  crosses stimuli: one person across them is the point.
 *                  'stimulus' sets are derived from a place on the stimulus (a
 *                  heatmap cell) and would read falsely elsewhere, so only plots
 *                  of the same stimulus mark them.
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
 * `useSyncedMax`, a monotone max, and `0` is a real cursor position.
 *
 * No effects: a kit publishes from `onHover` and repaints through its
 * `overlayKey`; the host reads the two channels into a plain `CursorRead`
 * (`cursorMarks.ts`) for it. The port retracts itself on destroy, so no recipe
 * can forget to.
 *
 * The input carries the PORT, never the cursor's value — a per-move `input()`
 * would hand every plot a new input and rebuild its scene per pointer frame.
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
 * node, a SPLOM dot), `drawTimeGuides` (the time channel). A plot that IS one
 * participant (scanpath) has no smaller part to mark, so it only publishes: a
 * whole-panel outline lit from elsewhere read as a stray focus border.
 */
import { onDestroy } from 'svelte'
import { sessionScoped } from '$lib/session/context'
import type { CursorPosition } from './cursorMarks'
import { usePlaybackClocks, type PlaybackClocks } from './playbackClock.svelte'

type PlotCursor = {
  plotId: number
  /** Null when the publisher's x is not elapsed ms (a scarf in 'ordinal'). */
  times: { scope: () => number | null; at: () => readonly number[] } | null
  /** Null when the publisher has no participant under the pointer (an AOI stream). */
  participants: (() => readonly number[]) | null
  /** The publisher's stimulus when its sets are 'stimulus'; null for 'identity'. */
  participantsScope: (() => number | null) | null
}

/** How a plot sits on the PARTICIPANTS channel; see the file header. */
export type ParticipantScope = {
  /** This plot's stimulus; omitted only by a plot spanning stimuli. */
  stimulus?: () => number | null
  /** What the sets it publishes mean; 'identity' when omitted. */
  publishes?: 'identity' | 'stimulus'
}

/** One shared empty set, so a cursor-less read is reference-stable. */
const NO_IDS: readonly number[] = []

/** One pointer, one cursor per session (never module state). */
export class PlotCursorState {
  current = $state.raw<PlotCursor | null>(null)
}

const usePlotCursor = sessionScoped(() => new PlotCursorState())


export interface PlotCursorPort {
  /** Publish the pointer's position; `null` when it leaves. */
  publish: (at: CursorPosition | null) => void
  /** ANOTHER plot's instants when comparable here, plus a playing clock's time. */
  readonly times: readonly number[]
  /** ANOTHER plot's participants under the pointer, less a 'stimulus' set from another stimulus. */
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
  timeScope: () => number | null = () => null,
  clocks: PlaybackClocks | null = null,
  { stimulus = () => null, publishes = 'identity' }: ParticipantScope = {}
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
        // A 'stimulus' publisher with no stimulus reaches no one: it fails closed.
        participantsScope: publishes === 'stimulus' ? stimulus : null,
      }
    },
    get times() {
      const c = others()
      const mine = timeScope()
      if (mine === null) return NO_IDS
      const hovered = c?.times != null && c.times.scope() === mine ? c.times.at() : NO_IDS
      // Playing clocks ride this channel, so readers draw their usual guide.
      const playing = clocks?.playingTimes(mine) ?? NO_IDS
      return playing.length === 0 ? hovered : [...hovered, ...playing]
    },
    get participants() {
      const c = others()
      if (!c?.participants) return NO_IDS
      if (c.participantsScope !== null) {
        const mine = stimulus()
        if (mine === null || c.participantsScope() !== mine) return NO_IDS
      }
      return c.participants()
    },
  }
}

/**
 * One plot's end of the cursor, built once per grid item by the platform from
 * the plot's `cursor` declaration (`plotHost.svelte.ts`). It owns its own
 * retraction: a plot removed under the pointer gets no `mouseleave`.
 *
 * `timeScope` is this plot's stimulus id, or `null` while its x axis is not
 * absolute time: one gate, both directions of the TIME channel. Omit it entirely
 * for a plot with no time axis (a matrix). `stimulus` gates 'stimulus' participant
 * sets both ways; omit it only for a plot spanning stimuli.
 */
export function plotCursorPort(
  plotId: number,
  { timeScope, ...participants }: { timeScope?: () => number | null } & ParticipantScope = {}
): PlotCursorPort {
  const port = createPlotCursorPort(usePlotCursor(), plotId, timeScope, usePlaybackClocks(), participants)
  onDestroy(() => port.publish(null))
  return port
}
