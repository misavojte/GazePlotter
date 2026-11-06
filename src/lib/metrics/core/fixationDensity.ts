/**
 * The fixation-density measure, canvas-free: weights splatted onto a grid in
 * gaze units, then blurred by a separable tapered Gaussian. Peak-normalised, so
 * a lone fixation of weight w peaks at w and the map keeps the weight's unit.
 * Shared by the heat map and the heat map overlap metric, so both use one
 * kernel, one Auto radius and one map extent.
 */
import { SEGMENT_STRIDE, SegmentField, type BinaryBufferReader } from '$lib/data/binary'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { Rect } from '$lib/data/media/mediaAlignment'
import { mediaRegionOf } from '$lib/data/media/stimulusMedia'
import type { StimulusMedia } from '$lib/data/types'
import { fillWindowFrame, segmentInRange, type WindowFrame } from './dsl'
import { percentileSorted } from './numeric'

/** The located fixations of some participants on one stimulus within a time range. */
export interface ScopedFixations {
  xs: Float32Array
  ys: Float32Array
  /** Duration clipped to the range ('duration'), or 1 when the midpoint is in range ('count'). */
  weights: Float32Array
  starts: Float64Array
  ends: Float64Array
  /** Index into the `participantIds` passed in. */
  owner: Uint32Array
  /** These participants' fixations on the stimulus at any time. */
  total: number
  /** Fixations with a weight in range, located or not. */
  inRange: number
  withoutCoordinates: number
}

/**
 * The fixations a density map is built from, weighted by the metric library's
 * dwell and count conventions, so a map's mass reconciles with them.
 */
export function scopedFixations(
  reader: BinaryBufferReader,
  spatial: Float32Array,
  stimulusId: number,
  participantIds: readonly number[],
  timeStart: number,
  timeEnd: number,
  weight: 'duration' | 'count'
): ScopedFixations {
  let capacity = 0
  for (const id of participantIds) {
    const { startIndex, endIndex } = reader.getFixationRange(stimulusId, id)
    capacity += endIndex - startIndex
  }
  const xs = new Float32Array(capacity)
  const ys = new Float32Array(capacity)
  const weights = new Float32Array(capacity)
  const starts = new Float64Array(capacity)
  const ends = new Float64Array(capacity)
  const owner = new Uint32Array(capacity)
  const frame: WindowFrame = { windowStart: 0, windowEnd: 0, start: 0, end: 0, duration: 0 }
  const segBuf = reader.segmentBufferRaw
  const fixIdx = reader.fixationIndexRaw
  let count = 0
  let inRange = 0
  let withoutCoordinates = 0
  for (let p = 0; p < participantIds.length; p++) {
    const { startIndex, endIndex } = reader.getFixationRange(stimulusId, participantIds[p])
    const rStart = reader.getParticipantStartTime(stimulusId, participantIds[p])
    const rEnd = reader.getParticipantEndTime(stimulusId, participantIds[p])
    for (let k = startIndex; k < endIndex; k++) {
      const i = fixIdx[k]
      const base = i * SEGMENT_STRIDE
      const start = segBuf[base + SegmentField.START_TIME]
      const end = segBuf[base + SegmentField.END_TIME]
      // KEEP IN SYNC with metrics/core/scanner.ts: its two skip lines + fillWindowFrame.
      if (timeEnd > 0 && start > timeEnd) break
      if (!segmentInRange(start, end, timeStart, timeEnd, rStart, rEnd)) continue
      const midInScope = fillWindowFrame(frame, start, end, timeStart, timeEnd)
      const w = weight === 'duration' ? frame.duration : midInScope ? 1 : 0
      if (!(w > 0)) continue
      inRange++
      const x = spatial[i * 2]
      const y = spatial[i * 2 + 1]
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        withoutCoordinates++
        continue
      }
      xs[count] = x
      ys[count] = y
      weights[count] = w
      starts[count] = start
      ends[count] = end
      owner[count++] = p
    }
  }
  return {
    xs: xs.subarray(0, count),
    ys: ys.subarray(0, count),
    weights: weights.subarray(0, count),
    starts: starts.subarray(0, count),
    ends: ends.subarray(0, count),
    owner: owner.subarray(0, count),
    total: capacity,
    inRange,
    withoutCoordinates,
  }
}

/** A value grid in gaze units; cell (i, j) is centred at (x0 + (i + 0.5) cell, y0 + (j + 0.5) cell). */
export interface GridGeometry {
  x0: number
  y0: number
  cell: number
  cols: number
  rows: number
}

/** sigma = R / 3: the kernel's 3-sigma support is the radius. */
export const SIGMA_PER_RADIUS = 1 / 3

/** Finest cell as a share of the radius: the worst sub-cell peak stays near 0.98 w. */
const CELLS_PER_RADIUS = 16
/** Coarsest cell before peaks read noticeably low (about 3 % at a sub-cell offset). */
const COARSE_CELLS_PER_RADIUS = 12
/** Cell budget of one grid (2048 x 2048), and its longest side. */
const MAX_GRID_CELLS = 2048 * 2048
const MAX_GRID_SIDE = 8192

/** Grid over `extent` padded by `radius` on every side, so kernels at the edge stay whole. */
export function gridFor(
  extent: Rect,
  radius: number,
  cellsPerRadius = CELLS_PER_RADIUS,
  maxCells = MAX_GRID_CELLS
): GridGeometry {
  const width = extent.width + 2 * radius
  const height = extent.height + 2 * radius
  const cell = Math.max(
    radius / cellsPerRadius,
    Math.sqrt((width * height) / maxCells),
    Math.max(width, height) / MAX_GRID_SIDE
  )
  return {
    x0: extent.x - radius,
    y0: extent.y - radius,
    cell,
    cols: Math.max(1, Math.ceil(width / cell)),
    rows: Math.max(1, Math.ceil(height / cell)),
  }
}

/**
 * One side of the separable kernel, taps at 0, cell, 2 cell, ... : a Gaussian
 * shifted and rescaled to be 1 at the centre and exactly 0 at the radius, so the
 * map has no faint rim where a plain truncated Gaussian would stop at 1.1 %.
 */
export function kernelTaps(radius: number, cell: number): Float32Array {
  const sigma = radius * SIGMA_PER_RADIUS
  const floor = Math.exp(-0.5 / (SIGMA_PER_RADIUS * SIGMA_PER_RADIUS))
  const reach = Math.floor(radius / cell)
  const taps = new Float32Array(reach + 1)
  for (let k = 0; k <= reach; k++) {
    const d = k * cell
    const g = Math.exp(-(d * d) / (2 * sigma * sigma))
    taps[k] = Math.max(0, (g - floor) / (1 - floor))
  }
  return taps
}

/** The cell budget forced a cell too coarse for the radius: peaks read low. */
export const isCoarseGrid = (grid: GridGeometry, radius: number) =>
  grid.cell > radius / COARSE_CELLS_PER_RADIUS

/** Gaze-unit centre of a row-major cell index. */
export function cellCentreOf(grid: GridGeometry, cell: number): { x: number; y: number } {
  return {
    x: grid.x0 + ((cell % grid.cols) + 0.5) * grid.cell,
    y: grid.y0 + (Math.floor(cell / grid.cols) + 0.5) * grid.cell,
  }
}

/**
 * Bilinear splat: each weight is shared among its four nearest cell centres,
 * which conserves mass and keeps sub-cell position. Shares landing off the grid
 * are dropped (the grid is padded by the radius, so those never reach the extent).
 */
export function splatFixations(
  xs: Float32Array,
  ys: Float32Array,
  ws: Float32Array,
  count: number,
  grid: GridGeometry,
  out: Float32Array
): void {
  const { x0, y0, cell, cols, rows } = grid
  const inv = 1 / cell
  for (let k = 0; k < count; k++) {
    const w = ws[k]
    if (w === 0) continue
    const gx = (xs[k] - x0) * inv - 0.5
    const gy = (ys[k] - y0) * inv - 0.5
    const i0 = Math.floor(gx)
    const j0 = Math.floor(gy)
    const fx = gx - i0
    const fy = gy - j0
    if (j0 >= 0 && j0 < rows) {
      const row = j0 * cols
      if (i0 >= 0 && i0 < cols) out[row + i0] += w * (1 - fx) * (1 - fy)
      if (i0 + 1 >= 0 && i0 + 1 < cols) out[row + i0 + 1] += w * fx * (1 - fy)
    }
    if (j0 + 1 >= 0 && j0 + 1 < rows) {
      const row = (j0 + 1) * cols
      if (i0 >= 0 && i0 < cols) out[row + i0] += w * (1 - fx) * fy
      if (i0 + 1 >= 0 && i0 + 1 < cols) out[row + i0 + 1] += w * fx * fy
    }
  }
}

/**
 * Separable blur of `values` in place: rows into `scratch`, then columns back.
 * Both passes walk memory row by row; zero source cells are skipped, which is
 * most of a fixation map.
 */
export function blurGaussian(
  values: Float32Array,
  grid: GridGeometry,
  taps: Float32Array,
  scratch: Float32Array
): void {
  const { cols, rows } = grid
  const reach = taps.length - 1
  scratch.fill(0)
  for (let j = 0; j < rows; j++) {
    const row = j * cols
    for (let i = 0; i < cols; i++) {
      const v = values[row + i]
      if (v === 0) continue
      const lo = Math.max(0, i - reach)
      const hi = Math.min(cols - 1, i + reach)
      for (let t = lo; t <= hi; t++) scratch[row + t] += v * taps[t > i ? t - i : i - t]
    }
  }
  values.fill(0)
  for (let j = 0; j < rows; j++) {
    const lo = Math.max(0, j - reach)
    const hi = Math.min(rows - 1, j + reach)
    const src = j * cols
    for (let t = lo; t <= hi; t++) {
      const tap = taps[t > j ? t - j : j - t]
      if (tap === 0) continue
      const dst = t * cols
      for (let i = 0; i < cols; i++) {
        const v = scratch[src + i]
        if (v !== 0) values[dst + i] += v * tap
      }
    }
  }
}

/** Fixations bucketed into radius-sized squares (CSR): bucket b holds `order[offsets[b] .. offsets[b + 1]]`. */
export interface FixationBuckets {
  x0: number
  y0: number
  size: number
  cols: number
  rows: number
  offsets: Uint32Array
  order: Uint32Array
}

function bucketOf(v: number, origin: number, size: number, n: number): number {
  const b = Math.floor((v - origin) / size)
  return b < 0 ? 0 : b >= n ? n - 1 : b
}

/** Most buckets of one index; a tiny radius gets larger buckets, never a huge table. */
const MAX_BUCKETS = 1 << 20

/**
 * Counting sort of fixations into square buckets over `grid`, at least `radius`
 * a side so a 3 x 3 scan covers the radius; off-grid points clamp to edge buckets.
 */
export function bucketFixations(
  xs: Float32Array,
  ys: Float32Array,
  count: number,
  grid: GridGeometry,
  radius: number
): FixationBuckets {
  const width = grid.cols * grid.cell
  const height = grid.rows * grid.cell
  const size = Math.max(radius, Math.sqrt((width * height) / MAX_BUCKETS))
  const cols = Math.max(1, Math.ceil(width / size))
  const rows = Math.max(1, Math.ceil(height / size))
  const offsets = new Uint32Array(cols * rows + 1)
  const keys = new Uint32Array(count)
  for (let k = 0; k < count; k++) {
    const b = bucketOf(ys[k], grid.y0, size, rows) * cols + bucketOf(xs[k], grid.x0, size, cols)
    keys[k] = b
    offsets[b + 1]++
  }
  for (let b = 0; b < cols * rows; b++) offsets[b + 1] += offsets[b]
  const cursor = offsets.slice(0, cols * rows)
  const order = new Uint32Array(count)
  for (let k = 0; k < count; k++) order[cursor[keys[k]]++] = k
  return { x0: grid.x0, y0: grid.y0, size, cols, rows, offsets, order }
}

/**
 * Indices of fixations within `radius` of (px, py), written into `out`;
 * returns how many. Scans the 3 x 3 buckets around the point, which covers the
 * radius when buckets are at least that size.
 */
export function fixationsWithin(
  buckets: FixationBuckets,
  xs: Float32Array,
  ys: Float32Array,
  px: number,
  py: number,
  radius: number,
  out: Uint32Array
): number {
  const { x0, y0, size, cols, rows, offsets, order } = buckets
  const bi = bucketOf(px, x0, size, cols)
  const bj = bucketOf(py, y0, size, rows)
  const r2 = radius * radius
  let n = 0
  for (let j = Math.max(0, bj - 1); j <= Math.min(rows - 1, bj + 1); j++) {
    for (let i = Math.max(0, bi - 1); i <= Math.min(cols - 1, bi + 1); i++) {
      const b = j * cols + i
      for (let o = offsets[b]; o < offsets[b + 1]; o++) {
        const k = order[o]
        const dx = xs[k] - px
        const dy = ys[k] - py
        if (dx * dx + dy * dy <= r2) out[n++] = k
      }
    }
  }
  return n
}

/** Bound on the points a robust extent sorts: a deterministic stride sample beyond it. */
const EXTENT_SAMPLE_CAP = 200_000
/** Auto radius as a share of the longer side of the robust fixation extent. */
const AUTO_RADIUS_SHARE = 0.05
/** Robust extent bounds: 1st and 99th percentile per axis. */
const ROBUST_QUANTILE = 0.01
/** Without media the extent clamps outliers beyond this share of the robust
    extent past each of its edges. */
const OUTLIER_MARGIN = 0.5

interface PointExtent {
  /** Exact bounding box of every located fixation. */
  bbox: Rect
  /** 1st to 99th percentile per axis. */
  robust: Rect
}

/** Every participant's located fixations on `stimuli`, all times: one bbox + one robust extent. */
function fixationExtent(reader: BinaryBufferReader, stimuli: number[]): PointExtent | null {
  const { spatialBuffer: xy, maxParticipants } = reader.getBuffers()
  if (!xy) return null
  const fixIdx = reader.fixationIndexRaw
  let n = 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of stimuli) {
    for (let p = 0; p < maxParticipants; p++) {
      const { startIndex, endIndex } = reader.getFixationRange(s, p)
      for (let k = startIndex; k < endIndex; k++) {
        const i = fixIdx[k] * 2
        const x = xy[i]
        const y = xy[i + 1]
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        n++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (n === 0) return null
  // A deterministic stride sample bounds the sort on very large datasets.
  const stride = Math.ceil(n / EXTENT_SAMPLE_CAP)
  const sx = new Float64Array(Math.ceil(n / stride))
  const sy = new Float64Array(sx.length)
  let seen = 0
  let m = 0
  for (const s of stimuli) {
    for (let p = 0; p < maxParticipants; p++) {
      const { startIndex, endIndex } = reader.getFixationRange(s, p)
      for (let k = startIndex; k < endIndex; k++) {
        const i = fixIdx[k] * 2
        const x = xy[i]
        const y = xy[i + 1]
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        if (seen++ % stride === 0 && m < sx.length) {
          sx[m] = x
          sy[m++] = y
        }
      }
    }
  }
  const xsSorted = sx.subarray(0, m).sort()
  const ysSorted = sy.subarray(0, m).sort()
  const lo = (a: Float64Array) => percentileSorted(a, ROBUST_QUANTILE)
  const hi = (a: Float64Array) => percentileSorted(a, 1 - ROBUST_QUANTILE)
  return {
    bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    robust: {
      x: lo(xsSorted),
      y: lo(ysSorted),
      width: hi(xsSorted) - lo(xsSorted),
      height: hi(ysSorted) - lo(ysSorted),
    },
  }
}

/** Per-reader extents: the data under a reader never changes (an edit builds a new reader). */
const extentCache = new WeakMap<
  BinaryBufferReader,
  { dataset?: PointExtent | null; stimuli: Map<number, PointExtent | null> }
>()

function cacheOf(reader: BinaryBufferReader) {
  let cache = extentCache.get(reader)
  if (!cache) extentCache.set(reader, (cache = { stimuli: new Map() }))
  return cache
}

function datasetExtent(reader: BinaryBufferReader): PointExtent | null {
  const cache = cacheOf(reader)
  if (cache.dataset === undefined) {
    const stimuli = Array.from({ length: reader.getBuffers().stimuliCount }, (_, s) => s)
    cache.dataset = fixationExtent(reader, stimuli)
  }
  return cache.dataset
}

function stimulusExtent(reader: BinaryBufferReader, stimulusId: number): PointExtent | null {
  const cache = cacheOf(reader)
  if (!cache.stimuli.has(stimulusId)) {
    cache.stimuli.set(stimulusId, fixationExtent(reader, [stimulusId]))
  }
  return cache.stimuli.get(stimulusId) ?? null
}

/**
 * Auto kernel radius: a share of the robust extent of ALL fixations in the
 * dataset, so every stimulus and selection of one study gets the same kernel
 * (it describes the eye and tracker, not the picture). Falls back to the media
 * size, then to 1, when the fixations have no extent.
 */
export function autoRadius(reader: BinaryBufferReader, media: StimulusMedia | null): number {
  const robust = datasetExtent(reader)?.robust
  const side = robust ? Math.max(robust.width, robust.height) : 0
  if (side > 0) return side * AUTO_RADIUS_SHARE
  if (media) {
    const region = mediaRegionOf(media)
    return Math.max(region.width, region.height) * AUTO_RADIUS_SHARE
  }
  return 1
}

/** The resolved auto radius for a stimulus, for the pane label; null without spatial data. */
export function autoRadiusFor(engine: DataEngine, stimulusId: number): number | null {
  const reader = engine.getReader()
  if (!reader?.hasSpatialData) return null
  return autoRadius(reader, engine.metadata?.stimuliMedia?.[stimulusId] ?? null)
}

/**
 * The area a stimulus's map covers: the media region, or without media the
 * fixations' bbox, clamped so far outliers cannot shrink the map to a stamp.
 * Null without media and without located fixations.
 */
export function densityExtent(
  reader: BinaryBufferReader,
  stimulusId: number,
  media: StimulusMedia | null
): Rect | null {
  if (media) return mediaRegionOf(media)
  const extent = stimulusExtent(reader, stimulusId)
  return extent && clampOutliers(extent)
}

function clampOutliers({ bbox, robust }: PointExtent): Rect {
  const mx = robust.width * OUTLIER_MARGIN
  const my = robust.height * OUTLIER_MARGIN
  const x0 = Math.max(bbox.x, robust.x - mx)
  const y0 = Math.max(bbox.y, robust.y - my)
  const x1 = Math.min(bbox.x + bbox.width, robust.x + robust.width + mx)
  const y1 = Math.min(bbox.y + bbox.height, robust.y + robust.height + my)
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}
