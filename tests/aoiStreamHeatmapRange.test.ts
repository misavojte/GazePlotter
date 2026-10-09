import { describe, it, expect } from 'vitest'
import {
  resolveHeatRange,
  transformStreamDataToCoordinates,
  type StreamCoordsParams,
} from '../src/lib/plots/aoi-stream/core/layout'
import type { AoiStreamPlotResult } from '../src/lib/plots/aoi-stream/types'
import { samplePalette } from '../src/lib/color/interpolation'

const PALETTE = ['#000000', '#808080', '#ffffff']
const BELOW = '#111111'
const ABOVE = '#eeeeee'

/** A result carrying only what the coordinate transform reads. */
function streamResult(values: number[][]): AoiStreamPlotResult {
  let maxValue = 0
  for (const row of values) for (const v of row) if (v > maxValue) maxValue = v
  return {
    series: values.map((row, i) => ({
      id: i,
      label: `AOI ${i}`,
      color: '#ff0000',
      values: Float32Array.from(row),
    })),
    binCount: values[0].length,
    windowSize: 100,
    stepSize: 100,
    maxValue,
    maxTotal: maxValue,
  } as unknown as AoiStreamPlotResult
}

function transform(
  values: number[][],
  colorValueRange: [number, number],
  alignment: StreamCoordsParams['alignment'] = 'heatmap'
) {
  return transformStreamDataToCoordinates(
    {
      data: streamResult(values),
      alignment,
      floorLeft: 0,
      floorTop: 0,
      floorWidth: 100,
      floorHeight: 100,
      floorBottom: 100,
      syncedMTopOverride: null,
      highlightMaskById: null,
      colorScale: PALETTE,
      colorValueRange,
      belowMinColor: BELOW,
      aboveMaxColor: ABOVE,
    },
    null
  )
}

/** Heatmap bin colors of series `s`, without the two transparent edge sentinels. */
function binColors(values: number[][], range: [number, number], s = 0): string[] {
  return transform(values, range).buckets.seriesBuckets[s].heatmapColors.slice(1, -1)
}

describe('resolveHeatRange', () => {
  it('auto max is the data max, an explicit max wins, empty data falls back to 1', () => {
    expect(resolveHeatRange([0, 0], 7)).toEqual([0, 7])
    expect(resolveHeatRange([1, 5], 7)).toEqual([1, 5])
    expect(resolveHeatRange([0, 0], 0)).toEqual([0, 1])
  })
})

describe('AOI Timeline heatmap out-of-bounds fills', () => {
  it('a zero bin stays transparent even under an explicit floor', () => {
    expect(binColors([[0, 1, 3]], [2, 0])[0]).toBe('transparent')
  })

  it('a positive bin under the floor takes the below-min fill', () => {
    expect(binColors([[0, 1, 3]], [2, 0])[1]).toBe(BELOW)
  })

  it('normalises the gradient from the floor, not from zero', () => {
    const colors = binColors([[2, 4, 6]], [2, 6])
    expect(colors).toEqual([
      samplePalette(PALETTE, 0),
      samplePalette(PALETTE, 0.5),
      samplePalette(PALETTE, 1),
    ])
  })

  it('paints above-max only under an explicit max', () => {
    expect(binColors([[8, 2]], [0, 5])).toEqual([ABOVE, samplePalette(PALETTE, 0.4)])
    // Auto: the range max IS the data max, so nothing can exceed it.
    expect(binColors([[8, 2]], [0, 0])).toEqual([
      samplePalette(PALETTE, 1),
      samplePalette(PALETTE, 0.25),
    ])
  })

  it('the ridgeline scale ignores the heatmap range', () => {
    const auto = transform([[1, 4, 2]], [0, 0], 'ridgeline').buckets.seriesBuckets[0].topY
    const explicit = transform([[1, 4, 2]], [0, 100], 'ridgeline').buckets.seriesBuckets[0].topY
    expect(Array.from(explicit)).toEqual(Array.from(auto))
  })
})
