import { FIXATION_CATEGORY_ID } from '$lib/data/binary/schema'

/**
 * Geometry for aligning reference media by hand: the media rectangle is
 * dragged and scaled under a FIXED cloud of fixations until the fixations sit
 * on the media's content. Pure (no DOM) so the drag math is testable.
 *
 * Two spaces: WORLD = gaze coordinates (what `StimulusMedia.region` stores),
 * VIEW = canvas CSS pixels. One uniform scale between them (never distort).
 */

export type Rect = { x: number; y: number; width: number; height: number }
export type Corner = 'nw' | 'ne' | 'sw' | 'se'
export type View = { scale: number; offsetX: number; offsetY: number }

/** The reader surface fixation collection needs (structural, so tests can stub it). */
export interface FixationPointSource {
  readonly hasSpatialData: boolean
  getSegmentRange(
    stimulusId: number,
    participantId: number
  ): { startIndex: number; endIndex: number }
  getSegmentCategory(segmentIndex: number): number
  getSegmentSpatial(segmentIndex: number): { x: number; y: number } | null
}

/**
 * Fixation points of the given participants on one stimulus, flat
 * `[x0, y0, x1, y1, ...]`. Fixations without finite coordinates are skipped.
 */
export function collectFixationPoints(
  reader: FixationPointSource,
  stimulusId: number,
  participantIds: readonly number[]
): Float64Array {
  if (!reader.hasSpatialData) return new Float64Array(0)
  const out: number[] = []
  for (const participantId of participantIds) {
    const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)
    for (let i = startIndex; i < endIndex; i++) {
      if (reader.getSegmentCategory(i) !== FIXATION_CATEGORY_ID) continue
      const p = reader.getSegmentSpatial(i)
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
      out.push(p.x, p.y)
    }
  }
  return Float64Array.from(out)
}

/** Bounding box of flat points, or null when there are none. */
export function pointsBounds(points: Float64Array): Rect | null {
  if (points.length < 2) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]
    const y = points[i + 1]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function unionRect(a: Rect, b: Rect | null): Rect {
  if (!b) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

export type Insets = { top: number; right: number; bottom: number; left: number }

/**
 * Uniform-scale view fitting `world` into a `width` × `height` canvas,
 * centred in the area left inside `insets` (CSS px).
 */
export function fitView(world: Rect, width: number, height: number, insets: Insets): View {
  const availW = Math.max(1, width - insets.left - insets.right)
  const availH = Math.max(1, height - insets.top - insets.bottom)
  const w = world.width > 0 ? world.width : 1
  const h = world.height > 0 ? world.height : 1
  const scale = Math.min(availW / w, availH / h)
  return {
    scale,
    offsetX: insets.left + (availW - w * scale) / 2 - world.x * scale,
    offsetY: insets.top + (availH - h * scale) / 2 - world.y * scale,
  }
}

/** Zooms `view` by `factor` keeping the VIEW point (px, py) fixed under the pointer. */
export function zoomView(view: View, factor: number, px: number, py: number): View {
  const scale = view.scale * factor
  return {
    scale,
    offsetX: px - (px - view.offsetX) * factor,
    offsetY: py - (py - view.offsetY) * factor,
  }
}

/**
 * Strips binary-fraction noise from sums of exact decimal inputs
 * (360.1 + 0.001 → 360.101, not 360.10100000000003). Twelve significant
 * digits are far beyond any gaze measurement, so nothing meaningful is lost.
 */
export function cleanFloat(value: number): number {
  return Number(value.toPrecision(12))
}

export const toView = (view: View, x: number, y: number) => ({
  x: x * view.scale + view.offsetX,
  y: y * view.scale + view.offsetY,
})

export const toWorld = (view: View, x: number, y: number) => ({
  x: (x - view.offsetX) / view.scale,
  y: (y - view.offsetY) / view.scale,
})

/**
 * Rounding step for world values: the power of ten at or below one canvas
 * pixel's worth of world units. Pixel-unit data snaps to whole numbers;
 * normalized (0 to 1) data keeps three or four decimals.
 */
export function snapStep(view: View): number {
  return 10 ** Math.floor(Math.log10(1 / view.scale))
}

/**
 * Rounding step for a rect of the given world size when no view is at hand
 * (buttons, not drags): whole units for pixel-scale data, matching what a
 * drag produces there; about a thousandth of the size for small-unit data
 * (normalized 0 to 1 coordinates).
 */
export function snapStepForSize(size: number): number {
  if (size >= 10) return 1
  return 10 ** Math.floor(Math.log10(Math.max(size, Number.MIN_VALUE) / 1000))
}

/**
 * The media rect, at its natural aspect ratio, that just covers the fixation
 * bounds, centred on them. A starting point when the media is far off (for
 * example gaze in normalized units, media in pixels).
 */
export function coverBounds(bounds: Rect, aspect: number): Rect {
  let width = bounds.width
  let height = width / aspect
  if (height < bounds.height) {
    height = bounds.height
    width = height * aspect
  }
  return {
    x: bounds.x + bounds.width / 2 - width / 2,
    y: bounds.y + bounds.height / 2 - height / 2,
    width,
    height,
  }
}

/** Rounds to a multiple of `step` without binary-fraction noise (0.30000000000000004). */
export function snapValue(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  return Number((Math.round(value / step) * step).toFixed(decimals))
}

export function snapRect(rect: Rect, step: number): Rect {
  return {
    x: snapValue(rect.x, step),
    y: snapValue(rect.y, step),
    width: Math.max(step, snapValue(rect.width, step)),
    height: Math.max(step, snapValue(rect.height, step)),
  }
}

/**
 * Round tick values (steps of 1, 2 or 5 times a power of ten) covering
 * [min, max] with at most about `maxTicks` ticks.
 */
export function niceTicks(min: number, max: number, maxTicks: number): number[] {
  const range = max - min
  if (!(range > 0) || maxTicks < 1) return []
  const raw = range / maxTicks
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag
  const ticks: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    ticks.push(snapValue(v, step < 1 ? step : 1))
  }
  return ticks
}

/**
 * Fixation counts per screen cell: `cell` × `cell` device pixels over a
 * `pixelWidth` × `pixelHeight` canvas, the view scaled by `dpr`. Points off
 * the canvas are dropped. Pure arithmetic, so it stays cheap for hundreds of
 * thousands of fixations, unlike one draw call per fixation.
 */
export function densityGrid(
  points: Float64Array,
  view: View,
  pixelWidth: number,
  pixelHeight: number,
  dpr: number,
  cell: number
): { counts: Uint32Array; cols: number; rows: number; max: number } {
  const cols = Math.ceil(pixelWidth / cell)
  const rows = Math.ceil(pixelHeight / cell)
  const counts = new Uint32Array(cols * rows)
  const sx = view.scale * dpr
  const ox = view.offsetX * dpr
  const oy = view.offsetY * dpr
  let max = 0
  for (let i = 0; i < points.length; i += 2) {
    const px = points[i] * sx + ox
    const py = points[i + 1] * sx + oy
    if (px < 0 || py < 0 || px >= pixelWidth || py >= pixelHeight) continue
    const k = Math.floor(py / cell) * cols + Math.floor(px / cell)
    const c = ++counts[k]
    if (c > max) max = c
  }
  return { counts, cols, rows, max }
}

/**
 * Opacity of a density cell. A lone fixation gets a fixed, clearly visible
 * floor so outliers still read as single points; denser cells rise on a log
 * scale to a cap below 1, so the media always shows through the cores.
 */
export function densityAlpha(count: number, max: number): number {
  if (count <= 0) return 0
  const FLOOR = 0.35
  const CAP = 0.8
  if (max <= 1) return FLOOR
  return FLOOR + (CAP - FLOOR) * (Math.log(count) / Math.log(max))
}

/** Corner positions of a world rect. */
export function cornerPoint(rect: Rect, corner: Corner): { x: number; y: number } {
  return {
    x: corner === 'nw' || corner === 'sw' ? rect.x : rect.x + rect.width,
    y: corner === 'nw' || corner === 'ne' ? rect.y : rect.y + rect.height,
  }
}

const CORNERS: readonly Corner[] = ['nw', 'ne', 'sw', 'se']
const OPPOSITE: Record<Corner, Corner> = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' }

/**
 * What a pointer at VIEW position (px, py) grabs: a corner handle (within
 * `handleRadius` px), the rect body, or nothing.
 */
export function hitTest(
  view: View,
  rect: Rect,
  px: number,
  py: number,
  handleRadius: number
): { kind: 'corner'; corner: Corner } | { kind: 'body' } | null {
  for (const corner of CORNERS) {
    const c = cornerPoint(rect, corner)
    const v = toView(view, c.x, c.y)
    if (Math.abs(px - v.x) <= handleRadius && Math.abs(py - v.y) <= handleRadius) {
      return { kind: 'corner', corner }
    }
  }
  const a = toView(view, rect.x, rect.y)
  const b = toView(view, rect.x + rect.width, rect.y + rect.height)
  if (px >= a.x && px <= b.x && py >= a.y && py <= b.y) return { kind: 'body' }
  return null
}

/**
 * Moves by an exact delta. Values the user typed keep their precision: only
 * the DELTA is ever rounded (by the caller, to the drag step), never the
 * position itself, so 360.25 moved by 10 is 370.25.
 */
export function moveRect(rect: Rect, dx: number, dy: number): Rect {
  return { ...rect, x: cleanFloat(rect.x + dx), y: cleanFloat(rect.y + dy) }
}

/**
 * Resizes `start` by dragging `corner` to world point (wx, wy). The opposite
 * corner stays exactly where it was.
 *
 * `step` > 0 rounds the dragged size to that step. With `keepAspect`, only
 * the width is rounded and the height follows from the start rect's exact
 * ratio, so the media is never distorted by rounding; the larger of the two
 * pointer-implied scales wins, so the corner tracks the pointer along
 * whichever axis moved more. Never smaller than `minSize`.
 */
export function resizeRect(
  start: Rect,
  corner: Corner,
  wx: number,
  wy: number,
  keepAspect: boolean,
  minSize: number,
  step = 0
): Rect {
  const anchor = cornerPoint(start, OPPOSITE[corner])
  const signX = corner === 'ne' || corner === 'se' ? 1 : -1
  const signY = corner === 'sw' || corner === 'se' ? 1 : -1
  const round = (v: number) => (step > 0 ? snapValue(v, step) : v)
  let width = Math.max(minSize, (wx - anchor.x) * signX)
  let height = Math.max(minSize, (wy - anchor.y) * signY)
  if (keepAspect && start.width > 0 && start.height > 0) {
    const s = Math.max(width / start.width, height / start.height)
    width = Math.max(minSize, round(start.width * s))
    // Not cleaned: the exact ratio matters more than a tidy height.
    height = width * (start.height / start.width)
  } else {
    width = Math.max(minSize, round(width))
    height = Math.max(minSize, round(height))
  }
  return {
    x: signX > 0 ? anchor.x : anchor.x - width,
    y: signY > 0 ? anchor.y : anchor.y - height,
    width,
    height,
  }
}
