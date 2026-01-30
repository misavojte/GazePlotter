import type { AoiStreamPlotResult, AoiStreamPlotSeries } from '../types'
import { RIDGELINE_SCALE, Y_AXIS } from '../const'
import { calculateIdealStripHeight } from './ridgeline'
import { desaturateToWhite, interpolateColor } from '$lib/color/utility'
import { PRESET_PALETTES, INACTIVE_COLOR } from '$lib/color/palettes'
import { computeNiceYAxis, niceStep } from './axis'

export interface RenderBuckets {
  xPositions: Float32Array
  seriesBuckets: Array<{
    topY: Float32Array
    bottomY: Float32Array
  }>
  binCount: number
}

/**
 * Initialize or reallocate render buckets when binCount or seriesCount changes.
 */
export function ensureRenderBuckets(
  renderBuckets: RenderBuckets | null,
  binCount: number,
  seriesCount: number
): RenderBuckets {
  if (
    !renderBuckets ||
    renderBuckets.binCount !== binCount ||
    renderBuckets.seriesBuckets.length !== seriesCount
  ) {
    const xPositions = new Float32Array(binCount)
    const seriesBuckets = new Array(seriesCount)

    for (let i = 0; i < seriesCount; i++) {
      seriesBuckets[i] = {
        topY: new Float32Array(binCount),
        bottomY: new Float32Array(binCount),
      }
    }

    return { xPositions, seriesBuckets, binCount }
  }
  return renderBuckets
}

export interface StreamCoordsParams {
  data: AoiStreamPlotResult
  alignment: 'center' | 'bottom' | 'ridgeline' | 'heatmap'
  floorLeft: number
  floorTop: number
  floorWidth: number
  floorHeight: number
  floorBottom: number
  stripHeightOverride: number | null
  highlightMaskById: Map<number, boolean> | null
  ridgelineScale?: number
  colorScale?: string[]
}

export interface StreamCoordsResult {
  buckets: RenderBuckets
  yAxisMin: number
  yAxisMax: number
  axisHalfRange: number
  axisTicks: number[]
  seriesPaint: Array<{
    color: string
    isDimmed: boolean
    id: number
    stripBottom?: number
    stripHeight?: number
    heatmapBinColors?: string[]
  }>
}

/**
 * Transforms raw stream data into screen coordinates and paint information.
 * This is a pure logic function extracted from the UI component.
 */
export function transformStreamDataToCoordinates(
  params: StreamCoordsParams,
  existingBuckets: RenderBuckets | null
): StreamCoordsResult {
  const {
    data,
    alignment,
    floorLeft,
    floorTop,
    floorWidth,
    floorHeight,
    floorBottom,
    stripHeightOverride,
    highlightMaskById,
    ridgelineScale,
    colorScale,
  } = params

  const scale = ridgelineScale ?? RIDGELINE_SCALE
  // Derive overlap from scale:
  // scale = h / S  => S = h / scale
  // overlap = 1 - S/h = 1 - (h/scale)/h = 1 - 1/scale
  // If scale=1 => overlap=0. If scale=2 => overlap=0.5.
  const overlap = 1 - 1 / scale

  const series = data.series
  const dataBinCount = data.binCount
  const renderBinCount = dataBinCount + 2
  const percentFactor = data.participants > 0 ? 100 / data.participants : 0
  const maxTotalPercent = Math.max(1, data.maxTotal) * percentFactor

  const buckets = ensureRenderBuckets(
    existingBuckets,
    renderBinCount,
    series.length
  )
  const { xPositions, seriesBuckets } = buckets

  // Pre-compute X positions
  const invBinCount = 1 / dataBinCount
  for (let i = 0; i < renderBinCount; i++) {
    if (i === 0) {
      xPositions[i] = floorLeft
    } else if (i === renderBinCount - 1) {
      xPositions[i] = floorLeft + floorWidth
    } else {
      xPositions[i] = floorLeft + (i - 1 + 0.5) * invBinCount * floorWidth
    }
  }

  let axisHalfRange = 50
  let axisTicks = [0]
  let yAxisMin = 0
  let yAxisMax = 100

  const cumulative = new Float32Array(renderBinCount)
  const totals = new Float32Array(renderBinCount)
  let stripHeight = 0

  if (alignment === 'center' || alignment === 'bottom') {
    for (let s = 0; s < series.length; s++) {
      const values = series[s].values
      for (let i = 0; i < dataBinCount; i++) {
        totals[i + 1] += values[i] * percentFactor
      }
    }
    totals[0] = 0
    totals[renderBinCount - 1] = 0

    if (alignment === 'center') {
      const computed = computeNiceYAxis(maxTotalPercent / 2)
      axisHalfRange = computed.axisHalfRange
      axisTicks = computed.ticks
      yAxisMin = -axisHalfRange
      yAxisMax = axisHalfRange
      for (let i = 0; i < renderBinCount; i++) {
        cumulative[i] = -totals[i] * 0.5
      }
    } else {
      const padded = Math.max(1, maxTotalPercent)
      // Use double the target ticks for bottom alignment since it is a single-sided axis
      const rawStep = padded / Math.max(1, Y_AXIS.TARGET_POSITIVE_TICKS * 2)
      const step = niceStep(rawStep)
      const axisMax = Math.max(1, Math.ceil(padded / step) * step)
      axisTicks = [0]
      for (let v = step; v <= axisMax + step * 0.001; v += step) {
        axisTicks.push(v)
      }
      yAxisMin = 0
      yAxisMax = axisMax
    }
  } else if (alignment === 'ridgeline') {
    axisTicks = [0, 100]
    yAxisMin = 0
    yAxisMax = 100
    stripHeight =
      stripHeightOverride !== null &&
      Number.isFinite(stripHeightOverride) &&
      stripHeightOverride > 0
        ? stripHeightOverride
        : calculateIdealStripHeight(data, floorHeight, true, scale)
  }

  let scaleY = 1
  let yBase = 0

  if (alignment === 'center') {
    scaleY = floorHeight / 2 / axisHalfRange
    yBase = floorTop + floorHeight / 2
  } else if (alignment === 'bottom') {
    scaleY = floorHeight / yAxisMax
    yBase = floorBottom
  }

  const seriesPaint = series.map((s: AoiStreamPlotSeries, idx: number) => {
    const isHighlighted = highlightMaskById?.get(s.id) ?? false
    const isDimmed = !!highlightMaskById && !isHighlighted
    const color = isDimmed ? desaturateToWhite(s.color, 0.85) : s.color

    const bucket = seriesBuckets[idx]
    const values = s.values

    if (alignment === 'ridgeline' || alignment === 'heatmap') {
      const isHeatmap = alignment === 'heatmap'

      let stripHeight: number
      let overlapOffset: number
      let totalGroupHeight: number

      if (isHeatmap) {
        stripHeight = floorHeight / Math.max(1, series.length)
        overlapOffset = stripHeight
        totalGroupHeight = floorHeight
      } else {
        const baseStripHeight =
          stripHeightOverride !== null &&
          Number.isFinite(stripHeightOverride) &&
          stripHeightOverride > 0
            ? stripHeightOverride
            : calculateIdealStripHeight(data, floorHeight, true, scale)

        stripHeight = baseStripHeight
        overlapOffset = stripHeight * (1 - overlap)
        totalGroupHeight = (series.length - 1) * overlapOffset + stripHeight
      }

      const groupTop = floorBottom - totalGroupHeight
      const stripTop = groupTop + idx * overlapOffset
      const stripBottom = stripTop + stripHeight
      if (isHeatmap) {
        const heatmapBinColors = new Array(renderBinCount)
        const scale = colorScale || PRESET_PALETTES.HEAT.colors

        for (let i = 0; i < renderBinCount; i++) {
          if (i === 0 || i === renderBinCount - 1) {
            heatmapBinColors[i] = 'transparent'
            bucket.topY[i] = stripBottom
          } else {
            const dataIndex = i - 1
            const val = Math.max(
              0,
              Math.min(100, values[dataIndex] * percentFactor)
            )

            if (val <= 0) {
              heatmapBinColors[i] = INACTIVE_COLOR
            } else {
              // Continuous multi-stop interpolation using provided scale
              const stopCount = scale.length - 1
              const scaledVal = (val / 100) * stopCount
              const baseIndex = Math.floor(scaledVal)
              const nextIndex = Math.min(scale.length - 1, baseIndex + 1)
              const factor = scaledVal - baseIndex

              heatmapBinColors[i] = interpolateColor(
                scale[baseIndex],
                scale[nextIndex],
                factor
              )
            }
            bucket.topY[i] = stripTop
          }
          bucket.bottomY[i] = stripBottom
        }

        return {
          color,
          isDimmed,
          id: s.id,
          stripBottom,
          stripHeight,
          heatmapBinColors,
        }
      } else {
        // Ridgeline/Standard strip rendering
        const localScaleY = (stripHeight * 0.9) / 100
        for (let i = 0; i < renderBinCount; i++) {
          const dataIndex = Math.max(0, Math.min(dataBinCount - 1, i - 1))
          let val =
            i === 0 || i === renderBinCount - 1
              ? 0
              : values[dataIndex] * percentFactor
          bucket.bottomY[i] = stripBottom
          bucket.topY[i] = stripBottom - val * localScaleY
        }

        return { color, isDimmed, id: s.id, stripBottom, stripHeight }
      }
    } else {
      // Stacked (Center/Bottom) rendering
      for (let i = 0; i < renderBinCount; i++) {
        const startVal = cumulative[i]
        const dataIndex = Math.max(0, Math.min(dataBinCount - 1, i - 1))
        let val =
          i === 0 || i === renderBinCount - 1
            ? 0
            : values[dataIndex] * percentFactor
        const endVal = startVal + val
        cumulative[i] = endVal
        bucket.topY[i] = yBase - endVal * scaleY
        bucket.bottomY[i] = yBase - startVal * scaleY
      }
      return { color, isDimmed, id: s.id }
    }
  })

  return {
    buckets,
    yAxisMin,
    yAxisMax,
    axisHalfRange,
    axisTicks,
    seriesPaint,
  }
}
