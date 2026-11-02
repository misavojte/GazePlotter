import { defineMetric } from '../../core/defineMetric'
import type { GroupScope } from '../../core/dsl'
import {
  autoRadius,
  blurGaussian,
  densityExtent,
  gridFor,
  kernelTaps,
  scopedFixations,
  splatFixations,
} from '../../core/fixationDensity'
import { pairMatrix } from '../../core/pairMatrix'
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
 * Each participant's heatmap on one shared grid, scaled to sum to 1: the
 * heatmap's "share of fixation time" map for that participant alone. Null for
 * a participant without a located fixation on the grid, and for everyone when
 * the data has no coordinates.
 */
function participantMaps(scope: GroupScope, radius: number): (Float32Array | null)[] {
  const none = scope.participantIds.map(() => null)
  const reader = scope.engine.getReader()
  const spatial = reader?.hasSpatialData ? reader.getBuffers().spatialBuffer : undefined
  if (!reader || !spatial) return none
  const media = scope.engine.metadata?.stimuliMedia?.[scope.stimulusId] ?? null
  const extent = densityExtent(reader, scope.stimulusId, media)
  if (!extent) return none

  const r = radius > 0 ? radius : autoRadius(reader, media)
  const grid = gridFor(extent, r, CELLS_PER_RADIUS, MAX_CELLS)
  const taps = kernelTaps(r, grid.cell)
  const scratch = new Float32Array(grid.cols * grid.rows)
  return scope.participantIds.map(id => {
    const f = scopedFixations(reader, spatial, scope.stimulusId, [id], scope.timeStart ?? 0, scope.timeEnd ?? 0, 'duration')
    const values = new Float32Array(grid.cols * grid.rows)
    splatFixations(f.xs, f.ys, f.weights, f.xs.length, grid, values)
    blurGaussian(values, grid, taps, scratch)
    let sum = 0
    for (let c = 0; c < values.length; c++) sum += values[c]
    if (!(sum > 0)) return null
    for (let c = 0; c < values.length; c++) values[c] /= sum
    return values
  })
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
  scanGroup: (scope, { radius }) => ({
    matrix: pairMatrix(participantMaps(scope, radius), overlap),
    participantIds: [...scope.participantIds],
  }),
})
