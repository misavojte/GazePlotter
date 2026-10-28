/**
 * Tick builders — "domain → PlotAreaTicks" so figures stop hand-rolling the
 * same position/label arrays before every `drawPlotArea`/`drawAxes` call.
 *
 * `PlotAreaTicks.positions` are normalised 0..1 along the edge (0 = left/top,
 * 1 = right/bottom). `labels` align with `positions`; omit for tick-only edges.
 */
import type { PlotAreaTicks } from './plotArea'
import type { AdaptiveTimeline } from './timelineUtils'
import { calculateNiceStepSize } from './timelineUtils'
import { niceTimelineTicks } from './plotArea'

export interface ValueAxisTickOptions {
  /** Invert positions (1 − p). Use for a bottom-origin Y value axis. */
  invert?: boolean
  /** Drop the labels, keeping only tick marks (e.g. a mirrored opposite edge). */
  ticksOnly?: boolean
}

/**
 * Ticks for a continuous value axis backed by an AdaptiveTimeline — the "nice"
 * ticks the timeline already computed. `invert` flips them for a Y axis whose
 * origin sits at the bottom (canvas y-down), `ticksOnly` strips labels for a
 * mirrored edge.
 */
export function valueAxisTicks(
  timeline: AdaptiveTimeline,
  options: ValueAxisTickOptions = {}
): PlotAreaTicks {
  const base = niceTimelineTicks(timeline)
  const positions = options.invert
    ? base.positions.map(p => 1 - p)
    : base.positions
  return options.ticksOnly ? { positions } : { positions, labels: base.labels }
}

export interface CategoryTickOptions {
  /** Label every `step`-th category (1-based count). Default 1 (label all). */
  step?: number
  /** Always label the first and last category even when `step` skips them. */
  edgesAlways?: boolean
  /** Invert positions (1 − p) — e.g. a bottom-origin row axis. */
  invert?: boolean
  /** Label for a 0-based category index. Default `i => String(i + 1)`. */
  format?: (index: number) => string
}

/**
 * Ticks centred on each of `count` equal categories/cells. Category
 * `i` sits at `(i + 0.5) / count`; only the labelled categories emit a tick so
 * `drawPlotArea` draws marks + labels solely where wanted.
 */
export function categoryTicks(
  count: number,
  options: CategoryTickOptions = {}
): PlotAreaTicks {
  const step = options.step ?? 1
  const format = options.format ?? ((i: number) => String(i + 1))
  const positions: number[] = []
  const labels: string[] = []
  for (let i = 0; i < count; i++) {
    const isEdge = i === 0 || i === count - 1
    const shown = (i + 1) % step === 0 || (options.edgesAlways && isEdge)
    if (!shown) continue
    const centred = (i + 0.5) / count
    positions.push(options.invert ? 1 - centred : centred)
    labels.push(format(i))
  }
  return { positions, labels }
}

/**
 * Nice ticks over a 1-based index axis whose ends ARE items 1 and `count`
 * (item k at `(k - 1) / (count - 1)`), e.g. recurrence's fixation lattice.
 * Item 1 always gets a tick, so the reader sees the axis starts at 1, then
 * every multiple of a whole-number nice step; `count` itself is not forced,
 * matching `linearTicks`. `labelFirst: false` keeps item 1's tick but drops its
 * label, for two axes meeting at a shared origin that should read "1" once.
 */
export function indexTicks(
  count: number,
  tickCount: number,
  options: { invert?: boolean; labelFirst?: boolean } = {}
): PlotAreaTicks {
  if (count < 2) return { positions: [0], labels: ['1'] }
  const span = count - 1
  // Indices are whole: a 0.5 step collapses to 1, a 2.5 step to 2.
  const step = Math.max(1, Math.floor(calculateNiceStepSize(span, tickCount)))
  const positions: number[] = []
  const labels: string[] = []
  const push = (v: number) => {
    const p = (v - 1) / span
    positions.push(options.invert ? 1 - p : p)
    labels.push(v === 1 && options.labelFirst === false ? '' : String(v))
  }
  push(1)
  for (let v = step; v <= count; v += step) if (v > 1) push(v)
  return { positions, labels }
}

/** Decimals a nice step needs to print exactly: 250 -> 0, 2.5 -> 1, 0.25 -> 2. */
function stepDecimals(step: number): number {
  let decimals = 0
  while (decimals < 6 && Math.abs(Math.round(step * 10 ** decimals) - step * 10 ** decimals) > 1e-6) {
    decimals++
  }
  return decimals
}

/**
 * Nice round-number ticks (1/2/2.5/5 x 10^n steps, like the timeline plots)
 * over a linear [min, max] axis, e.g. gaze coordinates: the multiples of the
 * step that fall inside the range. Unlike the timeline, min may be negative.
 */
export function linearTicks(min: number, max: number, count: number): PlotAreaTicks {
  if (!(max > min)) return { positions: [0.5], labels: [Number.isFinite(min) ? String(Number(min.toPrecision(3))) : ''] }
  const range = max - min
  const step = calculateNiceStepSize(range, count)
  // One precision for the whole axis, from the step: never "0.00" beside "250".
  const decimals = stepDecimals(step)
  const positions: number[] = []
  const labels: string[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-4; v += step) {
    // Snap floating-point drift (0.30000000000000004) back to the grid.
    const value = Math.abs(v) < step * 1e-6 ? 0 : v
    positions.push((value - min) / range)
    labels.push(value.toFixed(decimals))
  }
  return { positions, labels }
}
