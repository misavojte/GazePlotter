import type { AoiStreamPlotResult } from '../types'

import { RIDGELINE_CONTENT_FILL, RIDGELINE_SCALE } from '../const'

/**
 * Calculate the strip height that exactly fills the plot area with n strips
 * at the given scale, assuming no overhead from data peaks.
 *
 * h * (n - 1 + scale) / scale = plotHeight  →  h = plotHeight * scale / (n - 1 + scale)
 */
export function calculateFilledRidgelineStripHeight(
  plotHeight: number,
  seriesCount: number,
  scale: number
): number {
  if (seriesCount <= 0) return plotHeight
  return (plotHeight * scale) / (seriesCount - 1 + scale)
}

/**
 * Calculate the reference height (used for Y-axis scale display) that positions
 * the highest visible data peak at the boundary of the available space.
 *
 * When overlap is active (scale > 1 and allowOverlap), the bottom ridge can
 * extend its peak all the way to plotTop, so the available height is plotHeight.
 * When there is no overlap (scale = 1), the peak is bounded by the filled strip height.
 */
export function calculateMaxReferenceHeight(
  data: AoiStreamPlotResult,
  plotHeight: number,
  scale: number,
  allowOverlap: boolean
): number {
  const n = data.series.length
  if (n === 0) return plotHeight

  const filledStripHeight = calculateFilledRidgelineStripHeight(
    plotHeight,
    n,
    scale
  )
  const availableHeight =
    allowOverlap && scale > 1 ? plotHeight : filledStripHeight

  // Find the max peak percentage of the bottom series (last = outermost ridge)
  const percentFactor = data.participants > 0 ? 100 / data.participants : 0
  const bottomSeries = data.series[n - 1]
  let maxPeak = 0
  for (const v of bottomSeries.values) {
    const pct = v * percentFactor
    if (pct > maxPeak) maxPeak = pct
  }

  if (maxPeak <= 0) return filledStripHeight

  // referenceHeight s.t. maxPeak% * CONTENT_FILL / 100 * referenceHeight = availableHeight
  return (availableHeight * 100) / (maxPeak * RIDGELINE_CONTENT_FILL)
}

/**
 * Compute the mTop factor for a given stream data set.
 * mTop represents the fractional height that the top (front) series' peak
 * occupies relative to a full strip, accounting for the content fill factor.
 *
 * @param data - The stream plot data
 * @param applyMinTopHeight - If true, enforce a minimum mTop (for local rendering)
 */
export function computeMTop(
  data: AoiStreamPlotResult,
  applyMinTopHeight = false
): number {
  const n = data.series.length
  if (n === 0) return 1.0

  const topSeries = data.series[0]
  const percentFactor = data.participants > 0 ? 100 / data.participants : 0
  let maxVal = 0
  for (const v of topSeries.values) {
    const val = v * percentFactor
    if (val > maxVal) maxVal = val
  }

  let mTop = (maxVal / 100) * RIDGELINE_CONTENT_FILL

  if (applyMinTopHeight) {
    mTop = Math.max(mTop, 0.2)
  }

  return mTop
}

/**
 * Calculate the ideal strip height for a single ridgeline plot configuration.
 * Optimizes for "zero redundancy space" by finding the maximum possible strip height
 * that fits ALL series within the plot area without clipping.
 *
 * Considers the specific geometry of each series based on its stack order and overlap.
 *
 * @param data - The stream plot data
 * @param plotAreaHeight - Height of the plot area in pixels
 * @param applyMinTopHeight - If true, enforce minimum height for top ridge (for local rendering)
 * @param scaleOverride - Optional ridgeline scale override
 * @param mTopOverride - Optional mTop override (from sync, to ensure consistent scale)
 */
export function calculateIdealStripHeight(
  data: AoiStreamPlotResult,
  plotAreaHeight: number,
  applyMinTopHeight = false,
  scaleOverride?: number,
  mTopOverride?: number
): number {
  if (!data.series || data.series.length === 0) return plotAreaHeight

  const scale = scaleOverride ?? RIDGELINE_SCALE
  const n = data.series.length

  const mTop = mTopOverride ?? computeMTop(data, applyMinTopHeight)

  // Optimized geometric formula:
  // H = (N-1) * S + h_top
  // h_top = mTop * h
  // S = h / scale
  // H = (N-1)(h/scale) + mTop*h
  // H = h * [ (N-1)/scale + mTop ]
  // h = H / [ (N-1)/scale + mTop ]
  // h = H * scale / [ (N-1) + mTop * scale ]

  const idealHeight = (plotAreaHeight * scale) / (n - 1 + mTop * scale)

  return idealHeight
}
