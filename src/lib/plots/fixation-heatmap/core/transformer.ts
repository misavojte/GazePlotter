import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getParticipant, getParticipantsIds } from '$lib/data/engine'
import {
  SEGMENT_STRIDE,
  SegmentField,
  type BinaryBufferReader,
} from '$lib/data/binary'
import { mediaRegionOf } from '$lib/data/media/stimulusMedia'
import type { Rect } from '$lib/data/media/mediaAlignment'
import type { StimulusMedia } from '$lib/data/types'
import { fillWindowFrame, type WindowFrame } from '$lib/metrics/core/dsl'
import { memoByRef } from '$lib/plots/shared/kit'
import {
  autoRadius,
  blurGaussian,
  densityExtent,
  gridFor,
  isCoarseGrid,
  kernelTaps,
  splatFixations,
} from '$lib/metrics/core/fixationDensity'
import type {
  FixationHeatmapPlotSettings,
  FixationHeatmapTransformResult,
  FixationHeatmapUnavailableReason,
  HeatmapParticipant,
} from '../types'

/** Recent maps per reader by their compute key, so colour, opacity and scale edits never recompute. */
const mapsOf = memoByRef((_reader: BinaryBufferReader) => new Map<string, FixationHeatmapTransformResult>())

/** Recent maps kept per reader: enough for a workspace of side-by-side heatmaps. */
const MAP_CACHE_SIZE = 16

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
  const radius = settings.radius > 0 ? settings.radius : autoRadius(reader, media)
  const ids = getParticipantsIds(engine, settings, stimulusId)
  const names = ids.map(id => getParticipant(engine, id).displayedName)

  // Everything the map depends on; view-only settings (colours, opacity, scale) are not in it.
  const region = media ? mediaRegionOf(media) : null
  const key = JSON.stringify([
    stimulusId,
    settings.accumulate,
    settings.normalization,
    radius,
    settings.timelineStart ?? 0,
    settings.timelineEnd ?? 0,
    ids,
    names,
    region && [region.x, region.y, region.width, region.height],
  ])
  const maps = mapsOf(reader)
  const cached = maps.get(key)
  if (cached) {
    maps.delete(key)
    maps.set(key, cached)
    return cached
  }
  const result = computeHeatmap(reader, spatial, settings, media, radius, ids, names)
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
  const starts = new Float64Array(capacity)
  const ends = new Float64Array(capacity)
  const owner = new Uint32Array(capacity)
  const totals = new Float64Array(ids.length)
  let lastEnd = 0
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
      starts[count] = start
      ends[count] = end
      owner[count] = p
      totals[p] += w
      if (end > lastEnd) lastEnd = end
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
  const extent = densityExtent(reader, stimulusId, media)!
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
      coarse: isCoarseGrid(grid, radius),
      extent,
      clip: media ? extent : null,
      xs: xs.subarray(0, count),
      ys: ys.subarray(0, count),
      raw: raw.subarray(0, count),
      starts: starts.subarray(0, count),
      ends: ends.subarray(0, count),
      lastEnd,
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
