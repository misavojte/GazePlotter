import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getParticipant, getParticipantsIds } from '$lib/data/engine'
import {
  SEGMENT_STRIDE,
  SegmentField,
  type BinaryBufferReader,
} from '$lib/data/binary'
import { mediaRegionOf } from '$lib/data/media/mediaUpload'
import type { Rect } from '$lib/data/media/mediaAlignment'
import type { StimulusMedia } from '$lib/data/types'
import { fillWindowFrame, type WindowFrame } from '$lib/metrics/core/dsl'
import { percentileSorted } from '$lib/shared/stats'
import { blurGaussian, gridFor, isCoarseGrid, kernelTaps, splatFixations } from './density'
import { FIXATION_HEATMAP_LAYOUT as L } from '../const'
import type {
  FixationHeatmapPlotSettings,
  FixationHeatmapTransformResult,
  FixationHeatmapUnavailableReason,
  HeatmapParticipant,
} from '../types'

/** Bound on the points a robust extent sorts: a deterministic stride sample beyond it. */
const EXTENT_SAMPLE_CAP = 200_000

interface PointExtent {
  /** Exact bounding box of every located fixation. */
  bbox: Rect
  /** 1st to 99th percentile per axis. */
  robust: Rect
}

/** Per-reader extents: the data under a reader never changes (an edit builds a new reader). */
const readerCache = new WeakMap<
  BinaryBufferReader,
  {
    dataset?: PointExtent | null
    stimuli: Map<number, PointExtent | null>
    /** Recent maps by their compute key, so colour, opacity and scale edits never recompute. */
    maps: Map<string, FixationHeatmapTransformResult>
  }
>()

/** Recent maps kept per reader: enough for a workspace of side-by-side heatmaps. */
const MAP_CACHE_SIZE = 16

function cacheOf(reader: BinaryBufferReader) {
  let entry = readerCache.get(reader)
  if (!entry) {
    entry = { stimuli: new Map(), maps: new Map() }
    readerCache.set(reader, entry)
  }
  return entry
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
  const lo = (a: Float64Array) => percentileSorted(a, L.robustQuantile)
  const hi = (a: Float64Array) => percentileSorted(a, 1 - L.robustQuantile)
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
  if (side > 0) return side * L.autoRadiusShare
  if (media) {
    const region = mediaRegionOf(media)
    return Math.max(region.width, region.height) * L.autoRadiusShare
  }
  return 1
}

/** The resolved auto radius for a stimulus, for the pane label; null without spatial data. */
export function autoRadiusFor(engine: DataEngine, stimulusId: number): number | null {
  const reader = engine.getReader()
  if (!reader?.hasSpatialData) return null
  return autoRadius(reader, engine.metadata?.stimuliMedia?.[stimulusId] ?? null)
}

/** Without media: the fixations' bbox, clamped so far outliers cannot shrink the map to a stamp. */
function viewDomain({ bbox, robust }: PointExtent): Rect {
  const mx = robust.width * L.outlierMargin
  const my = robust.height * L.outlierMargin
  const x0 = Math.max(bbox.x, robust.x - mx)
  const y0 = Math.max(bbox.y, robust.y - my)
  const x1 = Math.min(bbox.x + bbox.width, robust.x + robust.width + mx)
  const y1 = Math.min(bbox.y + bbox.height, robust.y + robust.height + my)
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

const inside = (r: Rect, x: number, y: number) =>
  x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height

const unavailable = (reason: FixationHeatmapUnavailableReason): FixationHeatmapTransformResult => ({
  kind: 'unavailable',
  reason,
})

/**
 * The selection's fixation map on one stimulus. A fixation adds its duration
 * clipped to the time range, or 1 when its midpoint is in range: the metric
 * library's dwell and count conventions, so the map's mass reconciles with
 * them. Weights are normalised per participant (share, %) or averaged over
 * the N participants with a located fixation in range (mean).
 */
export function getFixationHeatmapData(
  engine: DataEngine,
  settings: FixationHeatmapPlotSettings
): FixationHeatmapTransformResult {
  const reader = engine.getReader()
  const spatial = reader?.hasSpatialData ? reader.getBuffers().spatialBuffer : undefined
  if (!reader || !spatial) return unavailable('no-spatial-data')

  const { stimulusId } = settings
  const media = engine.metadata?.stimuliMedia?.[stimulusId] ?? null
  const radiusIsAuto = !(settings.radius > 0)
  const radius = radiusIsAuto ? autoRadius(reader, media) : settings.radius
  const ids = getParticipantsIds(engine, settings.groupId, stimulusId)
  const names = ids.map(id => getParticipant(engine, id).displayedName)

  // Everything the map depends on; view-only settings (colours, opacity, scale) are not in it.
  const region = media ? mediaRegionOf(media) : null
  const key = JSON.stringify([
    stimulusId,
    settings.accumulate,
    settings.normalization,
    radius,
    radiusIsAuto,
    settings.timelineStart ?? 0,
    settings.timelineEnd ?? 0,
    ids,
    names,
    region && [region.x, region.y, region.width, region.height],
  ])
  const maps = cacheOf(reader).maps
  const cached = maps.get(key)
  if (cached) {
    maps.delete(key)
    maps.set(key, cached)
    return cached
  }
  const result = computeHeatmap(reader, spatial, settings, media, radius, radiusIsAuto, ids, names)
  maps.set(key, result)
  if (maps.size > MAP_CACHE_SIZE) maps.delete(maps.keys().next().value!)
  return result
}

function computeHeatmap(
  reader: BinaryBufferReader,
  spatial: Float32Array,
  settings: FixationHeatmapPlotSettings,
  media: StimulusMedia | null,
  radius: number,
  radiusIsAuto: boolean,
  ids: number[],
  names: string[]
): FixationHeatmapTransformResult {
  const { stimulusId } = settings
  let capacity = 0
  let recorded = 0
  for (const id of ids) {
    const { startIndex, endIndex } = reader.getFixationRange(stimulusId, id)
    capacity += endIndex - startIndex
    if (reader.getSegmentCount(stimulusId, id) > 0) recorded++
  }
  if (capacity === 0) return unavailable('no-fixations')

  const xs = new Float32Array(capacity)
  const ys = new Float32Array(capacity)
  const raw = new Float32Array(capacity)
  const owner = new Uint32Array(capacity)
  const totals = new Float64Array(ids.length)
  const byDuration = settings.accumulate === 'duration'
  const timeStart = settings.timelineStart ?? 0
  const timeEnd = settings.timelineEnd ?? 0
  const frame: WindowFrame = { windowStart: 0, windowEnd: 0, start: 0, end: 0, duration: 0 }
  const segBuf = reader.segmentBufferRaw
  const fixIdx = reader.fixationIndexRaw
  let count = 0
  let inRange = 0
  let withoutCoordinates = 0

  for (let p = 0; p < ids.length; p++) {
    const { startIndex, endIndex } = reader.getFixationRange(stimulusId, ids[p])
    for (let k = startIndex; k < endIndex; k++) {
      const i = fixIdx[k]
      const base = i * SEGMENT_STRIDE
      const start = segBuf[base + SegmentField.START_TIME]
      const end = segBuf[base + SegmentField.END_TIME]
      // KEEP IN SYNC with metrics/core/scanner.ts: its two skip lines + fillWindowFrame.
      if (timeEnd > 0 && start >= timeEnd) break
      if (end <= timeStart) continue
      const midInScope = fillWindowFrame(frame, start, end, timeStart, timeEnd)
      const w = byDuration ? frame.duration : midInScope ? 1 : 0
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
      raw[count] = w
      owner[count] = p
      totals[p] += w
      count++
    }
  }
  if (inRange === 0) return unavailable('none-in-range')
  if (count === 0) return unavailable('no-coordinates')

  // N: the participants with a located fixation in range; the rest are skipped, never divided by.
  const participants: HeatmapParticipant[] = []
  const indexOf = new Int32Array(ids.length).fill(-1)
  for (let p = 0; p < ids.length; p++) {
    if (!(totals[p] > 0)) continue
    indexOf[p] = participants.length
    participants.push({ id: ids[p], name: names[p], total: totals[p] })
  }
  const n = participants.length
  const share = settings.normalization === 'share'
  const weights = new Float32Array(count)
  const participantIndex = new Uint32Array(count)
  for (let k = 0; k < count; k++) {
    const p = owner[k]
    participantIndex[k] = indexOf[p]
    weights[k] = share ? (100 * raw[k]) / totals[p] / n : raw[k] / n
  }

  // A located fixation exists (count > 0), so without media the stimulus extent does too.
  const extent = media ? mediaRegionOf(media) : viewDomain(stimulusExtent(reader, stimulusId)!)
  // What is drawn: heat is clipped to the media; without media the view keeps the kernel margin.
  const drawn = media
    ? extent
    : { x: extent.x - radius, y: extent.y - radius, width: extent.width + 2 * radius, height: extent.height + 2 * radius }
  let outside = 0
  for (let k = 0; k < count; k++) if (!inside(drawn, xs[k], ys[k])) outside++
  if (media && outside === count) return unavailable('none-on-media')

  const grid = gridFor(extent, radius)
  const values = new Float32Array(grid.cols * grid.rows)
  splatFixations(xs, ys, weights, count, grid, values)
  blurGaussian(values, grid, kernelTaps(radius, grid.cell), new Float32Array(values.length))

  // The peak over what is shown: heat is clipped to the media rect.
  let max = 0
  for (let j = 0; j < grid.rows; j++) {
    const cy = grid.y0 + (j + 0.5) * grid.cell
    for (let i = 0; i < grid.cols; i++) {
      const v = values[j * grid.cols + i]
      if (v <= max) continue
      if (media && !inside(extent, grid.x0 + (i + 0.5) * grid.cell, cy)) continue
      max = v
    }
  }

  return {
    kind: 'ok',
    data: {
      grid,
      values,
      max,
      radius,
      radiusIsAuto,
      coarse: isCoarseGrid(grid, radius),
      extent,
      clip: media ? extent : null,
      xs: xs.subarray(0, count),
      ys: ys.subarray(0, count),
      raw: raw.subarray(0, count),
      participantIndex,
      participants,
      summary: {
        fixations: count,
        withoutCoordinates,
        outside,
        // Among those recorded on this stimulus: under All, people who never saw it are no warning.
        participantsWithout: recorded - n,
        selected: recorded,
      },
    },
  }
}
