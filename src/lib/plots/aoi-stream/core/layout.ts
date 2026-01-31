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
    heatmapColors: string[]
  }>
  totals: Float32Array
  cumulative: Float32Array
  seriesPaint: StreamPaintInfo[]
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
  const needsRealloc =
    !renderBuckets ||
    renderBuckets.binCount !== binCount ||
    renderBuckets.seriesBuckets.length !== seriesCount

  if (needsRealloc) {
    const seriesBuckets = new Array(seriesCount)
    const seriesPaint = new Array(seriesCount)
    for (let i = 0; i < seriesCount; i++) {
      seriesBuckets[i] = {
        topY: new Float32Array(binCount),
        bottomY: new Float32Array(binCount),
        heatmapColors: new Array(binCount),
      }
      seriesPaint[i] = { color: '', isDimmed: false, id: -1 }
    }

    return {
      xPositions: new Float32Array(binCount),
      seriesBuckets,
      totals: new Float32Array(binCount),
      cumulative: new Float32Array(binCount),
      seriesPaint,
      binCount,
    }
  }

  // Clear transient buffers
  renderBuckets.totals.fill(0)
  renderBuckets.cumulative.fill(0)
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

export interface StreamPaintInfo {
  color: string
  isDimmed: boolean
  id: number
  stripBottom?: number
  stripHeight?: number
  heatmapBinColors?: string[]
}

export interface StreamCoordsResult {
  buckets: RenderBuckets
  yAxisMin: number
  yAxisMax: number
  axisHalfRange: number
  axisTicks: number[]
  seriesPaint: StreamPaintInfo[]
}

/**
 * Transforms raw stream data into screen coordinates and paint information.
 * Adheres to zero-allocation hot path principles.
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

  const { series, binCount: dataBinCount, participants, maxTotal } = data
  const renderBinCount = dataBinCount + 2
  const percentFactor = participants > 0 ? 100 / participants : 0
  const maxTotalPercent = Math.max(1, maxTotal) * percentFactor

  const buckets = ensureRenderBuckets(
    existingBuckets,
    renderBinCount,
    series.length
  )
  const { xPositions, seriesBuckets, totals, cumulative, seriesPaint } = buckets

  // 1. Static Geometry Calculation
  const invBinCount = 1 / dataBinCount
  for (let i = 0; i < renderBinCount; i++) {
    if (i === 0) xPositions[i] = floorLeft
    else if (i === renderBinCount - 1) xPositions[i] = floorLeft + floorWidth
    else xPositions[i] = floorLeft + (i - 0.5) * invBinCount * floorWidth
  }

  // 2. Axis and Scaling Configuration
  let axisHalfRange = 50
  let axisTicks: number[] = [0]
  let yAxisMin = 0
  let yAxisMax = 100

  if (alignment === 'center' || alignment === 'bottom') {
    // Populate totals for stacking
    for (let s = 0; s < series.length; s++) {
      const vals = series[s].values
      for (let i = 0; i < dataBinCount; i++) {
        totals[i + 1] += vals[i] * percentFactor
      }
    }

    if (alignment === 'center') {
      const computed = computeNiceYAxis(maxTotalPercent / 2)
      axisHalfRange = computed.axisHalfRange
      axisTicks = computed.ticks
      yAxisMin = -axisHalfRange
      yAxisMax = axisHalfRange
      for (let i = 0; i < renderBinCount; i++) cumulative[i] = -totals[i] * 0.5
    } else {
      const padded = Math.max(1, maxTotalPercent)
      const step = niceStep(padded / (Y_AXIS.TARGET_POSITIVE_TICKS * 2))
      const axisMax = Math.max(1, Math.ceil(padded / step) * step)
      axisTicks = [0]
      for (let v = step; v <= axisMax + step * 0.001; v += step)
        axisTicks.push(v)
      yAxisMax = axisMax
    }
  } else if (alignment === 'ridgeline') {
    axisTicks = [0, 100]
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

  // 3. Main Series Pass: Coordinates and Paint
  const isRidgeline = alignment === 'ridgeline'
  const isHeatmap = alignment === 'heatmap'
  const scale = ridgelineScale ?? RIDGELINE_SCALE
  const overlap = 1 - 1 / scale

  // Pre-calculate strip heights for modes that need them
  let stripHeight = 0
  let overlapOffset = 0
  let totalGroupHeight = 0
  if (isHeatmap) {
    stripHeight = floorHeight / Math.max(1, series.length)
    overlapOffset = stripHeight
    totalGroupHeight = floorHeight
  } else if (isRidgeline) {
    stripHeight =
      stripHeightOverride ??
      calculateIdealStripHeight(data, floorHeight, true, scale)
    overlapOffset = stripHeight * (1 - overlap)
    totalGroupHeight = (series.length - 1) * overlapOffset + stripHeight
  }

  const groupTop = floorBottom - totalGroupHeight
  const palette = colorScale || PRESET_PALETTES.HEAT.colors
  const paletteStopCount = palette.length - 1

  for (let s = 0; s < series.length; s++) {
    const source = series[s]
    const bucket = seriesBuckets[s]
    const isHighlighted = highlightMaskById?.get(source.id) ?? false
    const isDimmed = !!highlightMaskById && !isHighlighted
    const color = isDimmed
      ? desaturateToWhite(source.color, 0.85)
      : source.color

    const info = seriesPaint[s]
    info.color = color
    info.isDimmed = isDimmed
    info.id = source.id
    info.stripBottom = undefined
    info.stripHeight = undefined
    info.heatmapBinColors = undefined

    if (isHeatmap || isRidgeline) {
      const sTop = groupTop + s * overlapOffset
      const sBottom = sTop + stripHeight
      info.stripBottom = sBottom
      info.stripHeight = stripHeight

      if (isHeatmap) {
        info.heatmapBinColors = bucket.heatmapColors
        for (let i = 0; i < renderBinCount; i++) {
          if (i === 0 || i === renderBinCount - 1) {
            bucket.heatmapColors[i] = 'transparent'
            bucket.topY[i] = sBottom
          } else {
            const val = Math.max(
              0,
              Math.min(100, source.values[i - 1] * percentFactor)
            )
            if (val <= 0) {
              bucket.heatmapColors[i] = INACTIVE_COLOR
            } else {
              const scaledVal = (val / 100) * paletteStopCount
              const baseIdx = Math.floor(scaledVal)
              const nextIdx = Math.min(palette.length - 1, baseIdx + 1)
              bucket.heatmapColors[i] = interpolateColor(
                palette[baseIdx],
                palette[nextIdx],
                scaledVal - baseIdx
              )
            }
            bucket.topY[i] = sTop
          }
          bucket.bottomY[i] = sBottom
        }
      } else {
        const localScaleY = (stripHeight * 0.9) / 100
        for (let i = 0; i < renderBinCount; i++) {
          const val =
            i === 0 || i === renderBinCount - 1
              ? 0
              : source.values[i - 1] * percentFactor
          bucket.bottomY[i] = sBottom
          bucket.topY[i] = sBottom - val * localScaleY
        }
      }
    } else {
      // Stacked
      for (let i = 0; i < renderBinCount; i++) {
        const startVal = cumulative[i]
        const val =
          i === 0 || i === renderBinCount - 1
            ? 0
            : source.values[i - 1] * percentFactor
        const endVal = startVal + val
        cumulative[i] = endVal
        bucket.topY[i] = yBase - endVal * scaleY
        bucket.bottomY[i] = yBase - startVal * scaleY
      }
    }
    seriesPaint[s] = info
  }

  return {
    buckets,
    yAxisMin,
    yAxisMax,
    axisHalfRange,
    axisTicks,
    seriesPaint,
  }
}
