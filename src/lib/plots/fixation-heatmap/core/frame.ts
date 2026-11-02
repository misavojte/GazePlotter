/**
 * A PLAYBACK FRAME of a fixation map: the parked map's fixations re-weighted
 * to a time window, on the parked grid and the parked normalisation basis
 * (each participant's whole-range total W_j and N). So the accumulate run
 * grows into the parked map, its last frame is the parked map, and no frame
 * value exceeds the parked value at that point: the colour scale holds.
 */
import { fillWindowFrame, type WindowFrame } from '$lib/metrics/core/dsl'
import { blurGaussian, kernelTaps, splatFixations } from './density'
import type {
  FixationHeatmapAccumulate,
  FixationHeatmapData,
  FixationHeatmapNormalization,
} from '../types'

/** Buffers reused across frames: two value grids (so consecutive frames never alias) and the blur's. */
export interface FrameScratch {
  values: [Float32Array, Float32Array]
  blur: Float32Array
  taps: Float32Array
  /** What the buffers were sized and sampled for. */
  cells: number
  cell: number
  radius: number
  turn: 0 | 1
}

export const createFrameScratch = (): FrameScratch => ({
  values: [new Float32Array(0), new Float32Array(0)],
  blur: new Float32Array(0),
  taps: new Float32Array(0),
  cells: 0,
  cell: 0,
  radius: 0,
  turn: 0,
})

/**
 * The map of `parent`'s fixations inside `[windowStart, windowEnd]`: clipped
 * duration, or 1 when the midpoint is inside (the parked map's rules). An
 * empty or reversed window gives an empty map.
 */
export function heatmapFrame(
  parent: FixationHeatmapData,
  windowStart: number,
  windowEnd: number,
  accumulate: FixationHeatmapAccumulate,
  normalization: FixationHeatmapNormalization,
  scratch: FrameScratch = createFrameScratch()
): FixationHeatmapData {
  const { grid, radius, starts, ends, participants, participantIndex } = parent
  const cells = grid.cols * grid.rows
  if (scratch.cells !== cells) {
    scratch.values = [new Float32Array(cells), new Float32Array(cells)]
    scratch.blur = new Float32Array(cells)
    scratch.cells = cells
  }
  if (scratch.cell !== grid.cell || scratch.radius !== radius) {
    scratch.taps = kernelTaps(radius, grid.cell)
    scratch.cell = grid.cell
    scratch.radius = radius
  }
  scratch.turn = scratch.turn === 0 ? 1 : 0
  const values = scratch.values[scratch.turn]
  values.fill(0)

  const n = parent.xs.length
  const xs = new Float32Array(n)
  const ys = new Float32Array(n)
  const raw = new Float32Array(n)
  const weights = new Float32Array(n)
  const owner = new Uint32Array(n)
  const fStarts = new Float64Array(n)
  const fEnds = new Float64Array(n)
  const byDuration = accumulate === 'duration'
  const share = normalization === 'share'
  const N = participants.length
  const frame: WindowFrame = { windowStart: 0, windowEnd: 0, start: 0, end: 0, duration: 0 }
  let count = 0
  if (windowEnd > windowStart && windowEnd > 0) {
    for (let k = 0; k < n; k++) {
      const start = starts[k]
      const end = ends[k]
      if (end <= windowStart || start >= windowEnd) continue
      const midInWindow = fillWindowFrame(frame, start, end, windowStart, windowEnd)
      const w = byDuration ? frame.duration : midInWindow ? 1 : 0
      if (!(w > 0)) continue
      const p = participantIndex[k]
      xs[count] = parent.xs[k]
      ys[count] = parent.ys[k]
      raw[count] = w
      owner[count] = p
      fStarts[count] = start
      fEnds[count] = end
      weights[count] = share ? (100 * w) / participants[p].total / N : w / N
      count++
    }
  }
  splatFixations(xs, ys, weights, count, grid, values)
  blurGaussian(values, grid, scratch.taps, scratch.blur)
  let max = 0
  for (let k = 0; k < cells; k++) if (values[k] > max) max = values[k]

  return {
    ...parent,
    values,
    max,
    xs: xs.subarray(0, count),
    ys: ys.subarray(0, count),
    raw: raw.subarray(0, count),
    starts: fStarts.subarray(0, count),
    ends: fEnds.subarray(0, count),
    participantIndex: owner.subarray(0, count),
    summary: { ...parent.summary, fixations: count },
  }
}
