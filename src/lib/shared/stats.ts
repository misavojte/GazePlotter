/**
 * Linear-interpolated percentile of an ASCENDING-sorted array (the standard
 * "linear"/R-7 method). Shared by the bar boxplot statistics and the
 * evolving-metrics overlay band. Callers guarantee `sorted.length >= 1`.
 *
 * @param sorted Values sorted ascending
 * @param p Percentile in [0, 1] (e.g. 0.25 for Q1)
 */
export function percentileSorted(
  sorted: readonly number[],
  p: number
): number {
  if (sorted.length === 1) return sorted[0]
  const index = p * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}
