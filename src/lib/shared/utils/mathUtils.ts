/**
 * Matrix and mathematical utility functions for data transformation
 * Optimized for performance while maintaining clarity
 */

/**
 * Formats a number to a specific number of decimal places
 * Uses a rounding behavior that rounds 0.5 and above up
 *
 * @param value The number to format
 * @param decimalPlaces Number of decimal places (default: 1)
 * @returns Formatted number
 */
export function formatDecimal(
  value: number,
  decimalPlaces: number = 1
): number {
  const factor = Math.pow(10, decimalPlaces)
  return Math.round(value * factor) / factor
}

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

/**
 * Checks if two arrays have the same elements (order doesn't matter)
 *
 * @param arr1 First array
 * @param arr2 Second array
 * @returns Boolean indicating if arrays have same elements
 */
export function arraysHaveSameElements<T>(
  arr1: readonly T[],
  arr2: readonly T[]
): boolean {
  if (arr1.length !== arr2.length) return false

  // For small arrays, sorting might be more efficient
  if (arr1.length <= 10) {
    // IMPORTANT: Use comparison function for numeric types to avoid string-sort bugs
    const sortedArr1 = [...arr1].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const sortedArr2 = [...arr2].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

    for (let i = 0; i < sortedArr1.length; i++) {
      if (sortedArr1[i] !== sortedArr2[i]) return false
    }

    return true
  }
  // For larger arrays, use a Map to avoid O(n²) comparison
  else {
    const countMap = new Map<T, number>()

    // Count occurrences in first array
    for (const item of arr1) {
      countMap.set(item, (countMap.get(item) || 0) + 1)
    }

    // Decrement counters for second array
    for (const item of arr2) {
      const count = countMap.get(item)
      if (count === undefined || count === 0) return false
      countMap.set(item, count - 1)
    }

    return true
  }
}
