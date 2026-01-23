import type { AoiStreamPlotResult } from '../types'

import { RIDGELINE_OVERLAP } from '../const'

/**
 * Calculate the max constraint factor for a ridgeline plot.
 * This factor represents the total vertical space (in units of stripHeight)
 * required to fit all series without clipping.
 *
 * @param data - The stream plot data
 * @param applyMinTopHeight - If true, enforce a minimum height for the top ridge
 */
function calculateMaxConstraintFactor(
  data: AoiStreamPlotResult,
  applyMinTopHeight = false
): number {
  if (!data.series || data.series.length === 0) return 0

  const n = data.series.length
  const percentFactor = data.participants > 0 ? 100 / data.participants : 0
  let maxConstraintFactor = 0

  // Iterate over ALL series to find the binding constraint
  for (let s = 0; s < data.series.length; s++) {
    const series = data.series[s]
    const values = series.values
    const binCount = data.binCount

    // Find peak value for this series (0-100)
    let maxVal = 0
    for (let i = 0; i < binCount; i++) {
      const v = values[i] * percentFactor
      if (v > maxVal) maxVal = v
    }

    // Geometric factor:
    // (N - 1 - s) * (1 - OVERLAP)  -> Static vertical offset due to stacking
    // (maxVal * 0.9) / 100         -> Dynamic height of the data itself
    const geometricOffset = (n - 1 - s) * (1 - RIDGELINE_OVERLAP)
    let dataHeight = (maxVal * 0.9) / 100

    // Enforce minimum height for the top ridge (s=0) to prevent it from being crushed
    // Only apply when rendering locally, NOT during sync calculations
    if (applyMinTopHeight && s === 0) {
      const minTopHeight = (1 - RIDGELINE_OVERLAP) * 0.5
      if (dataHeight < minTopHeight) {
        dataHeight = minTopHeight
      }
    }

    const totalFactor = geometricOffset + dataHeight

    if (totalFactor > maxConstraintFactor) {
      maxConstraintFactor = totalFactor
    }
  }

  return maxConstraintFactor
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
 */
export function calculateIdealStripHeight(
  data: AoiStreamPlotResult,
  plotAreaHeight: number,
  applyMinTopHeight = false
): number {
  if (!data.series || data.series.length === 0) return plotAreaHeight

  const n = data.series.length
  const maxFactor = calculateMaxConstraintFactor(data, applyMinTopHeight)

  // Standard minimum density (if all series were maxed out at 100%)
  const standardDenom = n - (n - 1) * RIDGELINE_OVERLAP
  const standardHeight = plotAreaHeight / standardDenom

  if (maxFactor <= 1e-4) return standardHeight * 10

  const idealHeight = plotAreaHeight / maxFactor
  const finalHeight = Math.min(idealHeight, standardHeight * 10)

  // Cap at a reasonable max multiplier to prevent explosions on flat lines,
  // but allow it to be smaller than standardHeight if needed to prevent clipping.
  return finalHeight
}
