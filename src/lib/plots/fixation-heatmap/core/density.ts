/**
 * The fixation-density measure, canvas-free: weights splatted onto a grid in
 * gaze units, then blurred by a separable tapered Gaussian. Peak-normalised, so
 * a lone fixation of weight w peaks at w and the map keeps the weight's unit.
 */
import type { Rect } from '$lib/data/media/mediaAlignment'

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
export function gridFor(extent: Rect, radius: number): GridGeometry {
  const width = extent.width + 2 * radius
  const height = extent.height + 2 * radius
  const cell = Math.max(
    radius / CELLS_PER_RADIUS,
    Math.sqrt((width * height) / MAX_GRID_CELLS),
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
