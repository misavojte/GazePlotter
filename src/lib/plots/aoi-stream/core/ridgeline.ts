import type { AoiStreamPlotResult } from '../types'

import { RIDGELINE_SCALE } from '../const'

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
 * @param overlapOverride - Optional overlap factor override (0-1)
 */
export function calculateIdealStripHeight(
  data: AoiStreamPlotResult,
  plotAreaHeight: number,
  applyMinTopHeight = false, // Deprecated but kept for signature compatibility
  scaleOverride?: number
): number {
  if (!data.series || data.series.length === 0) return plotAreaHeight

  const scale = scaleOverride ?? RIDGELINE_SCALE
  const n = data.series.length

  // Calculate the max percentage value of the TOP series (index 0)
  // to minimalize its dedicated space.
  // The layout logic scales values by 0.9 within the strip height.
  // So effective height factor mTop = (maxVal / 100) * 0.9
  let mTop = 1.0

  if (n > 0) {
    const topSeries = data.series[0]
    const percentFactor = data.participants > 0 ? 100 / data.participants : 0
    let maxVal = 0
    for (const v of topSeries.values) {
      const val = v * percentFactor
      if (val > maxVal) maxVal = val
    }
    mTop = (maxVal / 100) * 0.9

    // If applyMinTopHeight is true (local rendering), prevent collapse
    // sync logic might allow collapse if other plots need space
    if (applyMinTopHeight) {
      // Ensure at least 20% of a strip height is visible for labels/visuals
      // or effectively the scale equivalent
      mTop = Math.max(mTop, 0.2)
    }
  }

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
