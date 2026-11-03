import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getParticipant, getParticipantsIds } from '$lib/data/engine'
import type { BinaryBufferReader } from '$lib/data/binary'
import { mediaRegionOf } from '$lib/data/media/stimulusMedia'
import type { Rect } from '$lib/data/media/mediaAlignment'
import type { StimulusMedia } from '$lib/data/types'
import { memoByRef } from '$lib/plots/shared/kit'
import {
  autoRadius,
  blurGaussian,
  densityExtent,
  gridFor,
  isCoarseGrid,
  kernelTaps,
  scopedFixations,
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
 * The selection's fixation map on one stimulus, weighted as `scopedFixations`
 * documents. Weights are normalised per participant (share, %) or averaged
 * over the N participants with a located fixation in range (mean).
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
  const recorded = ids.filter(id => reader.getSegmentCount(stimulusId, id) > 0).length
  const { xs, ys, weights: raw, starts, ends, owner, total, inRange, withoutCoordinates } = scopedFixations(
    reader,
    spatial,
    stimulusId,
    ids,
    settings.timelineStart ?? 0,
    settings.timelineEnd ?? 0,
    settings.accumulate
  )
  const count = xs.length
  if (total === 0) return unavailable('no-fixations')
  if (inRange === 0) return unavailable('none-in-range')
  if (count === 0) return unavailable('no-coordinates')
  const totals = new Float64Array(ids.length)
  let lastEnd = 0
  for (let k = 0; k < count; k++) {
    totals[owner[k]] += raw[k]
    if (ends[k] > lastEnd) lastEnd = ends[k]
  }

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
      xs,
      ys,
      raw,
      starts,
      ends,
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
