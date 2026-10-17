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
 * Ticks centred on each of `count` equal categories/cells — the pattern used
 * by recurrence (per-fixation cells) and bar (per-AOI categories). Category
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

function formatLinearTick(v: number): string {
  if (!Number.isFinite(v)) return ''
  const abs = Math.abs(v)
  if (abs >= 1000) return Math.round(v).toString()
  if (abs >= 10) return v.toFixed(0)
  return v.toFixed(2)
}

/**
 * Nice round-number ticks (1/2/2.5/5 x 10^n steps, like the timeline plots)
 * over a linear [min, max] axis, e.g. gaze coordinates: the multiples of the
 * step that fall inside the range. Unlike the timeline, min may be negative.
 */
export function linearTicks(min: number, max: number, count: number): PlotAreaTicks {
  if (!(max > min)) return { positions: [0.5], labels: [formatLinearTick(min)] }
  const range = max - min
  const step = calculateNiceStepSize(range, count)
  const positions: number[] = []
  const labels: string[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-4; v += step) {
    // Snap floating-point drift (0.30000000000000004) back to the grid.
    const value = Math.abs(v) < step * 1e-6 ? 0 : v
    positions.push((value - min) / range)
    labels.push(formatLinearTick(value))
  }
  return { positions, labels }
}
