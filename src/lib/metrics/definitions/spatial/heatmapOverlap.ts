import { SEGMENT_STRIDE, SegmentField, type BinaryBufferReader } from '$lib/data/binary'
import { defineMetric } from '../../core/defineMetric'
import { fillWindowFrame, type WindowFrame } from '../../core/dsl'
import {
  autoRadius,
  blurGaussian,
  densityExtent,
  gridFor,
  kernelTaps,
  splatFixations,
  type GridGeometry,
} from '../../core/fixationDensity'
import { numberParam } from '../../core/params'

/** Cell size as a share of the radius. The overlap sums over cells, so a
 *  quarter radius (0.75 sigma) samples the kernel finely enough. */
const CELLS_PER_RADIUS = 4
/** Cell budget of one participant's map: every map stays in memory for the pairs. */
const MAX_CELLS = 256 * 256

const params = [
  numberParam('radius', 'Radius R (0 = Auto)', 0, {
    min: 0,
    description: "Kernel radius in gaze units, as on the heatmap. 0 uses the heatmap's Auto radius.",
    toLabel: v => (v > 0 ? `radius ${v}` : 'auto radius'),
  }),
] as const

/**
 * One participant's heatmap on `grid`, scaled to sum to 1: fixation durations
 * clipped to the time range, the heatmap's "share of fixation time" map for
 * that participant alone. Null without a located fixation on the grid.
 */
function participantMap(
  reader: BinaryBufferReader,
  spatial: Float32Array,
  stimulusId: number,
  participantId: number,
  timeStart: number,
  timeEnd: number,
  grid: GridGeometry,
  taps: Float32Array,
  scratch: Float32Array
): Float32Array | null {
  const { startIndex, endIndex } = reader.getFixationRange(stimulusId, participantId)
  const capacity = endIndex - startIndex
  if (capacity === 0) return null
  const xs = new Float32Array(capacity)
  const ys = new Float32Array(capacity)
  const ws = new Float32Array(capacity)
  const frame: WindowFrame = { windowStart: 0, windowEnd: 0, start: 0, end: 0, duration: 0 }
  const segBuf = reader.segmentBufferRaw
  const fixIdx = reader.fixationIndexRaw
  let count = 0
  for (let k = startIndex; k < endIndex; k++) {
    const i = fixIdx[k]
    const base = i * SEGMENT_STRIDE
    const start = segBuf[base + SegmentField.START_TIME]
    const end = segBuf[base + SegmentField.END_TIME]
    // KEEP IN SYNC with metrics/core/scanner.ts: its two skip lines + fillWindowFrame.
    if (timeEnd > 0 && start >= timeEnd) break
    if (end <= timeStart) continue
    fillWindowFrame(frame, start, end, timeStart, timeEnd)
    const x = spatial[i * 2]
    const y = spatial[i * 2 + 1]
    if (!(frame.duration > 0) || !Number.isFinite(x) || !Number.isFinite(y)) continue
    xs[count] = x
    ys[count] = y
    ws[count++] = frame.duration
  }
  if (count === 0) return null
  const values = new Float32Array(grid.cols * grid.rows)
  splatFixations(xs, ys, ws, count, grid, values)
  blurGaussian(values, grid, taps, scratch)
  let sum = 0
  for (let c = 0; c < values.length; c++) sum += values[c]
  if (!(sum > 0)) return null
  for (let c = 0; c < values.length; c++) values[c] /= sum
  return values
}

/** Histogram intersection of two maps that each sum to 1. */
function overlap(a: Float32Array, b: Float32Array): number {
  let sum = 0
  for (let c = 0; c < a.length; c++) sum += a[c] < b[c] ? a[c] : b[c]
  return sum
}

defineMetric({
  id: 'heatmapOverlap',
  label: 'Heatmap overlap',
  description:
    "Per participant pair: how much the two participants' heatmaps overlap, from 0 (no common area) to 1 (identical). " +
    "Each map is one participant's share of fixation time, blurred with the heatmap's kernel; the overlap sums the smaller share in every cell (SIM). " +
    'Ignores fixation order and needs no AOIs. Typical values sit well above 0, because most viewers look at the same central and salient areas.',
  unit: '',
  category: 'spatial',
  rawShape: 'participant-pair-matrix',
  needsCoordinates: true,
  windowUnit: 'ms',
  supportsWindowing: false,
  measurementClass: 'relational',
  searchTags: ['heat map', 'heatmap', 'attention map', 'overlap', 'similarity', 'spatial', 'pairwise', 'sim', 'histogram intersection'],
  params,
  scanGroup: (scope, { radius }) => {
    const participantIds = [...scope.participantIds]
    const size = participantIds.length
    const matrix = new Array<number>(size * size).fill(NaN)
    const reader = scope.engine.getReader()
    const spatial = reader?.hasSpatialData ? reader.getBuffers().spatialBuffer : undefined
    if (!reader || !spatial) return { matrix, participantIds }

    const media = scope.engine.metadata?.stimuliMedia?.[scope.stimulusId] ?? null
    const extent = densityExtent(reader, scope.stimulusId, media)
    if (!extent) return { matrix, participantIds }
    const r = radius > 0 ? radius : autoRadius(reader, media)
    const grid = gridFor(extent, r, CELLS_PER_RADIUS, MAX_CELLS)
    const taps = kernelTaps(r, grid.cell)
    const scratch = new Float32Array(grid.cols * grid.rows)
    const maps = participantIds.map(id =>
      participantMap(reader, spatial, scope.stimulusId, id, scope.timeStart ?? 0, scope.timeEnd ?? 0, grid, taps, scratch)
    )

    for (let i = 0; i < size; i++) {
      const a = maps[i]
      if (!a) continue
      matrix[i * size + i] = 1
      for (let j = i + 1; j < size; j++) {
        const b = maps[j]
        if (!b) continue
        const v = Math.round(overlap(a, b) * 1000) / 1000
        matrix[i * size + j] = v
        matrix[j * size + i] = v
      }
    }
    return { matrix, participantIds }
  },
})
