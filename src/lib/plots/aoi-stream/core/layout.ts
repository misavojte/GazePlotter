import type { AoiStreamPlotResult } from '../types'
import {
  RIDGELINE_CONTENT_FILL,
  RIDGELINE_SCALE,
  STREAM_SYMMETRY_FACTOR,
  Y_AXIS,
} from '../const'
import { calculateIdealStripHeight } from './ridgeline'
import { desaturateToWhite, interpolateColor } from '$lib/color'
import { PRESET_PALETTES } from '$lib/color/palettes'
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
function ensureRenderBuckets(
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
  alignment: 'stream' | 'distribution' | 'ridgeline' | 'heatmap'
  floorLeft: number
  floorTop: number
  floorWidth: number
  floorHeight: number
  floorBottom: number
  syncedMTopOverride: number | null
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
  referenceHeight?: number
  heatmapBinColors?: string[]
}

export interface StreamCoordsResult {
  buckets: RenderBuckets
  yAxisMin: number
  yAxisMax: number
  axisHalfRange: number
  axisTicks: number[]
  seriesPaint: StreamPaintInfo[]
  seriesRanks: Int32Array | null
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
    syncedMTopOverride,
    highlightMaskById,
    ridgelineScale,
    colorScale,
  } = params

  const {
    series,
    binCount: dataBinCount,
    maxTotal,
    maxValue,
    windowSize,
    stepSize,
  } = data
  const renderBinCount = dataBinCount + 2
  // Values arrive in the metric's native unit (ms / count / %). The y-axis
  // range is driven directly by the data; no per-participant percent
  // conversion happens here. `maxTotal` is the largest stacked sum across
  // bins (drives stream/distribution); `maxValue` is the largest single-cell
  // value (drives the heatmap gradient).
  const maxTotalForAxis = Math.max(1, maxTotal)
  const maxCellForHeat = Math.max(maxValue, Number.EPSILON)
  // Each data bin represents a window of length `windowSize`, offset from
  // the previous window by `stepSize`. Total time covered by all windows is
  // (binCount - 1) × step + window — equals `binCount × window` when
  // windows tile (step === window) and is shorter otherwise. Bin centres
  // land at `binIdx × step + window / 2` along that range.
  const plotRange = Math.max(1, (dataBinCount - 1) * stepSize + windowSize)

  const buckets = ensureRenderBuckets(
    existingBuckets,
    renderBinCount,
    series.length
  )
  const { xPositions, seriesBuckets, totals, cumulative, seriesPaint } = buckets

  // 1. Static Geometry Calculation
  // Bin centre formula: for the i-th data bin, its window centre lands at
  // `i × stepSize + windowSize / 2` ms (relative to plot start), which
  // maps to `(i × step + window / 2) / plotRange` of the plot width. For
  // non-overlapping windows (step === window) this collapses to the older
  // even-spacing `(i + 0.5) / dataBinCount` exactly. For sliding windows
  // it shifts bin centres inward (the first bin centre lands at
  // `windowSize / 2` ms, not at the plot edge).
  for (let i = 0; i < renderBinCount; i++) {
    if (i === 0) xPositions[i] = floorLeft
    else if (i === renderBinCount - 1) xPositions[i] = floorLeft + floorWidth
    else {
      const dataIdx = i - 1
      const centreMs = dataIdx * stepSize + windowSize / 2
      xPositions[i] = floorLeft + (centreMs / plotRange) * floorWidth
    }
  }

  // 2. Axis and Scaling Configuration
  let axisHalfRange = 50
  let axisTicks: number[] = [0]
  let yAxisMin = 0
  let yAxisMax = 100

  if (alignment === 'stream' || alignment === 'distribution') {
    // Populate totals for stacking (raw values, no scaling)
    for (let s = 0; s < series.length; s++) {
      const vals = series[s].values
      for (let i = 0; i < dataBinCount; i++) {
        totals[i + 1] += vals[i]
      }
    }

    if (alignment === 'stream') {
      const computed = computeNiceYAxis(maxTotalForAxis / 2)
      axisHalfRange = computed.axisHalfRange
      axisTicks = computed.ticks
      yAxisMin = -axisHalfRange
      yAxisMax = axisHalfRange
      for (let i = 0; i < renderBinCount; i++) cumulative[i] = -totals[i] * STREAM_SYMMETRY_FACTOR
    } else {
      const step = niceStep(maxTotalForAxis / (Y_AXIS.TARGET_POSITIVE_TICKS * 2))
      const axisMax = Math.max(step, Math.ceil(maxTotalForAxis / step) * step)
      axisTicks = [0]
      for (let v = step; v <= axisMax + step * 0.001; v += step)
        axisTicks.push(v)
      yAxisMax = axisMax
    }
  } else if (alignment === 'ridgeline') {
    axisTicks = [0, maxCellForHeat]
  }

  let scaleY = 1
  let yBase = 0
  if (alignment === 'stream') {
    scaleY = floorHeight / 2 / axisHalfRange
    yBase = floorTop + floorHeight / 2
  } else if (alignment === 'distribution') {
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
  let ridgelineReferenceHeight = 0
  if (isHeatmap) {
    stripHeight = floorHeight / Math.max(1, series.length)
    overlapOffset = stripHeight
    totalGroupHeight = floorHeight
  } else if (isRidgeline) {
    // Strip layout always uses actual floorHeight — fills available space, no whitespace.
    // When synced, mTopOverride ensures consistent data scale across comparable plots.
    stripHeight = calculateIdealStripHeight(
      data,
      floorHeight,
      true,
      scale,
      syncedMTopOverride ?? undefined
    )
    ridgelineReferenceHeight = stripHeight
    overlapOffset = stripHeight * (1 - overlap)
    totalGroupHeight = (series.length - 1) * overlapOffset + stripHeight
  }

  const groupTop = floorBottom - totalGroupHeight
  const palette = colorScale || PRESET_PALETTES.HEAT.colors
  const paletteStopCount = palette.length - 1

  let seriesRanks: Int32Array | null = null

  if (alignment === 'distribution') {
    // Record the rank (vertical position) of each series at each bin
    // Layout: seriesRanks[seriesIndex * renderBinCount + binIndex] = rank (0 = bottom, N-1 = top)
    seriesRanks = new Int32Array(series.length * renderBinCount)

    // Per-bin sorting to ensure biggest share is at the bottom
    const seriesIndices = new Int32Array(series.length)

    for (let s = 0; s < series.length; s++) {
      seriesIndices[s] = s
      const source = series[s]
      const isHighlighted = highlightMaskById?.get(source.id) ?? false
      const isDimmed = !!highlightMaskById && !isHighlighted
      const info = seriesPaint[s]
      info.color = isDimmed
        ? desaturateToWhite(source.color, 0.85)
        : source.color
      info.isDimmed = isDimmed
      info.id = source.id
      info.stripBottom = undefined
      info.stripHeight = undefined
      info.referenceHeight = undefined
      info.heatmapBinColors = undefined
    }

    for (let i = 0; i < renderBinCount; i++) {
      // Sort indices by value descending so biggest value is first (at the bottom of stack)
      seriesIndices.sort((a, b) => {
        const valA =
          i === 0 || i === renderBinCount - 1 ? 0 : series[a].values[i - 1]
        const valB =
          i === 0 || i === renderBinCount - 1 ? 0 : series[b].values[i - 1]
        return valB - valA
      })

      let currentStartVal = 0
      for (let sIdx = 0; sIdx < seriesIndices.length; sIdx++) {
        const s = seriesIndices[sIdx]
        const val =
          i === 0 || i === renderBinCount - 1
            ? 0
            : series[s].values[i - 1]

        // Store rank: sIdx is the visual stack index (0 is bottom)
        seriesRanks[s * renderBinCount + i] = sIdx

        const bucket = seriesBuckets[s]
        const endVal = currentStartVal + val
        bucket.topY[i] = yBase - endVal * scaleY
        bucket.bottomY[i] = yBase - currentStartVal * scaleY
        currentStartVal = endVal
      }
    }
  } else {
    // Original path for heatmap, ridgeline, and stream (stacked) alignments
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
      info.referenceHeight = undefined
      info.heatmapBinColors = undefined

      if (isHeatmap || isRidgeline) {
        const sTop = groupTop + s * overlapOffset
        const sBottom = sTop + stripHeight
        info.stripBottom = sBottom
        info.stripHeight = stripHeight

        if (isRidgeline && s === 0) {
          info.referenceHeight = ridgelineReferenceHeight
        }

        if (isHeatmap) {
          info.heatmapBinColors = bucket.heatmapColors
          for (let i = 0; i < renderBinCount; i++) {
            if (i === 0 || i === renderBinCount - 1) {
              bucket.heatmapColors[i] = 'transparent'
              bucket.topY[i] = sBottom
            } else {
              const raw = source.values[i - 1]
              const val = Math.max(0, Math.min(maxCellForHeat, raw))
              if (val <= 0) {
                // NODATA: let the plot-area gray background show through.
                bucket.heatmapColors[i] = 'transparent'
              } else {
                const scaledVal = (val / maxCellForHeat) * paletteStopCount
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
          // Ridgeline: pixels per native-unit value, computed so that the
          // overall max value occupies CONTENT_FILL of the strip height.
          const localScaleY =
            (ridgelineReferenceHeight * RIDGELINE_CONTENT_FILL) / maxCellForHeat
          for (let i = 0; i < renderBinCount; i++) {
            const val =
              i === 0 || i === renderBinCount - 1
                ? 0
                : source.values[i - 1]
            bucket.bottomY[i] = sBottom
            bucket.topY[i] = sBottom - val * localScaleY
          }
        }
      } else {
        // Stacked (Stream)
        for (let i = 0; i < renderBinCount; i++) {
          const startVal = cumulative[i]
          const val =
            i === 0 || i === renderBinCount - 1
              ? 0
              : source.values[i - 1]
          const endVal = startVal + val
          cumulative[i] = endVal
          bucket.topY[i] = yBase - endVal * scaleY
          bucket.bottomY[i] = yBase - startVal * scaleY
        }
      }
      seriesPaint[s] = info
    }
  }

  return {
    buckets,
    yAxisMin,
    yAxisMax,
    axisHalfRange,
    axisTicks,
    seriesPaint,
    seriesRanks,
  }
}
