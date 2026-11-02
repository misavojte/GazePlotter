/**
 * PLOT KIT — what a canvas plot draws and how it reacts, as plain functions over
 * plain values. The engine (`usePlot.svelte.ts`) consumes this contract directly;
 * kits never touch runes, and `tests/plotKitBoundary.test.ts` enforces it.
 *
 * Why: Svelte re-runs a derived on every read once its input was replaced by an
 * equal-but-new value and it returned an EQUAL value (a write version only
 * moves on change). A draw that read such a derived per cell froze a 130-AOI
 * matrix for 18 s. So plot code is plain functions, and the engine caches each
 * pipeline step in a derived that returns a FRESH object, which caches.
 *
 * Data flows one way: the view's `input` + the canvas size → `chrome` (what the
 * frame needs) → `scene` (everything drawn, for this frame) → draw / hit / overlay.
 * Interaction hooks act through `PlotActions`, which the platform provides.
 */
import type { BlockedRegion } from './canvasBlockSelect.action'
import { NO_CURSOR, type CursorPosition, type CursorRead } from './cursorMarks'
import type { PlotPlaceholderContent } from './drawCanvasPlaceholder'
import type {
  CanvasSize,
  FrameAxes,
  FrameGutters,
  FrameHit,
  FramePointerHandlers,
  GradientLegendSlot,
  PlotFrame,
} from './frame'
import type { GradientLegendGeometry } from './legendGradient'
import type { LegendConfig, LegendGeometry, LegendItemGeometry } from './legendRendering'
import type { PlotPlayback } from './playback.svelte'

/** What the frame needs before it can be resolved, from the input and the canvas size. */
export interface KitChrome {
  /** Axis chrome; its labels and titles size the gutters. Null draws no axes. */
  axes?: FrameAxes | null
  gutters?: FrameGutters
  /** A colorbar the platform reserves, places and draws below the x-axis. */
  gradientLegend?: GradientLegendSlot | null
  /** Data-level placeholder (missing metric, empty selection). When set, no scene is built. */
  placeholder?: PlotPlaceholderContent | null
}

/** Everything a scene may depend on besides the input. */
export interface SceneContext<C extends KitChrome = KitChrome> {
  frame: PlotFrame
  size: CanvasSize
  chrome: C
  /** Device pixels per CSS pixel of the canvas (display or export DPI). */
  pixelRatio: number
  /** The placed colorbar declared by `chrome.gradientLegend`, for hit-testing its title. */
  gradientLegend: GradientLegendGeometry | null
}

/**
 * What a kit can do from an interaction hook. Reads are live (current values
 * when called), so a cursor publish re-derives under a resting pointer.
 * Export hands over inert actions.
 */
export interface PlotActions<I, S, St> {
  scene(): S | null
  input(): I
  frame(): PlotFrame
  /** The settings in effect: the committed ones, or a draft over them. */
  settings(): St
  /** Publish this plot's PLOT CURSOR position; `null` retracts it. */
  publish(at: CursorPosition | null): void
  /** Add or remove one entry of an array setting (e.g. `highlights`): one undo step. */
  toggle(key: keyof St & string, value: string | number): void
  /** Preview settings live (a pan while dragging); the view re-derives from them. */
  draft(patch: Partial<St>): void
  /** Commit `patch`, or else the draft: one undo step. Drops the draft either way. */
  commit(patch?: Partial<St>): void
}

/**
 * The platform's per-plot services (`plotHost.svelte.ts`), which the engine
 * turns into a kit's `PlotActions`. Export hands over `INERT_HOST`.
 */
export interface PlotHost {
  /** The shared PLOT CURSOR as plain sets (a reactive read). */
  cursor(): CursorRead
  publish(at: CursorPosition | null): void
  settings(): Record<string, unknown>
  toggle(key: string, value: string | number): void
  draft(patch: Record<string, unknown>): void
  commit(patch?: Record<string, unknown>): void
  /** The plot's playback clock membership, for plots that declare `playback`. */
  playback: PlotPlayback | null
}

/** No cursor, no settings writes, no clock: what an exported figure gets. */
export const INERT_HOST: PlotHost = {
  cursor: () => NO_CURSOR,
  publish() {},
  settings: () => ({}),
  toggle() {},
  draft() {},
  commit() {},
  playback: null,
}

/** The overlay's inputs: this plot's hover hit and the shared cursor, both plain. */
export interface OverlayState<I, H> {
  hover: H | null
  cursor: CursorRead
  input: I
}

export interface PlotKit<I, C extends KitChrome, S, H, St = Record<string, unknown>> {
  /** Canvas aria-label. */
  label: string | ((input: I) => string)
  /** Axes, gutters, colorbar and data placeholder; omitted means a bare frame. */
  chrome?: (input: I, size: CanvasSize) => C
  /** A fresh object with every geometry and colour for this frame. Not called while `chrome.placeholder` is set. */
  scene: (input: I, ctx: SceneContext<C>) => S
  /** Size guard: a placeholder when the scene cannot be drawn legibly at this size. */
  fit?: (scene: S, ctx: SceneContext<C>) => PlotPlaceholderContent | null
  /** Clip `draw` to the data rect. Default true; matrices draw labels outside it. */
  clip?: boolean
  draw: (ctx: CanvasRenderingContext2D, scene: S, frame: PlotFrame) => void
  /** Marks the axis border would otherwise slice (drawn after it, still cached). */
  drawAboveAxes?: (ctx: CanvasRenderingContext2D, scene: S, frame: PlotFrame) => void
  /** Hover and cursor marks, blitted over the cached data layer. */
  overlay?: {
    /** Equality-stable repaint key for the cursor marks: positions, never the cursor arrays. */
    key?: (scene: S, cursor: CursorRead, input: I) => string | number
    draw: (ctx: CanvasRenderingContext2D, scene: S, frame: PlotFrame, state: OverlayState<I, H>) => void
  }
  /** Hover inside the data rect. */
  hit?: (scene: S, x: number, y: number, frame: PlotFrame, input: I) => FrameHit<H> | null
  /** Hover on chrome outside the data rect (a legend title's notes). */
  hitChrome?: (scene: S, x: number, y: number, frame: PlotFrame, ctx: SceneContext<C>) => FrameHit<H> | null
  /** Dedup key for `hover`; defaults to the hit payload. */
  hoverKey?: (hover: H) => unknown
  /** Side effect on a hover change (publish the PLOT CURSOR). */
  hover?: (hover: H | null, act: PlotActions<I, S, St>) => void
  /** A click on the canvas, with the current hover payload. */
  click?: (hover: H | null, act: PlotActions<I, S, St>) => void
  /** Interactive legend band: the platform hit-tests items and shows the Highlight tooltip. */
  legend?: {
    geometry: (scene: S) => LegendGeometry | null
    config: LegendConfig
    highlights: (input: I) => readonly string[]
    hitData?: (item: LegendItemGeometry) => H
  }
  /** Where a press selects the plot rather than the grid; default the data rect. */
  blockedRegions?: (scene: S, frame: PlotFrame) => BlockedRegion[]
  /** Pointer and drag handlers, made once per canvas. */
  pointer?: (act: PlotActions<I, S, St>) => FramePointerHandlers
}

/**
 * Types a kit for its input, hover payload and (for kits that change settings)
 * settings, inferring chrome and scene from the functions. Declare `chrome` and
 * `scene` first in the literal so inference flows in order.
 */
export function defineKit<I, H = unknown, St = Record<string, unknown>>() {
  return <C extends KitChrome = KitChrome, S = unknown>(
    kit: PlotKit<I, C, S, H, St>
  ): PlotKit<I, C, S, H, St> => kit
}

/** Any kit, for the platform that is generic over it. */
export type AnyPlotKit = PlotKit<any, any, any, any, any>

/**
 * Memoise `fn` per object: one result per input identity, released with it.
 * For kit work that must survive resizes (textures, scratch buffers, layouts),
 * keyed by the immutable data object the view handed over.
 */
export function memoByRef<K extends object, V>(fn: (key: K) => V): (key: K) => V {
  const cache = new WeakMap<K, V>()
  return key => {
    if (cache.has(key)) return cache.get(key) as V
    const value = fn(key)
    cache.set(key, value)
    return value
  }
}
